import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { HostDiscoveryService, DiscoveredHost } from './host-discovery.service';
import { WifiSoundNativeService } from './wifi-sound-native.service';
import {
  DiscoveredHostEvent,
  HostLostEvent,
} from '../plugins/wifi-sound.plugin';

// ── Stub ─────────────────────────────────────────────────────────────────

class WifiSoundNativeServiceStub {
  readonly hostDiscoveredSubject = new Subject<DiscoveredHostEvent>();
  readonly hostLostSubject = new Subject<HostLostEvent>();

  readonly onHostDiscovered = this.hostDiscoveredSubject.asObservable();
  readonly onHostLost = this.hostLostSubject.asObservable();

  startDiscovery = jasmine.createSpy('startDiscovery').and.resolveTo();
  stopDiscovery = jasmine.createSpy('stopDiscovery').and.resolveTo();
}

describe('HostDiscoveryService', () => {
  let service: HostDiscoveryService;
  let nativeStub: WifiSoundNativeServiceStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HostDiscoveryService,
        {
          provide: WifiSoundNativeService,
          useClass: WifiSoundNativeServiceStub,
        },
      ],
    });

    service = TestBed.inject(HostDiscoveryService);
    nativeStub = TestBed.inject(
      WifiSoundNativeService
    ) as unknown as WifiSoundNativeServiceStub;
  });

  // ── Basics ─────────────────────────────────────────────────────────

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── discover() ─────────────────────────────────────────────────────

  it('calls startDiscovery on subscribe', () => {
    const sub = service.discover().subscribe();
    expect(nativeStub.startDiscovery).toHaveBeenCalled();
    sub.unsubscribe();
  });

  it('calls stopDiscovery on unsubscribe', () => {
    const sub = service.discover().subscribe();
    sub.unsubscribe();
    expect(nativeStub.stopDiscovery).toHaveBeenCalled();
  });

  it('emits list with one host when a host is discovered', () => {
    let latest: DiscoveredHost[] = [];
    const sub = service.discover().subscribe((hosts) => (latest = hosts));

    nativeStub.hostDiscoveredSubject.next({
      id: 'host-1',
      name: 'Living Room',
      address: '192.168.1.10',
      port: 5050,
      codec: 'PCM',
      sampleRate: 48000,
      transport: 'wifi',
    });

    expect(latest.length).toBe(1);
    expect(latest[0].id).toBe('host-1');
    expect(latest[0].name).toBe('Living Room');
    expect(latest[0].address).toBe('192.168.1.10');
    expect(latest[0].transport).toBe('wifi');
    expect(latest[0].signal).toBe(-50); // placeholder RSSI
    expect(latest[0].lastSeen).toBeInstanceOf(Date);

    sub.unsubscribe();
  });

  it('accumulates multiple discovered hosts', () => {
    let latest: DiscoveredHost[] = [];
    const sub = service.discover().subscribe((hosts) => (latest = hosts));

    nativeStub.hostDiscoveredSubject.next({
      id: 'host-1',
      name: 'Host A',
      address: '192.168.1.10',
      port: 5050,
      codec: 'PCM',
      sampleRate: 48000,
      transport: 'wifi',
    });
    nativeStub.hostDiscoveredSubject.next({
      id: 'host-2',
      name: 'Host B',
      address: '192.168.1.20',
      port: 5050,
      codec: 'PCM',
      sampleRate: 48000,
      transport: 'wifi',
    });

    expect(latest.length).toBe(2);
    expect(latest.map((h) => h.id)).toEqual(['host-1', 'host-2']);

    sub.unsubscribe();
  });

  it('updates existing host when same id is rediscovered', () => {
    let latest: DiscoveredHost[] = [];
    const sub = service.discover().subscribe((hosts) => (latest = hosts));

    nativeStub.hostDiscoveredSubject.next({
      id: 'host-1',
      name: 'Old Name',
      address: '192.168.1.10',
      port: 5050,
      codec: 'PCM',
      sampleRate: 48000,
      transport: 'wifi',
    });
    nativeStub.hostDiscoveredSubject.next({
      id: 'host-1',
      name: 'New Name',
      address: '192.168.1.10',
      port: 5050,
      codec: 'PCM',
      sampleRate: 48000,
      transport: 'wifi',
    });

    // Should still be 1 host, not 2
    expect(latest.length).toBe(1);
    expect(latest[0].name).toBe('New Name');

    sub.unsubscribe();
  });

  it('removes host when hostLost fires matching address', () => {
    let latest: DiscoveredHost[] = [];
    const sub = service.discover().subscribe((hosts) => (latest = hosts));

    nativeStub.hostDiscoveredSubject.next({
      id: 'host-1',
      name: 'Host A',
      address: '192.168.1.10',
      port: 5050,
      codec: 'PCM',
      sampleRate: 48000,
      transport: 'wifi',
    });
    nativeStub.hostDiscoveredSubject.next({
      id: 'host-2',
      name: 'Host B',
      address: '192.168.1.20',
      port: 5050,
      codec: 'PCM',
      sampleRate: 48000,
      transport: 'wifi',
    });

    expect(latest.length).toBe(2);

    nativeStub.hostLostSubject.next({ address: '192.168.1.10' });

    expect(latest.length).toBe(1);
    expect(latest[0].id).toBe('host-2');

    sub.unsubscribe();
  });

  it('hostLost for unknown address does not crash', () => {
    let latest: DiscoveredHost[] = [];
    const sub = service.discover().subscribe((hosts) => (latest = hosts));

    nativeStub.hostLostSubject.next({ address: '10.0.0.99' });

    expect(latest.length).toBe(0);

    sub.unsubscribe();
  });

  it('emits empty array after all hosts are lost', () => {
    let latest: DiscoveredHost[] = [];
    const sub = service.discover().subscribe((hosts) => (latest = hosts));

    nativeStub.hostDiscoveredSubject.next({
      id: 'host-1',
      name: 'Solo',
      address: '192.168.1.10',
      port: 5050,
      codec: 'PCM',
      sampleRate: 48000,
      transport: 'wifi',
    });

    expect(latest.length).toBe(1);

    nativeStub.hostLostSubject.next({ address: '192.168.1.10' });

    expect(latest.length).toBe(0);

    sub.unsubscribe();
  });

  it('multiple subscribers each get their own host list', () => {
    const results1: DiscoveredHost[][] = [];
    const results2: DiscoveredHost[][] = [];

    const sub1 = service
      .discover()
      .subscribe((hosts) => results1.push([...hosts]));
    const sub2 = service
      .discover()
      .subscribe((hosts) => results2.push([...hosts]));

    nativeStub.hostDiscoveredSubject.next({
      id: 'host-1',
      name: 'Shared',
      address: '192.168.1.10',
      port: 5050,
      codec: 'PCM',
      sampleRate: 48000,
      transport: 'wifi',
    });

    // Both subscribers should have received the emission
    expect(results1.length).toBeGreaterThan(0);
    expect(results2.length).toBeGreaterThan(0);

    sub1.unsubscribe();
    sub2.unsubscribe();
  });

  it('does not emit before any host event', () => {
    let emitCount = 0;
    const sub = service.discover().subscribe(() => emitCount++);

    expect(emitCount).toBe(0);

    sub.unsubscribe();
  });
});
