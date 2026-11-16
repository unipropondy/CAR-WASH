import { Platform } from 'react-native';
import { NOTIFICATION_SOUND_URI, NOTIFICATION_SOUND_BASE64 } from './notificationSoundAsset';

export interface KioskOrderNotification {
  orderId?: number;
  orderNo: string;
  customerName: string;
  vehiclePlate: string;
  vehicleType?: string;
  packageName: string;
  amount: number;
  payMode: string;
  payStatus: string;
  isDealer?: boolean;
  dealerName?: string;
  timestamp: string;
}

const STORAGE_ORDER_KEY = 'RED_BAY_KIOSK_ORDER_ALERT';
const CHANNEL_NAME = 'red_bay_kiosk_orders_channel';

type OrderListener = (order: KioskOrderNotification) => void;
const orderListeners: Set<OrderListener> = new Set();

let broadcastChannel: BroadcastChannel | null = null;
if (Platform.OS === 'web' && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'NEW_KIOSK_ORDER' && event.data.payload) {
        notifyOrderListeners(event.data.payload);
      }
    };
  } catch (e) {
    console.warn('[kioskOrderNotificationService] BroadcastChannel init error:', e);
  }
}

// Cross-tab storage event listener
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_ORDER_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (parsed && parsed.orderNo) {
          notifyOrderListeners(parsed);
        }
      } catch (e) {}
    }
  });
}

function notifyOrderListeners(order: KioskOrderNotification) {
  orderListeners.forEach((cb) => {
    try {
      cb(order);
    } catch (e) {
      console.warn('[kioskOrderNotificationService] Listener error:', e);
    }
  });
}

// ================= AUDIO ALERT ENGINE =================
let audioContext: AudioContext | null = null;
let cachedAudioElement: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (!audioContext) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      audioContext = new AudioCtx();
    }
  }
  return audioContext;
}

function getCachedAudioElement(): HTMLAudioElement | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (!cachedAudioElement) {
    try {
      cachedAudioElement = new Audio(NOTIFICATION_SOUND_URI);
      cachedAudioElement.preload = 'auto';
      cachedAudioElement.load();
    } catch (e) {}
  }
  return cachedAudioElement;
}

// Gesture unlock for audio
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      getCachedAudioElement();
    } catch (e) {}
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}

/**
 * Synthesizes a crisp, high-quality, professional retail register chime
 * using a bright 4-note ascending arpeggio chord with 0ms audio latency.
 */
function playSynthesizedOrderChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const playNotes = () => {
      const now = ctx.currentTime;
      // 4 bell frequencies: E5 (659Hz), A5 (880Hz), C#6 (1108Hz), E6 (1318Hz)
      const notes = [
        { freq: 659.25, time: now + 0.00 },
        { freq: 880.00, time: now + 0.08 },
        { freq: 1108.73, time: now + 0.16 },
        { freq: 1318.51, time: now + 0.24 },
      ];

      notes.forEach(({ freq, time }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle'; // Smooth harmonic chime
        osc.frequency.setValueAtTime(freq, time);

        // Fast attack and musical bell decay
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.linearRampToValueAtTime(0.40, time + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.55);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.60);
      });
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(playNotes).catch(playNotes);
    } else {
      playNotes();
    }
  } catch (e) {
    console.warn('[kioskOrderNotificationService] Synth audio error:', e);
  }
}

/**
 * Play order notification sound: uses instant Web Audio synth bell chime and pre-warmed audio element
 */
export function playOrderAlertSound() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  // 1. Play synthesized bell chime (always 0ms instant, works offline, no network/file decode lag)
  playSynthesizedOrderChime();

  // 2. Play bundled notification sound WAV from pre-warmed element
  try {
    const audio = getCachedAudioElement();
    if (audio) {
      audio.currentTime = 0;
      audio.volume = 1.0;
      audio.play().catch(() => {
        // Autoplay policy or unlock handled by Web Audio synth
      });
    }
  } catch (e) {}
}

/**
 * Broadcast new kiosk order to POS (cross-tab and network)
 */
export function broadcastNewKioskOrder(order: KioskOrderNotification) {
  // 1. Local memory listeners
  notifyOrderListeners(order);

  // 2. LocalStorage for cross-tab sync
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        STORAGE_ORDER_KEY,
        JSON.stringify({ ...order, _t: Date.now() })
      );
    } catch (e) {}
  }

  // 3. BroadcastChannel for instant zero-latency broadcast
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({
        type: 'NEW_KIOSK_ORDER',
        payload: order,
      });
    } catch (e) {}
  }
}

/**
 * Subscribe to new kiosk orders in POS
 */
export function subscribeToKioskOrders(callback: OrderListener): () => void {
  orderListeners.add(callback);
  return () => {
    orderListeners.delete(callback);
  };
}

