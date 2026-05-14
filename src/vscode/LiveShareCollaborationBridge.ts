import * as vscode from 'vscode';
import * as vsls from 'vsls/vscode';

const serviceName = 'webComponentDesignerCollaboration';
const notificationName = 'designer-collaboration-message';
const snapshotRequestName = 'designer-collaboration-snapshot';
const snapshotTimeout = 5000;

type CollaborationEnvelope = {
	id: string;
	documentId: string;
	sessionId: string;
	fromPeerId: string;
	payload: unknown;
};

type RegisteredWebview = {
	documentId: string;
	webview: vscode.Webview;
};

type PendingSnapshotRequest = {
	resolve: (snapshot: unknown) => void;
	reject: (error: Error) => void;
	timeout: NodeJS.Timeout;
};

export class LiveShareCollaborationBridge implements vscode.Disposable {
	private readonly webviews = new Map<vscode.Webview, RegisteredWebview>();
	private readonly pendingSnapshotRequests = new Map<string, PendingSnapshotRequest>();
	private liveShare: vsls.LiveShare | null | undefined;
	private sharedService: vsls.SharedService | null = null;
	private sharedServiceProxy: vsls.SharedServiceProxy | null = null;
	private readonly disposables: vscode.Disposable[] = [];
	private readonly outputChannel = vscode.window.createOutputChannel('Designer Collaboration');

	constructor(private readonly context: vscode.ExtensionContext) {
		this.disposables.push(this.outputChannel);
		this.log('Live Share collaboration bridge created.');
	}

	showOutput(): void {
		this.outputChannel.show();
	}

	async getDocumentId(uri: vscode.Uri): Promise<string> {
		const liveShare = await this.getLiveShare();
		if (liveShare?.session?.role === vsls.Role.Host && uri.scheme === 'file') {
			try {
				const documentId = liveShare.convertLocalUriToShared(uri).toString();
				this.log(`Mapped host document URI to shared URI. local=${uri.toString()} shared=${documentId}`);
				return documentId;
			} catch {
				this.log(`Could not convert host document URI to shared URI. Falling back to local URI. uri=${uri.toString()}`);
				return uri.toString();
			}
		}

		this.log(`Using document URI as collaboration id. role=${this.getRoleName(liveShare?.session?.role)} uri=${uri.toString()}`);
		return uri.toString();
	}

	registerWebview(documentId: string, webviewPanel: vscode.WebviewPanel): vscode.Disposable {
		this.webviews.set(webviewPanel.webview, { documentId, webview: webviewPanel.webview });
		this.log(`Registered designer webview. documentId=${documentId}`);
		void this.ensureLiveShareReady().then(() => this.postStatus(webviewPanel.webview, documentId));

		const disposable = new vscode.Disposable(() => {
			this.log(`Disposed designer webview. documentId=${documentId}`);
			this.webviews.delete(webviewPanel.webview);
			for (const [requestId, pending] of this.pendingSnapshotRequests) {
				if (requestId.startsWith(`${documentId}:`)) {
					clearTimeout(pending.timeout);
					pending.reject(new Error('Designer webview closed before it returned a collaboration snapshot.'));
					this.pendingSnapshotRequests.delete(requestId);
				}
			}
		});
		this.disposables.push(disposable);
		return disposable;
	}

	handleWebviewMessage(webview: vscode.Webview, message: any): boolean {
		if (!message?.type?.startsWith?.('collaboration:'))
			return false;

		const registered = this.webviews.get(webview);
		if (!registered)
			return true;

		this.log(`Received webview message. type=${message.type} documentId=${registered.documentId}`);
		switch (message.type) {
			case 'collaboration:ready':
			case 'collaboration:requestStatus':
				void this.ensureLiveShareReady().then(() => this.postStatus(webview, registered.documentId));
				return true;
			case 'collaboration:message':
				void this.sendCollaborationMessage(registered.documentId, message.payload);
				return true;
			case 'collaboration:requestSnapshot':
				void this.requestRemoteSnapshot(registered.documentId, webview);
				return true;
			case 'collaboration:snapshotResponse':
				this.completeSnapshotRequest(registered.documentId, message.requestId, message.snapshot);
				return true;
			default:
				return true;
		}
	}

	dispose(): void {
		for (const pending of this.pendingSnapshotRequests.values()) {
			clearTimeout(pending.timeout);
			pending.reject(new Error('Live Share collaboration bridge disposed.'));
		}
		this.pendingSnapshotRequests.clear();
		this.webviews.clear();
		for (const disposable of this.disposables)
			disposable.dispose();
		this.disposables.length = 0;
	}

	private async getLiveShare(): Promise<vsls.LiveShare | null> {
		if (this.liveShare !== undefined)
			return this.liveShare;

		this.liveShare = await vsls.getApi(this.context.extension.id);
		this.log(this.liveShare
			? `Live Share API acquired. sessionId=${this.liveShare.session?.id ?? 'none'} role=${this.getRoleName(this.liveShare.session?.role)} peer=${this.getPeerId(this.liveShare.session) ?? 'none'}`
			: 'Live Share API unavailable. Is the Live Share extension installed and active?');
		if (this.liveShare) {
			this.disposables.push(this.liveShare.onDidChangeSession(() => {
				this.log(`Live Share session changed. sessionId=${this.liveShare?.session?.id ?? 'none'} role=${this.getRoleName(this.liveShare?.session?.role)} peer=${this.getPeerId(this.liveShare?.session) ?? 'none'}`);
				this.sharedService = null;
				this.sharedServiceProxy = null;
				void this.ensureLiveShareReady().then(() => this.postStatusToAll());
			}));
			this.disposables.push(this.liveShare.onDidChangePeers(event => {
				this.log(`Live Share peers changed. added=${event.added.length} removed=${event.removed.length} total=${this.liveShare?.peers?.length ?? 0}`);
				this.postStatusToAll();
			}));
		}
		return this.liveShare;
	}

	private async ensureLiveShareReady(): Promise<void> {
		const liveShare = await this.getLiveShare();
		if (!liveShare?.session?.id) {
			this.log('Live Share session is not active yet.');
			return;
		}

		if (liveShare.session.role === vsls.Role.Host && !this.sharedService) {
			this.log(`Sharing Live Share service "${serviceName}".`);
			this.sharedService = await liveShare.shareService(serviceName);
			this.log(this.sharedService
				? `Shared service ready. available=${this.sharedService.isServiceAvailable}`
				: 'Live Share refused shareService; collaboration RPC is unavailable.');
			this.sharedService?.onNotify(notificationName, args => this.receiveFromLiveShare(args as CollaborationEnvelope));
			this.sharedService?.onRequest(snapshotRequestName, async args => {
				const documentId = String(args?.[0] ?? '');
				this.log(`Received remote snapshot request. documentId=${documentId}`);
				return this.getLocalSnapshot(documentId);
			});
		} else if (liveShare.session.role === vsls.Role.Guest && !this.sharedServiceProxy) {
			this.log(`Requesting Live Share shared service proxy "${serviceName}".`);
			this.sharedServiceProxy = await liveShare.getSharedService(serviceName);
			this.log(this.sharedServiceProxy
				? `Shared service proxy ready. available=${this.sharedServiceProxy.isServiceAvailable}`
				: 'Live Share refused getSharedService; collaboration RPC is unavailable.');
			this.sharedServiceProxy?.onNotify(notificationName, args => this.receiveFromLiveShare(args as CollaborationEnvelope));
			this.sharedServiceProxy?.onDidChangeIsServiceAvailable(available => {
				this.log(`Shared service proxy availability changed. available=${available}`);
				this.postStatusToAll();
			});
		}
	}

	private async sendCollaborationMessage(documentId: string, payload: unknown): Promise<void> {
		await this.ensureLiveShareReady();
		const liveShare = await this.getLiveShare();
		const session = liveShare?.session;
		const peerId = this.getPeerId(session);
		if (!session?.id || !peerId) {
			this.log(`Cannot send collaboration message; no active session/peer. documentId=${documentId}`);
			return;
		}

		const envelope: CollaborationEnvelope = {
			id: `${Date.now()}:${Math.random().toString(36).slice(2)}`,
			documentId,
			sessionId: session.id,
			fromPeerId: peerId,
			payload
		};

		this.log(`Sending collaboration envelope. role=${this.getRoleName(session.role)} documentId=${documentId} payloadType=${this.getPayloadType(payload)}`);
		if (session.role === vsls.Role.Host)
			this.sharedService?.notify(notificationName, envelope);
		else if (session.role === vsls.Role.Guest)
			this.sharedServiceProxy?.notify(notificationName, envelope);
	}

	private receiveFromLiveShare(envelope: CollaborationEnvelope): void {
		if (!this.isEnvelopeForCurrentSession(envelope)) {
			this.log(`Ignored Live Share envelope for another session or malformed payload. documentId=${envelope?.documentId ?? 'unknown'} sessionId=${envelope?.sessionId ?? 'unknown'}`);
			return;
		}

		const session = this.liveShare?.session;
		const peerId = this.getPeerId(session);
		if (peerId && envelope.fromPeerId === peerId) {
			this.log(`Ignored self-originated Live Share envelope. documentId=${envelope.documentId}`);
			return;
		}

		this.log(`Received Live Share envelope. role=${this.getRoleName(session?.role)} documentId=${envelope.documentId} from=${envelope.fromPeerId} payloadType=${this.getPayloadType(envelope.payload)}`);
		if (session?.role === vsls.Role.Host)
			this.sharedService?.notify(notificationName, envelope);

		let delivered = 0;
		for (const registered of this.webviews.values()) {
			if (registered.documentId === envelope.documentId) {
				delivered++;
				void registered.webview.postMessage({ type: 'collaboration:message', envelope });
			}
		}
		this.log(`Delivered Live Share envelope to webviews. count=${delivered} documentId=${envelope.documentId}`);
	}

	private async requestRemoteSnapshot(documentId: string, webview: vscode.Webview): Promise<void> {
		await this.ensureLiveShareReady();
		const liveShare = await this.getLiveShare();
		if (liveShare?.session?.role !== vsls.Role.Guest || !this.sharedServiceProxy?.isServiceAvailable) {
			this.log(`Skipped remote snapshot request. role=${this.getRoleName(liveShare?.session?.role)} proxyAvailable=${this.sharedServiceProxy?.isServiceAvailable ?? false} documentId=${documentId}`);
			return;
		}

		try {
			this.log(`Requesting host snapshot. documentId=${documentId}`);
			const snapshot = await this.sharedServiceProxy.request(snapshotRequestName, [documentId]);
			this.log(`Received host snapshot response. documentId=${documentId} hasSnapshot=${!!snapshot}`);
			await webview.postMessage({ type: 'collaboration:applySnapshot', snapshot });
		} catch {
			this.log(`Host snapshot request failed. documentId=${documentId}`);
			// Snapshot bootstrap is opportunistic; regular Live Share file sync and later
			// collaboration changes still keep the designer usable.
		}
	}

	private getLocalSnapshot(documentId: string): Promise<unknown> {
		const registered = [...this.webviews.values()].find(x => x.documentId === documentId);
		if (!registered) {
			this.log(`No local webview found for snapshot request. documentId=${documentId}`);
			return Promise.resolve(null);
		}

		const requestId = `${documentId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
		this.log(`Requesting local webview snapshot. documentId=${documentId} requestId=${requestId}`);
		void registered.webview.postMessage({ type: 'collaboration:requestSnapshot', requestId });
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pendingSnapshotRequests.delete(requestId);
				reject(new Error('Timed out waiting for designer collaboration snapshot.'));
			}, snapshotTimeout);
			this.pendingSnapshotRequests.set(requestId, { resolve, reject, timeout });
		});
	}

	private completeSnapshotRequest(documentId: string, requestId: string, snapshot: unknown): void {
		const pending = this.pendingSnapshotRequests.get(requestId);
		if (!pending || !requestId.startsWith(`${documentId}:`)) {
			this.log(`Ignored unknown snapshot response. documentId=${documentId} requestId=${requestId}`);
			return;
		}

		clearTimeout(pending.timeout);
		this.pendingSnapshotRequests.delete(requestId);
		this.log(`Completed local snapshot request. documentId=${documentId} requestId=${requestId} hasSnapshot=${!!snapshot}`);
		pending.resolve(snapshot);
	}

	private postStatusToAll(): void {
		for (const registered of this.webviews.values())
			this.postStatus(registered.webview, registered.documentId);
	}

	private postStatus(webview: vscode.Webview, documentId: string): void {
		const session = this.liveShare?.session;
		const peerId = this.getPeerId(session);
		const available = !!session?.id && !!peerId && (session.role === vsls.Role.Host || this.sharedServiceProxy?.isServiceAvailable);
		this.log(`Posting collaboration status to webview. available=${available} role=${this.getRoleName(session?.role)} sessionId=${session?.id ?? 'none'} peer=${peerId ?? 'none'} documentId=${documentId}`);
		void webview.postMessage({
			type: 'collaboration:status',
			documentId,
			available,
			sessionId: session?.id,
			peerId,
			displayName: session?.user?.displayName ?? (peerId ? `peer-${session?.peerNumber}` : undefined),
			role: session?.role === vsls.Role.Host ? 'host' : session?.role === vsls.Role.Guest ? 'guest' : 'none'
		});
	}

	private getPeerId(session: vsls.Session | null | undefined): string | undefined {
		if (!session?.id)
			return undefined;
		return session.user?.id ?? `${session.id}:peer:${session.peerNumber}`;
	}

	private isEnvelopeForCurrentSession(envelope: CollaborationEnvelope): boolean {
		return !!envelope
			&& typeof envelope.documentId === 'string'
			&& envelope.sessionId === this.liveShare?.session?.id
			&& typeof envelope.fromPeerId === 'string';
	}

	private getRoleName(role: vsls.Role | undefined): string {
		return role === vsls.Role.Host ? 'host' : role === vsls.Role.Guest ? 'guest' : 'none';
	}

	private getPayloadType(payload: unknown): string {
		if (payload && typeof payload === 'object' && 'type' in payload)
			return String((payload as { type?: unknown }).type ?? 'unknown');
		return 'unknown';
	}

	private log(message: string): void {
		this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
	}
}
