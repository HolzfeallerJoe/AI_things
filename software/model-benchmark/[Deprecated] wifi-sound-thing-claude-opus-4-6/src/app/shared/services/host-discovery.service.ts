import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { WifiSoundNativeService } from './wifi-sound-native.service';

export interface DiscoveredHost {
  id: string;
  name: string;
  address: string;
  transport: string;
  signal: number;
  lastSeen: Date;
}

/**
 * Discovers broadcasting hosts on the local network via UDP beacons.
 *
 * Delegates to the native WifiSound plugin for real beacon listening.
 * The returned Observable accumulates discovered hosts and removes them
 * when they stop broadcasting.
 */
@Injectable({
  providedIn: 'root',
})
export class HostDiscoveryService {
  private readonly nativeService = inject(WifiSoundNativeService);

  /**
   * Start scanning for hosts.
   *
   * Returns an Observable that emits the current list of discovered hosts
   * whenever a host appears or disappears.  Unsubscribing stops the
   * native discovery listener.
   */
  discover(): Observable<DiscoveredHost[]> {
    return new Observable<DiscoveredHost[]>((subscriber) => {
      const hosts = new Map<string, DiscoveredHost>();

      const discoveredSub = this.nativeService.onHostDiscovered.subscribe(
        (event) => {
          hosts.set(event.id, {
            id: event.id,
            name: event.name,
            address: event.address,
            transport: event.transport,
            signal: -50, // UDP beacons don't carry RSSI; placeholder value
            lastSeen: new Date(),
          });
          subscriber.next(Array.from(hosts.values()));
        }
      );

      const lostSub = this.nativeService.onHostLost.subscribe((event) => {
        for (const [key, host] of hosts) {
          if (host.address === event.address) {
            hosts.delete(key);
            break;
          }
        }
        subscriber.next(Array.from(hosts.values()));
      });

      void this.nativeService.startDiscovery();

      return () => {
        discoveredSub.unsubscribe();
        lostSub.unsubscribe();
        void this.nativeService.stopDiscovery();
      };
    });
  }
}
