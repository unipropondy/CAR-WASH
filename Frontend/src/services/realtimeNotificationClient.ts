import { Platform } from 'react-native';
import { getApiBaseUrl } from './apiConfig';

type EventHandler = (payload: any) => void;

class RealtimeNotificationClient {
  private ws: WebSocket | null = null;
  private isConnecting: boolean = false;
  private reconnectTimeout: any = null;
  private pingInterval: any = null;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private processedEventIds: Set<string> = new Set();
  private maxTrackedEvents = 200;
  private reconnectAttempts = 0;

  constructor() {
    this.init();
  }

  private getWebSocketUrl(): string {
    const base = getApiBaseUrl().replace(/\/+$/, '');
    let wsBase = base;
    if (base.startsWith('https://')) {
      wsBase = 'wss://' + base.substring(8);
    } else if (base.startsWith('http://')) {
      wsBase = 'ws://' + base.substring(7);
    } else {
      wsBase = `ws://${base}`;
    }
    return `${wsBase}/ws/notifications`;
  }

  public init() {
    this.connect();
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.isConnecting) return;

    this.isConnecting = true;
    const url = this.getWebSocketUrl();

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }

        // Heartbeat ping every 20s to prevent mobile sleep/carrier timeout
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send(JSON.stringify({ type: 'PING' }));
            } catch (e) {}
          }
        }, 20000);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data || !data.type) return;

          // Deduplicate events by eventId or unique payload key
          const dedupeKey = data.eventId || (data.payload?.orderNo ? `order-${data.payload.orderNo}` : null) || (data.payload?.id ? `help-${data.payload.id}` : null);
          if (dedupeKey) {
            if (this.processedEventIds.has(dedupeKey)) {
              return;
            }
            this.processedEventIds.add(dedupeKey);
            if (this.processedEventIds.size > this.maxTrackedEvents) {
              const first = Array.from(this.processedEventIds)[0];
              this.processedEventIds.delete(first);
            }
          }

          const handlers = this.listeners.get(data.type);
          if (handlers) {
            handlers.forEach((handler) => {
              try {
                handler(data.payload);
              } catch (err) {
                console.warn('[RealtimeClient] Handler error for', data.type, err);
              }
            });
          }
        } catch (e) {
          // JSON parse error
        }
      };

      this.ws.onclose = () => {
        this.cleanup();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Suppress noisy uncaught error: onclose handles the reconnect lifecycle
        this.cleanup();
        this.scheduleReconnect();
      };
    } catch (err) {
      this.cleanup();
      this.scheduleReconnect();
    }
  }

  private cleanup() {
    this.isConnecting = false;
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectAttempts++;
    // Exponential backoff: 3s -> 6s -> 12s -> 20s max
    const delay = Math.min(20000, 3000 * Math.pow(1.5, Math.min(this.reconnectAttempts - 1, 5)));
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  public on(eventType: string, handler: EventHandler): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);

    // Ensure connection is active
    this.connect();

    return () => {
      const set = this.listeners.get(eventType);
      if (set) {
        set.delete(handler);
      }
    };
  }
}

export const realtimeNotificationClient = new RealtimeNotificationClient();
