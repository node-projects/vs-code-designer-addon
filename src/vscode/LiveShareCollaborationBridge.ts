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

	constructor(private readonly context: vscode.ExtensionContext) { }

	async getDocumentId(uri: vscode.Uri): Promise<string> {
		const liveShare = await this.getLiveShare();
		if (liveShare?.session?.role === vsls.Role.Host && uri.scheme === 'file') {
			try {
				return liveShare.convertLocalUriToShared(uri).toString();
			} catch {
				return uri.toString();
			}
		}

		return uri.toString();
	}

	registerWebview(documentId: string, webviewPanel: vscode.WebviewPanel): vscode.Disposable {
		this.webviews.set(webviewPanel.webview, { documentId, webview: webviewPanel.webview });
		void this.ensureLiveShareReady().then(() => this.postStatus(webviewPanel.webview, documentId));

		const disposable = new vscode.Disposable(() => {
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
		if (this.liveShare) {
			this.disposables.push(this.liveShare.onDidChangeSession(() => {
				this.sharedService = null;
				this.sharedServiceProxy = null;
				void this.ensureLiveShareReady().then(() => this.postStatusToAll());
			}));
			this.disposables.push(this.liveShare.onDidChangePeers(() => this.postStatusToAll()));
		}
		return this.liveShare;
	}

	private async ensureLiveShareReady(): Promise<void> {
		const liveShare = await this.getLiveShare();
		if (!liveShare?.session?.id)
			return;

		if (liveShare.session.role === vsls.Role.Host && !this.sharedService) {
			this.sharedService = await liveShare.shareService(serviceName);
			this.sharedService?.onNotify(notificationName, args => this.receiveFromLiveShare(args as CollaborationEnvelope));
			this.sharedService?.onRequest(snapshotRequestName, async args => {
				const documentId = String(args?.[0] ?? '');
				return this.getLocalSnapshot(documentId);
			});
		} else if (liveShare.session.role === vsls.Role.Guest && !this.sharedServiceProxy) {
			this.sharedServiceProxy = await liveShare.getSharedService(serviceName);
			this.sharedServiceProxy?.onNotify(notificationName, args => this.receiveFromLiveShare(args as CollaborationEnvelope));
			this.sharedServiceProxy?.onDidChangeIsServiceAvailable(() => this.postStatusToAll());
		}
	}

	private async sendCollaborationMessage(documentId: string, payload: unknown): Promise<void> {
		await this.ensureLiveShareReady();
		const liveShare = await this.getLiveShare();
		const session = liveShare?.session;
		const peerId = this.getPeerId(session);
		if (!session?.id || !peerId)
			return;

		const envelope: CollaborationEnvelope = {
			id: `${Date.now()}:${Math.random().toString(36).slice(2)}`,
			documentId,
			sessionId: session.id,
			fromPeerId: peerId,
			payload
		};

		if (session.role === vsls.Role.Host)
			this.sharedService?.notify(notificationName, envelope);
		else if (session.role === vsls.Role.Guest)
			this.sharedServiceProxy?.notify(notificationName, envelope);
	}

	private receiveFromLiveShare(envelope: CollaborationEnvelope): void {
		if (!this.isEnvelopeForCurrentSession(envelope))
			return;

		const session = this.liveShare?.session;
		const peerId = this.getPeerId(session);
		if (peerId && envelope.fromPeerId === peerId)
			return;

		if (session?.role === vsls.Role.Host)
			this.sharedService?.notify(notificationName, envelope);

		for (const registered of this.webviews.values()) {
			if (registered.documentId === envelope.documentId)
				void registered.webview.postMessage({ type: 'collaboration:message', envelope });
		}
	}

	private async requestRemoteSnapshot(documentId: string, webview: vscode.Webview): Promise<void> {
		await this.ensureLiveShareReady();
		const liveShare = await this.getLiveShare();
		if (liveShare?.session?.role !== vsls.Role.Guest || !this.sharedServiceProxy?.isServiceAvailable)
			return;

		try {
			const snapshot = await this.sharedServiceProxy.request(snapshotRequestName, [documentId]);
			await webview.postMessage({ type: 'collaboration:applySnapshot', snapshot });
		} catch {
			// Snapshot bootstrap is opportunistic; regular Live Share file sync and later
			// collaboration changes still keep the designer usable.
		}
	}

	private getLocalSnapshot(documentId: string): Promise<unknown> {
		const registered = [...this.webviews.values()].find(x => x.documentId === documentId);
		if (!registered)
			return Promise.resolve(null);

		const requestId = `${documentId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
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
		if (!pending || !requestId.startsWith(`${documentId}:`))
			return;

		clearTimeout(pending.timeout);
		this.pendingSnapshotRequests.delete(requestId);
		pending.resolve(snapshot);
	}

	private postStatusToAll(): void {
		for (const registered of this.webviews.values())
			this.postStatus(registered.webview, registered.documentId);
	}

	private postStatus(webview: vscode.Webview, documentId: string): void {
		const session = this.liveShare?.session;
		const peerId = this.getPeerId(session);
		void webview.postMessage({
			type: 'collaboration:status',
			documentId,
			available: !!session?.id && !!peerId && (session.role === vsls.Role.Host || this.sharedServiceProxy?.isServiceAvailable),
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
}
