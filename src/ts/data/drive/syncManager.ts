/**
 * Sync Manager
 *
 * Handles change detection and debounced synchronization.
 * Tracks pending changes and syncs them with 5-second debounce.
 * Uses tauri-plugin-google-auth for OAuth on desktop.
 */

import { getDatabase, setDatabase } from "../storage/database.svelte";
import {
    checkConflict,
    showConflictDialog,
    performSync,
    syncChangedItems,
    initialSync,
    downloadManifest,
    createManifestFromLocal
} from "./sync";
import { alertError, alertStore } from "../../utils/alert.svelte";
import { language } from "../../../lang";
import { isTauri } from "../../utils/env";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "../../config/secrets";

// ============================================================================
// Types
// ============================================================================

export interface ChangedItem {
    type: 'chat' | 'character' | 'settings' | 'botPresets';
    id?: string;  // Required for chat (chaId_chatId) and character (chaId)
}

type SyncStatus = 'idle' | 'syncing' | 'error' | 'conflict' | 'rate_limited';

export interface SyncProgress {
    current: number;
    total: number;
    phase: string;  // e.g., 'characters', 'chats', 'assets'
}

export interface RateLimitInfo {
    retryAfter: number;  // seconds until retry
    retryAt: number;     // timestamp when retry will happen
}

// ============================================================================
// SyncManager Class
// ============================================================================

class SyncManager {
    private pendingChanges: Map<string, ChangedItem> = new Map();
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private debounceMs: number = 5000;  // 5 seconds

    private status: SyncStatus = 'idle';
    private lastError: string | null = null;
    private progress: SyncProgress | null = null;
    private cancelled: boolean = false;  // Cancellation flag
    private rateLimitInfo: RateLimitInfo | null = null;
    private rateLimitCountdownTimer: ReturnType<typeof setInterval> | null = null;

    // Listeners for UI updates
    private statusListeners: Set<(status: SyncStatus) => void> = new Set();
    private progressListeners: Set<(progress: SyncProgress | null) => void> = new Set();
    private rateLimitListeners: Set<(info: RateLimitInfo | null) => void> = new Set();

    // ========================================================================
    // Access Token Management (Persisted to DB)
    // ========================================================================

    /**
     * Set tokens after successful OAuth (persisted to DB)
     */
    setTokens(accessToken: string, refreshToken?: string, expiresIn?: number): void {
        const db = getDatabase();
        db.syncAccessToken = accessToken;
        if (refreshToken) {
            db.syncRefreshToken = refreshToken;
        }
        if (expiresIn) {
            // Store expiration time with 5 minute buffer
            db.syncTokenExpiresAt = Date.now() + (expiresIn * 1000) - (5 * 60 * 1000);
        }
        setDatabase(db);
        console.log('[SyncManager] Tokens saved to DB');
    }

    /**
     * Get the current access token (from DB)
     */
    getAccessToken(): string | null {
        return getDatabase().syncAccessToken || null;
    }

    /**
     * Clear all tokens (logout)
     */
    clearTokens(): void {
        const db = getDatabase();
        db.syncAccessToken = undefined;
        db.syncRefreshToken = undefined;
        db.syncTokenExpiresAt = undefined;
        setDatabase(db);
        this.cancelPendingSync();
        console.log('[SyncManager] Tokens cleared');
    }

    /**
     * Check if we have a valid access token
     */
    hasAccessToken(): boolean {
        const db = getDatabase();
        return !!db.syncAccessToken;
    }

    /**
     * Check if token is expired
     */
    isTokenExpired(): boolean {
        const db = getDatabase();
        if (!db.syncTokenExpiresAt) return false;
        return Date.now() > db.syncTokenExpiresAt;
    }

    /**
     * Check if we have a refresh token
     */
    hasRefreshToken(): boolean {
        return !!getDatabase().syncRefreshToken;
    }

    /**
     * Get refresh token
     */
    getRefreshToken(): string | null {
        return getDatabase().syncRefreshToken || null;
    }

    /**
     * Refresh access token using refresh token
     * Returns new access token if successful, null otherwise
     */
    async refreshAccessToken(): Promise<string | null> {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) {
            console.log('[SyncManager] No refresh token available');
            return null;
        }

        try {
            console.log('[SyncManager] Refreshing access token...');
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                    client_id: GOOGLE_CLIENT_ID,
                    client_secret: GOOGLE_CLIENT_SECRET,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[SyncManager] Token refresh failed:', response.status, errorText);
                // If refresh token is invalid, clear tokens
                if (response.status === 400 || response.status === 401) {
                    this.clearTokens();
                }
                return null;
            }

            const data = await response.json();
            console.log('[SyncManager] Token refreshed successfully');

            // Update tokens (refresh token may or may not be returned)
            this.setTokens(
                data.access_token,
                data.refresh_token, // May be undefined
                data.expires_in
            );

            return data.access_token;
        } catch (error) {
            console.error('[SyncManager] Token refresh error:', error);
            return null;
        }
    }

    /**
     * Get valid access token, refreshing if necessary
     */
    async getValidAccessToken(): Promise<string | null> {
        const accessToken = this.getAccessToken();
        if (!accessToken) {
            return null;
        }

        // Check if token is expired or about to expire
        if (this.isTokenExpired()) {
            console.log('[SyncManager] Token expired, attempting refresh');
            return await this.refreshAccessToken();
        }

        return accessToken;
    }

    // Legacy methods for compatibility
    setAccessToken(token: string): void {
        this.setTokens(token);
    }

    clearAccessToken(): void {
        this.clearTokens();
    }

    // ========================================================================
    // Status Management
    // ========================================================================

    /**
     * Get current sync status
     */
    getStatus(): SyncStatus {
        return this.status;
    }

    /**
     * Get last error message
     */
    getLastError(): string | null {
        return this.lastError;
    }

    /**
     * Subscribe to status changes
     */
    onStatusChange(listener: (status: SyncStatus) => void): () => void {
        this.statusListeners.add(listener);
        return () => this.statusListeners.delete(listener);
    }

    private setStatus(status: SyncStatus, error?: string): void {
        this.status = status;
        this.lastError = error || null;
        if (status !== 'syncing') {
            this.progress = null;
            this.progressListeners.forEach(listener => listener(null));
        }
        this.statusListeners.forEach(listener => listener(status));
    }

    // ========================================================================
    // Progress Management
    // ========================================================================

    /**
     * Get current sync progress
     */
    getProgress(): SyncProgress | null {
        return this.progress;
    }

    /**
     * Subscribe to progress changes
     */
    onProgressChange(listener: (progress: SyncProgress | null) => void): () => void {
        this.progressListeners.add(listener);
        return () => this.progressListeners.delete(listener);
    }

    /**
     * Update sync progress (called from sync.ts)
     */
    updateProgress(current: number, total: number, phase: string): void {
        this.progress = { current, total, phase };
        this.progressListeners.forEach(listener => listener(this.progress));
    }

    // ========================================================================
    // Rate Limit Management
    // ========================================================================

    /**
     * Get current rate limit info
     */
    getRateLimitInfo(): RateLimitInfo | null {
        return this.rateLimitInfo;
    }

    /**
     * Subscribe to rate limit changes
     */
    onRateLimitChange(listener: (info: RateLimitInfo | null) => void): () => void {
        this.rateLimitListeners.add(listener);
        return () => this.rateLimitListeners.delete(listener);
    }

    /**
     * Start rate limit countdown (called from sync.ts when 429 received)
     */
    startRateLimitCountdown(seconds: number): void {
        this.clearRateLimitCountdown();

        const retryAt = Date.now() + (seconds * 1000);
        this.rateLimitInfo = { retryAfter: seconds, retryAt };
        this.setStatus('rate_limited');
        this.rateLimitListeners.forEach(listener => listener(this.rateLimitInfo));

        // Update countdown every second
        this.rateLimitCountdownTimer = setInterval(() => {
            const remaining = Math.ceil((retryAt - Date.now()) / 1000);
            if (remaining <= 0) {
                this.clearRateLimitCountdown();
            } else {
                this.rateLimitInfo = { retryAfter: remaining, retryAt };
                this.rateLimitListeners.forEach(listener => listener(this.rateLimitInfo));
            }
        }, 1000);
    }

    /**
     * Clear rate limit countdown
     */
    clearRateLimitCountdown(): void {
        if (this.rateLimitCountdownTimer) {
            clearInterval(this.rateLimitCountdownTimer);
            this.rateLimitCountdownTimer = null;
        }
        this.rateLimitInfo = null;
        this.rateLimitListeners.forEach(listener => listener(null));
    }

    // ========================================================================
    // Change Tracking
    // ========================================================================

    /**
     * Mark an item as changed (will be synced after debounce)
     */
    markChanged(type: ChangedItem['type'], id?: string): void {
        const db = getDatabase();

        // Only track changes if sync is enabled
        if (!db.syncEnabled) {
            return;
        }

        // Need access token to sync
        if (!this.hasAccessToken()) {
            console.log('[SyncManager] No access token, change not tracked');
            return;
        }

        // Ignore changes during sync to prevent cascading syncs and version increment
        if (this.status === 'syncing') {
            return;
        }

        // Create unique key for deduplication
        const key = id ? `${type}:${id}` : type;
        this.pendingChanges.set(key, { type, id });

        console.log(`[SyncManager] Change marked: ${key} (${this.pendingChanges.size} pending)`);

        // Reset debounce timer
        this.scheduleSync();
    }

    /**
     * Mark a chat as changed
     */
    markChatChanged(chaId: string, chatId: string): void {
        this.markChanged('chat', `${chaId}_${chatId}`);
    }

    /**
     * Mark a character as changed
     */
    markCharacterChanged(chaId: string): void {
        this.markChanged('character', chaId);
    }

    /**
     * Mark settings as changed
     */
    markSettingsChanged(): void {
        this.markChanged('settings');
    }

    /**
     * Mark bot presets as changed
     */
    markBotPresetsChanged(): void {
        this.markChanged('botPresets');
    }

    // ========================================================================
    // Sync Scheduling
    // ========================================================================

    /**
     * Schedule a sync after debounce delay
     */
    private scheduleSync(): void {
        // Clear existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Schedule new sync
        this.debounceTimer = setTimeout(() => {
            this.executeSync();
        }, this.debounceMs);
    }

    /**
     * Cancel pending sync and abort running sync
     */
    cancelPendingSync(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.pendingChanges.clear();

        // Set cancellation flag to stop running sync
        if (this.status === 'syncing') {
            this.cancelled = true;
            this.setStatus('idle');
            console.log('[SyncManager] Sync cancelled');
        }
    }

    /**
     * Check if sync was cancelled (used by sync functions)
     */
    isCancelled(): boolean {
        return this.cancelled;
    }

    /**
     * Execute the sync immediately
     */
    private async executeSync(): Promise<void> {
        // Get valid token, refreshing if expired
        const accessToken = await this.getValidAccessToken();
        if (!accessToken) {
            console.log('[SyncManager] No valid access token, skipping sync');
            return;
        }

        if (this.pendingChanges.size === 0) {
            console.log('[SyncManager] No pending changes, skipping sync');
            return;
        }

        if (this.status === 'syncing') {
            console.log('[SyncManager] Already syncing, rescheduling');
            this.scheduleSync();
            return;
        }

        this.cancelled = false;  // Reset cancellation flag
        this.setStatus('syncing');
        const changes = Array.from(this.pendingChanges.values());
        this.pendingChanges.clear();
        this.debounceTimer = null;

        console.log(`[SyncManager] Executing sync with ${changes.length} changes`);

        try {
            // Check for conflict
            const conflictInfo = await checkConflict(accessToken);

            if (conflictInfo.hasConflict) {
                console.log('[SyncManager] Conflict detected');
                this.setStatus('conflict');

                const choice = await showConflictDialog(
                    conflictInfo.serverVersion,
                    conflictInfo.serverTime,
                    conflictInfo.localVersion,
                    conflictInfo.localTime
                );

                if (choice === 'cancel') {
                    this.setStatus('idle');
                    return;
                }

                // Perform full sync in chosen direction
                this.setStatus('syncing');
                await performSync(accessToken, choice);
            } else {
                // No conflict - sync only changed items
                await syncChangedItems(accessToken, changes);
            }

            this.setStatus('idle');
            console.log('[SyncManager] Sync completed successfully');

        } catch (error) {
            console.error('[SyncManager] Sync failed:', error);
            this.setStatus('error', error?.toString());

            // Re-add changes to retry later
            for (const change of changes) {
                const key = change.id ? `${change.type}:${change.id}` : change.type;
                this.pendingChanges.set(key, change);
            }
        }
    }

    // ========================================================================
    // Manual Sync Operations
    // ========================================================================

    /**
     * Perform initial sync on app startup
     */
    async doInitialSync(): Promise<void> {
        const accessToken = await this.getValidAccessToken();
        if (!accessToken) {
            console.log('[SyncManager] No valid access token for initial sync');
            return;
        }

        const db = getDatabase();
        if (!db.syncEnabled) {
            console.log('[SyncManager] Sync not enabled');
            return;
        }

        this.cancelled = false;
        this.setStatus('syncing');

        try {
            await initialSync(accessToken);
            if (!this.cancelled) {
                this.setStatus('idle');
            }
        } catch (error) {
            if (!this.cancelled) {
                console.error('[SyncManager] Initial sync failed:', error);
                this.setStatus('error', error?.toString());
            }
        }
    }

    /**
     * Force a full sync in the specified direction
     */
    async forceSync(direction: 'download' | 'upload'): Promise<void> {
        const accessToken = await this.getValidAccessToken();
        if (!accessToken) {
            alertError(language.syncNoToken || 'No access token. Please connect to Google Drive first.');
            return;
        }

        this.cancelPendingSync();
        this.cancelled = false;
        this.setStatus('syncing');

        try {
            await performSync(accessToken, direction);
            if (!this.cancelled) {
                this.setStatus('idle');
            }
        } catch (error) {
            if (!this.cancelled) {
                console.error('[SyncManager] Force sync failed:', error);
                this.setStatus('error', error?.toString());
                alertError(`Sync failed: ${error}`);
            }
        }
    }

    /**
     * Sync immediately without waiting for debounce
     */
    async syncNow(): Promise<void> {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        await this.executeSync();
    }

    // ========================================================================
    // Enable/Disable Sync
    // ========================================================================

    /**
     * Enable sync
     */
    enable(): void {
        const db = getDatabase();
        db.syncEnabled = true;
        setDatabase(db);
        console.log('[SyncManager] Sync enabled');
    }

    /**
     * Disable sync
     */
    disable(): void {
        const db = getDatabase();
        db.syncEnabled = false;
        setDatabase(db);
        this.cancelPendingSync();
        console.log('[SyncManager] Sync disabled');
    }

    /**
     * Check if sync is enabled
     */
    isEnabled(): boolean {
        return getDatabase().syncEnabled || false;
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const syncManager = new SyncManager();
