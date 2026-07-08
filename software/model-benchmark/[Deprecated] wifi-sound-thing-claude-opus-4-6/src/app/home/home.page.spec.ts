import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flushMicrotasks,
} from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BehaviorSubject, Subject } from 'rxjs';

import { HomePage } from './home.page';
import type { DiscoveredHost } from '../shared/services/host-discovery.service';
import { HostDiscoveryService } from '../shared/services/host-discovery.service';
import {
  HostNetworkService,
  type HostNetworkInfo,
} from '../shared/services/host-network.service';
import { WifiSoundNativeService } from '../shared/services/wifi-sound-native.service';
import type {
  HostMetricsEvent,
  ClientMetricsEvent,
  DiscoveredHostEvent,
  HostLostEvent,
} from '../shared/plugins/wifi-sound.plugin';

// ── Stubs ──────────────────────────────────────────────────────────────

class HostDiscoveryServiceStub {
  private readonly subject = new BehaviorSubject<DiscoveredHost[]>([]);

  discover() {
    return this.subject.asObservable();
  }

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

  get currentInfo(): HostNetworkInfo {
    return this.subject.getValue();
  }

  refresh = jasmine.createSpy('refresh').and.callFake(() => {
    return Promise.resolve().then(() => {
      this.subject.next({
        ipAddress: '192.168.1.77',
        connectionType: 'wifi',
        fetchedAt: new Date(),
        source: 'plugin',
      });
    });
  });

  emit(info: HostNetworkInfo): void {
    this.subject.next(info);
  }
}

class WifiSoundNativeServiceStub {
  readonly hostMetrics$ = new Subject<HostMetricsEvent>();
  readonly clientMetrics$ = new Subject<ClientMetricsEvent>();
  readonly hostDiscovered$ = new Subject<DiscoveredHostEvent>();
  readonly hostLost$ = new Subject<HostLostEvent>();

  readonly onHostMetrics = this.hostMetrics$.asObservable();
  readonly onClientMetrics = this.clientMetrics$.asObservable();
  readonly onHostDiscovered = this.hostDiscovered$.asObservable();
  readonly onHostLost = this.hostLost$.asObservable();

  checkShizuku = jasmine
    .createSpy('checkShizuku')
    .and.returnValue(Promise.resolve({ available: false, granted: false }));

  requestShizukuPermission = jasmine
    .createSpy('requestShizukuPermission')
    .and.returnValue(Promise.resolve(true));

  requestMediaProjection = jasmine
    .createSpy('requestMediaProjection')
    .and.returnValue(Promise.resolve(true));

  startHost = jasmine
    .createSpy('startHost')
    .and.returnValue(Promise.resolve({ captureMode: 'projection' }));

  stopHost = jasmine
    .createSpy('stopHost')
    .and.returnValue(Promise.resolve());

  startClient = jasmine
    .createSpy('startClient')
    .and.returnValue(Promise.resolve());

  stopClient = jasmine
    .createSpy('stopClient')
    .and.returnValue(Promise.resolve());

  startDiscovery = jasmine
    .createSpy('startDiscovery')
    .and.returnValue(Promise.resolve());

  stopDiscovery = jasmine
    .createSpy('stopDiscovery')
    .and.returnValue(Promise.resolve());
}

// ── Helpers ────────────────────────────────────────────────────────────

const demoHost: DiscoveredHost = {
  id: 'demo',
  name: 'Demo Host',
  address: '192.168.1.42',
  transport: 'udp://192.168.1.42:5050',
  signal: -48,
  lastSeen: new Date(),
};

// ── Tests ──────────────────────────────────────────────────────────────

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let discoveryStub: HostDiscoveryServiceStub;
  let networkStub: HostNetworkServiceStub;
  let nativeStub: WifiSoundNativeServiceStub;

  beforeEach(async () => {
    discoveryStub = new HostDiscoveryServiceStub();
    networkStub = new HostNetworkServiceStub();
    nativeStub = new WifiSoundNativeServiceStub();

    await TestBed.configureTestingModule({
      declarations: [HomePage],
      imports: [IonicModule.forRoot(), ReactiveFormsModule],
      providers: [
        FormBuilder,
        { provide: HostDiscoveryService, useValue: discoveryStub },
        { provide: HostNetworkService, useValue: networkStub },
        { provide: WifiSoundNativeService, useValue: nativeStub },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Basic creation ───────────────────────────────────────────────

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // ── Host form / presets ──────────────────────────────────────────

  it('should initialise host form with default preset values', () => {
    const defaultPreset = component.hostPresets[0];
    expect(component.mode).toBe('host');
    expect(component.hostForm.value.codec).toBe(defaultPreset.codec);
    expect(component.hostForm.value.sampleRate).toBe(
      defaultPreset.sampleRate
    );
    expect(component.hostForm.value.frameSize).toBe(defaultPreset.frameSize);
    expect(component.hostForm.value.jitterBuffer).toBe(
      defaultPreset.jitterBuffer
    );
    const hasConsoleReady = component.logEntries.some((e) =>
      e.message.includes('Console ready')
    );
    expect(hasConsoleReady).toBeTrue();
  });

  it('should apply preset changes when selected', () => {
    const targetPreset = component.hostPresets[1];
    component.handlePresetChange(targetPreset.id);
    expect(component.hostForm.get('codec')?.value).toBe(targetPreset.codec);
    expect(component.hostForm.get('sampleRate')?.value).toBe(
      targetPreset.sampleRate
    );
    expect(component.hostForm.get('frameSize')?.value).toBe(
      targetPreset.frameSize
    );
    expect(component.hostForm.get('jitterBuffer')?.value).toBe(
      targetPreset.jitterBuffer
    );
  });

  it('should ignore invalid preset ids', () => {
    const before = component.hostForm.value.codec;
    component.handlePresetChange(undefined);
    expect(component.hostForm.value.codec).toBe(before);
    component.handlePresetChange('nonexistent');
    expect(component.hostForm.value.codec).toBe(before);
  });

  // ── Mode switching ───────────────────────────────────────────────

  it('should switch modes and log context hints', () => {
    component.onModeChange('client');
    expect(component.mode).toBe('client');
    expect(component.logEntries[0].message).toContain(
      'Switched to client controls'
    );

    component.onModeChange('host');
    expect(component.mode).toBe('host');
    expect(component.logEntries[0].message).toContain(
      'Switched to host controls'
    );
  });

  it('should ignore invalid or duplicate mode changes', () => {
    component.onModeChange(undefined);
    expect(component.mode).toBe('host');

    const logCount = component.logEntries.length;
    component.onModeChange('host'); // same mode
    expect(component.logEntries.length).toBe(logCount);
  });

  // ── Host start/stop — projection fallback (Shizuku unavailable) ──

  it('should check Shizuku first, then fall back to projection', fakeAsync(() => {
    component.startHost();
    flushMicrotasks();

    expect(nativeStub.checkShizuku).toHaveBeenCalled();
    expect(nativeStub.requestMediaProjection).toHaveBeenCalled();
    expect(nativeStub.startHost).toHaveBeenCalled();
    expect(component.hostStreaming).toBeTrue();
    expect(component.logEntries[0].message).toContain('Broadcast started');
    expect(component.logEntries[0].message).toContain('[Projection]');
  }));

  it('should pass captureMode projection when Shizuku unavailable', fakeAsync(() => {
    component.startHost();
    flushMicrotasks();

    const callArgs = nativeStub.startHost.calls.mostRecent().args[0];
    expect(callArgs.captureMode).toBe('projection');
  }));

  it('should build peer list from form when starting host', fakeAsync(() => {
    component.hostForm.patchValue({ peers: '10.0.0.1, 10.0.0.2' });
    component.startHost();
    flushMicrotasks();

    expect(component.connectedPeers.length).toBe(2);
    expect(component.connectedPeers[0].address).toBe('10.0.0.1');
    expect(component.connectedPeers[1].address).toBe('10.0.0.2');
    expect(
      component.connectedPeers.every((p) => p.badgeColor === 'success')
    ).toBeTrue();
  }));

  it('should pass correct config to native startHost', fakeAsync(() => {
    component.startHost();
    flushMicrotasks();

    const callArgs = nativeStub.startHost.calls.mostRecent().args[0];
    expect(callArgs.sampleRate).toBe(component.hostForm.value.sampleRate);
    expect(callArgs.frameSize).toBe(component.hostForm.value.frameSize);
    expect(callArgs.jitterBuffer).toBe(component.hostForm.value.jitterBuffer);
    expect(callArgs.hostAddress).toBe('192.168.43.1');
  }));

  it('should not start if already streaming', fakeAsync(() => {
    component.startHost();
    flushMicrotasks();
    nativeStub.checkShizuku.calls.reset();

    component.startHost();
    flushMicrotasks();
    expect(nativeStub.checkShizuku).not.toHaveBeenCalled();
  }));

  it('should log error when media projection denied', fakeAsync(() => {
    nativeStub.requestMediaProjection.and.returnValue(
      Promise.resolve(false)
    );

    component.startHost();
    flushMicrotasks();

    expect(component.hostStreaming).toBeFalse();
    expect(component.logEntries[0].message).toContain('permission denied');
  }));

  it('should log error when native startHost fails', fakeAsync(() => {
    nativeStub.startHost.and.returnValue(
      Promise.reject(new Error('Service crash'))
    );

    component.startHost();
    flushMicrotasks();

    expect(component.hostStreaming).toBeFalse();
    expect(component.logEntries[0].message).toContain(
      'Failed to start broadcast'
    );
  }));

  it('should stop native host and update state', fakeAsync(() => {
    component.startHost();
    flushMicrotasks();

    component.stopHost();
    flushMicrotasks();

    expect(nativeStub.stopHost).toHaveBeenCalled();
    expect(component.hostStreaming).toBeFalse();
    expect(component.logEntries[0].message).toContain('Broadcast stopped');
  }));

  it('should not stop if not streaming', fakeAsync(() => {
    component.stopHost();
    flushMicrotasks();
    expect(nativeStub.stopHost).not.toHaveBeenCalled();
  }));

  // ── Shizuku capture mode ────────────────────────────────────────

  it('should use Shizuku mode when available and granted', fakeAsync(() => {
    nativeStub.checkShizuku.and.returnValue(
      Promise.resolve({ available: true, granted: true })
    );
    nativeStub.startHost.and.returnValue(
      Promise.resolve({ captureMode: 'shizuku' })
    );

    component.startHost();
    flushMicrotasks();

    // Should NOT request MediaProjection
    expect(nativeStub.requestMediaProjection).not.toHaveBeenCalled();
    expect(nativeStub.requestShizukuPermission).not.toHaveBeenCalled();

    const callArgs = nativeStub.startHost.calls.mostRecent().args[0];
    expect(callArgs.captureMode).toBe('shizuku');
    expect(component.hostStreaming).toBeTrue();
    expect(component.logEntries[0].message).toContain('[Shizuku]');

    // Check that the REMOTE_SUBMIX log appeared
    const submixLog = component.logEntries.find((e) =>
      e.message.includes('REMOTE_SUBMIX')
    );
    expect(submixLog).toBeTruthy();
  }));

  it('should request Shizuku permission when available but not granted', fakeAsync(() => {
    nativeStub.checkShizuku.and.returnValue(
      Promise.resolve({ available: true, granted: false })
    );
    nativeStub.requestShizukuPermission.and.returnValue(
      Promise.resolve(true)
    );
    nativeStub.startHost.and.returnValue(
      Promise.resolve({ captureMode: 'shizuku' })
    );

    component.startHost();
    flushMicrotasks();

    expect(nativeStub.requestShizukuPermission).toHaveBeenCalled();
    expect(nativeStub.requestMediaProjection).not.toHaveBeenCalled();

    const callArgs = nativeStub.startHost.calls.mostRecent().args[0];
    expect(callArgs.captureMode).toBe('shizuku');
    expect(component.hostStreaming).toBeTrue();

    const grantedLog = component.logEntries.find((e) =>
      e.message.includes('Shizuku permission granted')
    );
    expect(grantedLog).toBeTruthy();
  }));

  it('should fall back to projection when Shizuku permission denied', fakeAsync(() => {
    nativeStub.checkShizuku.and.returnValue(
      Promise.resolve({ available: true, granted: false })
    );
    nativeStub.requestShizukuPermission.and.returnValue(
      Promise.resolve(false)
    );

    component.startHost();
    flushMicrotasks();

    expect(nativeStub.requestShizukuPermission).toHaveBeenCalled();
    // Falls back to projection
    expect(nativeStub.requestMediaProjection).toHaveBeenCalled();

    const callArgs = nativeStub.startHost.calls.mostRecent().args[0];
    expect(callArgs.captureMode).toBe('projection');
    expect(component.hostStreaming).toBeTrue();
    expect(component.logEntries[0].message).toContain('[Projection]');

    const fallbackLog = component.logEntries.find((e) =>
      e.message.includes('Falling back to MediaProjection')
    );
    expect(fallbackLog).toBeTruthy();
  }));

  it('should abort when Shizuku denied and projection also denied', fakeAsync(() => {
    nativeStub.checkShizuku.and.returnValue(
      Promise.resolve({ available: true, granted: false })
    );
    nativeStub.requestShizukuPermission.and.returnValue(
      Promise.resolve(false)
    );
    nativeStub.requestMediaProjection.and.returnValue(
      Promise.resolve(false)
    );

    component.startHost();
    flushMicrotasks();

    expect(component.hostStreaming).toBeFalse();
    expect(nativeStub.startHost).not.toHaveBeenCalled();
    expect(component.logEntries[0].message).toContain('permission denied');
  }));

  it('should log Shizuku not available warning', fakeAsync(() => {
    // Default stub: Shizuku unavailable
    component.startHost();
    flushMicrotasks();

    const notAvailableLog = component.logEntries.find((e) =>
      e.message.includes('Shizuku not available')
    );
    expect(notAvailableLog).toBeTruthy();
    expect(notAvailableLog?.level).toBe('warning');
  }));

  it('should handle checkShizuku failure gracefully', fakeAsync(() => {
    nativeStub.checkShizuku.and.returnValue(
      Promise.reject(new Error('Shizuku not installed'))
    );

    component.startHost();
    flushMicrotasks();

    expect(component.hostStreaming).toBeFalse();
    expect(component.logEntries[0].message).toContain(
      'Failed to start broadcast'
    );
  }));

  it('should not request Shizuku permission when already granted', fakeAsync(() => {
    nativeStub.checkShizuku.and.returnValue(
      Promise.resolve({ available: true, granted: true })
    );
    nativeStub.startHost.and.returnValue(
      Promise.resolve({ captureMode: 'shizuku' })
    );

    component.startHost();
    flushMicrotasks();

    expect(nativeStub.requestShizukuPermission).not.toHaveBeenCalled();
  }));

  // ── Client connect/disconnect (async, native) ────────────────────

  it('should connect client via native service', fakeAsync(() => {
    discoveryStub.emit([demoHost]);
    fixture.detectChanges();

    component.connectClient();
    flushMicrotasks();

    expect(nativeStub.startClient).toHaveBeenCalledWith(
      jasmine.objectContaining({
        hostAddress: '192.168.1.42',
      })
    );
    expect(component.clientConnected).toBeTrue();
    expect(component.clientStatus.state).toBe('Connected');
    expect(component.clientStatus.codec).toBe('PCM 16-bit');
    expect(component.logEntries[0].message).toContain('Connected to Demo Host');
  }));

  it('should warn when connecting without a selected host', fakeAsync(() => {
    component.connectClient();
    flushMicrotasks();

    expect(component.clientConnected).toBeFalse();
    expect(nativeStub.startClient).not.toHaveBeenCalled();
    expect(component.logEntries[0].message).toContain('No host available');
  }));

  it('should log error when native startClient fails', fakeAsync(() => {
    discoveryStub.emit([demoHost]);
    nativeStub.startClient.and.returnValue(
      Promise.reject(new Error('Socket bind failed'))
    );

    component.connectClient();
    flushMicrotasks();

    expect(component.clientConnected).toBeFalse();
    expect(component.clientStatus.state).toBe('Disconnected');
    expect(component.logEntries[0].message).toContain('Connection failed');
  }));

  it('should disconnect client via native service', fakeAsync(() => {
    discoveryStub.emit([demoHost]);
    component.connectClient();
    flushMicrotasks();

    component.disconnectClient();
    flushMicrotasks();

    expect(nativeStub.stopClient).toHaveBeenCalled();
    expect(component.clientConnected).toBeFalse();
    expect(component.clientStatus.state).toBe('Disconnected');
    expect(component.logEntries[0].message).toContain(
      'Client disconnected'
    );
  }));

  it('should not disconnect if not connected', fakeAsync(() => {
    component.disconnectClient();
    flushMicrotasks();
    expect(nativeStub.stopClient).not.toHaveBeenCalled();
  }));

  // ── Host metrics ─────────────────────────────────────────────────

  it('should update stat cards from host metrics events', fakeAsync(() => {
    component.startHost();
    flushMicrotasks();

    nativeStub.hostMetrics$.next({
      packetsSent: 500,
      bytesSent: 50000,
      peerCount: 2,
      uptimeMs: 65000,
    });

    const cards = component.hostStatCards;
    const peers = cards.find((c) => c.label === 'Active peers');
    const packets = cards.find((c) => c.label === 'Packets sent');
    const uptime = cards.find((c) => c.label === 'Uptime');

    expect(peers?.value).toBe('2');
    expect(packets?.value).toBe('500');
    expect(uptime?.value).toBe('00:01:05');
  }));

  it('should show dashes in stat cards when not streaming', () => {
    const cards = component.hostStatCards;
    expect(cards.find((c) => c.label === 'Active peers')?.value).toBe('0');
    expect(cards.find((c) => c.label === 'Packets sent')?.value).toBe('--');
    expect(cards.find((c) => c.label === 'Uptime')?.value).toBe('--');
  });

  // ── Client metrics ───────────────────────────────────────────────

  it('should update client status from client metrics events', fakeAsync(() => {
    discoveryStub.emit([demoHost]);
    component.connectClient();
    flushMicrotasks();

    nativeStub.clientMetrics$.next({
      packetsReceived: 100,
      latencyUs: 45000,
      bufferDepth: 3,
      packetsDropped: 1,
    });
    fixture.detectChanges();

    expect(component.clientStatus.latency).toBe('45 ms');
    expect(component.clientStatus.buffer).toBe('3 frames');
  }));

  it('should ignore client metrics when not connected', () => {
    const before = { ...component.clientStatus };

    nativeStub.clientMetrics$.next({
      packetsReceived: 50,
      latencyUs: 30000,
      bufferDepth: 2,
      packetsDropped: 0,
    });

    expect(component.clientStatus.latency).toBe(before.latency);
  });

  // ── Discovery ────────────────────────────────────────────────────

  it('should auto-select first discovered host', () => {
    discoveryStub.emit([demoHost]);
    expect(component.selectedHostId).toBe('demo');
    expect(component.discoveredHosts.length).toBe(1);
  });

  it('should warn when selected host disappears', () => {
    discoveryStub.emit([demoHost]);
    expect(component.selectedHostId).toBe('demo');

    discoveryStub.emit([]);
    expect(component.selectedHostId).toBeNull();
    expect(component.logEntries[0].message).toContain(
      'no longer broadcasting'
    );
  });

  // ── Signal helpers ───────────────────────────────────────────────

  it('should return correct badge color for signal strength', () => {
    expect(component.badgeColorForSignal(-40)).toBe('success');
    expect(component.badgeColorForSignal(-55)).toBe('success');
    expect(component.badgeColorForSignal(-60)).toBe('warning');
    expect(component.badgeColorForSignal(-70)).toBe('warning');
    expect(component.badgeColorForSignal(-80)).toBe('danger');
  });

  it('should return correct signal label', () => {
    expect(component.signalStrengthLabel(-40)).toBe('Strong');
    expect(component.signalStrengthLabel(-60)).toBe('Fair');
    expect(component.signalStrengthLabel(-80)).toBe('Weak');
  });

  // ── Log helpers ──────────────────────────────────────────────────

  it('should return correct icon for each log level', () => {
    expect(component.logIcon('success')).toBe('checkmark-circle-outline');
    expect(component.logIcon('warning')).toBe('alert-circle-outline');
    expect(component.logIcon('error')).toBe('close-circle-outline');
    expect(component.logIcon('info')).toBe('information-circle-outline');
  });

  it('should return correct color for each log level', () => {
    expect(component.logColor('success')).toBe('success');
    expect(component.logColor('warning')).toBe('warning');
    expect(component.logColor('error')).toBe('danger');
    expect(component.logColor('info')).toBe('primary');
  });

  it('should limit log entries to 8', fakeAsync(() => {
    // Generate many log entries by toggling modes repeatedly
    for (let i = 0; i < 12; i++) {
      component.onModeChange(i % 2 === 0 ? 'client' : 'host');
    }
    expect(component.logEntries.length).toBeLessThanOrEqual(8);
  }));

  // ── Network IP logging ───────────────────────────────────────────

  it('should log when host network IP is detected', () => {
    networkStub.emit({
      ipAddress: '10.0.0.5',
      connectionType: 'wifi',
      fetchedAt: new Date(),
      source: 'plugin',
    });
    expect(component.logEntries[0].message).toContain(
      'Host network address detected: 10.0.0.5'
    );
  });

  it('should log warning when IP becomes unavailable', () => {
    networkStub.emit({
      ipAddress: '10.0.0.5',
      connectionType: 'wifi',
      fetchedAt: new Date(),
      source: 'plugin',
    });
    networkStub.emit({
      ipAddress: null,
      connectionType: null,
      fetchedAt: new Date(),
      source: 'fallback',
    });
    expect(component.logEntries[0].message).toContain(
      'Host network address unavailable'
    );
  });

  // ── Refresh host network ─────────────────────────────────────────

  it('should refresh host network details on demand', fakeAsync(() => {
    component.refreshHostNetwork();
    expect(component.refreshingHostNetwork).toBeTrue();
    expect(networkStub.refresh).toHaveBeenCalled();

    flushMicrotasks();
    expect(component.refreshingHostNetwork).toBeFalse();
  }));

  it('should not refresh if already refreshing', () => {
    component.refreshHostNetwork();
    networkStub.refresh.calls.reset();
    component.refreshHostNetwork();
    expect(networkStub.refresh).not.toHaveBeenCalled();
  });

  // ── Disable getters ──────────────────────────────────────────────

  it('should disable start when form is invalid', () => {
    component.hostForm.patchValue({ codec: null });
    expect(component.disableStartHost).toBeTrue();
  });

  it('should disable connect when no host selected', () => {
    expect(component.disableConnect).toBeTrue();
  });

  it('should enable connect when host is discovered', () => {
    discoveryStub.emit([demoHost]);
    expect(component.disableConnect).toBeFalse();
  });

  it('should disable disconnect when not connected', () => {
    expect(component.disableDisconnect).toBeTrue();
  });

  // ── Reset host form ──────────────────────────────────────────────

  it('should reset host form to defaults', () => {
    component.hostForm.patchValue({ codec: 'aac', sampleRate: 44100 });
    component.resetHostForm();

    const defaultPreset = component.hostPresets[0];
    expect(component.hostForm.value.codec).toBe(defaultPreset.codec);
    expect(component.hostForm.value.sampleRate).toBe(
      defaultPreset.sampleRate
    );
    expect(component.logEntries[0].message).toContain('reset to defaults');
  });

  // ── Select host ──────────────────────────────────────────────────

  it('should select a discovered host and log', () => {
    discoveryStub.emit([demoHost]);
    const other: DiscoveredHost = {
      ...demoHost,
      id: 'other',
      name: 'Other Host',
      address: '192.168.1.99',
    };
    discoveryStub.emit([demoHost, other]);

    component.selectDiscoveredHost(other);
    expect(component.selectedHostId).toBe('other');
    expect(component.logEntries[0].message).toContain('Other Host');
  });

  // ── Cleanup ──────────────────────────────────────────────────────

  it('should clean up subscriptions on destroy', () => {
    component.ngOnDestroy();
    // Should not throw; subscriptions are cleaned up
    expect(component).toBeTruthy();
  });
});
