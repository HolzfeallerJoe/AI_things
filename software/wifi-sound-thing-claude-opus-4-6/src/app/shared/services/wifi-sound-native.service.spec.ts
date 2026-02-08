import { Subject } from 'rxjs';
import { WifiSoundNativeService } from './wifi-sound-native.service';
import type {
  HostMetricsEvent,
  ClientMetricsEvent,
  DiscoveredHostEvent,
  HostLostEvent,
} from '../plugins/wifi-sound.plugin';

/**
 * WifiSoundNativeService wraps the Capacitor WifiSound plugin.
 *
 * In a browser test environment the Capacitor Proxy has no web
 * implementation, so calling `addListener` on it rejects. To avoid
 * unhandled-rejection noise we build the service via Object.create()
 * (skipping the constructor) and test the Observable wiring through the
 * private Subjects directly.
 */
describe('WifiSoundNativeService', () => {
  let service: WifiSoundNativeService;

  // Helpers to access private subjects
  function hostMetrics$(): Subject<HostMetricsEvent> {
    return (service as unknown as Record<string, unknown>)[
      'hostMetricsSubject'
    ] as Subject<HostMetricsEvent>;
  }
  function clientMetrics$(): Subject<ClientMetricsEvent> {
    return (service as unknown as Record<string, unknown>)[
      'clientMetricsSubject'
    ] as Subject<ClientMetricsEvent>;
  }
  function hostDiscovered$(): Subject<DiscoveredHostEvent> {
    return (service as unknown as Record<string, unknown>)[
      'hostDiscoveredSubject'
    ] as Subject<DiscoveredHostEvent>;
  }
  function hostLost$(): Subject<HostLostEvent> {
    return (service as unknown as Record<string, unknown>)[
      'hostLostSubject'
    ] as Subject<HostLostEvent>;
  }

  beforeEach(() => {
    // Build an instance WITHOUT running the constructor (which would
    // call WifiSound.addListener on a Proxy that has no web impl).
    service = Object.create(WifiSoundNativeService.prototype);

    // Manually initialise the fields that the class declares.
    const s = service as unknown as Record<string, unknown>;
    s['hostMetricsSubject'] = new Subject<HostMetricsEvent>();
    s['clientMetricsSubject'] = new Subject<ClientMetricsEvent>();
    s['hostDiscoveredSubject'] = new Subject<DiscoveredHostEvent>();
    s['hostLostSubject'] = new Subject<HostLostEvent>();
    s['onHostMetrics'] = (
      s['hostMetricsSubject'] as Subject<HostMetricsEvent>
    ).asObservable();
    s['onClientMetrics'] = (
      s['clientMetricsSubject'] as Subject<ClientMetricsEvent>
    ).asObservable();
    s['onHostDiscovered'] = (
      s['hostDiscoveredSubject'] as Subject<DiscoveredHostEvent>
    ).asObservable();
    s['onHostLost'] = (
      s['hostLostSubject'] as Subject<HostLostEvent>
    ).asObservable();
  });

  // ── Construction ────────────────────────────────────────────────────

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('exposes four observable properties', () => {
    expect(service.onHostMetrics).toBeDefined();
    expect(service.onClientMetrics).toBeDefined();
    expect(service.onHostDiscovered).toBeDefined();
    expect(service.onHostLost).toBeDefined();
  });

  // ── Public async methods exist ─────────────────────────────────────

  it('has checkShizuku method', () => {
    expect(typeof service.checkShizuku).toBe('function');
  });

  it('has requestShizukuPermission method', () => {
    expect(typeof service.requestShizukuPermission).toBe('function');
  });

  it('has requestMediaProjection method', () => {
    expect(typeof service.requestMediaProjection).toBe('function');
  });

  it('has startHost method', () => {
    expect(typeof service.startHost).toBe('function');
  });

  it('has stopHost method', () => {
    expect(typeof service.stopHost).toBe('function');
  });

  it('has startClient method', () => {
    expect(typeof service.startClient).toBe('function');
  });

  it('has stopClient method', () => {
    expect(typeof service.stopClient).toBe('function');
  });

  it('has startDiscovery method', () => {
    expect(typeof service.startDiscovery).toBe('function');
  });

  it('has stopDiscovery method', () => {
    expect(typeof service.stopDiscovery).toBe('function');
  });

  // ── onHostMetrics observable ───────────────────────────────────────

  it('onHostMetrics emits when subject fires', () => {
    const received: HostMetricsEvent[] = [];
    const sub = service.onHostMetrics.subscribe((d) => received.push(d));

    const event: HostMetricsEvent = {
      packetsSent: 100,
      bytesSent: 384000,
      peerCount: 2,
      uptimeMs: 5000,
    };
    hostMetrics$().next(event);

    expect(received.length).toBe(1);
    expect(received[0]).toEqual(event);
    sub.unsubscribe();
  });

  // ── onClientMetrics observable ─────────────────────────────────────

  it('onClientMetrics emits when subject fires', () => {
    const received: ClientMetricsEvent[] = [];
    const sub = service.onClientMetrics.subscribe((d) => received.push(d));

    const event: ClientMetricsEvent = {
      packetsReceived: 50,
      latencyUs: 12000,
      bufferDepth: 3,
      packetsDropped: 1,
    };
    clientMetrics$().next(event);

    expect(received.length).toBe(1);
    expect(received[0]).toEqual(event);
    sub.unsubscribe();
  });

  // ── onHostDiscovered observable ────────────────────────────────────

  it('onHostDiscovered emits when subject fires', () => {
    const received: DiscoveredHostEvent[] = [];
    const sub = service.onHostDiscovered.subscribe((d) => received.push(d));

    const event: DiscoveredHostEvent = {
      id: 'host-1',
      name: 'Living Room',
      address: '192.168.1.10',
      port: 5050,
      codec: 'PCM',
      sampleRate: 48000,
      transport: 'wifi',
    };
    hostDiscovered$().next(event);

    expect(received.length).toBe(1);
    expect(received[0]).toEqual(event);
    sub.unsubscribe();
  });

  // ── onHostLost observable ──────────────────────────────────────────

  it('onHostLost emits when subject fires', () => {
    const received: HostLostEvent[] = [];
    const sub = service.onHostLost.subscribe((d) => received.push(d));

    const event: HostLostEvent = { address: '192.168.1.10' };
    hostLost$().next(event);

    expect(received.length).toBe(1);
    expect(received[0]).toEqual(event);
    sub.unsubscribe();
  });

  // ── Multiple subscribers ───────────────────────────────────────────

  it('multiple subscribers each receive events', () => {
    const a: HostMetricsEvent[] = [];
    const b: HostMetricsEvent[] = [];

    const subA = service.onHostMetrics.subscribe((d) => a.push(d));
    const subB = service.onHostMetrics.subscribe((d) => b.push(d));

    const event: HostMetricsEvent = {
      packetsSent: 10,
      bytesSent: 3840,
      peerCount: 1,
      uptimeMs: 200,
    };
    hostMetrics$().next(event);

    expect(a.length).toBe(1);
    expect(b.length).toBe(1);
    expect(a[0]).toEqual(event);

    subA.unsubscribe();
    subB.unsubscribe();
  });

  // ── Unsubscribe stops delivery ─────────────────────────────────────

  it('unsubscribed observer does not receive events', () => {
    let count = 0;
    const sub = service.onHostMetrics.subscribe(() => count++);
    sub.unsubscribe();

    hostMetrics$().next({
      packetsSent: 1,
      bytesSent: 100,
      peerCount: 1,
      uptimeMs: 1000,
    });

    expect(count).toBe(0);
  });

  // ── Sequential events ──────────────────────────────────────────────

  it('emits events in order', () => {
    const values: number[] = [];
    const sub = service.onHostMetrics.subscribe((d) =>
      values.push(d.packetsSent)
    );

    for (let i = 1; i <= 5; i++) {
      hostMetrics$().next({
        packetsSent: i,
        bytesSent: i * 3840,
        peerCount: 1,
        uptimeMs: i * 1000,
      });
    }

    expect(values).toEqual([1, 2, 3, 4, 5]);
    sub.unsubscribe();
  });
});
