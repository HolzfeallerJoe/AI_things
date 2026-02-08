import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Capacitor } from '@capacitor/core';

type NetworkSource = 'plugin' | 'fallback';

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

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (Capacitor.isPluginAvailable('Network')) {
      try {
        const { Network } = await this.loadNetworkPlugin();
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
        this.infoSubject.next({
          ipAddress: this.fallbackIp(),
          connectionType: status.connectionType ?? null,
          fetchedAt: new Date(),
          source: 'fallback',
          fallbackReason:
            'Network plugin did not provide an IP address. Using hotspot default.',
        });
        return;
      } catch (error) {
        this.infoSubject.next({
          ipAddress: this.fallbackIp(),
          connectionType: null,
          fetchedAt: new Date(),
          source: 'fallback',
          fallbackReason:
            'Unable to read from Capacitor Network plugin. Using hotspot default.',
        });
        return;
      }
    }

    this.infoSubject.next({
      ipAddress: this.fallbackIp(),
      connectionType: null,
      fetchedAt: new Date(),
      source: 'fallback',
      fallbackReason:
        'Capacitor Network plugin unavailable in this environment. Using hotspot default.',
    });
  }

  private async loadNetworkPlugin(): Promise<typeof import('@capacitor/network')> {
    return import('@capacitor/network');
  }

  private fallbackIp(): string {
    return '192.168.43.1';
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
