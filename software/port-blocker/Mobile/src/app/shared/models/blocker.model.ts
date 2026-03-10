export type BlockerStatus = 'listening' | 'paused' | 'stopped' | 'error';
export type BlockerProtocol = 'tcp' | 'udp';

export interface Blocker {
  id: string;
  port: number;
  protocol: BlockerProtocol;
  status: BlockerStatus;
  connectionsCount: number;
  bytesReceived: number;
  lastActivity: string | null;
  errorMessage: string | null;
}
