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
import { WifiSoundNativeService } from '../shared/services/wifi-sound-native.service';
import type { HostMetricsEvent } from '../shared/plugins/wifi-sound.plugin';

type ControlMode = 'host' | 'client';
type LogLevel = 'info' | 'success' | 'warning' | 'error';

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
  state: 'Disconnected' | 'Connected' | 'Syncing';
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

  private readonly formBuilder = inject(FormBuilder);
  private readonly discoveryService = inject(HostDiscoveryService);
  private readonly hostNetworkService = inject(HostNetworkService);
  private readonly wifiSoundNative = inject(WifiSoundNativeService);

  hostForm: FormGroup = this.buildHostForm();
  clientForm: FormGroup = this.buildClientForm();
  readonly hostNetworkInfo$ = this.hostNetworkService.info$;

  refreshingHostNetwork = false;

  connectedPeers: PeerStatus[] = [];

  /** Latest host metrics from the native service. */
  private latestHostMetrics: HostMetricsEvent | null = null;

  logEntries: LogEntry[] = [
    this.makeLogEntry(
      'info',
      'Console ready. Configure a host broadcast or connect as a client.'
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

  constructor() {
    this.applyPreset(this.hostPresets[0]);
    this.initializeDiscovery();
    this.observeHostNetwork();
    this.observeNativeMetrics();
  }

  ngOnDestroy(): void {
    this.discoverySubscription?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get hostStatCards(): Array<{ label: string; value: string; helper?: string }> {
    const metrics = this.latestHostMetrics;
    const peerCount = metrics?.peerCount ?? 0;
    const packetsSent = metrics?.packetsSent ?? 0;
    const uptimeMs = metrics?.uptimeMs ?? 0;

    const uptimeLabel = this.hostStreaming
      ? this.formatUptime(uptimeMs)
      : '--';

    return [
      {
        label: 'Active peers',
        value: this.hostStreaming ? `${peerCount}` : '0',
        helper: 'Peers receiving audio right now',
      },
      {
        label: 'Packets sent',
        value: this.hostStreaming ? `${packetsSent}` : '--',
        helper: 'Total audio frames sent',
      },
      {
        label: 'Codec bitrate',
        value: this.hostStreaming
          ? this.deriveBitrateLabel(this.hostForm.value.codec)
          : '--',
      },
      {
        label: 'Uptime',
        value: uptimeLabel,
      },
    ];
  }

  get modeHint(): string {
    return this.mode === 'host'
      ? 'Host mode captures playback audio and streams it to peers on your Wi-Fi.'
      : 'Client mode listens to a host broadcast and routes audio to this device.';
  }

  get disableStartHost(): boolean {
    return this.hostStreaming || this.hostForm.invalid;
  }

  get disableStopHost(): boolean {
    return !this.hostStreaming;
  }

  get disableConnect(): boolean {
    return (
      this.clientConnected ||
      this.clientForm.invalid ||
      !this.selectedHost
    );
  }

  get disableDisconnect(): boolean {
    return !this.clientConnected;
  }

  get selectedHost(): DiscoveredHost | null {
    if (!this.selectedHostId) {
      return null;
    }
    return (
      this.discoveredHosts.find((host) => host.id === this.selectedHostId) ??
      null
    );
  }

  onModeChange(nextMode: SegmentValue | undefined): void {
    if (nextMode !== 'host' && nextMode !== 'client') {
      return;
    }
    if (nextMode === this.mode) {
      return;
    }
    this.mode = nextMode;
    const level: LogLevel = nextMode === 'host' ? 'info' : 'warning';
    const message =
      nextMode === 'host'
        ? 'Switched to host controls. Verify capture permission before going live.'
        : 'Switched to client controls. Make sure Bluetooth headphones are paired on this device.';
    this.pushLog(level, message);
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
    this.pushLog(
      'info',
      `Applied "${preset.name}" preset: ${preset.description}.`
    );
  }

  async startHost(): Promise<void> {
    if (this.hostStreaming) {
      return;
    }

    try {
      // Step 1: Determine capture mode — prefer Shizuku (captures DRM audio)
      let captureMode: 'shizuku' | 'projection' = 'projection';

      this.pushLog('info', 'Checking Shizuku availability...');
      const shizuku = await this.wifiSoundNative.checkShizuku();

      if (shizuku.available) {
        if (shizuku.granted) {
          captureMode = 'shizuku';
          this.pushLog('success', 'Shizuku available with permission — using REMOTE_SUBMIX capture.');
        } else {
          this.pushLog('info', 'Shizuku running but not granted — requesting permission...');
          const granted = await this.wifiSoundNative.requestShizukuPermission();
          if (granted) {
            captureMode = 'shizuku';
            this.pushLog('success', 'Shizuku permission granted — using REMOTE_SUBMIX capture.');
          } else {
            this.pushLog('warning', 'Shizuku permission denied. Falling back to MediaProjection.');
          }
        }
      } else {
        this.pushLog('warning', 'Shizuku not available. Using MediaProjection (some apps may be silent).');
      }

      // Step 2: Request MediaProjection if needed
      if (captureMode === 'projection') {
        this.pushLog('info', 'Requesting MediaProjection permission...');
        const projGranted = await this.wifiSoundNative.requestMediaProjection();
        if (!projGranted) {
          this.pushLog('error', 'MediaProjection permission denied.');
          return;
        }
      }

      // Step 3: Gather config from form
      const { codec, sampleRate, frameSize, jitterBuffer, peers } =
        this.hostForm.value;
      const peerList = ((peers as string) || '')
        .split(',')
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0);

      // Step 4: Get host address for discovery beacon
      const networkInfo = this.hostNetworkService.currentInfo;
      const hostAddress = networkInfo.ipAddress ?? '192.168.43.1';

      // Step 5: Start native host
      const result = await this.wifiSoundNative.startHost({
        captureMode,
        sampleRate,
        frameSize,
        jitterBuffer,
        peers: peerList,
        hostName: 'WiFi Sound Host',
        hostAddress,
      });

      this.hostStreaming = true;
      this.latestHostMetrics = null;

      // Build peer list for UI
      this.connectedPeers = peerList.map((addr, i) => ({
        name: `Peer ${i + 1}`,
        address: addr,
        latencyMs: 0,
        jitterMs: 0,
        badgeColor: 'success' as const,
        stateLabel: 'Streaming',
      }));

      const modeLabel = result.captureMode === 'shizuku' ? 'Shizuku' : 'Projection';
      const codecLabel =
        typeof codec === 'string' ? codec.toUpperCase() : String(codec);
      const rateValue =
        typeof sampleRate === 'number' ? sampleRate : Number(sampleRate);
      const displayRate = Number.isFinite(rateValue)
        ? rateValue / 1000 + ' kHz'
        : 'unknown rate';
      this.pushLog(
        'success',
        `Broadcast started [${modeLabel}] (${codecLabel} @ ${displayRate}).`
      );
    } catch (error) {
      this.pushLog('error', `Failed to start broadcast: ${error}`);
    }
  }
  async stopHost(): Promise<void> {
    if (!this.hostStreaming) {
      return;
    }
    try {
      await this.wifiSoundNative.stopHost();
    } catch (error) {
      this.pushLog('error', `Error stopping broadcast: ${error}`);
    }
    this.hostStreaming = false;
    this.latestHostMetrics = null;
    this.updatePeerStreamingState(false);
    this.pushLog('warning', 'Broadcast stopped. Peers are standing by.');
  }

  resetHostForm(): void {
    const defaultPreset = this.hostPresets[0];
    this.applyPreset(defaultPreset);
    this.hostForm.patchValue({
      preset: defaultPreset.id,
      peers: '192.168.1.50, 192.168.1.51',
      encryption: 'none',
      autoStart: true,
      recordSession: false,
    });
    this.pushLog('info', 'Host configuration reset to defaults.');
  }

  async connectClient(): Promise<void> {
    if (this.clientConnected) {
      return;
    }
    const targetHost = this.selectedHost;
    if (!targetHost) {
      this.pushLog(
        'warning',
        'No host available. Wait for auto discovery to find a broadcaster.'
      );
      return;
    }

    this.clientStatus = {
      state: 'Syncing',
      latency: '--',
      jitter: '--',
      buffer: `${this.clientForm.value.jitterBuffer} frames`,
      codec: 'Negotiating...',
      signal: '--',
      lastSync: this.timestampLabel(),
    };

    try {
      await this.wifiSoundNative.startClient({
        hostAddress: targetHost.address,
        jitterBuffer: this.clientForm.value.jitterBuffer,
      });

      this.clientConnected = true;
      this.clientStatus = {
        ...this.clientStatus,
        state: 'Connected',
        codec: 'PCM 16-bit',
        lastSync: this.timestampLabel(),
      };
      this.pushLog(
        'success',
        `Connected to ${targetHost.name} (${targetHost.address}).`
      );
    } catch (error) {
      this.clientStatus = { ...this.defaultClientStatus };
      this.pushLog('error', `Connection failed: ${error}`);
    }
  }

  async disconnectClient(): Promise<void> {
    if (!this.clientConnected) {
      return;
    }
    try {
      await this.wifiSoundNative.stopClient();
    } catch { /* best effort */ }
    this.clientConnected = false;
    this.clientStatus = { ...this.defaultClientStatus };
    this.pushLog('warning', 'Client disconnected from host.');
  }

  refreshDiscovery(): void {
    const discoveryEnabled = this.clientForm.get('discovery')?.value;
    if (!discoveryEnabled) {
      this.clientForm.patchValue({ discovery: true });
      return;
    }
    this.startHostDiscovery(true);
  }

  selectDiscoveredHost(host: DiscoveredHost): void {
    this.selectedHostId = host.id;
    this.pushLog(
      'success',
      `Discovered host selected: ${host.name} (${host.address}).`
    );
  }

  refreshHostNetwork(): void {
    if (this.refreshingHostNetwork) {
      return;
    }
    this.refreshingHostNetwork = true;
    void this.hostNetworkService.refresh().finally(() => {
      this.refreshingHostNetwork = false;
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

  private deriveBitrateLabel(codec: string): string {
    switch (codec) {
      case 'opus':
        return '192 kbps (variable)';
      case 'aac':
        return '256 kbps';
      case 'pcm':
        return '1.5 Mbps';
      default:
        return '--';
    }
  }

  private updatePeerStreamingState(active: boolean): void {
    this.connectedPeers = this.connectedPeers.map((peer) => ({
      ...peer,
      badgeColor: active ? 'success' : 'medium',
      stateLabel: active ? 'Streaming' : 'Standby',
    }));
  }

  private pushLog(level: LogLevel, message: string): void {
    const entry = this.makeLogEntry(level, message);
    this.logEntries = [entry, ...this.logEntries].slice(0, 8);
  }

  private makeLogEntry(level: LogLevel, message: string): LogEntry {
    return {
      level,
      message,
      timestamp: this.timestampLabel(),
    };
  }

  private timestampLabel(): string {
    return new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  private initializeDiscovery(): void {
    const discoveryControl = this.clientForm.get('discovery');

    if (discoveryControl) {
      discoveryControl.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((enabled) => {
          if (enabled) {
            this.startHostDiscovery();
          } else {
            this.stopHostDiscovery(true);
          }
        });

      if (discoveryControl.value) {
        this.startHostDiscovery();
      } else {
        this.discoveryMessage =
          'Auto discovery disabled. Re-enable it to resume scanning.';
      }
    }
  }

  private observeHostNetwork(): void {
    this.hostNetworkInfo$
      .pipe(takeUntil(this.destroy$))
      .subscribe((info) => {
        this.syncHostIpLog(info);
      });
  }

  private observeNativeMetrics(): void {
    this.wifiSoundNative.onHostMetrics
      .pipe(takeUntil(this.destroy$))
      .subscribe((metrics) => {
        this.latestHostMetrics = metrics;
      });

    this.wifiSoundNative.onClientMetrics
      .pipe(takeUntil(this.destroy$))
      .subscribe((metrics) => {
        if (!this.clientConnected) {
          return;
        }
        const latencyMs = Math.round(metrics.latencyUs / 1000);
        this.clientStatus = {
          ...this.clientStatus,
          latency: `${latencyMs} ms`,
          buffer: `${metrics.bufferDepth} frames`,
          lastSync: this.timestampLabel(),
        };
      });
  }

  private formatUptime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return [hours, minutes, seconds]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');
  }

  private startHostDiscovery(forceRefresh = false): void {
    if (!forceRefresh && this.discoveryInProgress) {
      return;
    }

    this.discoverySubscription?.unsubscribe();
    this.discoverySubscription = null;
    this.discoveryInProgress = true;
    this.discoveryMessage = 'Scanning for Wi-Fi audio hosts...';

    if (forceRefresh) {
      this.selectedHostId = null;
      this.discoveredHosts = [];
      this.pushLog('info', 'Refreshing auto discovery.');
    } else {
      this.pushLog('info', 'Auto discovery enabled. Scanning for hosts.');
    }

    this.discoverySubscription = this.discoveryService
      .discover()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (hosts) => {
          this.discoveredHosts = hosts;
          this.updateSelectionFromHosts(hosts);
        },
        complete: () => {
          this.discoveryInProgress = false;
          this.discoveryMessage = this.discoveredHosts.length
            ? 'Discovery complete. Select a host or refresh to rescan.'
            : 'No hosts discovered. Ensure a broadcaster is live and refresh.';
        },
        error: () => {
          this.discoveryInProgress = false;
          this.discoveryMessage =
            'Discovery failed. Check your connection and try again.';
          this.pushLog(
            'warning',
            'Auto discovery failed. Check your hotspot or Wi-Fi and try again.'
          );
        },
      });
  }

  private stopHostDiscovery(paused: boolean): void {
    this.discoverySubscription?.unsubscribe();
    this.discoverySubscription = null;
    this.discoveryInProgress = false;
    this.discoveryMessage = paused
      ? 'Auto discovery paused. Toggle it back on to resume scanning.'
      : 'Auto discovery stopped.';
    if (paused) {
      this.pushLog(
        'warning',
        'Auto discovery disabled. Toggle it back on when you are ready to scan.'
      );
    }
  }

  private syncHostIpLog(info: HostNetworkInfo): void {
    const currentIp = info.ipAddress;
    if (currentIp && currentIp !== this.lastLoggedHostIp) {
      this.lastLoggedHostIp = currentIp;
      const via = info.source === 'plugin' ? 'detected' : 'estimated';
      this.pushLog('info', `Host network address ${via}: ${currentIp}.`);
      return;
    }
    if (!currentIp && this.lastLoggedHostIp) {
      this.lastLoggedHostIp = null;
      this.pushLog(
        'warning',
        'Host network address unavailable. Check your Wi-Fi or hotspot.'
      );
    }
  }

  private updateSelectionFromHosts(hosts: DiscoveredHost[]): void {
    if (!hosts.length) {
      if (this.selectedHostId) {
        this.pushLog(
          'warning',
          'Selected host is no longer broadcasting. Waiting for a replacement.'
        );
      }
      this.selectedHostId = null;
      return;
    }

    const existing =
      this.selectedHostId &&
      hosts.find((host) => host.id === this.selectedHostId);

    if (existing) {
      return;
    }

    const fallback = hosts[0];
    const hadSelection = !!this.selectedHostId;
    this.selectedHostId = fallback.id;
    this.pushLog(
      hadSelection ? 'warning' : 'info',
      hadSelection
        ? `Switched to ${fallback.name} automatically - previous host went offline.`
        : `Host auto-selected: ${fallback.name} (${fallback.address}).`
    );
  }

  private buildHostForm(): FormGroup {
    const defaultPreset = this.hostPresets[0];
    return this.formBuilder.group({
      preset: [defaultPreset.id, Validators.required],
      codec: [defaultPreset.codec, Validators.required],
      sampleRate: [defaultPreset.sampleRate, Validators.required],
      frameSize: [defaultPreset.frameSize, Validators.required],
      jitterBuffer: [defaultPreset.jitterBuffer, Validators.required],
      peers: ['192.168.1.50, 192.168.1.51'],
      encryption: ['none', Validators.required],
      autoStart: [true],
      recordSession: [false],
    });
  }

  private buildClientForm(): FormGroup {
    return this.formBuilder.group({
      discovery: [true],
      jitterBuffer: [3, Validators.required],
      driftCorrection: [true],
      autoReconnect: [true],
      preferredOutput: ['bluetooth', Validators.required],
    });
  }
}
