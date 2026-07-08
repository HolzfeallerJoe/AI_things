import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

export type NativeCaptureMode = 'auto' | 'playback' | 'microphone';

export interface NativeHostOptions {
  peers: string[];
  port: number;
  sampleRate: number;
  channels: 1 | 2;
  frameSize: number;
  captureMode: NativeCaptureMode;
}

export interface NativeClientOptions {
  hostAddress: string;
  port: number;
  jitterFrames: number;
  sampleRate: number;
  channels: 1 | 2;
  frameSize: number;
}

export interface NativeAudioStatus {
  hostRunning: boolean;
  clientRunning: boolean;
  hostMode: string;
  lastError: string | null;
  capturePermission: boolean;
}

interface NativeAudioPlugin {
  requestCapturePermission(): Promise<{ granted: boolean }>;
  startHost(options: NativeHostOptions): Promise<{ started: boolean; capturePermission: boolean }>;
  stopHost(): Promise<void>;
  startClient(options: NativeClientOptions): Promise<void>;
  stopClient(): Promise<void>;
  getStatus(): Promise<NativeAudioStatus>;
}

const NativeAudio = registerPlugin<NativeAudioPlugin>('NativeAudio');

@Injectable({
  providedIn: 'root',
})
export class NativeUdpAudioService {
  isAvailable(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  async requestCapturePermission(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    const result = await NativeAudio.requestCapturePermission();
    return !!result.granted;
  }

  async startHost(options: NativeHostOptions): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Native UDP host mode is only available on Android builds.');
    }
    await NativeAudio.startHost(options);
  }

  async stopHost(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    await NativeAudio.stopHost();
  }

  async startClient(options: NativeClientOptions): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Native UDP client mode is only available on Android builds.');
    }
    await NativeAudio.startClient(options);
  }

  async stopClient(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    await NativeAudio.stopClient();
  }

  async getStatus(): Promise<NativeAudioStatus> {
    if (!this.isAvailable()) {
      return {
        hostRunning: false,
        clientRunning: false,
        hostMode: 'idle',
        lastError: null,
        capturePermission: false,
      };
    }
    return NativeAudio.getStatus();
  }
}
