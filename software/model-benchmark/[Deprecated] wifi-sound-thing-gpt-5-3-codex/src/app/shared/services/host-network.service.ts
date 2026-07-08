import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Capacitor } from '@capacitor/core';

type NetworkSource = 'plugin' | 'webrtc' | 'fallback';

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
    const pluginAvailable = Capacitor.isPluginAvailable('Network');
    let connectionType: string | null = null;
    let fallbackReason =
      'Capacitor Network plugin unavailable in this environment. Using hotspot default.';

    if (pluginAvailable) {
      try {
        const { Network } = await this.loadNetworkPlugin();
        const status = await Network.getStatus();
        connectionType = status.connectionType ?? null;
        const ipAddress = this.extractIpAddress(status);
        if (ipAddress) {
          this.infoSubject.next({
            ipAddress,
            connectionType,
            fetchedAt: new Date(),
            source: 'plugin',
          });
          return;
        }
        fallbackReason = 'Network plugin did not provide an IP address. Using hotspot default.';
      } catch (error) {
        fallbackReason = 'Unable to read from Capacitor Network plugin. Using hotspot default.';
      }
    }

    const webRtcIpAddress = await this.resolveWebRtcIpAddress();
    if (webRtcIpAddress) {
      this.infoSubject.next({
        ipAddress: webRtcIpAddress,
        connectionType,
        fetchedAt: new Date(),
        source: 'webrtc',
      });
      return;
    }

    this.infoSubject.next({
      ipAddress: this.fallbackIp(),
      connectionType,
      fetchedAt: new Date(),
      source: 'fallback',
      fallbackReason,
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

  private async resolveWebRtcIpAddress(timeoutMs = 1500): Promise<string | null> {
    const PeerConnection = this.resolvePeerConnectionCtor();
    if (!PeerConnection) {
      return null;
    }

    return new Promise<string | null>((resolve) => {
      const candidates = new Set<string>();
      const peer = new PeerConnection({ iceServers: [] });
      let finished = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

      const finish = (preferred: string | null = null): void => {
        if (finished) {
          return;
        }
        finished = true;
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        peer.onicecandidate = null;
        try {
          peer.close();
        } catch {
          // Ignore close failures from browsers that already closed the connection.
        }
        resolve(preferred ?? this.selectPreferredAddress(candidates));
      };

      peer.onicecandidate = (event) => {
        if (!event.candidate) {
          finish();
          return;
        }

        const fromAddressField = this.normalizeIpAddress(
          (event.candidate as RTCIceCandidate & { address?: string }).address ?? null
        );
        const fromCandidateField = this.extractAddressFromCandidate(event.candidate.candidate);
        const ipAddress = fromAddressField ?? fromCandidateField;
        if (!ipAddress) {
          return;
        }

        candidates.add(ipAddress);
        if (this.isPrivateLanAddress(ipAddress)) {
          finish(ipAddress);
        }
      };

      timeoutHandle = setTimeout(() => finish(), timeoutMs);
      peer.createDataChannel('host-network-ip');
      void peer
        .createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false })
        .then((offer) => peer.setLocalDescription(offer))
        .catch(() => finish());
    });
  }

  private resolvePeerConnectionCtor(): typeof RTCPeerConnection | null {
    if (typeof globalThis === 'undefined') {
      return null;
    }
    const maybeWindow = globalThis as typeof globalThis & {
      RTCPeerConnection?: typeof RTCPeerConnection;
      webkitRTCPeerConnection?: typeof RTCPeerConnection;
      mozRTCPeerConnection?: typeof RTCPeerConnection;
    };
    return (
      maybeWindow.RTCPeerConnection ??
      maybeWindow.webkitRTCPeerConnection ??
      maybeWindow.mozRTCPeerConnection ??
      null
    );
  }

  private extractAddressFromCandidate(candidate: string): string | null {
    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      return null;
    }

    const pieces = candidate.trim().split(/\s+/);
    if (pieces.length >= 5) {
      const normalized = this.normalizeIpAddress(pieces[4]);
      if (normalized) {
        return normalized;
      }
    }

    const ipMatch = candidate.match(
      /((?:\d{1,3}\.){3}\d{1,3}|(?:[A-Fa-f0-9]{1,4}:){2,}[A-Fa-f0-9]{1,4})/
    );
    return this.normalizeIpAddress(ipMatch?.[1] ?? null);
  }

  private normalizeIpAddress(raw: string | null): string | null {
    if (typeof raw !== 'string') {
      return null;
    }
    const value = raw.trim().replace(/^\[|\]$/g, '');
    if (!value || value.endsWith('.local')) {
      return null;
    }
    if (this.isIpv4Address(value) || this.isIpv6Address(value)) {
      return this.isLoopbackAddress(value) ? null : value;
    }
    return null;
  }

  private selectPreferredAddress(candidates: Set<string>): string | null {
    const list = [...candidates];
    const privateAddress = list.find((address) => this.isPrivateLanAddress(address));
    if (privateAddress) {
      return privateAddress;
    }
    return list.length ? list[0] : null;
  }

  private isPrivateLanAddress(address: string): boolean {
    if (this.isIpv4Address(address)) {
      if (address.startsWith('10.') || address.startsWith('192.168.')) {
        return true;
      }
      if (!address.startsWith('172.')) {
        return false;
      }
      const secondOctet = Number(address.split('.')[1]);
      return Number.isFinite(secondOctet) && secondOctet >= 16 && secondOctet <= 31;
    }
    const lower = address.toLowerCase();
    return lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
  }

  private isIpv4Address(address: string): boolean {
    const parts = address.split('.');
    if (parts.length !== 4) {
      return false;
    }
    return parts.every((segment) => {
      if (!/^\d{1,3}$/.test(segment)) {
        return false;
      }
      const value = Number(segment);
      return Number.isInteger(value) && value >= 0 && value <= 255;
    });
  }

  private isIpv6Address(address: string): boolean {
    return address.includes(':') && /^[A-Fa-f0-9:]+$/.test(address);
  }

  private isLoopbackAddress(address: string): boolean {
    if (this.isIpv4Address(address)) {
      return address.startsWith('127.');
    }
    return address === '::1';
  }
}
