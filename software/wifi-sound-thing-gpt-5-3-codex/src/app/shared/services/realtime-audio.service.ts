import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

type RuntimeRole = 'idle' | 'host' | 'client' | 'observer';
type HostState = 'idle' | 'starting' | 'streaming' | 'error';
type ClientState = 'idle' | 'connecting' | 'syncing' | 'connected' | 'error';

export type CaptureSource = 'display' | 'microphone';

export interface DiscoveredHostSession {
  id: string;
  roomId: string;
  name: string;
  address: string | null;
  transport: string;
  updatedAt: Date;
}

export interface HostSessionStatus {
  state: HostState;
  peerCount: number;
  bitrateKbps: number | null;
  message: string;
  error: string | null;
}

export interface ClientSessionStatus {
  state: ClientState;
  hostId: string | null;
  latencyMs: number | null;
  jitterMs: number | null;
  bitrateKbps: number | null;
  lastSyncAt: Date | null;
  message: string;
  error: string | null;
}

export interface StartHostOptions {
  signalingUrl: string;
  roomId: string;
  name: string;
  source: CaptureSource;
  address: string | null;
}

export interface ConnectClientOptions {
  signalingUrl: string;
  roomId: string;
  hostId: string;
  name: string;
}

interface SignalHostEntry {
  id: string;
  roomId: string;
  name: string;
  address: string | null;
  transport: string;
  updatedAt: number;
}

interface SignalEnvelope {
  type: string;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class RealtimeAudioService {
  private readonly discoveredHostsSubject = new BehaviorSubject<
    DiscoveredHostSession[]
  >([]);
  readonly discoveredHosts$ = this.discoveredHostsSubject.asObservable();

  private readonly hostStatusSubject = new BehaviorSubject<HostSessionStatus>({
    state: 'idle',
    peerCount: 0,
    bitrateKbps: null,
    message: 'Host idle.',
    error: null,
  });
  readonly hostStatus$ = this.hostStatusSubject.asObservable();

  private readonly clientStatusSubject = new BehaviorSubject<ClientSessionStatus>(
    {
      state: 'idle',
      hostId: null,
      latencyMs: null,
      jitterMs: null,
      bitrateKbps: null,
      lastSyncAt: null,
      message: 'Client idle.',
      error: null,
    }
  );
  readonly clientStatus$ = this.clientStatusSubject.asObservable();

  private signalingSocket: WebSocket | null = null;
  private signalingUrl: string | null = null;
  private role: RuntimeRole = 'idle';
  private clientId: string | null = null;
  private roomId: string | null = null;
  private hostId: string | null = null;

  private localStream: MediaStream | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private clientPeerConnection: RTCPeerConnection | null = null;
  private readonly hostPeerConnections = new Map<string, RTCPeerConnection>();
  private readonly hostDataChannels = new Map<string, RTCDataChannel>();

  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private hostSyncTimer: ReturnType<typeof setInterval> | null = null;
  private clientSyncTimeout: ReturnType<typeof setTimeout> | null = null;

  private lastInboundBytes = 0;
  private lastInboundReadAtMs = 0;
  private clockOffsetSamples: number[] = [];

  async startDiscovery(signalingUrl: string): Promise<void> {
    if (this.role === 'host' || this.role === 'client') {
      return;
    }
    await this.ensureSignaling(signalingUrl);
    this.role = 'observer';
    this.roomId = null;
    this.hostId = null;
    this.sendSignal({
      type: 'hello',
      role: 'observer',
      name: 'observer',
      roomId: 'default-room',
    });
    this.sendSignal({ type: 'hosts-request' });
  }

  async startHost(options: StartHostOptions): Promise<void> {
    await this.stop();
    this.role = 'host';
    this.roomId = normalizeValue(options.roomId, 'default-room');

    this.hostStatusSubject.next({
      state: 'starting',
      peerCount: 0,
      bitrateKbps: null,
      message: 'Requesting audio capture permission...',
      error: null,
    });

    this.localStream = await this.captureHostAudio(options.source);
    await this.ensureSignaling(options.signalingUrl);

    this.sendSignal({
      type: 'hello',
      role: 'host',
      roomId: this.roomId,
      name: normalizeValue(options.name, 'Host'),
      address: options.address,
    });
    this.sendSignal({ type: 'hosts-request' });
    this.startHostSyncTimer();
    this.updateHostState({
      state: 'streaming',
      message: `Broadcasting in room "${this.roomId}". Waiting for clients...`,
      error: null,
    });
  }

  async connectClient(options: ConnectClientOptions): Promise<void> {
    await this.stop();
    this.role = 'client';
    this.roomId = normalizeValue(options.roomId, 'default-room');
    this.hostId = options.hostId;
    this.resetClientStatsWindow();
    this.clientStatusSubject.next({
      state: 'connecting',
      hostId: options.hostId,
      latencyMs: null,
      jitterMs: null,
      bitrateKbps: null,
      lastSyncAt: null,
      message: 'Connecting to host...',
      error: null,
    });

    await this.ensureSignaling(options.signalingUrl);

    this.sendSignal({
      type: 'hello',
      role: 'client',
      roomId: this.roomId,
      name: normalizeValue(options.name, 'Client'),
      targetHostId: options.hostId,
    });
    this.sendSignal({ type: 'hosts-request' });
  }

  refreshHosts(): void {
    this.sendSignal({ type: 'hosts-request' });
  }

  stopDiscovery(): void {
    if (this.role !== 'observer') {
      return;
    }
    this.role = 'idle';
    this.closeSignalingSocket();
  }

  updateHostMetadata(name: string, roomId: string, address: string | null): void {
    if (this.role !== 'host') {
      return;
    }
    const nextRoomId = normalizeValue(roomId, 'default-room');
    this.roomId = nextRoomId;
    this.sendSignal({
      type: 'host-meta-update',
      name: normalizeValue(name, 'Host'),
      roomId: nextRoomId,
      address,
    });
  }

  async stop(): Promise<void> {
    this.stopTimers();
    this.closeAllHostPeerConnections();
    this.closeClientPeerConnection();
    this.stopLocalStream();
    this.releaseRemoteAudio();
    this.role = 'idle';
    this.clientId = null;
    this.roomId = null;
    this.hostId = null;
    this.clockOffsetSamples = [];
    this.closeSignalingSocket();

    this.hostStatusSubject.next({
      state: 'idle',
      peerCount: 0,
      bitrateKbps: null,
      message: 'Host idle.',
      error: null,
    });
    this.clientStatusSubject.next({
      state: 'idle',
      hostId: null,
      latencyMs: null,
      jitterMs: null,
      bitrateKbps: null,
      lastSyncAt: null,
      message: 'Client idle.',
      error: null,
    });
  }

  private async ensureSignaling(url: string): Promise<void> {
    const trimmedUrl = normalizeValue(url, 'ws://localhost:8787');
    if (
      this.signalingSocket &&
      this.signalingUrl === trimmedUrl &&
      this.signalingSocket.readyState === WebSocket.OPEN
    ) {
      return;
    }

    this.closeSignalingSocket();
    this.signalingUrl = trimmedUrl;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const socket = new WebSocket(trimmedUrl);
      this.signalingSocket = socket;

      socket.addEventListener('open', () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      });

      socket.addEventListener('message', (event) => {
        if (socket !== this.signalingSocket) {
          return;
        }
        this.handleSignalMessage(event.data);
      });

      socket.addEventListener('error', () => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error(`Unable to reach signaling server at ${trimmedUrl}.`));
      });

      socket.addEventListener('close', () => {
        if (socket !== this.signalingSocket) {
          return;
        }
        if (!settled) {
          settled = true;
          reject(new Error(`Signaling server at ${trimmedUrl} closed the socket.`));
          return;
        }

        this.signalingSocket = null;
        if (this.role === 'host') {
          this.updateHostState({
            state: 'error',
            message: 'Signaling connection closed.',
            error: 'Connection to signaling server was lost.',
          });
        }
        if (this.role === 'client') {
          this.updateClientState({
            state: 'error',
            message: 'Signaling connection closed.',
            error: 'Connection to signaling server was lost.',
          });
        }
      });
    });
  }

  private handleSignalMessage(raw: unknown): void {
    const envelope = parseEnvelope(raw);
    if (!envelope) {
      return;
    }

    switch (envelope.type) {
      case 'welcome': {
        const clientId = stringOrNull(envelope['clientId']);
        this.clientId = clientId;
        return;
      }

      case 'hosts-state': {
        this.discoveredHostsSubject.next(parseHosts(envelope['hosts']));
        return;
      }

      case 'peer-joined': {
        if (this.role !== 'host') {
          return;
        }
        const peerId = stringOrNull(envelope['peerId']);
        if (!peerId) {
          return;
        }
        void this.createHostOffer(peerId);
        return;
      }

      case 'peer-left': {
        const peerId = stringOrNull(envelope['peerId']);
        if (!peerId) {
          return;
        }
        if (this.role === 'host') {
          this.closeHostPeer(peerId);
          this.refreshHostPeerCount();
        } else if (this.role === 'client' && this.hostId === peerId) {
          this.updateClientState({
            state: 'error',
            message: 'Host disconnected.',
            error: 'The selected host left the session.',
          });
          this.closeClientPeerConnection();
        }
        return;
      }

      case 'offer': {
        if (this.role !== 'client') {
          return;
        }
        void this.handleClientOffer(envelope);
        return;
      }

      case 'answer': {
        if (this.role !== 'host') {
          return;
        }
        void this.handleHostAnswer(envelope);
        return;
      }

      case 'ice-candidate': {
        void this.handleIceCandidate(envelope);
        return;
      }

      case 'error': {
        const message = stringOrNull(envelope['message']) ?? 'Unknown signaling error.';
        if (this.role === 'host') {
          this.updateHostState({ state: 'error', message, error: message });
        } else if (this.role === 'client') {
          this.updateClientState({ state: 'error', message, error: message });
        }
        return;
      }

      default:
        return;
    }
  }

  private async createHostOffer(peerId: string): Promise<void> {
    if (!this.localStream) {
      return;
    }
    if (this.hostPeerConnections.has(peerId)) {
      return;
    }

    const peerConnection = this.createHostPeerConnection(peerId);
    const localStream = this.localStream;
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    this.sendSignal({
      type: 'offer',
      to: peerId,
      sdp: peerConnection.localDescription,
    });
  }

  private createHostPeerConnection(peerId: string): RTCPeerConnection {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }
      this.sendSignal({
        type: 'ice-candidate',
        to: peerId,
        candidate: event.candidate,
      });
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === 'failed' || state === 'closed' || state === 'disconnected') {
        this.closeHostPeer(peerId);
      }
      this.refreshHostPeerCount();
    };

    const syncChannel = peerConnection.createDataChannel('stream-sync');
    syncChannel.onopen = () => {
      this.pushHostSyncMessage(syncChannel, true);
    };
    syncChannel.onclose = () => {
      this.hostDataChannels.delete(peerId);
    };

    this.hostPeerConnections.set(peerId, peerConnection);
    this.hostDataChannels.set(peerId, syncChannel);
    this.refreshHostPeerCount();
    return peerConnection;
  }

  private async handleHostAnswer(envelope: SignalEnvelope): Promise<void> {
    const from = stringOrNull(envelope['from']);
    if (!from) {
      return;
    }
    const peerConnection = this.hostPeerConnections.get(from);
    if (!peerConnection) {
      return;
    }
    const sdp = envelope['sdp'] as RTCSessionDescriptionInit | undefined;
    if (!sdp) {
      return;
    }
    await peerConnection.setRemoteDescription(sdp);
  }

  private async handleIceCandidate(envelope: SignalEnvelope): Promise<void> {
    const candidate = envelope['candidate'] as RTCIceCandidateInit | null;
    if (candidate === undefined) {
      return;
    }
    if (this.role === 'host') {
      const from = stringOrNull(envelope['from']);
      if (!from) {
        return;
      }
      const peerConnection = this.hostPeerConnections.get(from);
      if (!peerConnection) {
        return;
      }
      await peerConnection.addIceCandidate(candidate);
      return;
    }

    if (this.role === 'client' && this.clientPeerConnection) {
      await this.clientPeerConnection.addIceCandidate(candidate);
    }
  }

  private async handleClientOffer(envelope: SignalEnvelope): Promise<void> {
    const from = stringOrNull(envelope['from']);
    const sdp = envelope['sdp'] as RTCSessionDescriptionInit | undefined;
    if (!from || !sdp) {
      return;
    }

    const peerConnection = this.ensureClientPeerConnection(from);
    await peerConnection.setRemoteDescription(sdp);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    this.sendSignal({
      type: 'answer',
      to: from,
      sdp: peerConnection.localDescription,
    });
    this.updateClientState({
      state: 'syncing',
      hostId: from,
      message: 'Negotiated. Waiting for synchronized playout...',
      error: null,
    });
  }

  private ensureClientPeerConnection(hostId: string): RTCPeerConnection {
    if (this.clientPeerConnection && this.hostId === hostId) {
      return this.clientPeerConnection;
    }

    this.closeClientPeerConnection();
    this.hostId = hostId;

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) {
        return;
      }
      this.attachRemoteAudio(stream);
    };

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !this.hostId) {
        return;
      }
      this.sendSignal({
        type: 'ice-candidate',
        to: this.hostId,
        candidate: event.candidate,
      });
    };

    peerConnection.ondatachannel = (event) => {
      this.bindClientSyncChannel(event.channel);
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === 'connected') {
        this.updateClientState({
          state: 'syncing',
          message: 'Audio transport connected. Waiting for sync marker...',
          error: null,
        });
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        this.updateClientState({
          state: 'error',
          message: 'Connection dropped.',
          error: 'WebRTC transport disconnected.',
        });
      }
    };

    this.clientPeerConnection = peerConnection;
    this.startClientStatsTimer(peerConnection);
    return peerConnection;
  }

  private bindClientSyncChannel(channel: RTCDataChannel): void {
    channel.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        return;
      }
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return;
      }
      const type = typeof payload['type'] === 'string' ? payload['type'] : null;
      if (!type) {
        return;
      }
      if (type === 'clock') {
        const hostNowMs = numberOrNull(payload['hostNowMs']);
        if (hostNowMs === null) {
          return;
        }
        this.recordClockOffset(hostNowMs - Date.now());
        return;
      }
      if (type === 'sync-start') {
        const hostStartAtMs = numberOrNull(payload['hostStartAtMs']);
        if (hostStartAtMs === null) {
          return;
        }
        this.scheduleClientSyncStart(hostStartAtMs);
      }
    };
  }

  private scheduleClientSyncStart(hostStartAtMs: number): void {
    if (!this.remoteAudioElement) {
      return;
    }
    if (this.clientSyncTimeout) {
      clearTimeout(this.clientSyncTimeout);
      this.clientSyncTimeout = null;
    }

    const localStartAt = hostStartAtMs - this.estimatedClockOffset();
    const delayMs = Math.max(0, localStartAt - Date.now());
    this.remoteAudioElement.muted = true;

    this.clientSyncTimeout = setTimeout(() => {
      if (!this.remoteAudioElement) {
        return;
      }
      this.remoteAudioElement.muted = false;
      void this.remoteAudioElement.play().catch(() => undefined);
      this.updateClientState({
        state: 'connected',
        lastSyncAt: new Date(),
        message: 'Synchronized playout active.',
        error: null,
      });
    }, delayMs);
  }

  private recordClockOffset(offsetMs: number): void {
    this.clockOffsetSamples = [...this.clockOffsetSamples, offsetMs].slice(-12);
  }

  private estimatedClockOffset(): number {
    if (!this.clockOffsetSamples.length) {
      return 0;
    }
    const total = this.clockOffsetSamples.reduce((sum, item) => sum + item, 0);
    return total / this.clockOffsetSamples.length;
  }

  private startHostSyncTimer(): void {
    if (this.hostSyncTimer) {
      clearInterval(this.hostSyncTimer);
      this.hostSyncTimer = null;
    }
    this.hostSyncTimer = setInterval(() => {
      for (const channel of this.hostDataChannels.values()) {
        this.pushHostSyncMessage(channel, false);
      }
    }, 2500);
  }

  private pushHostSyncMessage(channel: RTCDataChannel, includeSyncStart: boolean): void {
    if (channel.readyState !== 'open') {
      return;
    }
    channel.send(
      JSON.stringify({
        type: 'clock',
        hostNowMs: Date.now(),
      })
    );

    if (!includeSyncStart) {
      return;
    }
    channel.send(
      JSON.stringify({
        type: 'sync-start',
        hostStartAtMs: Date.now() + 1200,
      })
    );
  }

  private async captureHostAudio(source: CaptureSource): Promise<MediaStream> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      throw new Error('Media devices are unavailable in this environment.');
    }

    if (source === 'display') {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true,
      });
      const audioTracks = displayStream.getAudioTracks();
      displayStream.getVideoTracks().forEach((track) => track.stop());
      if (audioTracks.length) {
        return new MediaStream(audioTracks);
      }
      displayStream.getTracks().forEach((track) => track.stop());
      throw new Error(
        'Screen capture started without audio. Share a tab/window with "Share audio" enabled.'
      );
    }

    return navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 2,
        noiseSuppression: false,
        echoCancellation: false,
        autoGainControl: false,
      },
      video: false,
    });
  }

  private attachRemoteAudio(stream: MediaStream): void {
    if (!this.remoteAudioElement) {
      this.remoteAudioElement = document.createElement('audio');
      this.remoteAudioElement.autoplay = true;
      this.remoteAudioElement.setAttribute('playsinline', 'true');
      this.remoteAudioElement.style.display = 'none';
      document.body.appendChild(this.remoteAudioElement);
    }
    this.remoteAudioElement.srcObject = stream;
    this.remoteAudioElement.muted = true;
    void this.remoteAudioElement.play().catch(() => undefined);
  }

  private startClientStatsTimer(peerConnection: RTCPeerConnection): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }

    this.statsTimer = setInterval(() => {
      void this.readClientStats(peerConnection);
    }, 1500);
  }

  private async readClientStats(peerConnection: RTCPeerConnection): Promise<void> {
    if (peerConnection.connectionState !== 'connected') {
      return;
    }

    const statsReport = await peerConnection.getStats();
    let jitterMs: number | null = null;
    let latencyMs: number | null = null;
    let totalBytes = 0;

    statsReport.forEach((report) => {
      if (report.type === 'inbound-rtp') {
        const inbound = report as RTCInboundRtpStreamStats;
        const kind =
          inbound.kind ??
          (inbound as RTCInboundRtpStreamStats & { mediaType?: string }).mediaType;
        if (kind === 'audio') {
          if (typeof inbound.jitter === 'number') {
            jitterMs = Math.round(inbound.jitter * 1000);
          }
          if (typeof inbound.bytesReceived === 'number') {
            totalBytes = inbound.bytesReceived;
          }
        }
      }

      if (report.type === 'candidate-pair') {
        const pair = report as RTCIceCandidatePairStats;
        if (pair.state === 'succeeded' && typeof pair.currentRoundTripTime === 'number') {
          latencyMs = Math.round(pair.currentRoundTripTime * 1000);
        }
      }
    });

    const now = Date.now();
    const bitrateKbps = this.calculateBitrateKbps(totalBytes, now);
    this.updateClientState({
      latencyMs,
      jitterMs,
      bitrateKbps,
    });
  }

  private calculateBitrateKbps(totalBytes: number, nowMs: number): number | null {
    if (!this.lastInboundReadAtMs) {
      this.lastInboundReadAtMs = nowMs;
      this.lastInboundBytes = totalBytes;
      return null;
    }

    const elapsedMs = nowMs - this.lastInboundReadAtMs;
    if (elapsedMs <= 0) {
      return null;
    }

    const byteDelta = Math.max(0, totalBytes - this.lastInboundBytes);
    this.lastInboundReadAtMs = nowMs;
    this.lastInboundBytes = totalBytes;

    const bits = byteDelta * 8;
    const kbps = bits / elapsedMs;
    return Math.round(kbps);
  }

  private resetClientStatsWindow(): void {
    this.lastInboundBytes = 0;
    this.lastInboundReadAtMs = 0;
  }

  private refreshHostPeerCount(): void {
    const activeCount = [...this.hostPeerConnections.values()].filter((peer) => {
      return peer.connectionState === 'connected' || peer.connectionState === 'connecting';
    }).length;
    this.updateHostState({
      peerCount: activeCount,
      message:
        activeCount > 0
          ? `Streaming to ${activeCount} client${activeCount === 1 ? '' : 's'}.`
          : 'Broadcasting in room. Waiting for clients...',
    });
  }

  private updateHostState(partial: Partial<HostSessionStatus>): void {
    this.hostStatusSubject.next({
      ...this.hostStatusSubject.value,
      ...partial,
    });
  }

  private updateClientState(partial: Partial<ClientSessionStatus>): void {
    this.clientStatusSubject.next({
      ...this.clientStatusSubject.value,
      ...partial,
    });
  }

  private closeHostPeer(peerId: string): void {
    const peer = this.hostPeerConnections.get(peerId);
    if (!peer) {
      return;
    }
    peer.close();
    this.hostPeerConnections.delete(peerId);
    this.hostDataChannels.delete(peerId);
  }

  private closeAllHostPeerConnections(): void {
    for (const peer of this.hostPeerConnections.values()) {
      peer.close();
    }
    this.hostPeerConnections.clear();
    this.hostDataChannels.clear();
  }

  private closeClientPeerConnection(): void {
    if (this.clientPeerConnection) {
      this.clientPeerConnection.close();
      this.clientPeerConnection = null;
    }
  }

  private stopLocalStream(): void {
    if (!this.localStream) {
      return;
    }
    this.localStream.getTracks().forEach((track) => track.stop());
    this.localStream = null;
  }

  private releaseRemoteAudio(): void {
    if (!this.remoteAudioElement) {
      return;
    }
    this.remoteAudioElement.pause();
    this.remoteAudioElement.srcObject = null;
    this.remoteAudioElement.remove();
    this.remoteAudioElement = null;
  }

  private stopTimers(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    if (this.hostSyncTimer) {
      clearInterval(this.hostSyncTimer);
      this.hostSyncTimer = null;
    }
    if (this.clientSyncTimeout) {
      clearTimeout(this.clientSyncTimeout);
      this.clientSyncTimeout = null;
    }
  }

  private closeSignalingSocket(): void {
    if (!this.signalingSocket) {
      return;
    }
    const socket = this.signalingSocket;
    this.signalingSocket = null;
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close(1000, 'session-stopped');
    }
  }

  private sendSignal(payload: Record<string, unknown>): void {
    if (!this.signalingSocket || this.signalingSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.signalingSocket.send(JSON.stringify(payload));
  }
}

function normalizeValue(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
}

function parseEnvelope(raw: unknown): SignalEnvelope | null {
  let data: unknown = raw;
  if (data instanceof Blob) {
    return null;
  }

  if (typeof data !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    const type = typeof parsed['type'] === 'string' ? parsed['type'] : null;
    if (!type) {
      return null;
    }
    return { type, ...parsed };
  } catch {
    return null;
  }
}

function parseHosts(raw: unknown): DiscoveredHostSession[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => parseHostEntry(entry))
    .filter((entry): entry is DiscoveredHostSession => entry !== null);
}

function parseHostEntry(raw: unknown): DiscoveredHostSession | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const entity = raw as Partial<SignalHostEntry>;
  if (
    typeof entity.id !== 'string' ||
    typeof entity.roomId !== 'string' ||
    typeof entity.name !== 'string'
  ) {
    return null;
  }

  return {
    id: entity.id,
    roomId: entity.roomId,
    name: entity.name,
    address: typeof entity.address === 'string' ? entity.address : null,
    transport: typeof entity.transport === 'string' ? entity.transport : 'webrtc',
    updatedAt:
      typeof entity.updatedAt === 'number'
        ? new Date(entity.updatedAt)
        : new Date(),
  };
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value !== 'number') {
    return null;
  }
  return Number.isFinite(value) ? value : null;
}
