import type { SupportMessage } from '../../types';

export interface SupportReplyMessage {
  type: 'support_reply';
  thread_id: number;
  message: SupportMessage;
}

export interface SupportNewMessage {
  type: 'support_new_message';
  thread_id: number;
  user_id: number;
}

interface SupportSocketOptions {
  token: string;
  onReply?: (msg: SupportReplyMessage) => void;
  onNewMessage?: (msg: SupportNewMessage) => void;
  pingIntervalMs?: number;
  baseReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

function buildSocketUrl(token: string): string {
  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProto}//${window.location.host}/api/ws/submissions/${token}`;
}

/**
 * Клиент WebSocket для событий поддержки. Использует тот же эндпоинт, что и
 * submissions — сервер доставляет support-события во все сокеты пользователя.
 * Переподключается бесконечно с backoff (в отличие от submission-сокета,
 * который завершается после получения результата).
 */
export class SupportSocketClient {
  private readonly token: string;
  private readonly onReply?: (msg: SupportReplyMessage) => void;
  private readonly onNewMessage?: (msg: SupportNewMessage) => void;
  private readonly pingIntervalMs: number;
  private readonly baseReconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;

  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private reconnectAttempts = 0;

  constructor(options: SupportSocketOptions) {
    this.token = options.token;
    this.onReply = options.onReply;
    this.onNewMessage = options.onNewMessage;
    this.pingIntervalMs = options.pingIntervalMs ?? 20000;
    this.baseReconnectDelayMs = options.baseReconnectDelayMs ?? 1000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 15000;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.clearReconnect();
    this.stopHeartbeat();
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
  }

  private connect(): void {
    if (this.stopped || (this.ws && this.ws.readyState === WebSocket.OPEN)) return;

    let ws: WebSocket;
    try {
      ws = new WebSocket(buildSocketUrl(this.token));
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    };

    ws.onmessage = (event) => {
      let message: unknown;
      try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message !== 'object') return;
      const typed = message as { type?: string };
      if (typed.type === 'support_reply') {
        this.onReply?.(message as SupportReplyMessage);
      } else if (typed.type === 'support_new_message') {
        this.onNewMessage?.(message as SupportNewMessage);
      }
    };

    ws.onclose = () => {
      this.stopHeartbeat();
      if (this.stopped) return;
      this.scheduleReconnect();
    };

    ws.onerror = () => { /* onclose handles reconnect */ };
  }

  private sendJson(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try { this.ws.send(JSON.stringify(payload)); } catch { /* ignore */ }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => this.sendJson({ action: 'ping' }), this.pingIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.clearReconnect();
    this.reconnectAttempts += 1;
    const backoff = this.baseReconnectDelayMs * (2 ** Math.min(this.reconnectAttempts - 1, 5));
    const delay = Math.min(backoff, this.maxReconnectDelayMs);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
