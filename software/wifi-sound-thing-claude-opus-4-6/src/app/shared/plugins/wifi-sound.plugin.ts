import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

// ── Plugin method options ──────────────────────────────────────────────

export interface StartHostOptions {
  captureMode?: 'shizuku' | 'projection';
  sampleRate: number;
  frameSize: number;
  jitterBuffer: number;
  peers: string[];
  hostName: string;
  hostAddress: string;
}

export interface ShizukuStatus {
  available: boolean;
  granted: boolean;
}

export interface StartClientOptions {
  hostAddress: string;
  sampleRate?: number;
  frameSize?: number;
  jitterBuffer?: number;
}

// ── Plugin event payloads ──────────────────────────────────────────────

export interface HostMetricsEvent {
  packetsSent: number;
  bytesSent: number;
  peerCount: number;
  uptimeMs: number;
}

export interface ClientMetricsEvent {
  packetsReceived: number;
  latencyUs: number;
  bufferDepth: number;
  packetsDropped: number;
}

export interface DiscoveredHostEvent {
  id: string;
  name: string;
  address: string;
  port: number;
  codec: string;
  sampleRate: number;
  transport: string;
}

export interface HostLostEvent {
  address: string;
}

export interface LocalIpResult {
  ipAddress: string | null;
}

// ── Plugin interface ───────────────────────────────────────────────────

export interface WifiSoundPlugin {
  // Network
  getLocalIpAddress(): Promise<LocalIpResult>;

  // Shizuku
  checkShizuku(): Promise<ShizukuStatus>;
  requestShizukuPermission(): Promise<{ granted: boolean }>;

  // Host
  requestMediaProjection(): Promise<{ granted: boolean }>;
  startHost(options: StartHostOptions): Promise<{ started: boolean; captureMode: string }>;
  stopHost(): Promise<void>;

  // Client
  startClient(options: StartClientOptions): Promise<{ connected: boolean }>;
  stopClient(): Promise<void>;

  // Discovery
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;

  // Events
  addListener(
    event: 'metricsUpdate',
    handler: (data: HostMetricsEvent) => void,
  ): Promise<PluginListenerHandle>;

  addListener(
    event: 'clientMetricsUpdate',
    handler: (data: ClientMetricsEvent) => void,
  ): Promise<PluginListenerHandle>;

  addListener(
    event: 'hostDiscovered',
    handler: (data: DiscoveredHostEvent) => void,
  ): Promise<PluginListenerHandle>;

  addListener(
    event: 'hostLost',
    handler: (data: HostLostEvent) => void,
  ): Promise<PluginListenerHandle>;
}

// ── Register ───────────────────────────────────────────────────────────

export const WifiSound = registerPlugin<WifiSoundPlugin>('WifiSound');
