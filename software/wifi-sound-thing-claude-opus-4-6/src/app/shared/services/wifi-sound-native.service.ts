import { inject, Injectable, NgZone } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
  WifiSound,
  StartHostOptions,
  StartClientOptions,
  HostMetricsEvent,
  ClientMetricsEvent,
  DiscoveredHostEvent,
  HostLostEvent,
  ShizukuStatus,
} from '../plugins/wifi-sound.plugin';

/**
 * Angular wrapper around the native WifiSound Capacitor plugin.
 *
 * Converts plugin events into RxJS Observables (inside NgZone so Angular
 * change detection works) and provides typed async methods for the UI layer.
 */
@Injectable({ providedIn: 'root' })
export class WifiSoundNativeService {
  private readonly ngZone = inject(NgZone);

  private readonly hostMetricsSubject = new Subject<HostMetricsEvent>();
  private readonly clientMetricsSubject = new Subject<ClientMetricsEvent>();
  private readonly hostDiscoveredSubject = new Subject<DiscoveredHostEvent>();
  private readonly hostLostSubject = new Subject<HostLostEvent>();

  /** Emits host-side streaming metrics every ~1 s while broadcasting. */
  readonly onHostMetrics: Observable<HostMetricsEvent> =
    this.hostMetricsSubject.asObservable();

  /** Emits client-side playback metrics every ~1 s while connected. */
  readonly onClientMetrics: Observable<ClientMetricsEvent> =
    this.clientMetricsSubject.asObservable();

  /** Emits whenever a new host beacon is received (client discovery). */
  readonly onHostDiscovered: Observable<DiscoveredHostEvent> =
    this.hostDiscoveredSubject.asObservable();

  /** Emits when a previously discovered host stops broadcasting. */
  readonly onHostLost: Observable<HostLostEvent> =
    this.hostLostSubject.asObservable();

  constructor() {
    this.registerListeners();
  }

  // ── Shizuku ──────────────────────────────────────────────────────────

  async checkShizuku(): Promise<ShizukuStatus> {
    return WifiSound.checkShizuku();
  }

  async requestShizukuPermission(): Promise<boolean> {
    const result = await WifiSound.requestShizukuPermission();
    return result.granted;
  }

  // ── Host ─────────────────────────────────────────────────────────────

  async requestMediaProjection(): Promise<boolean> {
    const result = await WifiSound.requestMediaProjection();
    return result.granted;
  }

  async startHost(options: StartHostOptions): Promise<{ captureMode: string }> {
    const result = await WifiSound.startHost(options);
    return { captureMode: result.captureMode };
  }

  async stopHost(): Promise<void> {
    await WifiSound.stopHost();
  }

  // ── Client ───────────────────────────────────────────────────────────

  async startClient(options: StartClientOptions): Promise<void> {
    await WifiSound.startClient(options);
  }

  async stopClient(): Promise<void> {
    await WifiSound.stopClient();
  }

  // ── Discovery ────────────────────────────────────────────────────────

  async startDiscovery(): Promise<void> {
    await WifiSound.startDiscovery();
  }

  async stopDiscovery(): Promise<void> {
    await WifiSound.stopDiscovery();
  }

  // ── Internals ────────────────────────────────────────────────────────

  private registerListeners(): void {
    WifiSound.addListener('metricsUpdate', (data) => {
      this.ngZone.run(() => this.hostMetricsSubject.next(data));
    });

    WifiSound.addListener('clientMetricsUpdate', (data) => {
      this.ngZone.run(() => this.clientMetricsSubject.next(data));
    });

    WifiSound.addListener('hostDiscovered', (data) => {
      this.ngZone.run(() => this.hostDiscoveredSubject.next(data));
    });

    WifiSound.addListener('hostLost', (data) => {
      this.ngZone.run(() => this.hostLostSubject.next(data));
    });
  }
}
