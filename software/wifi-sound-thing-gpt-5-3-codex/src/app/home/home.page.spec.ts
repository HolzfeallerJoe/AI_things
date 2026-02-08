import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flushMicrotasks,
  tick,
} from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';

import { HomePage } from './home.page';
import type { DiscoveredHost } from '../shared/services/host-discovery.service';
import { HostDiscoveryService } from '../shared/services/host-discovery.service';
import {
  HostNetworkService,
  type HostNetworkInfo,
} from '../shared/services/host-network.service';
import {
  RealtimeAudioService,
  type ClientSessionStatus,
  type HostSessionStatus,
} from '../shared/services/realtime-audio.service';
import { NativeUdpAudioService } from '../shared/services/native-udp-audio.service';
import { environment } from '../../environments/environment';

class HostDiscoveryServiceStub {
  private readonly subject = new BehaviorSubject<DiscoveredHost[]>([]);

  discover() {
    return this.subject.asObservable();
  }

  refresh = jasmine.createSpy('refresh');
  stop = jasmine.createSpy('stop');

  emit(hosts: DiscoveredHost[]): void {
    this.subject.next(hosts);
  }
}

class HostNetworkServiceStub {
  private readonly subject = new BehaviorSubject<HostNetworkInfo>({
    ipAddress: '192.168.43.1',
    connectionType: 'wifi',
    fetchedAt: new Date(),
    source: 'fallback',
    fallbackReason: 'Initial hotspot fallback',
  });

  readonly info$ = this.subject.asObservable();

  refresh = jasmine.createSpy('refresh').and.resolveTo();

  emit(info: HostNetworkInfo): void {
    this.subject.next(info);
  }
}

class RealtimeAudioServiceStub {
  private readonly hostSubject = new BehaviorSubject<HostSessionStatus>({
    state: 'idle',
    peerCount: 0,
    bitrateKbps: null,
    message: 'Host idle',
    error: null,
  });

  private readonly clientSubject = new BehaviorSubject<ClientSessionStatus>({
    state: 'idle',
    hostId: null,
    latencyMs: null,
    jitterMs: null,
    bitrateKbps: null,
    lastSyncAt: null,
    message: 'Client idle',
    error: null,
  });

  readonly hostStatus$ = this.hostSubject.asObservable();
  readonly clientStatus$ = this.clientSubject.asObservable();

  startHost = jasmine.createSpy('startHost').and.resolveTo();
  connectClient = jasmine.createSpy('connectClient').and.resolveTo();
  stop = jasmine.createSpy('stop').and.resolveTo();
  refreshHosts = jasmine.createSpy('refreshHosts');
  startDiscovery = jasmine.createSpy('startDiscovery').and.resolveTo();
  stopDiscovery = jasmine.createSpy('stopDiscovery');
  updateHostMetadata = jasmine.createSpy('updateHostMetadata');
}

class NativeUdpAudioServiceStub {
  isAvailable = jasmine.createSpy('isAvailable').and.returnValue(true);
  requestCapturePermission = jasmine.createSpy('requestCapturePermission').and.resolveTo(true);
  startHost = jasmine.createSpy('startHost').and.resolveTo();
  stopHost = jasmine.createSpy('stopHost').and.resolveTo();
  startClient = jasmine.createSpy('startClient').and.resolveTo();
  stopClient = jasmine.createSpy('stopClient').and.resolveTo();
  getStatus = jasmine.createSpy('getStatus').and.resolveTo({
    hostRunning: false,
    clientRunning: false,
    hostMode: 'idle',
    lastError: null,
    capturePermission: true,
  });
}

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let discoveryStub: HostDiscoveryServiceStub;
  let networkStub: HostNetworkServiceStub;
  let realtimeStub: RealtimeAudioServiceStub;
  let nativeStub: NativeUdpAudioServiceStub;

  beforeEach(async () => {
    discoveryStub = new HostDiscoveryServiceStub();
    networkStub = new HostNetworkServiceStub();
    realtimeStub = new RealtimeAudioServiceStub();
    nativeStub = new NativeUdpAudioServiceStub();

    await TestBed.configureTestingModule({
      declarations: [HomePage],
      imports: [IonicModule.forRoot(), ReactiveFormsModule, RouterTestingModule],
      providers: [
        FormBuilder,
        { provide: HostDiscoveryService, useValue: discoveryStub },
        { provide: HostNetworkService, useValue: networkStub },
        { provide: RealtimeAudioService, useValue: realtimeStub },
        { provide: NativeUdpAudioService, useValue: nativeStub },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise forms with defaults', () => {
    expect(component.hostForm.value.signalingUrl).toBe(environment.signalingUrl);
    expect(component.hostForm.value.roomId).toBe(environment.defaultRoomId);
    expect(component.hostForm.value.transportMode).toBe('native-udp');
    expect(component.clientForm.value.transportMode).toBe('native-udp');
    expect(component.clientForm.value.port).toBe(5052);
  });

  it('should start and stop native host', fakeAsync(() => {
    component.hostForm.patchValue({ peers: '192.168.1.21, 192.168.1.22' });
    component.startHost();
    flushMicrotasks();

    expect(nativeStub.startHost).toHaveBeenCalledWith(
      jasmine.objectContaining({
        peers: ['192.168.1.21', '192.168.1.22'],
        captureMode: 'auto',
      })
    );
    expect(component.hostStreaming).toBeTrue();

    component.stopHost();
    flushMicrotasks();
    expect(nativeStub.stopHost).toHaveBeenCalled();
  }));

  it('should map microphone capture to native host microphone mode', fakeAsync(() => {
    component.hostForm.patchValue({
      peers: '192.168.1.21',
      captureSource: 'microphone',
    });
    component.startHost();
    flushMicrotasks();

    expect(nativeStub.requestCapturePermission).not.toHaveBeenCalled();
    expect(nativeStub.startHost).toHaveBeenCalledWith(
      jasmine.objectContaining({
        captureMode: 'microphone',
      })
    );
  }));

  it('should start and stop native client', fakeAsync(() => {
    component.clientForm.patchValue({ hostAddress: '192.168.1.20' });
    component.connectClient();
    flushMicrotasks();

    expect(nativeStub.startClient).toHaveBeenCalledWith(
      jasmine.objectContaining({
        hostAddress: '192.168.1.20',
        port: 5052,
      })
    );
    expect(component.clientConnected).toBeTrue();

    component.disconnectClient();
    flushMicrotasks();
    expect(nativeStub.stopClient).toHaveBeenCalled();
  }));

  it('should use selected discovered host address for native client', fakeAsync(() => {
    component.discoveredHosts = [
      {
        id: 'host-1',
        roomId: 'room-a',
        name: 'Host One',
        address: '192.168.1.31',
        transport: 'webrtc://room-a',
        signal: -55,
        lastSeen: new Date(),
      },
    ];
    component.selectedHostId = 'host-1';
    component.clientForm.patchValue({ hostAddress: '' });

    component.connectClient();
    flushMicrotasks();

    expect(nativeStub.startClient).toHaveBeenCalledWith(
      jasmine.objectContaining({
        hostAddress: '192.168.1.31',
      })
    );
  }));

  it('should fail native client connect when no host address is available', fakeAsync(() => {
    component.discoveredHosts = [];
    component.selectedHostId = null;
    component.clientForm.patchValue({ hostAddress: '' });

    component.connectClient();
    flushMicrotasks();

    expect(nativeStub.startClient).not.toHaveBeenCalled();
    expect(component.clientConnected).toBeFalse();
    expect(component.logEntries[0].message).toContain('Native client connect failed');
  }));

  it('should use webrtc host path when transport is switched', fakeAsync(() => {
    component.hostForm.patchValue({ transportMode: 'webrtc' });
    component.startHost();
    flushMicrotasks();
    expect(realtimeStub.startHost).toHaveBeenCalled();
  }));

  it('should log native microphone fallback status', fakeAsync(() => {
    nativeStub.getStatus.and.resolveTo({
      hostRunning: true,
      clientRunning: false,
      hostMode: 'microphone',
      lastError: null,
      capturePermission: true,
    });
    component.hostForm.patchValue({ peers: '192.168.1.21' });

    component.startHost();
    flushMicrotasks();
    tick(2100);
    flushMicrotasks();

    const found = component.logEntries.some((entry) =>
      entry.message.includes('microphone fallback mode')
    );
    expect(found).toBeTrue();

    component.stopHost();
    flushMicrotasks();
  }));

  it('should switch modes and log message', () => {
    component.onModeChange('client');
    expect(component.mode).toBe('client');
    expect(component.logEntries[0].message).toContain('Switched to client controls');
  });

  it('should refresh host network details on demand', fakeAsync(() => {
    component.refreshHostNetwork();
    flushMicrotasks();

    expect(networkStub.refresh).toHaveBeenCalled();
    expect(component.refreshingHostNetwork).toBeFalse();
  }));
});
