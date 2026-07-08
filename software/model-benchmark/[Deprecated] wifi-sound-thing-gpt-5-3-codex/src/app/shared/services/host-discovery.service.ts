import { Injectable, inject } from '@angular/core';
import { Observable, defer } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { RealtimeAudioService } from './realtime-audio.service';

export interface DiscoveredHost {
  id: string;
  roomId: string;
  name: string;
  address: string;
  transport: string;
  signal: number;
  lastSeen: Date;
}

@Injectable({
  providedIn: 'root',
})
export class HostDiscoveryService {
  private readonly realtimeAudio = inject(RealtimeAudioService);

  discover(signalingUrl = environment.signalingUrl): Observable<DiscoveredHost[]> {
    return defer(() => {
      void this.realtimeAudio.startDiscovery(signalingUrl).catch(() => undefined);
      this.realtimeAudio.refreshHosts();
      return this.realtimeAudio.discoveredHosts$.pipe(
        map((hosts) => {
          return hosts.map((host) => ({
            id: host.id,
            roomId: host.roomId,
            name: host.name,
            address: host.address ?? 'address unavailable',
            transport: `webrtc://${host.roomId}`,
            signal: deriveSignal(host.updatedAt),
            lastSeen: host.updatedAt,
          }));
        })
      );
    });
  }

  refresh(): void {
    this.realtimeAudio.refreshHosts();
  }

  stop(): void {
    this.realtimeAudio.stopDiscovery();
  }
}

function deriveSignal(updatedAt: Date): number {
  const ageMs = Date.now() - updatedAt.getTime();
  if (ageMs < 3000) {
    return -49;
  }
  if (ageMs < 9000) {
    return -61;
  }
  return -72;
}
