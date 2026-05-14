import {
    ICollaborationCommentsChangedEvent,
    ICollaborationDocumentSnapshot,
    ICollaborationPeerPresence,
    ICollaborationRemoteChange,
    ICollaborationSelectionEvent,
    ICollaborationService,
    ICollaborationSession,
    ICollaborationTransport
} from '@node-projects/web-component-designer';

type CollaborationPayload =
    | { type: 'change'; change: ICollaborationRemoteChange; snapshot: ICollaborationDocumentSnapshot; }
    | { type: 'selection'; selection: ICollaborationSelectionEvent; }
    | { type: 'presence'; peer: ICollaborationPeerPresence; }
    | { type: 'comment-upsert'; comment: NonNullable<ICollaborationCommentsChangedEvent['comment']>; }
    | { type: 'comment-remove'; commentId: string; };

type CollaborationEnvelope = {
    documentId: string;
    sessionId: string;
    fromPeerId: string;
    payload: CollaborationPayload;
};

type VsCodeApi = ReturnType<typeof acquireVsCodeApi>;

export class VsCodeLiveShareCollaborationTransport implements ICollaborationTransport {
    private _service: ICollaborationService | null = null;
    private _session: ICollaborationSession | null = null;

    constructor(private readonly _vscode: VsCodeApi, private readonly _documentId: string) {
        this._vscode.postMessage({ type: 'collaboration:ready', documentId: this._documentId });
    }

    attach(service: ICollaborationService): void {
        this._service = service;
    }

    detach(): void {
        this._service = null;
    }

    connect(session: ICollaborationSession): void {
        this._session = session;
        this._vscode.postMessage({ type: 'collaboration:requestSnapshot', documentId: this._documentId });
    }

    disconnect(): void {
        this._session = null;
    }

    sendChange(change: ICollaborationRemoteChange, snapshot: ICollaborationDocumentSnapshot): void {
        this.sendPayload({ type: 'change', change, snapshot });
    }

    sendSelection(selection: ICollaborationSelectionEvent): void {
        this.sendPayload({ type: 'selection', selection });
    }

    sendPresence(peer: ICollaborationPeerPresence): void {
        this.sendPayload({ type: 'presence', peer });
    }

    sendComment(change: ICollaborationCommentsChangedEvent): void {
        if (change.comment)
            this.sendPayload({ type: 'comment-upsert', comment: change.comment });
        else if (change.commentId)
            this.sendPayload({ type: 'comment-remove', commentId: change.commentId });
    }

    handleStatus(message: { available?: boolean; sessionId?: string; peerId?: string; displayName?: string; documentId?: string; }): void {
        if (message.documentId !== this._documentId)
            return;

        if (!message.available || !message.sessionId || !message.peerId) {
            if (this._service?.state !== 'disconnected')
                this._service?.disconnect();
            return;
        }

        if (this._service?.state === 'connected'
            && this._service.session.sessionId === message.sessionId
            && this._service.session.peerId === message.peerId)
            return;

        this._service?.connect(message.sessionId, message.peerId, message.displayName);
    }

    async handleEnvelope(envelope: CollaborationEnvelope): Promise<void> {
        if (!this._service || envelope.documentId !== this._documentId)
            return;

        if (this._session?.peerId && envelope.fromPeerId === this._session.peerId)
            return;

        const payload = envelope.payload;
        switch (payload.type) {
            case 'change':
                await this._service.applyRemoteChange(payload.change, payload.snapshot);
                break;
            case 'selection':
                this._service.updateRemoteSelection(payload.selection.peerId, payload.selection.selectedNodeIndexes, payload.selection.primaryNodeIndex);
                break;
            case 'presence':
                this._service.updatePeerPresence(payload.peer, 'remote');
                break;
            case 'comment-upsert':
                this._service.upsertComment(payload.comment, 'remote');
                break;
            case 'comment-remove':
                this._service.removeComment(payload.commentId, 'remote');
                break;
        }
    }

    async applySnapshot(snapshot: ICollaborationDocumentSnapshot | null | undefined): Promise<void> {
        if (snapshot)
            await this._service?.applyRemoteSnapshot(snapshot);
    }

    createSnapshot(): ICollaborationDocumentSnapshot | null {
        return this._service?.createSnapshot() ?? null;
    }

    private sendPayload(payload: CollaborationPayload): void {
        if (!this._session)
            return;

        this._vscode.postMessage({
            type: 'collaboration:message',
            documentId: this._documentId,
            payload
        });
    }
}
