import { Platform } from 'react-native';
import { NOTIFICATION_SOUND_URI, NOTIFICATION_SOUND_BASE64 } from './notificationSoundAsset';
import { getApiBaseUrl } from './apiConfig';

const getBackendUrl = (): string => `${getApiBaseUrl()}/api/carwash`;

export interface HelpRequestItem {
  id: string;
  kioskId: string;
  location: string;
  step: string;
  message: string;
  status: 'PENDING' | 'RESOLVED';
  timestamp: string;
}

const STORAGE_ALERT_KEY = 'RED_BAY_KIOSK_HELP_ALERT';
const STORAGE_LIST_KEY = 'RED_BAY_ACTIVE_HELP_LIST';
const STORAGE_RESOLVED_KEY = 'RED_BAY_HELP_RESOLVED';
const CHANNEL_NAME = 'red_bay_kiosk_help_channel';

// In-memory listeners for the current tab
type HelpListener = (item: HelpRequestItem) => void;
type ResolvedListener = (id: string) => void;

const helpListeners: Set<HelpListener> = new Set();
const resolvedListeners: Set<ResolvedListener> = new Set();

// ================= LOCAL PERSISTENCE HELPERS =================
export function getStoredPendingRequests(): HelpRequestItem[] {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((r) => r && r.status === 'PENDING');
    }
  } catch (e) {}
  return [];
}

export function saveStoredPendingRequests(list: HelpRequestItem[]) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const pendingOnly = list.filter((r) => r && r.status === 'PENDING');
    localStorage.setItem(STORAGE_LIST_KEY, JSON.stringify(pendingOnly));
  } catch (e) {}
}

export function addHelpRequestToStoredList(item: HelpRequestItem): HelpRequestItem[] {
  const current = getStoredPendingRequests();
  const exists = current.some((r) => r.id === item.id);
  const updated = exists ? current : [item, ...current];
  saveStoredPendingRequests(updated);
  return updated;
}

export function removeHelpRequestFromStoredList(id: string): HelpRequestItem[] {
  const current = getStoredPendingRequests();
  const updated = current.filter((r) => r.id !== id);
  saveStoredPendingRequests(updated);
  return updated;
}

export function clearAllHelpRequests(): void {
  saveStoredPendingRequests([]);
}

// ================= BROADCAST & STORAGE SYNC =================
let broadcastChannel: any = null;
if (Platform.OS === 'web' && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new (window as any).BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.onmessage = (event: MessageEvent) => {
      if (event.data) {
        if (event.data.type === 'HELP_REQUEST' && event.data.payload) {
          notifyHelpRequestListeners(event.data.payload);
        } else if (event.data.type === 'HELP_RESOLVED' && event.data.payload?.id) {
          notifyHelpResolvedListeners(event.data.payload.id);
        }
      }
    };
  } catch (err) {
    // BroadcastChannel unsupported or restricted
  }
}

// Storage event listener for cross-tab notification
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === STORAGE_ALERT_KEY && e.newValue) {
      try {
        const item: HelpRequestItem = JSON.parse(e.newValue);
        notifyHelpRequestListeners(item);
      } catch (err) {}
    } else if (e.key === STORAGE_RESOLVED_KEY && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        if (data?.id) notifyHelpResolvedListeners(data.id);
      } catch (err) {}
    }
  });
}

function notifyHelpRequestListeners(item: HelpRequestItem) {
  helpListeners.forEach((fn) => {
    try {
      fn(item);
    } catch (err) {
      console.warn('Help listener error:', err);
    }
  });
}

function notifyHelpResolvedListeners(id: string) {
  resolvedListeners.forEach((fn) => {
    try {
      fn(id);
    } catch (err) {
      console.warn('Resolved listener error:', err);
    }
  });
}

// ================= AUDIO ENGINE (Using sound.wav) =================
let sharedAudioCtx: any = null;
let decodedAudioBuffer: any = null;

function getAudioContext() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function preloadCustomSound() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const ctx = getAudioContext();
    if (!ctx || decodedAudioBuffer) return;
    const arrayBuf = base64ToArrayBuffer(NOTIFICATION_SOUND_BASE64);
    ctx.decodeAudioData(
      arrayBuf,
      (buf: any) => {
        decodedAudioBuffer = buf;
      },
      () => {}
    );
  } catch (e) {}
}

// Global browser gesture unlocker to allow audio playback across tabs
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      preloadCustomSound();
    } catch (e) {}
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}

/**
 * Play user custom notification sound (Frontend/assets/Audio/sound.wav)
 */
export function playNotificationChime() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  let html5Played = false;

  // 1. Primary: HTML5 Audio with sound.wav Data URI
  try {
    const audio = new Audio(NOTIFICATION_SOUND_URI);
    audio.volume = 1.0;
    const p = audio.play();
    if (p !== undefined) {
      p.then(() => {
        html5Played = true;
      }).catch(() => {
        // If autoplay policy blocked HTML5, fall back to Web Audio API
        playViaWebAudioBuffer();
      });
    } else {
      html5Played = true;
    }
  } catch (err) {
    playViaWebAudioBuffer();
  }

  // 2. Secondary redundancy: Web Audio API playback
  setTimeout(() => {
    if (!html5Played) {
      playViaWebAudioBuffer();
    }
  }, 100);
}

function playViaWebAudioBuffer() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (decodedAudioBuffer) {
      const source = ctx.createBufferSource();
      source.buffer = decodedAudioBuffer;
      source.connect(ctx.destination);
      source.start(0);
    } else {
      const arrayBuf = base64ToArrayBuffer(NOTIFICATION_SOUND_BASE64);
      ctx.decodeAudioData(
        arrayBuf,
        (buf: any) => {
          decodedAudioBuffer = buf;
          const source = ctx.createBufferSource();
          source.buffer = buf;
          source.connect(ctx.destination);
          source.start(0);
        },
        () => {}
      );
    }
  } catch (e) {}
}

/**
 * 2. Send Help Request from Kiosk
 */
export async function sendKioskHelpRequest(
  step: string = 'General',
  location: string = 'Station #01'
): Promise<HelpRequestItem> {
  const createdItem: HelpRequestItem = {
    id: `HELP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    kioskId: 'KIOSK-01',
    location,
    step,
    message: `Customer at ${location} requested assistance on: ${step}`,
    status: 'PENDING',
    timestamp: new Date().toISOString(),
  };

  // 1. Immediately store in persistent local storage list
  addHelpRequestToStoredList(createdItem);

  // 2. Cross-tab broadcast & event
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_ALERT_KEY, JSON.stringify(createdItem));
      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'HELP_REQUEST', payload: createdItem });
      }
    } catch (e) {}
  }

  // 3. Notify listeners in current context
  notifyHelpRequestListeners(createdItem);

  // 4. Background backend sync (does not block user or fail if backend is down)
  try {
    fetch(`${getBackendUrl()}/help`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kioskId: createdItem.kioskId,
        location: createdItem.location,
        step: createdItem.step,
        message: createdItem.message,
      }),
    }).catch(() => {});
  } catch (e) {}

  return createdItem;
}

/**
 * 3. Fetch active help requests for POS
 */
export async function fetchActiveHelpRequests(): Promise<HelpRequestItem[]> {
  const localList = getStoredPendingRequests();

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 1800) : null;

    const res = await fetch(`${getBackendUrl()}/help`, {
      signal: controller?.signal,
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const serverItems: HelpRequestItem[] = json.data || [];

      // Merge server items and local pending items
      const map = new Map<string, HelpRequestItem>();
      serverItems.forEach((item) => {
        if (item && item.status === 'PENDING') map.set(item.id, item);
      });
      localList.forEach((item) => {
        if (item && item.status === 'PENDING') map.set(item.id, item);
      });

      const merged = Array.from(map.values());
      saveStoredPendingRequests(merged);
      return merged;
    }
  } catch (err) {
    // Backend offline / network error
  }

  // Fallback to local stored pending requests
  return localList;
}

/**
 * 4. Resolve / Acknowledge help request from POS
 */
export async function resolveHelpRequest(id: string): Promise<void> {
  // 1. Remove from local persistent storage
  removeHelpRequestFromStoredList(id);

  // 2. Broadcast resolve event to all tabs
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_RESOLVED_KEY, JSON.stringify({ id, time: Date.now() }));
      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'HELP_RESOLVED', payload: { id } });
      }
    } catch (e) {}
  }

  // 3. Notify local listeners
  notifyHelpResolvedListeners(id);

  // 4. Background backend sync
  try {
    fetch(`${getBackendUrl()}/help/${id}/resolve`, {
      method: 'PUT',
    }).catch(() => {});
  } catch (err) {}
}

/**
 * 5. Subscribe to Help Requests on POS
 */
export function subscribeToHelpRequests(callback: HelpListener): () => void {
  helpListeners.add(callback);
  return () => {
    helpListeners.delete(callback);
  };
}

/**
 * 6. Subscribe to Resolved Help Requests
 */
export function subscribeToHelpResolved(callback: ResolvedListener): () => void {
  resolvedListeners.add(callback);
  return () => {
    resolvedListeners.delete(callback);
  };
}
