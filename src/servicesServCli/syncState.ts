const SYNC_REQUEST_COOLDOWN_MS = 30_000;
const SYNC_PENDING_TIMEOUT_MS = 120_000;
const SYNC_ALERT_INTERVAL_MS = 60_000;

interface PendingSync {
    lastRequestAt: number;
    pendingSince: number;
    lastAlertAt: number;
}

const pendingByTable = new Map<number, PendingSync>();

export function isSyncRequestAllowed(fk_table: number, now: number): boolean {
    const pending = pendingByTable.get(fk_table);
    if (!pending) return true;
    return now - pending.lastRequestAt >= SYNC_REQUEST_COOLDOWN_MS;
}

export function markSyncRequested(fk_table: number, now: number): void {
    const existing = pendingByTable.get(fk_table);
    pendingByTable.set(fk_table, {
        lastRequestAt: now,
        pendingSince: existing?.pendingSince ?? now,
        lastAlertAt: existing?.lastAlertAt ?? 0,
    });
}

export function markSyncResolved(fk_table: number): void {
    pendingByTable.delete(fk_table);
}

export function hasPendingSync(fk_table: number): boolean {
    return pendingByTable.has(fk_table);
}

export function shouldAlertPendingSync(fk_table: number, now: number): boolean {
    const pending = pendingByTable.get(fk_table);
    if (!pending) return false;
    if (now - pending.pendingSince < SYNC_PENDING_TIMEOUT_MS) return false;
    if (now - pending.lastAlertAt < SYNC_ALERT_INTERVAL_MS) return false;
    pending.lastAlertAt = now;
    return true;
}

export function getPendingSyncInfo(fk_table: number, now: number): { timePendingMs: number } | null {
    const pending = pendingByTable.get(fk_table);
    if (!pending) return null;
    return { timePendingMs: now - pending.pendingSince };
}

export const SYNC_CONFIG = {
    cooldownMs: SYNC_REQUEST_COOLDOWN_MS,
    pendingTimeoutMs: SYNC_PENDING_TIMEOUT_MS,
    alertIntervalMs: SYNC_ALERT_INTERVAL_MS,
};
