/**
 * timeService.ts - Centralized Database System Time & Singapore Standard Time (SGT, UTC+8)
 * 
 * Provides unified, synchronized time handling across the entire RedBay Car Wash POS & Kiosk APK.
 * - Synchronizes with the SQL Server Database system clock (/api/time).
 * - Tracks clock skew/offset between the client device and the database server.
 * - Enforces Singapore Timezone (Asia/Singapore, UTC+8:00) on all dates, times, receipts,
 *   clocks, reports, orders, and diagnostic slips regardless of the physical device's clock/timezone.
 */

import { getApiBaseUrl } from './apiConfig';

const SGT_TIMEZONE = 'Asia/Singapore';

// In-memory clock offset between database server and client device: serverTimeMs - clientTimeMs
let dbClockOffsetMs = 0;
let lastSyncTimestampMs = 0;
let syncTimer: any = null;
let isSyncing = false;

/**
 * Parses any date representation and ensures it aligns with Singapore Time (UTC+8).
 * Handles bare SQL datetime strings (e.g., '2026-11-17 13:45:00' without timezone),
 * ISO strings, timestamps, and Date objects.
 */
export function parseToSgDate(input?: string | number | Date | null): Date {
  if (!input) return getDbTime();
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? getDbTime() : input;
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? getDbTime() : d;
  }
  if (typeof input === 'string') {
    let s = input.trim();
    if (!s) return getDbTime();

    // Bare SQL timestamp format 'YYYY-MM-DD HH:mm:ss' or 'YYYY-MM-DDTHH:mm:ss' without timezone offset:
    // In SQL Server, GETDATE() is stored in Singapore Time (+08:00).
    // Append '+08:00' so JS engines don't misinterpret it as local device timezone (e.g. IST).
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(s)) {
      s = s.replace(' ', 'T') + '+08:00';
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? getDbTime() : d;
  }
  return getDbTime();
}

/**
 * Returns the current time adjusted to the Database Server clock.
 */
export function getDbTime(): Date {
  return new Date(Date.now() + dbClockOffsetMs);
}

/**
 * Returns current timestamp in epoch milliseconds adjusted to Database Server clock.
 */
export function getDbTimestampMs(): number {
  return Date.now() + dbClockOffsetMs;
}

/**
 * Format time in Singapore Timezone (SGT, UTC+8).
 * Example: '01:15:30 PM' or '01:15 PM'
 */
export function formatSgTime(
  input?: string | number | Date | null,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const d = parseToSgDate(input);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: SGT_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      ...options,
    };
    return d.toLocaleTimeString('en-SG', defaultOptions);
  } catch (err) {
    const d = getDbTime();
    return d.toLocaleTimeString('en-SG', { timeZone: SGT_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: true });
  }
}

/**
 * Format date in Singapore Timezone (SGT, UTC+8).
 * Example: '17/11/2026' (en-GB format)
 */
export function formatSgDate(
  input?: string | number | Date | null,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const d = parseToSgDate(input);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: SGT_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...options,
    };
    return d.toLocaleDateString('en-GB', defaultOptions);
  } catch (err) {
    const d = getDbTime();
    return d.toLocaleDateString('en-GB', { timeZone: SGT_TIMEZONE });
  }
}

/**
 * Format date & time together in Singapore Timezone (SGT, UTC+8).
 * Example: '17/11/2026, 01:15:30 PM'
 */
export function formatSgDateTime(
  input?: string | number | Date | null,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const d = parseToSgDate(input);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: SGT_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      ...options,
    };
    return d.toLocaleString('en-SG', defaultOptions);
  } catch (err) {
    const d = getDbTime();
    return d.toLocaleString('en-SG', { timeZone: SGT_TIMEZONE });
  }
}

/**
 * Returns ISO date string 'YYYY-MM-DD' representing the calendar date in Singapore.
 * Flips midnight at Singapore midnight (UTC+8), ensuring daily reports and shift dates
 * are accurate regardless of the device's physical timezone.
 */
export function getSgDateISO(input?: string | number | Date | null): string {
  try {
    const d = parseToSgDate(input);
    // en-CA outputs YYYY-MM-DD natively
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: SGT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch (err) {
    const d = getDbTime();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}

/**
 * Synchronize with the Database Server System Time (/api/time).
 * Calculates round-trip network latency and adjusts dbClockOffsetMs.
 */
export async function syncDbTime(): Promise<number> {
  if (isSyncing) return dbClockOffsetMs;
  isSyncing = true;

  try {
    const baseUrl = getApiBaseUrl();
    const startTime = Date.now();
    const response = await fetch(`${baseUrl}/api/time`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      const endTime = Date.now();
      const roundTrip = endTime - startTime;

      if (data && typeof data.epochMs === 'number') {
        // Adjust for half the network latency
        const serverNowMs = data.epochMs + Math.round(roundTrip / 2);
        dbClockOffsetMs = serverNowMs - endTime;
        lastSyncTimestampMs = endTime;
        console.log(`[TimeService] Synchronized with DB sys time. Offset: ${dbClockOffsetMs}ms, Round-trip: ${roundTrip}ms`);
      }
    }
  } catch (err: any) {
    // Keep last offset or 0 if never synced; SGT timezone conversion still protects display
    console.warn('[TimeService] Time sync notice:', err?.message || err);
  } finally {
    isSyncing = false;
  }

  return dbClockOffsetMs;
}

/**
 * Initializes periodic DB time synchronization.
 * Runs on app start and resyncs every 2 minutes.
 */
export function initTimeSync(): () => void {
  // Sync immediately
  syncDbTime();

  if (syncTimer) {
    clearInterval(syncTimer);
  }

  // Resync every 2 minutes
  syncTimer = setInterval(() => {
    syncDbTime();
  }, 120000);

  return () => {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
  };
}
