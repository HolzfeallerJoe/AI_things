import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { WifiSound } from '../plugins/wifi-sound.plugin';

type NetworkSource = 'native' | 'plugin' | 'fallback';

export interface HostNetworkInfo {
  ipAddress: string | null;
  connectionType: string | null;
  fetchedAt: Date | null;
  source: NetworkSource;
  fallbackReason?: string;
}

@Injectable({
  providedIn: 'root',
})
export class HostNetworkService {
  private readonly infoSubject = new BehaviorSubject<HostNetworkInfo>({
    ipAddress: null,
    connectionType: null,
    fetchedAt: null,
    source: 'fallback',
    fallbackReason: 'Detecting network interface...',
  });

  readonly info$ = this.infoSubject.asObservable();

  /** Synchronous read of the latest network info. */
  get currentInfo(): HostNetworkInfo {
    return this.infoSubject.getValue();
  }

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    // 1. Try native plugin (reads NetworkInterface on Android — most reliable)
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await WifiSound.getLocalIpAddress();
        if (result.ipAddress) {
          this.infoSubject.next({
            ipAddress: result.ipAddress,
            connectionType: null,
            fetchedAt: new Date(),
            source: 'native',
          });
          // Try to enrich with connection type from Network plugin
          void this.enrichConnectionType();
          return;
        }
      } catch {
        // Native call failed — continue to fallbacks
      }
    }

    // 2. Try Capacitor Network plugin (may provide IP on some platforms)
    if (Capacitor.isPluginAvailable('Network')) {
      try {
        const { Network } = await import('@capacitor/network');
        const status = await Network.getStatus();
        const ipAddress = this.extractIpAddress(status);
        if (ipAddress) {
          this.infoSubject.next({
            ipAddress,
            connectionType: status.connectionType ?? null,
            fetchedAt: new Date(),
            source: 'plugin',
          });
          return;
        }
      } catch {
        // Network plugin failed — continue to fallback
      }
    }

    // 3. Final fallback: hardcoded hotspot default
    this.infoSubject.next({
      ipAddress: this.fallbackIp(),
      connectionType: null,
      fetchedAt: new Date(),
      source: 'fallback',
      fallbackReason:
        'Could not detect IP from network interfaces. Using hotspot default.',
    });
  }

  private fallbackIp(): string {
    return '192.168.43.1';
  }

  /** Attempt to read connection type from Capacitor Network without blocking. */
  private async enrichConnectionType(): Promise<void> {
    try {
      if (!Capacitor.isPluginAvailable('Network')) return;
      const { Network } = await import('@capacitor/network');
      const status = await Network.getStatus();
      const current = this.infoSubject.getValue();
      if (current.source === 'native' && status.connectionType) {
        this.infoSubject.next({
          ...current,
          connectionType: status.connectionType,
        });
      }
    } catch {
      // Non-critical — ignore
    }
  }

  private extractIpAddress(status: unknown): string | null {
    if (status && typeof status === 'object' && 'ipAddress' in status) {
      const record = status as Record<string, unknown>;
      const raw = record['ipAddress'];
      if (typeof raw === 'string' && raw.trim().length > 0) {
        return raw.trim();
      }
    }
    return null;
  }
}
