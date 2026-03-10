import { inject, Injectable, NgZone } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
  PortBlocker,
  StartBlockerOptions,
  StartBlockerResult,
  BlockerEventData,
  GetBlockersResult,
} from '../plugins/port-blocker.plugin';

@Injectable({ providedIn: 'root' })
export class PortBlockerNativeService {
  private readonly ngZone = inject(NgZone);

  private readonly statusChangedSubject = new Subject<BlockerEventData>();

  readonly onBlockerStatusChanged: Observable<BlockerEventData> =
    this.statusChangedSubject.asObservable();

  constructor() {
    this.registerListeners();
  }

  async startBlocker(options: StartBlockerOptions): Promise<StartBlockerResult> {
    return PortBlocker.startBlocker(options);
  }

  async pauseBlocker(id: string): Promise<void> {
    await PortBlocker.pauseBlocker({ id });
  }

  async resumeBlocker(id: string): Promise<void> {
    await PortBlocker.resumeBlocker({ id });
  }

  async stopBlocker(id: string): Promise<void> {
    await PortBlocker.stopBlocker({ id });
  }

  async getBlockers(): Promise<GetBlockersResult> {
    return PortBlocker.getBlockers();
  }

  private registerListeners(): void {
    PortBlocker.addListener('blockerStatusChanged', (data) => {
      this.ngZone.run(() => this.statusChangedSubject.next(data));
    });
  }
}
