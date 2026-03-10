import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

// ── Plugin method options ──────────────────────────────────────────────

export interface StartBlockerOptions {
  port: number;
  protocol: 'tcp' | 'udp';
}

export interface StartBlockerResult {
  id: string;
  port: number;
  protocol: string;
}

export interface BlockerInfo {
  id: string;
  port: number;
  protocol: string;
  status: 'listening' | 'paused' | 'stopped' | 'error';
  connectionsCount: number;
  bytesReceived: number;
  lastActivity: string | null;
  errorMessage: string | null;
}

export interface GetBlockersResult {
  blockers: BlockerInfo[];
}

// ── Plugin event payloads ──────────────────────────────────────────────

export interface BlockerEventData {
  id: string;
  port: number;
  protocol: string;
  status: string;
  connectionsCount: number;
  bytesReceived: number;
  lastActivity: string | null;
  errorMessage: string | null;
}

// ── Plugin interface ───────────────────────────────────────────────────

export interface PortBlockerPlugin {
  startBlocker(options: StartBlockerOptions): Promise<StartBlockerResult>;
  pauseBlocker(options: { id: string }): Promise<void>;
  resumeBlocker(options: { id: string }): Promise<void>;
  stopBlocker(options: { id: string }): Promise<void>;
  getBlockers(): Promise<GetBlockersResult>;

  addListener(
    event: 'blockerStatusChanged',
    handler: (data: BlockerEventData) => void,
  ): Promise<PluginListenerHandle>;
}

// ── Register ───────────────────────────────────────────────────────────

export const PortBlocker = registerPlugin<PortBlockerPlugin>('PortBlocker');
