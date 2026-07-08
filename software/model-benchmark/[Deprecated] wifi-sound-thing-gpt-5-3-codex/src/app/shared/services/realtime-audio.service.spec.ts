import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

import { RealtimeAudioService } from './realtime-audio.service';

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: FakeWebSocket[] = [];

  readonly sent: string[] = [];
  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;

  private readonly listeners = new Map<string, Array<(event: any) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, callback: (event: any) => void): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(callback);
    this.listeners.set(type, existing);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(): void {
    if (this.readyState === FakeWebSocket.CLOSED) {
      return;
    }
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatch('close', {});
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatch('open', {});
  }

  emitMessage(data: unknown): void {
    this.dispatch('message', { data });
  }

  emitClose(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatch('close', {});
  }

  emitError(): void {
    this.dispatch('error', {});
  }

  private dispatch(type: string, event: any): void {
    const callbacks = this.listeners.get(type) ?? [];
    callbacks.forEach((callback) => callback(event));
  }
}

describe('RealtimeAudioService', () => {
  let service: RealtimeAudioService;
  let originalWebSocket: typeof WebSocket;
  let getUserMediaSpy: jasmine.Spy | null = null;
  let getDisplayMediaSpy: jasmine.Spy | null = null;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    FakeWebSocket.instances = [];
    (globalThis as { WebSocket: typeof WebSocket }).WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    service = new RealtimeAudioService();

    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {},
      });
    }

    const mediaDevices = navigator.mediaDevices as MediaDevices & {
      getUserMedia?: (constraints?: MediaStreamConstraints) => Promise<MediaStream>;
      getDisplayMedia?: (options?: DisplayMediaStreamOptions) => Promise<MediaStream>;
    };

    if (typeof mediaDevices.getUserMedia !== 'function') {
      mediaDevices.getUserMedia = (() =>
        Promise.resolve({ getTracks: () => [] } as unknown as MediaStream)) as (
        constraints?: MediaStreamConstraints
      ) => Promise<MediaStream>;
    }
    if (typeof mediaDevices.getDisplayMedia !== 'function') {
      mediaDevices.getDisplayMedia = (() =>
        Promise.resolve({
          getAudioTracks: () => [],
          getVideoTracks: () => [],
          getTracks: () => [],
        } as unknown as MediaStream)) as (
        options?: DisplayMediaStreamOptions
      ) => Promise<MediaStream>;
    }

    getUserMediaSpy = spyOn(navigator.mediaDevices, 'getUserMedia').and.resolveTo(
      {
        getTracks: () => [],
      } as unknown as MediaStream
    );
    getDisplayMediaSpy = spyOn(navigator.mediaDevices, 'getDisplayMedia').and.resolveTo(
      {
        getAudioTracks: () => [],
        getVideoTracks: () => [],
        getTracks: () => [],
      } as unknown as MediaStream
    );
  });

  async function waitForFirstSocket(): Promise<FakeWebSocket> {
    for (let index = 0; index < 8; index += 1) {
      const socket = FakeWebSocket.instances[0];
      if (socket) {
        return socket;
      }
      await Promise.resolve();
    }
    throw new Error('Expected signaling socket to be created.');
  }

  afterEach(async () => {
    await service.stop();
    (globalThis as { WebSocket: typeof WebSocket }).WebSocket = originalWebSocket;
    getUserMediaSpy = null;
    getDisplayMediaSpy = null;
  });

  it('should start discovery, send observer hello, and map hosts-state updates', async () => {
    const observedHosts: Array<{ id: string; roomId: string; name: string }> = [];
    const subscription = service.discoveredHosts$.subscribe((hosts) => {
      if (hosts.length) {
        observedHosts.push({
          id: hosts[0].id,
          roomId: hosts[0].roomId,
          name: hosts[0].name,
        });
      }
    });

    const startPromise = service.startDiscovery('ws://signal');
    const socket = await waitForFirstSocket();

    socket.open();
    await startPromise;

    socket.emitMessage(
      JSON.stringify({
        type: 'hosts-state',
        hosts: [
          {
            id: 'host-a',
            roomId: 'living-room',
            name: 'Living Room Host',
            address: '192.168.1.20',
            transport: 'webrtc',
            updatedAt: Date.now(),
          },
        ],
      })
    );

    const sent = socket.sent.map((message) => JSON.parse(message) as Record<string, unknown>);
    expect(sent.some((message) => message['type'] === 'hello' && message['role'] === 'observer')).toBeTrue();
    expect(sent.some((message) => message['type'] === 'hosts-request')).toBeTrue();
    expect(observedHosts.length).toBeGreaterThan(0);
    expect(observedHosts[0].id).toBe('host-a');
    expect(observedHosts[0].roomId).toBe('living-room');

    subscription.unsubscribe();
  });

  it('should start host with microphone source and send metadata updates', async () => {
    const localTrackStop = jasmine.createSpy('localTrackStop');
    getUserMediaSpy?.and.resolveTo({
      getTracks: () => [{ stop: localTrackStop }],
    } as unknown as MediaStream);

    const startPromise = service.startHost({
      signalingUrl: 'ws://signal',
      roomId: 'room-1',
      name: 'Host Alpha',
      source: 'microphone',
      address: '192.168.1.10',
    });

    const socket = await waitForFirstSocket();
    socket.open();
    await startPromise;

    const hostStatus = await firstValueFrom(service.hostStatus$.pipe(take(1)));
    expect(hostStatus.state).toBe('streaming');
    expect(getUserMediaSpy).toHaveBeenCalled();
    expect(getDisplayMediaSpy).not.toHaveBeenCalled();

    service.updateHostMetadata('Host Beta', 'room-2', '192.168.1.11');

    const sent = socket.sent.map((message) => JSON.parse(message) as Record<string, unknown>);
    expect(
      sent.some(
        (message) =>
          message['type'] === 'hello' &&
          message['role'] === 'host' &&
          message['roomId'] === 'room-1'
      )
    ).toBeTrue();
    expect(
      sent.some(
        (message) =>
          message['type'] === 'host-meta-update' &&
          message['roomId'] === 'room-2' &&
          message['name'] === 'Host Beta'
      )
    ).toBeTrue();

    await service.stop();
    expect(localTrackStop).toHaveBeenCalled();
  });

  it('should connect as client and transition to error when signaling closes', async () => {
    const connectPromise = service.connectClient({
      signalingUrl: 'ws://signal',
      roomId: 'room-1',
      hostId: 'host-1',
      name: 'Client One',
    });

    const socket = await waitForFirstSocket();
    socket.open();
    await connectPromise;

    let clientStatus = await firstValueFrom(service.clientStatus$.pipe(take(1)));
    expect(clientStatus.state).toBe('connecting');
    expect(clientStatus.hostId).toBe('host-1');

    const sent = socket.sent.map((message) => JSON.parse(message) as Record<string, unknown>);
    expect(
      sent.some(
        (message) =>
          message['type'] === 'hello' &&
          message['role'] === 'client' &&
          message['targetHostId'] === 'host-1'
      )
    ).toBeTrue();

    socket.emitClose();

    clientStatus = await firstValueFrom(service.clientStatus$.pipe(take(1)));
    expect(clientStatus.state).toBe('error');
    expect(clientStatus.error).toContain('signaling server');
  });

  it('should reject display capture when no audio track is shared', async () => {
    const videoTrackStop = jasmine.createSpy('videoTrackStop');
    const genericTrackStop = jasmine.createSpy('genericTrackStop');
    getDisplayMediaSpy?.and.resolveTo({
      getAudioTracks: () => [],
      getVideoTracks: () => [{ stop: videoTrackStop }],
      getTracks: () => [{ stop: genericTrackStop }],
    } as unknown as MediaStream);

    await expectAsync(
      service.startHost({
        signalingUrl: 'ws://signal',
        roomId: 'room-1',
        name: 'Host Alpha',
        source: 'display',
        address: null,
      })
    ).toBeRejectedWithError(/without audio/i);

    expect(videoTrackStop).toHaveBeenCalled();
    expect(genericTrackStop).toHaveBeenCalled();
    expect(FakeWebSocket.instances.length).toBe(0);
  });
});
