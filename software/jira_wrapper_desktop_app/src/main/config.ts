import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized?: boolean;
}

export interface AppConfig {
  /** Jira host, e.g. "example.atlassian.net". Never committed - lives in userData. */
  domain: string | null;
  window: WindowState;
}

const DEFAULTS: AppConfig = {
  domain: null,
  window: { width: 1440, height: 900 },
};

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

export function loadConfig(): AppConfig {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath(), 'utf8')) as Partial<AppConfig>;
    return {
      ...DEFAULTS,
      ...parsed,
      window: { ...DEFAULTS.window, ...parsed.window },
    };
  } catch {
    return { ...DEFAULTS, window: { ...DEFAULTS.window } };
  }
}

export function saveConfig(config: AppConfig): void {
  const target = configPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * Accepts what a person would actually paste - "https://example.atlassian.net/jira/software",
 * "example.atlassian.net", a self-hosted host - and reduces it to a bare hostname.
 * Returns null when the input could not be a host at all.
 */
export function normalizeDomain(input: string): string | null {
  const host = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');

  if (!host || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
    return null;
  }
  return host;
}
