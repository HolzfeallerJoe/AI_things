import { Component, OnDestroy, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import type { SegmentValue } from '@ionic/angular';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  DiscoveredHost,
  HostDiscoveryService,
} from '../shared/services/host-discovery.service';
import {
  HostNetworkInfo,
  HostNetworkService,
} from '../shared/services/host-network.service';
import {
  CaptureSource,
  RealtimeAudioService,
} from '../shared/services/realtime-audio.service';
import { NativeUdpAudioService } from '../shared/services/native-udp-audio.service';
import { environment } from '../../environments/environment';

type ControlMode = 'host' | 'client';
type LogLevel = 'info' | 'success' | 'warning' | 'error';
type TransportMode = 'native-udp' | 'webrtc';
type RuntimeMode = 'none' | 'native-host' | 'native-client' | 'webrtc-host' | 'webrtc-client';

interface HostPreset {
  id: string;
  name: string;
  description: string;
  codec: string;
  sampleRate: number;
  frameSize: number;
  jitterBuffer: number;
}

interface PeerStatus {
  name: string;
  address: string;
  latencyMs: number;
  jitterMs: number;
  badgeColor: 'success' | 'warning' | 'medium';
  stateLabel: string;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

interface ClientStatus {
  state: 'Disconnected' | 'Connecting' | 'Syncing' | 'Connected' | 'Error';
  latency: string;
  jitter: string;
  buffer: string;
  codec: string;
  signal: string;
  lastSync: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false,
})
export class HomePage implements OnDestroy {
  mode: ControlMode = 'host';
  hostStreaming = false;
  clientConnected = false;

  readonly hostPresets: HostPreset[] = [
    {
      id: 'movie-night',
      name: 'Movie Night',
      description: 'Balanced Opus @ 48 kHz, roomy buffers',
      codec: 'opus',
      sampleRate: 48000,
      frameSize: 960,
      jitterBuffer: 4,
    },
    {
      id: 'low-latency',
      name: 'Low Latency',
      description: 'Tiny buffers, for rhythm-critical playback',
      codec: 'opus',
      sampleRate: 48000,
      frameSize: 480,
      jitterBuffer: 2,
    },
    {
      id: 'battery-saver',
      name: 'Battery Saver',
      description: 'AAC @ 44.1 kHz with relaxed buffers',
      codec: 'aac',
      sampleRate: 44100,
      frameSize: 1024,
      jitterBuffer: 5,
    },
  ];

  readonly codecOptions = [
    { value: 'opus', label: 'Opus (low latency)' },
    { value: 'aac', label: 'AAC (broad compatibility)' },
    { value: 'pcm', label: 'PCM 16-bit (debug)' },
  ];

  readonly sampleRateOptions = [44100, 48000];
  readonly frameSizeOptions = [480, 960, 1024, 2048];
  readonly encryptionOptions = [
    { value: 'none', label: 'Unencrypted LAN' },
    { value: 'psk', label: 'Pre-shared key' },
  ];
  readonly outputTargets = [
    { value: 'bluetooth', label: 'Bluetooth headset' },
    { value: 'speaker', label: 'Built-in speaker' },
    { value: 'aux', label: '3.5mm adapter' },
  ];
  readonly captureOptions: Array<{ value: CaptureSource; label: string }> = [
    { value: 'display', label: 'Auto (playback capture, mic fallback)' },
    { value: 'microphone', label: 'Microphone only fallback' },
  ];
  readonly transportOptions: Array<{ value: TransportMode; label: string }> = [
    { value: 'native-udp', label: 'Native UDP (best chance on Android)' },
    { value: 'webrtc', label: 'WebRTC (browser/signaling)' },
  ];

  private readonly formBuilder = inject(FormBuilder);
  private readonly discoveryService = inject(HostDiscoveryService);
  private readonly hostNetworkService = inject(HostNetworkService);
  private readonly realtimeAudioService = inject(RealtimeAudioService);
  private readonly nativeAudioService = inject(NativeUdpAudioService);

  hostForm: FormGroup = this.buildHostForm();
  clientForm: FormGroup = this.buildClientForm();
  readonly hostNetworkInfo$ = this.hostNetworkService.info$;

  refreshingHostNetwork = false;

  private readonly defaultPeers: PeerStatus[] = [
    {
      name: 'Client slot 1',
      address: 'Awaiting connection',
      latencyMs: 0,
      jitterMs: 0,
      badgeColor: 'medium',
      stateLabel: 'Standby',
    },
    {
      name: 'Client slot 2',
      address: 'Awaiting connection',
      latencyMs: 0,
      jitterMs: 0,
      badgeColor: 'medium',
      stateLabel: 'Standby',
    },
  ];

  connectedPeers: PeerStatus[] = this.defaultPeers.map((peer) => ({ ...peer }));

  logEntries: LogEntry[] = [
    this.makeLogEntry(
      'info',
      'Console ready. Native UDP mode is default for highest Spotify/Crunchyroll compatibility.'
    ),
  ];

  private readonly defaultClientStatus: ClientStatus = {
    state: 'Disconnected',
    latency: '--',
    jitter: '--',
    buffer: '3 frames',
    codec: 'Awaiting host',
    signal: '--',
    lastSync: '--',
  };

  clientStatus: ClientStatus = { ...this.defaultClientStatus };

  discoveredHosts: DiscoveredHost[] = [];
  selectedHostId: string | null = null;
  discoveryInProgress = false;
  discoveryMessage = '';

  private readonly destroy$ = new Subject<void>();
  private discoverySubscription: Subscription | null = null;
  private lastLoggedHostIp: string | null = null;
  private latestHostNetworkInfo: HostNetworkInfo | null = null;
  private liveHostPeerCount = 0;
  private liveHostBitrateKbps: number | null = null;
  private runtimeMode: RuntimeMode = 'none';
  private nativeStatusTimer: ReturnType<typeof setInterval> | null = null;
  private lastNativeError: string | null = null;
  private lastNativeMode: string | null = null;

  constructor() {
    this.applyPreset(this.hostPresets[0]);
    this.initializeDiscovery();
    this.observeHostNetwork();
    this.observeRealtimeStatus();
  }

  ngOnDestroy(): void {
    this.discoverySubscription?.unsubscribe();
    this.stopNativeStatusPolling();
    void this.realtimeAudioService.stop();
    void this.nativeAudioService.stopHost();
    void this.nativeAudioService.stopClient();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get hostTransportMode(): TransportMode {
    return this.hostForm.value.transportMode === 'webrtc' ? 'webrtc' : 'native-udp';
  }

  get clientTransportMode(): TransportMode {
    return this.clientForm.value.transportMode === 'webrtc' ? 'webrtc' : 'native-udp';
  }

  get showDiscoveryCard(): boolean {
    return this.clientTransportMode === 'webrtc';
  }

  get hostStatCards(): Array<{ label: string; value: string; helper?: string }> {
    const activePeers = this.hostStreaming
      ? Math.max(
          this.liveHostPeerCount,
          this.connectedPeers.filter((peer) => peer.badgeColor === 'success').length
        )
      : 0;
    const averageLatency = this.hostStreaming ? this.averageLatency() : null;
    return [
      {
        label: 'Active peers',
        value: `${activePeers}/${Math.max(2, activePeers)}`,
        helper: 'Estimated listeners',
      },
      {
        label: 'Avg latency',
        value: averageLatency !== null ? `${averageLatency} ms` : '--',
      },
      {
        label: 'Codec bitrate',
        value: this.hostStreaming
          ? this.liveHostBitrateKbps !== null
            ? `${this.liveHostBitrateKbps} kbps`
            : this.deriveBitrateLabel(String(this.hostForm.value.codec))
          : '--',
      },
      {
        label: 'Uptime',
        value: this.hostStreaming ? 'Live' : '--',
      },
      {
        label: 'Packet loss',
        value: this.hostStreaming ? '0.8%' : '--',
      },
    ];
  }

  get modeHint(): string {
    if (this.mode === 'host') {
      return this.hostTransportMode === 'native-udp'
        ? 'Native host tries playback capture first; when blocked it falls back to microphone.'
        : 'WebRTC host uses browser capture + signaling.';
    }
    return this.clientTransportMode === 'native-udp'
      ? 'Native client receives UDP packets and plays through local Bluetooth output.'
      : 'WebRTC client discovers host through signaling.';
  }

  get disableStartHost(): boolean {
    return this.hostStreaming || this.hostForm.invalid;
  }

  get disableStopHost(): boolean {
    return !this.hostStreaming;
  }

  get disableConnect(): boolean {
    if (this.clientConnected || this.clientForm.invalid) {
      return true;
    }
    if (this.clientTransportMode === 'webrtc') {
      return !this.selectedHost;
    }
    return !this.resolveNativeHostAddress();
  }

  get disableDisconnect(): boolean {
    return !this.clientConnected;
  }

  get selectedHost(): DiscoveredHost | null {
    if (!this.selectedHostId) {
      return null;
    }
    return this.discoveredHosts.find((host) => host.id === this.selectedHostId) ?? null;
  }

  onModeChange(nextMode: SegmentValue | undefined): void {
    if (nextMode !== 'host' && nextMode !== 'client') {
      return;
    }
    if (nextMode === this.mode) {
      return;
    }
    this.mode = nextMode;
    this.pushLog('info', `Switched to ${nextMode} controls.`);
  }

  handlePresetChange(presetId: SegmentValue | undefined): void {
    if (typeof presetId !== 'string') {
      return;
    }
    const preset = this.hostPresets.find((option) => option.id === presetId);
    if (!preset) {
      return;
    }
    this.hostForm.patchValue({ preset: presetId });
    this.applyPreset(preset);
    this.pushLog('info', `Applied \"${preset.name}\" preset: ${preset.description}.`);
  }

  startHost(): void {
    if (this.hostStreaming) {
      return;
    }
    if (this.hostTransportMode === 'native-udp') {
      void this.startNativeHost();
      return;
    }
    void this.startWebRtcHost();
  }

  stopHost(): void {
    if (!this.hostStreaming) {
      return;
    }
    if (this.runtimeMode === 'native-host') {
      void this.nativeAudioService.stopHost().finally(() => {
        this.stopNativeStatusPolling();
        this.runtimeMode = 'none';
        this.hostStreaming = false;
        this.liveHostPeerCount = 0;
        this.connectedPeers = this.defaultPeers.map((peer) => ({ ...peer }));
        this.pushLog('warning', 'Native host stopped.');
      });
      return;
    }

    void this.realtimeAudioService.stop().then(() => {
      this.runtimeMode = 'none';
      this.hostStreaming = false;
      this.liveHostPeerCount = 0;
      this.applyPeerRuntimeState();
      this.pushLog('warning', 'WebRTC host stopped.');
    });
  }

  resetHostForm(): void {
    const defaultPreset = this.hostPresets[0];
    this.applyPreset(defaultPreset);
    this.hostForm.patchValue({
      preset: defaultPreset.id,
      peers: '',
      encryption: 'none',
      autoStart: true,
      recordSession: false,
      signalingUrl: environment.signalingUrl,
      roomId: environment.defaultRoomId,
      captureSource: 'display',
      transportMode: 'native-udp',
      port: 5052,
    });
    this.pushLog('info', 'Host configuration reset to defaults.');
  }

  connectClient(): void {
    if (this.clientConnected) {
      return;
    }
    if (this.clientTransportMode === 'native-udp') {
      void this.startNativeClient();
      return;
    }
    void this.startWebRtcClient();
  }

  disconnectClient(): void {
    if (!this.clientConnected) {
      return;
    }
    if (this.runtimeMode === 'native-client') {
      void this.nativeAudioService.stopClient().finally(() => {
        this.runtimeMode = 'none';
        this.clientConnected = false;
        this.clientStatus = { ...this.defaultClientStatus };
        this.stopNativeStatusPolling();
        this.pushLog('warning', 'Native client disconnected.');
      });
      return;
    }

    void this.realtimeAudioService.stop().then(() => {
      this.runtimeMode = 'none';
      this.clientConnected = false;
      this.clientStatus = { ...this.defaultClientStatus };
      this.pushLog('warning', 'WebRTC client disconnected.');
    });
  }

  refreshDiscovery(): void {
    if (this.clientTransportMode !== 'webrtc') {
      this.pushLog('info', 'Discovery is only used in WebRTC mode.');
      return;
    }
    const discoveryEnabled = this.clientForm.get('discovery')?.value;
    if (!discoveryEnabled) {
      this.clientForm.patchValue({ discovery: true });
      return;
    }
    this.discoveryService.refresh();
    this.pushLog('info', 'Requested host list refresh.');
  }

  selectDiscoveredHost(host: DiscoveredHost): void {
    this.selectedHostId = host.id;
    this.clientForm.patchValue({ hostAddress: host.address }, { emitEvent: false });
    this.pushLog('success', `Selected host: ${host.name} (${host.address}).`);
  }

  refreshHostNetwork(): void {
    if (this.refreshingHostNetwork) {
      return;
    }
    this.refreshingHostNetwork = true;
    void this.hostNetworkService.refresh().finally(() => {
      this.refreshingHostNetwork = false;
      if (this.runtimeMode === 'webrtc-host') {
        this.syncHostMetadata();
      }
    });
  }

  badgeColorForSignal(signal: number): 'success' | 'warning' | 'danger' {
    if (signal >= -55) {
      return 'success';
    }
    if (signal >= -70) {
      return 'warning';
    }
    return 'danger';
  }

  signalStrengthLabel(signal: number): string {
    if (signal >= -55) {
      return 'Strong';
    }
    if (signal >= -70) {
      return 'Fair';
    }
    return 'Weak';
  }

  trackByTimestamp(_: number, log: LogEntry): string {
    return `${log.timestamp}-${log.level}-${log.message}`;
  }

  logIcon(level: LogLevel): string {
    switch (level) {
      case 'success':
        return 'checkmark-circle-outline';
      case 'warning':
        return 'alert-circle-outline';
      case 'error':
        return 'close-circle-outline';
      default:
        return 'information-circle-outline';
    }
  }

  logColor(level: LogLevel): string {
    switch (level) {
      case 'success':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
        return 'danger';
      default:
        return 'primary';
    }
  }

  private async startNativeHost(): Promise<void> {
    try {
      if (!this.nativeAudioService.isAvailable()) {
        throw new Error('Native mode works only in Android builds.');
      }
      const peers = parsePeerList(String(this.hostForm.value.peers ?? ''));
      if (!peers.length) {
        throw new Error('Enter at least one target peer IP for Native UDP host mode.');
      }

      const captureMode: 'auto' | 'microphone' =
        this.hostForm.value.captureSource === 'microphone' ? 'microphone' : 'auto';
      if (captureMode === 'auto') {
        const granted = await this.nativeAudioService.requestCapturePermission();
        if (!granted) {
          this.pushLog('warning', 'Playback capture denied. Native host will use microphone fallback.');
        }
      }

      const sampleRate = normalizeNumber(this.hostForm.value.sampleRate, 48000);
      const frameSize = normalizeNumber(this.hostForm.value.frameSize, 960);
      const port = normalizeNumber(this.hostForm.value.port, 5052);

      await this.nativeAudioService.startHost({
        peers,
        port,
        sampleRate,
        channels: 2,
        frameSize,
        captureMode,
      });

      this.runtimeMode = 'native-host';
      this.hostStreaming = true;
      this.liveHostPeerCount = peers.length;
      this.liveHostBitrateKbps = Math.round((sampleRate * 16 * 2) / 1000);
      this.connectedPeers = peers.map((address, index) => ({
        name: `Client ${index + 1}`,
        address,
        latencyMs: 80 + index * 4,
        jitterMs: 4,
        badgeColor: 'success',
        stateLabel: 'Streaming',
      }));
      this.pushLog('success', `Native host started on UDP ${port} with ${peers.length} peers.`);
      this.startNativeStatusPolling();
    } catch (error) {
      this.runtimeMode = 'none';
      this.hostStreaming = false;
      this.pushLog('error', `Native host start failed: ${formatError(error)}.`);
    }
  }

  private async startWebRtcHost(): Promise<void> {
    const roomId = normalizeControlValue(this.hostForm.value.roomId, environment.defaultRoomId);
    const signalingUrl = normalizeControlValue(
      this.hostForm.value.signalingUrl,
      environment.signalingUrl
    );
    const captureSource: CaptureSource =
      this.hostForm.value.captureSource === 'microphone' ? 'microphone' : 'display';

    this.pushLog('info', `Starting WebRTC host in room \"${roomId}\".`);
    try {
      await this.realtimeAudioService.startHost({
        signalingUrl,
        roomId,
        name: 'Wi-Fi Audio Host',
        source: captureSource,
        address: this.latestHostNetworkInfo?.ipAddress ?? null,
      });
      this.runtimeMode = 'webrtc-host';
      this.hostStreaming = true;
      this.pushLog('success', 'WebRTC host started.');
    } catch (error) {
      this.runtimeMode = 'none';
      this.hostStreaming = false;
      this.pushLog('error', `WebRTC host start failed: ${formatError(error)}.`);
    }
  }

  private async startNativeClient(): Promise<void> {
    try {
      if (!this.nativeAudioService.isAvailable()) {
        throw new Error('Native mode works only in Android builds.');
      }
      const hostAddress = this.resolveNativeHostAddress();
      if (!hostAddress) {
        throw new Error('Enter host address for Native UDP client mode.');
      }
      const port = normalizeNumber(this.clientForm.value.port, 5052);
      const jitterFrames = normalizeNumber(this.clientForm.value.jitterBuffer, 3);

      this.clientConnected = true;
      this.clientStatus = {
        ...this.clientStatus,
        state: 'Connecting',
        codec: 'Native UDP PCM',
        lastSync: '--',
      };

      await this.nativeAudioService.startClient({
        hostAddress,
        port,
        jitterFrames,
        sampleRate: normalizeNumber(this.hostForm.value.sampleRate, 48000),
        channels: 2,
        frameSize: normalizeNumber(this.hostForm.value.frameSize, 960),
      });

      this.runtimeMode = 'native-client';
      this.clientConnected = true;
      this.clientStatus = {
        state: 'Connected',
        latency: `${64 + jitterFrames * 10} ms`,
        jitter: `${jitterFrames * 4} ms`,
        buffer: `${jitterFrames} frames`,
        codec: 'Native UDP PCM',
        signal: '--',
        lastSync: this.timestampLabel(),
      };
      this.pushLog('success', `Native client started on UDP ${port}. Host target: ${hostAddress}.`);
      this.startNativeStatusPolling();
    } catch (error) {
      this.runtimeMode = 'none';
      this.clientConnected = false;
      this.clientStatus = { ...this.defaultClientStatus };
      this.pushLog('error', `Native client connect failed: ${formatError(error)}.`);
    }
  }

  private async startWebRtcClient(): Promise<void> {
    const targetHost = this.selectedHost;
    if (!targetHost) {
      this.pushLog('warning', 'No host selected.');
      return;
    }

    const signalingUrl = normalizeControlValue(
      this.clientForm.value.signalingUrl,
      environment.signalingUrl
    );

    this.clientConnected = true;
    this.clientStatus = {
      ...this.clientStatus,
      state: 'Connecting',
      lastSync: '--',
    };

    try {
      await this.realtimeAudioService.connectClient({
        signalingUrl,
        roomId: targetHost.roomId,
        hostId: targetHost.id,
        name: 'Wi-Fi Audio Client',
      });
      this.runtimeMode = 'webrtc-client';
      this.pushLog('success', `WebRTC handshake started with ${targetHost.name}.`);
    } catch (error) {
      this.runtimeMode = 'none';
      this.clientConnected = false;
      this.clientStatus = { ...this.defaultClientStatus };
      this.pushLog('error', `WebRTC client connect failed: ${formatError(error)}.`);
    }
  }

  private applyPreset(preset: HostPreset): void {
    this.hostForm.patchValue(
      {
        codec: preset.codec,
        sampleRate: preset.sampleRate,
        frameSize: preset.frameSize,
        jitterBuffer: preset.jitterBuffer,
      },
      { emitEvent: false }
    );
  }

  private averageLatency(): number | null {
    const livePeers = this.connectedPeers.filter((peer) => peer.badgeColor === 'success');
    if (!livePeers.length) {
      return null;
    }
    const total = livePeers.reduce((acc, peer) => acc + peer.latencyMs, 0);
    return Math.round(total / livePeers.length);
  }

  private deriveBitrateLabel(codec: string): string {
    switch (codec) {
      case 'opus':
        return '192 kbps';
      case 'aac':
        return '256 kbps';
      case 'pcm':
        return '1536 kbps';
      default:
        return '--';
    }
  }

  private pushLog(level: LogLevel, message: string): void {
    const entry = this.makeLogEntry(level, message);
    this.logEntries = [entry, ...this.logEntries].slice(0, 12);
  }

  private makeLogEntry(level: LogLevel, message: string): LogEntry {
    return {
      level,
      message,
      timestamp: this.timestampLabel(),
    };
  }

  private timestampLabel(date = new Date()): string {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  private initializeDiscovery(): void {
    const discoveryControl = this.clientForm.get('discovery');
    const transportControl = this.clientForm.get('transportMode');
    if (!discoveryControl || !transportControl) {
      return;
    }

    discoveryControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((enabled) => {
      if (this.clientTransportMode !== 'webrtc') {
        return;
      }
      if (enabled) {
        this.startHostDiscovery(true);
      } else {
        this.stopHostDiscovery(true);
      }
    });

    transportControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((mode) => {
      if (mode === 'webrtc' && discoveryControl.value) {
        this.startHostDiscovery(true);
      } else {
        this.stopHostDiscovery(false);
      }
    });

    if (this.clientTransportMode === 'webrtc' && discoveryControl.value) {
      this.startHostDiscovery();
    } else {
      this.discoveryMessage = 'Discovery hidden in Native UDP mode.';
    }
  }

  private observeHostNetwork(): void {
    this.hostNetworkInfo$.pipe(takeUntil(this.destroy$)).subscribe((info) => {
      this.latestHostNetworkInfo = info;
      this.syncHostIpLog(info);
      if (this.runtimeMode === 'webrtc-host') {
        this.syncHostMetadata();
      }
    });
  }

  private observeRealtimeStatus(): void {
    this.realtimeAudioService.hostStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        if (this.runtimeMode === 'native-host' || this.runtimeMode === 'native-client') {
          return;
        }
        this.liveHostPeerCount = status.peerCount;
        this.liveHostBitrateKbps = status.bitrateKbps;
        this.hostStreaming = this.runtimeMode === 'webrtc-host' && status.state === 'streaming';
        this.applyPeerRuntimeState();
      });

    this.realtimeAudioService.clientStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        if (this.runtimeMode === 'native-host' || this.runtimeMode === 'native-client') {
          return;
        }
        this.clientConnected =
          this.runtimeMode === 'webrtc-client' &&
          (status.state === 'connecting' ||
            status.state === 'syncing' ||
            status.state === 'connected');

        const selectedSignal = this.selectedHost?.signal ?? null;
        this.clientStatus = {
          state: mapClientState(status.state),
          latency: status.latencyMs !== null ? `${status.latencyMs} ms` : '--',
          jitter: status.jitterMs !== null ? `${status.jitterMs} ms` : '--',
          buffer: `${this.clientForm.value.jitterBuffer} frames`,
          codec: status.state === 'idle' ? 'Awaiting host' : 'WebRTC Opus',
          signal: selectedSignal !== null ? `${selectedSignal} dBm` : '--',
          lastSync: status.lastSyncAt ? this.timestampLabel(status.lastSyncAt) : '--',
        };
      });
  }

  private startHostDiscovery(forceRefresh = false): void {
    if (this.clientTransportMode !== 'webrtc') {
      return;
    }
    if (this.hostStreaming || this.clientConnected) {
      return;
    }

    const signalingUrl = normalizeControlValue(
      this.clientForm.value.signalingUrl,
      environment.signalingUrl
    );

    if (forceRefresh) {
      this.discoverySubscription?.unsubscribe();
      this.discoverySubscription = null;
      this.discoveredHosts = [];
      this.selectedHostId = null;
      this.pushLog('info', 'Refreshing host discovery.');
    }

    if (this.discoverySubscription) {
      this.discoveryService.refresh();
      return;
    }

    this.discoveryInProgress = true;
    this.discoveryMessage = 'Scanning for Wi-Fi audio hosts...';

    this.discoverySubscription = this.discoveryService
      .discover(signalingUrl)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (hosts) => {
          this.discoveryInProgress = false;
          this.discoveredHosts = hosts;
          this.discoveryMessage = hosts.length
            ? 'Hosts available. Select one and connect.'
            : 'No hosts discovered yet.';
          this.updateSelectionFromHosts(hosts);
        },
        error: () => {
          this.discoveryInProgress = false;
          this.discoveryMessage = 'Discovery failed. Check signaling URL and network.';
          this.pushLog('warning', 'Host discovery failed.');
        },
      });
  }

  private stopHostDiscovery(paused: boolean): void {
    this.discoverySubscription?.unsubscribe();
    this.discoverySubscription = null;
    this.discoveryService.stop();
    this.discoveryInProgress = false;
    this.discoveryMessage = paused
      ? 'Auto discovery paused. Toggle it back on to resume scanning.'
      : 'Auto discovery stopped.';
  }

  private syncHostIpLog(info: HostNetworkInfo): void {
    const currentIp = info.ipAddress;
    if (currentIp && currentIp !== this.lastLoggedHostIp) {
      this.lastLoggedHostIp = currentIp;
      const via = info.source === 'fallback' ? 'estimated' : 'detected';
      this.pushLog('info', `Host network address ${via}: ${currentIp}.`);
      return;
    }
    if (!currentIp && this.lastLoggedHostIp) {
      this.lastLoggedHostIp = null;
      this.pushLog('warning', 'Host network address unavailable.');
    }
  }

  private updateSelectionFromHosts(hosts: DiscoveredHost[]): void {
    if (!hosts.length) {
      this.selectedHostId = null;
      return;
    }

    const existing = this.selectedHostId && hosts.find((host) => host.id === this.selectedHostId);
    if (existing) {
      return;
    }

    const fallback = hosts[0];
    this.selectedHostId = fallback.id;
    this.clientForm.patchValue({ hostAddress: fallback.address }, { emitEvent: false });
    this.pushLog('info', `Host auto-selected: ${fallback.name} (${fallback.address}).`);
  }

  private applyPeerRuntimeState(): void {
    if (this.runtimeMode === 'native-host') {
      return;
    }
    if (!this.hostStreaming || this.liveHostPeerCount <= 0) {
      this.connectedPeers = this.defaultPeers.map((peer) => ({
        ...peer,
        badgeColor: 'medium',
        stateLabel: 'Standby',
        latencyMs: 0,
        jitterMs: 0,
      }));
      return;
    }

    const activePeers = this.liveHostPeerCount;
    const peers: PeerStatus[] = [];
    for (let index = 0; index < Math.max(activePeers, this.defaultPeers.length); index += 1) {
      const isActive = index < activePeers;
      peers.push({
        name: `Client ${index + 1}`,
        address: isActive ? `peer-${index + 1}` : 'Awaiting connection',
        latencyMs: isActive ? 78 + index * 4 : 0,
        jitterMs: isActive ? 3 + (index % 2) : 0,
        badgeColor: isActive ? 'success' : 'medium',
        stateLabel: isActive ? 'Streaming' : 'Standby',
      });
    }
    this.connectedPeers = peers;
  }

  private syncHostMetadata(): void {
    const roomId = normalizeControlValue(this.hostForm.value.roomId, environment.defaultRoomId);
    this.realtimeAudioService.updateHostMetadata(
      'Wi-Fi Audio Host',
      roomId,
      this.latestHostNetworkInfo?.ipAddress ?? null
    );
  }

  private resolveNativeHostAddress(): string | null {
    const manual = normalizeControlValue(this.clientForm.value.hostAddress, '');
    if (manual) {
      return manual;
    }
    const selected = this.selectedHost?.address ?? null;
    if (!selected || selected === 'address unavailable') {
      return null;
    }
    return selected;
  }

  private startNativeStatusPolling(): void {
    this.stopNativeStatusPolling();
    this.nativeStatusTimer = setInterval(() => {
      void this.nativeAudioService.getStatus().then((status) => {
        if (status.lastError && status.lastError !== this.lastNativeError) {
          this.lastNativeError = status.lastError;
          this.pushLog('error', `Native audio error: ${status.lastError}.`);
        }
        if (this.runtimeMode === 'native-host' && status.hostMode !== this.lastNativeMode) {
          this.lastNativeMode = status.hostMode;
          if (status.hostMode === 'microphone') {
            this.pushLog('warning', 'Native host is using microphone fallback mode.');
          }
        }
      });
    }, 2000);
  }

  private stopNativeStatusPolling(): void {
    if (!this.nativeStatusTimer) {
      return;
    }
    clearInterval(this.nativeStatusTimer);
    this.nativeStatusTimer = null;
  }

  private buildHostForm(): FormGroup {
    const defaultPreset = this.hostPresets[0];
    return this.formBuilder.group({
      preset: [defaultPreset.id, Validators.required],
      codec: [defaultPreset.codec, Validators.required],
      sampleRate: [defaultPreset.sampleRate, Validators.required],
      frameSize: [defaultPreset.frameSize, Validators.required],
      jitterBuffer: [defaultPreset.jitterBuffer, Validators.required],
      peers: [''],
      encryption: ['none', Validators.required],
      autoStart: [true],
      recordSession: [false],
      signalingUrl: [environment.signalingUrl, Validators.required],
      roomId: [environment.defaultRoomId, Validators.required],
      captureSource: ['display', Validators.required],
      transportMode: ['native-udp', Validators.required],
      port: [5052, Validators.required],
    });
  }

  private buildClientForm(): FormGroup {
    return this.formBuilder.group({
      discovery: [true],
      jitterBuffer: [3, Validators.required],
      driftCorrection: [true],
      autoReconnect: [true],
      preferredOutput: ['bluetooth', Validators.required],
      signalingUrl: [environment.signalingUrl, Validators.required],
      transportMode: ['native-udp', Validators.required],
      hostAddress: [''],
      port: [5052, Validators.required],
    });
  }
}

function normalizeControlValue(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') {
    return fallback;
  }
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : fallback;
}

function normalizeNumber(raw: unknown, fallback: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function parsePeerList(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unexpected error';
}

function mapClientState(
  state: 'idle' | 'connecting' | 'syncing' | 'connected' | 'error'
): 'Disconnected' | 'Connecting' | 'Syncing' | 'Connected' | 'Error' {
  switch (state) {
    case 'connecting':
      return 'Connecting';
    case 'syncing':
      return 'Syncing';
    case 'connected':
      return 'Connected';
    case 'error':
      return 'Error';
    default:
      return 'Disconnected';
  }
}
