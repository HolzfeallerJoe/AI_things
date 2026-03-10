import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import type { PluginListenerHandle } from '@capacitor/core';
import { ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { App } from '@capacitor/app';
import type { Blocker, BlockerProtocol } from '../shared/models/blocker.model';
import type { StartBlockerOptions } from '../shared/plugins/port-blocker.plugin';
import { PortBlockerNativeService } from '../shared/services/port-blocker-native.service';

interface BlockerViewModel extends Blocker {
  retryMode?: 'start' | 'resume';
  retryConfig?: StartBlockerOptions;
  pendingAction?: boolean;
  nativeRegistered?: boolean;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly nativeService = inject(PortBlockerNativeService);
  private readonly toastController = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private resumeBlockerHandle?: PluginListenerHandle;

  blockers: BlockerViewModel[] = [];
  adding = false;

  blockerForm: FormGroup = this.formBuilder.group({
    port: [null, [Validators.required, Validators.min(1), Validators.max(65535)]],
    protocol: ['tcp' as BlockerProtocol, Validators.required],
  });

  ngOnInit(): void {
    this.loadBlockers();
    this.observeStatusChanges();
    void App.addListener('resume', () => {
      void this.loadBlockers();
    }).then((handle) => {
      this.resumeBlockerHandle = handle;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    void this.resumeBlockerHandle?.remove();
  }

  get portInvalid(): boolean {
    const ctrl = this.blockerForm.get('port');
    return !!ctrl && ctrl.invalid && ctrl.touched;
  }

  get portError(): string {
    const ctrl = this.blockerForm.get('port');
    if (!ctrl || !ctrl.errors) {
      return '';
    }
    if (ctrl.errors['required']) {
      return 'Port is required';
    }
    if (ctrl.errors['min'] || ctrl.errors['max']) {
      return 'Port must be 1 - 65535';
    }
    return '';
  }

  async onStart(): Promise<void> {
    if (this.blockerForm.invalid || this.adding) {
      return;
    }

    this.adding = true;
    const { port, protocol } = this.blockerForm.value;
    const config: StartBlockerOptions = { port, protocol };

    try {
      await this.startBlocker(config);
      this.blockerForm.patchValue({ port: null });
      this.blockerForm.get('port')?.markAsUntouched();
    } catch (err) {
      await this.upsertFailedStart(config, this.getErrorMessage(err));
    } finally {
      this.adding = false;
    }
  }

  async onPause(blocker: BlockerViewModel): Promise<void> {
    this.updateBlocker(blocker.id, { pendingAction: true });
    try {
      await this.nativeService.pauseBlocker(blocker.id);
      this.updateBlocker(blocker.id, {
        pendingAction: false,
        status: 'paused',
        errorMessage: null,
        retryMode: undefined,
      });
    } catch (err) {
      this.updateBlocker(blocker.id, {
        pendingAction: false,
        status: 'error',
        errorMessage: this.getErrorMessage(err),
        retryMode: 'resume',
      });
      await this.presentErrorToast(`Pause failed: ${this.getErrorMessage(err)}`);
    }
  }

  async onResume(blocker: BlockerViewModel): Promise<void> {
    this.updateBlocker(blocker.id, { pendingAction: true });
    try {
      await this.nativeService.resumeBlocker(blocker.id);
      this.updateBlocker(blocker.id, {
        pendingAction: false,
        status: 'listening',
        errorMessage: null,
        retryMode: undefined,
      });
    } catch (err) {
      this.updateBlocker(blocker.id, {
        pendingAction: false,
        status: 'error',
        errorMessage: this.getErrorMessage(err),
        retryMode: 'resume',
      });
      await this.presentErrorToast(`Resume failed: ${this.getErrorMessage(err)}`);
    }
  }

  async onRetry(blocker: BlockerViewModel): Promise<void> {
    if (blocker.pendingAction) {
      return;
    }

    if (blocker.retryMode === 'start' && blocker.retryConfig) {
      this.updateBlocker(blocker.id, { pendingAction: true });
      try {
        await this.startBlocker(blocker.retryConfig, blocker.id);
      } catch (err) {
        this.updateBlocker(blocker.id, {
          pendingAction: false,
          status: 'error',
          errorMessage: this.getErrorMessage(err),
          retryMode: 'start',
        });
        await this.presentErrorToast(`Retry failed: ${this.getErrorMessage(err)}`);
      }
      return;
    }

    await this.onResume(blocker);
  }

  async onStop(blocker: BlockerViewModel): Promise<void> {
    if (blocker.pendingAction) {
      return;
    }

    if (blocker.nativeRegistered === false) {
      this.blockers = this.blockers.filter((entry) => entry.id !== blocker.id);
      return;
    }

    this.updateBlocker(blocker.id, { pendingAction: true });
    try {
      await this.nativeService.stopBlocker(blocker.id);
      this.blockers = this.blockers.filter((entry) => entry.id !== blocker.id);
    } catch (err) {
      this.updateBlocker(blocker.id, { pendingAction: false });
      await this.presentErrorToast(`Stop failed: ${this.getErrorMessage(err)}`);
    }
  }

  trackById(_: number, blocker: BlockerViewModel): string {
    return blocker.id;
  }

  statusColor(blocker: BlockerViewModel): string {
    switch (blocker.status) {
      case 'listening':
        return 'success';
      case 'paused':
        return 'warning';
      case 'error':
        return 'danger';
      default:
        return 'medium';
    }
  }

  statusIcon(blocker: BlockerViewModel): string {
    switch (blocker.status) {
      case 'listening':
        return 'radio-outline';
      case 'paused':
        return 'pause-circle-outline';
      case 'error':
        return 'alert-circle-outline';
      default:
        return 'stop-circle-outline';
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const val = bytes / Math.pow(1024, i);
    return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  private async loadBlockers(): Promise<void> {
    try {
      const result = await this.nativeService.getBlockers();
      const failedStarts = this.blockers.filter((blocker) => blocker.nativeRegistered === false);
      this.blockers = [
        ...result.blockers.map((info) => this.mapNativeBlocker(info)),
        ...failedStarts,
      ];
    } catch (err) {
      // Native plugin not available (e.g. running in browser)
      console.error(err);
    }
  }

  private observeStatusChanges(): void {
    this.nativeService.onBlockerStatusChanged
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        if (event.status === 'stopped') {
          this.blockers = this.blockers.filter((blocker) => blocker.id !== event.id);
          return;
        }

        this.upsertNativeBlocker({
          id: event.id,
          port: event.port,
          protocol: event.protocol,
          status: event.status,
          connectionsCount: event.connectionsCount,
          bytesReceived: event.bytesReceived,
          lastActivity: event.lastActivity,
          errorMessage: event.errorMessage,
        });
      });
  }

  private async startBlocker(
    config: StartBlockerOptions,
    replaceId?: string,
  ): Promise<void> {
    const result = await this.nativeService.startBlocker(config);
    if (replaceId && replaceId !== result.id) {
      this.blockers = this.blockers.filter((blocker) => blocker.id !== replaceId);
    }

    this.upsertNativeBlocker({
      id: result.id,
      port: result.port,
      protocol: result.protocol,
      status: 'listening',
      connectionsCount: 0,
      bytesReceived: 0,
      lastActivity: null,
      errorMessage: null,
    });
  }

  private async upsertFailedStart(
    config: StartBlockerOptions,
    errorMessage: string,
  ): Promise<void> {
    const existing = this.blockers.find(
      (blocker) =>
        blocker.nativeRegistered === false &&
        blocker.port === config.port &&
        blocker.protocol === config.protocol,
    );

    const patch: BlockerViewModel = {
      id: existing?.id ?? `failed-${config.protocol}-${config.port}`,
      port: config.port,
      protocol: config.protocol,
      status: 'error',
      connectionsCount: 0,
      bytesReceived: 0,
      lastActivity: null,
      errorMessage,
      retryMode: 'start',
      retryConfig: config,
      nativeRegistered: false,
      pendingAction: false,
    };

    if (existing) {
      this.updateBlocker(existing.id, patch);
    } else {
      this.blockers = [patch, ...this.blockers];
    }

    await this.presentErrorToast(`Block failed: ${errorMessage}`);
  }

  private updateBlocker(id: string, patch: Partial<BlockerViewModel>): void {
    this.blockers = this.blockers.map((blocker) =>
      blocker.id === id ? { ...blocker, ...patch } : blocker,
    );
  }

  private upsertNativeBlocker(info: {
    id: string;
    port: number;
    protocol: string;
    status: string;
    connectionsCount: number;
    bytesReceived: number;
    lastActivity: string | null;
    errorMessage: string | null;
  }): void {
    const nextBlocker = this.mapNativeBlocker(info);
    const existingIndex = this.blockers.findIndex((blocker) => blocker.id === info.id);

    if (existingIndex === -1) {
      this.blockers = [...this.blockers, nextBlocker];
      return;
    }

    this.blockers = this.blockers.map((blocker, index) =>
      index === existingIndex ? { ...blocker, ...nextBlocker } : blocker,
    );
  }

  private mapNativeBlocker(info: {
    id: string;
    port: number;
    protocol: string;
    status: string;
    connectionsCount: number;
    bytesReceived: number;
    lastActivity: string | null;
    errorMessage: string | null;
  }): BlockerViewModel {
    return {
      id: info.id,
      port: info.port,
      protocol: info.protocol as BlockerProtocol,
      status: info.status as Blocker['status'],
      connectionsCount: info.connectionsCount,
      bytesReceived: info.bytesReceived,
      lastActivity: info.lastActivity,
      errorMessage: info.errorMessage,
      retryMode: info.status === 'error' ? 'resume' : undefined,
      pendingAction: false,
      nativeRegistered: true,
    };
  }

  private getErrorMessage(err: unknown): string {
    if (typeof err === 'string') {
      return err;
    }

    if (err && typeof err === 'object') {
      const maybeMessage = (err as { message?: string }).message;
      if (maybeMessage) {
        return maybeMessage.replace(/^Failed to (start|pause|resume|stop) blocker:\s*/i, '');
      }
    }

    return 'Unknown error';
  }

  private async presentErrorToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color: 'danger',
      position: 'top',
    });

    await toast.present();
  }
}
