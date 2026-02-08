import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { skip } from 'rxjs/operators';

import { HostDiscoveryService } from './host-discovery.service';
import {
  RealtimeAudioService,
  type DiscoveredHostSession,
} from './realtime-audio.service';

class RealtimeAudioServiceStub {
  private readonly hostsSubject = new BehaviorSubject<DiscoveredHostSession[]>([]);
  readonly discoveredHosts$ = this.hostsSubject.asObservable();

  startDiscovery = jasmine.createSpy('startDiscovery').and.resolveTo();
  refreshHosts = jasmine.createSpy('refreshHosts');
  stopDiscovery = jasmine.createSpy('stopDiscovery');

  emit(hosts: DiscoveredHostSession[]): void {
    this.hostsSubject.next(hosts);
  }
}

describe('HostDiscoveryService', () => {
  let service: HostDiscoveryService;
  let realtimeStub: RealtimeAudioServiceStub;

  beforeEach(() => {
    realtimeStub = new RealtimeAudioServiceStub();
    TestBed.configureTestingModule({
      providers: [{ provide: RealtimeAudioService, useValue: realtimeStub }],
    });
    service = TestBed.inject(HostDiscoveryService);
  });

  it('should start discovery and map host sessions for ui consumption', async () => {
    const now = new Date();
    const stale = new Date(now.getTime() - 20_000);

    const firstEmissionPromise = firstValueFrom(service.discover('ws://signal').pipe(take(1)));
    const firstEmission = await firstEmissionPromise;
    expect(firstEmission).toEqual([]);
    expect(realtimeStub.startDiscovery).toHaveBeenCalledWith('ws://signal');
    expect(realtimeStub.refreshHosts).toHaveBeenCalled();

    const mappedPromise = firstValueFrom(service.discover('ws://signal').pipe(skip(1), take(1)));
    realtimeStub.emit([
      {
        id: 'host-1',
        roomId: 'living-room',
        name: 'Host One',
        address: '192.168.1.20',
        transport: 'webrtc',
        updatedAt: now,
      },
      {
        id: 'host-2',
        roomId: 'kitchen',
        name: 'Host Two',
        address: null,
        transport: 'webrtc',
        updatedAt: stale,
      },
    ]);

    const mapped = await mappedPromise;
    expect(mapped.length).toBe(2);
    expect(mapped[0].address).toBe('192.168.1.20');
    expect(mapped[0].transport).toBe('webrtc://living-room');
    expect(mapped[0].signal).toBe(-49);
    expect(mapped[1].address).toBe('address unavailable');
    expect(mapped[1].signal).toBe(-72);
  });

  it('should delegate refresh and stop to realtime service', () => {
    service.refresh();
    service.stop();
    expect(realtimeStub.refreshHosts).toHaveBeenCalled();
    expect(realtimeStub.stopDiscovery).toHaveBeenCalled();
  });
});
