/**
 * Google Drive Real-time Sync
 *
 * Implements manifest-based optimistic locking for real-time synchronization.
 */

import { alertError, alertSelect, alertStore } from "../../utils/alert";
import { getDatabase, setDatabase, type character, type groupChat, type Chat, type Database } from "../storage/database.svelte";
import { forageStorage } from "src/ts/data/storage/autoStorage";
import { saveToWorker, loadFromWorker } from 'src/ts/data/storage/opfsWorkerClient.svelte'
import { decodeChat } from 'src/ts/data/storage/risuSave'
import { getUnpargeables } from 'src/ts/utils/dbUtils'
import { sleep, getBasename } from '../../utils/util';
import { language } from "../../../lang";
import { syncManager } from "./syncManager";

// ============================================================================
// Types
// ============================================================================

export interface SyncManifest {
    version: number;  // Incremented on every change

    chats: {
        [chatId: string]: { modifiedAt: number; fileId?: string }
    };

    characters: {
        [charId: string]: { modifiedAt: number; fileId?: string }
    };

    settings: {
        modifiedAt: number;
        fileId?: string;
    };

    botPresets: {
        modifiedAt: number;
        fileId?: string;
    };

    assets: {
        [assetName: string]: { fileId: string }
    };

    deletedAssets: {
        [assetName: string]: number;  // Deletion timestamp (cleanup after 30 days)
    };
}

interface DriveFile {
    mimeType: string;
    name: string;
    id: string;
}

// ============================================================================
// Constants
// ============================================================================

const SYNC_FOLDER = 'sync';
const MANIFEST_FILE = 'manifest.json';
const TOMBSTONE_DAYS = 30;
const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 1000;  // 1 second

// Cached manifest file ID (to avoid repeated listSyncFiles calls)
let cachedManifestFileId: string | null = null;

// ============================================================================
// Fetch with Retry (Exponential Backoff)
// ============================================================================

interface FetchWithRetryOptions extends RequestInit {
    maxRetries?: number;
}

/**
 * Fetch with automatic retry on rate limit (429) and server errors (5xx)
 * Uses exponential backoff with jitter
 */
async function fetchWithRetry(
    url: string,
    options: FetchWithRetryOptions = {}
): Promise<Response> {
    const { maxRetries = MAX_RETRIES, ...fetchOptions } = options;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // Check if sync was cancelled
        if (syncManager.isCancelled()) {
            throw new Error('Sync cancelled');
        }

        const response = await fetch(url, fetchOptions);

        // Success or client error (except 429) - return immediately
        if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
            return response;
        }

        // Rate limit (429) or server error (5xx) - retry with backoff
        if (response.status === 429 || response.status >= 500) {
            if (attempt === maxRetries) {
                // Last attempt failed
                return response;
            }

            // Calculate delay with exponential backoff + jitter
            // Try to get Retry-After header first
            const retryAfterHeader = response.headers.get('Retry-After');
            let delayMs: number;

            if (retryAfterHeader) {
                // Retry-After can be seconds or HTTP date
                const retryAfterSeconds = parseInt(retryAfterHeader, 10);
                if (!isNaN(retryAfterSeconds)) {
                    delayMs = retryAfterSeconds * 1000;
                } else {
                    // Try parsing as HTTP date
                    const retryDate = new Date(retryAfterHeader);
                    delayMs = Math.max(0, retryDate.getTime() - Date.now());
                }
            } else {
                // Exponential backoff: 1s, 2s, 4s, 8s, 16s + jitter
                delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
                // Add jitter (0-25% of delay)
                delayMs += Math.random() * delayMs * 0.25;
            }

            const delaySeconds = Math.ceil(delayMs / 1000);
            console.log(`[Sync] Rate limited (${response.status}), retrying in ${delaySeconds}s (attempt ${attempt + 1}/${maxRetries})`);

            // Update UI with countdown
            syncManager.startRateLimitCountdown(delaySeconds);

            // Wait for the delay
            await sleep(delayMs);

            // Clear rate limit status before retry
            syncManager.clearRateLimitCountdown();
            continue;
        }

        // Other errors - return response
        return response;
    }

    // Should not reach here, but just in case
    throw new Error('Max retries exceeded');
}

// ============================================================================
// Google Drive API Helpers (for sync folder)
// ============================================================================

let syncFolderId: string | null = null;

/**
 * Get or create the sync folder in appDataFolder
 */
async function getSyncFolderId(accessToken: string): Promise<string> {
    if (syncFolderId) return syncFolderId;

    // Search for existing sync folder
    const searchUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${SYNC_FOLDER}' and mimeType='application/vnd.google-apps.folder'`;
    const searchResponse = await fetchWithRetry(searchUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (searchResponse.ok) {
        const data = await searchResponse.json();
        if (data.files && data.files.length > 0) {
            syncFolderId = data.files[0].id;
            return syncFolderId;
        }
    }

    // Create sync folder if not exists
    const createResponse = await fetchWithRetry('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: SYNC_FOLDER,
            mimeType: 'application/vnd.google-apps.folder',
            parents: ['appDataFolder']
        })
    });

    if (createResponse.ok) {
        const folder = await createResponse.json();
        syncFolderId = folder.id;
        return syncFolderId;
    }

    throw new Error('Failed to create sync folder');
}

/**
 * List files in sync folder
 */
async function listSyncFiles(accessToken: string): Promise<DriveFile[]> {
    const folderId = await getSyncFolderId(accessToken);
    const files: DriveFile[] = [];
    let pageToken = '';

    do {
        const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q='${folderId}' in parents&pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const response = await fetchWithRetry(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            throw new Error(`Failed to list sync files: ${response.status}`);
        }

        const data = await response.json();
        files.push(...(data.files || []));
        pageToken = data.nextPageToken || '';
    } while (pageToken);

    return files;
}

/**
 * Create or update a file in sync folder
 */
async function uploadSyncFile(accessToken: string, fileName: string, content: Uint8Array<ArrayBuffer>, existingFileId?: string): Promise<string> {
    const folderId = await getSyncFolderId(accessToken);

    if (existingFileId) {
        // Update existing file
        const response = await fetchWithRetry(
            `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/octet-stream'
                },
                body: content
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to update file: ${response.status}`);
        }

        return existingFileId;
    } else {
        // Create new file
        const metadata = {
            name: fileName,
            parents: [folderId]
        };

        const body = new FormData();
        body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        body.append('file', new Blob([content]));

        const response = await fetchWithRetry(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` },
                body
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to create file: ${response.status}`);
        }

        const result = await response.json();
        return result.id;
    }
}

/**
 * Download a file from sync folder
 */
async function downloadSyncFile(accessToken: string, fileId: string): Promise<Uint8Array<ArrayBuffer>> {
    const response = await fetchWithRetry(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`);
    }

    return new Uint8Array(await response.arrayBuffer()) as Uint8Array<ArrayBuffer>;
}

/**
 * Delete a file from sync folder
 */
async function deleteSyncFile(accessToken: string, fileId: string): Promise<void> {
    const response = await fetchWithRetry(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );

    if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to delete file: ${response.status}`);
    }
}

// ============================================================================
// Manifest Operations
// ============================================================================

/**
 * Download manifest from Drive
 */
export async function downloadManifest(accessToken: string): Promise<SyncManifest | null> {
    try {
        // Try using cached manifest file ID first
        if (cachedManifestFileId) {
            try {
                const data = await downloadSyncFile(accessToken, cachedManifestFileId);
                const text = new TextDecoder().decode(data);
                return JSON.parse(text) as SyncManifest;
            } catch (e) {
                // Cache might be stale, clear and try finding again
                cachedManifestFileId = null;
            }
        }

        // Find manifest file (only needed on first call or if cache was stale)
        const files = await listSyncFiles(accessToken);
        const manifestFile = files.find(f => f.name === MANIFEST_FILE);

        if (!manifestFile) {
            return null;
        }

        // Cache the file ID for future calls
        cachedManifestFileId = manifestFile.id;

        const data = await downloadSyncFile(accessToken, manifestFile.id);
        const text = new TextDecoder().decode(data);
        return JSON.parse(text) as SyncManifest;
    } catch (e) {
        console.error('[Sync] Failed to download manifest:', e);
        return null;
    }
}

/**
 * Upload manifest to Drive
 */
export async function uploadManifest(accessToken: string, manifest: SyncManifest): Promise<void> {
    const content = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    // Use cached manifest file ID if available
    const fileId = await uploadSyncFile(accessToken, MANIFEST_FILE, content, cachedManifestFileId || undefined);
    // Update cache with returned file ID
    cachedManifestFileId = fileId;
}

/**
 * Create initial manifest from local data
 */
export function createManifestFromLocal(): SyncManifest {
    const db = getDatabase();
    const manifest: SyncManifest = {
        version: 1,
        chats: {},
        characters: {},
        settings: { modifiedAt: Date.now() },
        botPresets: { modifiedAt: Date.now() },
        assets: {},
        deletedAssets: {}
    };

    for (const char of db.characters) {
        manifest.characters[char.chaId] = {
            modifiedAt: char.modifiedAt || Date.now()
        };

        for (const chat of char.chats || []) {
            if (chat.id) {
                manifest.chats[`${char.chaId}_${chat.id}`] = {
                    modifiedAt: chat.modifiedAt || Date.now()
                };
            }
        }
    }

    return manifest;
}

// ============================================================================
// Sync Operations
// ============================================================================

export interface ConflictInfo {
    hasConflict: boolean;
    serverVersion?: number;
    serverTime?: number;
    localVersion?: number;
    localTime?: number;
}

/**
 * Check if there's a conflict (server has newer version)
 */
export async function checkConflict(accessToken: string): Promise<ConflictInfo> {
    const db = getDatabase();
    const serverManifest = await downloadManifest(accessToken);

    if (!serverManifest) {
        return { hasConflict: false };  // No manifest = no conflict
    }

    const lastSyncedVersion = db.lastSyncedVersion || 0;
    const hasConflict = serverManifest.version > lastSyncedVersion;

    return {
        hasConflict,
        serverVersion: serverManifest.version,
        serverTime: Math.max(
            serverManifest.settings?.modifiedAt || 0,
            serverManifest.botPresets?.modifiedAt || 0,
            ...Object.values(serverManifest.characters).map(c => c.modifiedAt || 0),
            ...Object.values(serverManifest.chats).map(c => c.modifiedAt || 0)
        ),
        localVersion: lastSyncedVersion,
        localTime: db.lastSyncTime
    };
}

/**
 * Show conflict resolution dialog with version info
 */
export async function showConflictDialog(
    serverVersion?: number,
    serverTime?: number,
    localVersion?: number,
    localTime?: number
): Promise<'download' | 'upload' | 'cancel'> {
    const formatTime = (ts?: number) => ts ? new Date(ts).toLocaleString() : '?';

    const serverLabel = serverVersion !== undefined
        ? `${language.syncUseServerVersion || 'Use server version'} (v${serverVersion}, ${formatTime(serverTime)})`
        : language.syncUseServerVersion || 'Use server version (download)';

    const localLabel = localVersion !== undefined
        ? `${language.syncUseLocalVersion || 'Use local version'} (v${localVersion}, ${formatTime(localTime)})`
        : language.syncUseLocalVersion || 'Use local version (upload)';

    const choice = await alertSelect([
        serverLabel,
        localLabel,
        language.cancel || 'Cancel'
    ]);

    switch (choice) {
        case '0': return 'download';
        case '1': return 'upload';
        default: return 'cancel';
    }
}

/**
 * Perform full sync in the specified direction
 */
export async function performSync(
    accessToken: string,
    direction: 'download' | 'upload'
): Promise<void> {
    const db = getDatabase();
    const serverManifest = await downloadManifest(accessToken);
    const localManifest = createManifestFromLocal();

    // Only block UI for downloads (affects local data)
    // Uploads run in background
    if (direction === 'download') {
        alertStore.set({
            type: 'wait',
            msg: 'Downloading...'
        });
    }

    if (direction === 'download') {
        await syncDownload(accessToken, serverManifest, localManifest);

        // Update lastSyncedVersion from server
        const newManifest = await downloadManifest(accessToken);
        if (newManifest) {
            db.lastSyncedVersion = newManifest.version;
            db.lastSyncTime = Date.now();
            setDatabase(db);
        }

        alertStore.set({ type: 'none', msg: '' });
    } else {
        // syncUpload handles version update internally
        await syncUpload(accessToken, serverManifest, localManifest);
    }
}

/**
 * Sync download: Server → Local
 */
async function syncDownload(
    accessToken: string,
    serverManifest: SyncManifest | null,
    localManifest: SyncManifest
): Promise<void> {
    if (!serverManifest) {
        console.log('[Sync] No server manifest, nothing to download');
        return;
    }

    const db = getDatabase();
    let downloadCount = 0;
    let skipCount = 0;

    // Download characters (using fileId from manifest)
    for (const [charId, serverItem] of Object.entries(serverManifest.characters)) {
        if (syncManager.isCancelled()) break;

        const localItem = localManifest.characters[charId];

        if (localItem && localItem.modifiedAt === serverItem.modifiedAt) {
            skipCount++;
            continue;
        }

        if (!serverItem.fileId) {
            console.warn(`[Sync] No fileId for character ${charId}, skipping`);
            continue;
        }

        try {
            const data = await downloadSyncFile(accessToken, serverItem.fileId);
            const charData = JSON.parse(new TextDecoder().decode(data)) as character | groupChat;

            // Find and update character in DB
            const index = db.characters.findIndex(c => c.chaId === charId);
            if (index >= 0) {
                db.characters[index] = charData;
            } else {
                db.characters.push(charData);
            }
            downloadCount++;
        } catch (e) {
            console.error(`[Sync] Failed to download character ${charId}:`, e);
        }
    }

    if (syncManager.isCancelled()) {
        console.log('[Sync] Download cancelled');
        return;
    }

    // Delete characters not in server manifest
    db.characters = db.characters.filter(c =>
        serverManifest.characters[c.chaId] !== undefined
    );

    // Download chats (using fileId from manifest)
    for (const [chatKey, serverItem] of Object.entries(serverManifest.chats)) {
        if (syncManager.isCancelled()) break;

        const localItem = localManifest.chats[chatKey];

        if (localItem && localItem.modifiedAt === serverItem.modifiedAt) {
            skipCount++;
            continue;
        }

        if (!serverItem.fileId) {
            console.warn(`[Sync] No fileId for chat ${chatKey}, skipping`);
            continue;
        }

        try {
            const data = await downloadSyncFile(accessToken, serverItem.fileId);
            // Save to local OPFS (chatKey is "chaId_chatId", convert to "chaId/chatId")
            const [chaId, chatId] = chatKey.split('_')
            await saveToWorker(`database/chats/${chaId}/${chatId}.bin`, data);
            downloadCount++;
        } catch (e) {
            console.error(`[Sync] Failed to download chat ${chatKey}:`, e);
        }
    }

    if (syncManager.isCancelled()) {
        console.log('[Sync] Download cancelled');
        return;
    }

    // Download settings (using fileId from manifest)
    if (serverManifest.settings.fileId) {
        try {
            const data = await downloadSyncFile(accessToken, serverManifest.settings.fileId);
            const settings = JSON.parse(new TextDecoder().decode(data));
            // Merge settings (preserve sync-related fields)
            Object.assign(db, settings, {
                lastSyncedVersion: db.lastSyncedVersion,
                lastSyncTime: db.lastSyncTime,
                syncEnabled: db.syncEnabled
            });
        } catch (e) {
            console.error('[Sync] Failed to download settings:', e);
        }
    }

    // Download botPresets (using fileId from manifest)
    if (serverManifest.botPresets.fileId) {
        try {
            const data = await downloadSyncFile(accessToken, serverManifest.botPresets.fileId);
            const presets = JSON.parse(new TextDecoder().decode(data));
            db.botPresets = presets;
        } catch (e) {
            console.error('[Sync] Failed to download botPresets:', e);
        }
    }

    setDatabase(db);

    // Sync assets (using fileId from manifest)
    alertStore.set({
        type: 'wait',
        msg: language.syncDownloadingAssets || 'Downloading assets...'
    });
    const assetResult = await syncAssetsDownload(accessToken, serverManifest);

    console.log(`[Sync] Download complete: ${downloadCount} downloaded, ${skipCount} skipped, ${assetResult.downloadCount} assets`);
}

/**
 * Sync upload: Local → Server
 */
async function syncUpload(
    accessToken: string,
    serverManifest: SyncManifest | null,
    localManifest: SyncManifest
): Promise<void> {
    const db = getDatabase();
    const PARALLEL_UPLOADS = db.driveParallelConnections || 20;

    // If no server manifest, create one
    const manifest: SyncManifest = serverManifest || {
        version: 0,
        chats: {},
        characters: {},
        settings: { modifiedAt: 0 },
        botPresets: { modifiedAt: 0 },
        assets: {},
        deletedAssets: {}
    };

    // Ensure assets object exists (for legacy manifests)
    if (!manifest.assets) {
        manifest.assets = {};
    }

    // ========== Build upload lists ==========

    // Characters to upload (use fileId from manifest)
    type CharUploadItem = { char: character | groupChat; fileName: string; existingFileId?: string };
    const charsToUpload: CharUploadItem[] = [];

    for (const char of db.characters) {
        const serverItem = manifest.characters[char.chaId];
        if (serverItem && serverItem.modifiedAt === (char.modifiedAt || 0)) {
            continue;
        }
        const fileName = `char_${char.chaId}.json.bin`;
        charsToUpload.push({ char, fileName, existingFileId: serverItem?.fileId });
    }

    // Chats to upload (use fileId from manifest)
    type ChatUploadItem = { chatKey: string; chat: Chat; fileName: string; existingFileId?: string };
    const chatsToUpload: ChatUploadItem[] = [];

    for (const char of db.characters) {
        for (const chat of char.chats || []) {
            if (!chat.id) continue;
            const chatKey = `${char.chaId}_${chat.id}`;
            const serverItem = manifest.chats[chatKey];
            if (serverItem && serverItem.modifiedAt === (chat.modifiedAt || 0)) {
                continue;
            }
            const fileName = `chat_${chatKey}.json.bin`;
            chatsToUpload.push({ chatKey, chat, fileName, existingFileId: serverItem?.fileId });
        }
    }

    // Get asset count for total progress calculation
    const localAssets = getLocalAssetList();
    const totalItems = charsToUpload.length + chatsToUpload.length + localAssets.length;
    let uploadedCount = 0;

    console.log(`[Sync] Items to upload: ${charsToUpload.length} characters, ${chatsToUpload.length} chats, ${localAssets.length} assets, parallel: ${PARALLEL_UPLOADS}`);

    // ========== Parallel character uploads ==========
    if (charsToUpload.length > 0) {
        let charIndex = 0;

        async function uploadOneChar(): Promise<void> {
            while (charIndex < charsToUpload.length && !syncManager.isCancelled()) {
                const idx = charIndex++;
                const { char, fileName, existingFileId } = charsToUpload[idx];

                try {
                    const content = new TextEncoder().encode(JSON.stringify(char));
                    const fileId = await uploadSyncFile(accessToken, fileName, content, existingFileId);
                    manifest.characters[char.chaId] = { modifiedAt: char.modifiedAt || Date.now(), fileId };
                    uploadedCount++;
                    syncManager.updateProgress(uploadedCount, totalItems, 'characters');
                } catch (e) {
                    console.error(`[Sync] Failed to upload character ${char.chaId}:`, e);
                }
            }
        }

        await Promise.all(
            Array.from({ length: Math.min(PARALLEL_UPLOADS, charsToUpload.length) }, () => uploadOneChar())
        );
    }

    if (syncManager.isCancelled()) {
        console.log('[Sync] Upload cancelled');
        return;
    }

    // Delete characters not in local from manifest (parallel)
    const charsToDelete: { charId: string; fileId: string }[] = [];
    for (const charId of Object.keys(manifest.characters)) {
        if (!db.characters.find(c => c.chaId === charId)) {
            const serverItem = manifest.characters[charId];
            if (serverItem?.fileId) {
                charsToDelete.push({ charId, fileId: serverItem.fileId });
            }
            delete manifest.characters[charId];
        }
    }

    if (charsToDelete.length > 0) {
        let charDelIdx = 0;
        let charDeleted = 0;
        async function deleteOneChar(): Promise<void> {
            while (charDelIdx < charsToDelete.length && !syncManager.isCancelled()) {
                const { charId, fileId } = charsToDelete[charDelIdx++];
                try {
                    await deleteSyncFile(accessToken, fileId);
                    charDeleted++;
                    syncManager.updateProgress(charDeleted, charsToDelete.length, 'deleting');
                } catch (e) {
                    console.error(`[Sync] Failed to delete character file ${charId}:`, e);
                    charDeleted++;
                    syncManager.updateProgress(charDeleted, charsToDelete.length, 'deleting');
                }
            }
        }
        await Promise.all(
            Array.from({ length: Math.min(PARALLEL_UPLOADS, charsToDelete.length) }, () => deleteOneChar())
        );
    }

    if (syncManager.isCancelled()) {
        console.log('[Sync] Upload cancelled');
        return;
    }

    // ========== Parallel chat uploads ==========
    if (chatsToUpload.length > 0) {
        let chatIndex = 0;

        async function uploadOneChat(): Promise<void> {
            while (chatIndex < chatsToUpload.length && !syncManager.isCancelled()) {
                const idx = chatIndex++;
                const { chatKey, chat, fileName, existingFileId } = chatsToUpload[idx];

                try {
                    // Load chat content from OPFS if not loaded
                    // chatKey is "chaId_chatId", convert to "chaId/chatId" for file path
                    const [chaId, chatId] = chatKey.split('_')
                    let chatData = chat;
                    if (chat.message === undefined) {
                        try {
                            const data = await loadFromWorker(`database/chats/${chaId}/${chatId}.bin`);
                            if (data) {
                                chatData = JSON.parse(new TextDecoder().decode(data));
                            }
                        } catch (e) {
                            // Use chat as-is
                        }
                    }

                    const content = new TextEncoder().encode(JSON.stringify(chatData));
                    const fileId = await uploadSyncFile(accessToken, fileName, content, existingFileId);
                    manifest.chats[chatKey] = { modifiedAt: chat.modifiedAt || Date.now(), fileId };
                    uploadedCount++;
                    syncManager.updateProgress(uploadedCount, totalItems, 'chats');
                } catch (e) {
                    console.error(`[Sync] Failed to upload chat ${chatKey}:`, e);
                }
            }
        }

        await Promise.all(
            Array.from({ length: Math.min(PARALLEL_UPLOADS, chatsToUpload.length) }, () => uploadOneChat())
        );
    }

    if (syncManager.isCancelled()) {
        console.log('[Sync] Upload cancelled');
        return;
    }

    // Delete chats not in local from manifest (parallel)
    const localChatKeys = new Set<string>();
    for (const char of db.characters) {
        for (const chat of char.chats || []) {
            if (chat.id) {
                localChatKeys.add(`${char.chaId}_${chat.id}`);
            }
        }
    }

    const chatsToDelete: { chatKey: string; fileId: string }[] = [];
    for (const chatKey of Object.keys(manifest.chats)) {
        if (!localChatKeys.has(chatKey)) {
            const serverItem = manifest.chats[chatKey];
            if (serverItem?.fileId) {
                chatsToDelete.push({ chatKey, fileId: serverItem.fileId });
            }
            delete manifest.chats[chatKey];
        }
    }

    if (chatsToDelete.length > 0) {
        let chatDelIdx = 0;
        let chatDeleted = 0;
        async function deleteOneChat(): Promise<void> {
            while (chatDelIdx < chatsToDelete.length && !syncManager.isCancelled()) {
                const { chatKey, fileId } = chatsToDelete[chatDelIdx++];
                try {
                    await deleteSyncFile(accessToken, fileId);
                    chatDeleted++;
                    syncManager.updateProgress(chatDeleted, chatsToDelete.length, 'deleting');
                } catch (e) {
                    console.error(`[Sync] Failed to delete chat file ${chatKey}:`, e);
                    chatDeleted++;
                    syncManager.updateProgress(chatDeleted, chatsToDelete.length, 'deleting');
                }
            }
        }
        await Promise.all(
            Array.from({ length: Math.min(PARALLEL_UPLOADS, chatsToDelete.length) }, () => deleteOneChat())
        );
    }

    if (syncManager.isCancelled()) {
        console.log('[Sync] Upload cancelled');
        return;
    }

    // Upload settings (exclude characters, botPresets, and sync fields)
    const settingsToUpload = { ...db };
    delete (settingsToUpload as any).characters;
    delete (settingsToUpload as any).botPresets;
    delete (settingsToUpload as any).lastSyncedVersion;
    delete (settingsToUpload as any).lastSyncTime;
    delete (settingsToUpload as any).syncEnabled;

    const settingsContent = new TextEncoder().encode(JSON.stringify(settingsToUpload));
    const settingsFileId = await uploadSyncFile(accessToken, 'settings.json.bin', settingsContent, manifest.settings.fileId);
    manifest.settings = { modifiedAt: Date.now(), fileId: settingsFileId };

    // Upload botPresets
    const presetsContent = new TextEncoder().encode(JSON.stringify(db.botPresets));
    const presetsFileId = await uploadSyncFile(accessToken, 'botpresets.json.bin', presetsContent, manifest.botPresets.fileId);
    manifest.botPresets = { modifiedAt: Date.now(), fileId: presetsFileId };

    // Sync assets (runs in background, no UI blocking)
    console.log('[Sync] Starting asset upload...');
    const assetResult = await syncAssetsUpload(accessToken, manifest, uploadedCount, totalItems);

    // Increment version - update local first, then server
    // This way, if interrupted between local and server update,
    // local will be "newer" and user can choose to upload again
    manifest.version++;
    db.lastSyncedVersion = manifest.version;
    db.lastSyncTime = Date.now();
    setDatabase(db);

    await uploadManifest(accessToken, manifest);

    console.log(`[Sync] Upload complete: ${totalItems} items (${assetResult.uploadCount} assets uploaded, ${assetResult.skipCount} skipped)`);
}

/**
 * Sync only changed items (for incremental sync)
 */
export async function syncChangedItems(
    accessToken: string,
    changedItems: { type: 'chat' | 'character' | 'settings' | 'botPresets', id?: string }[]
): Promise<void> {
    // Check for conflict first
    const conflictInfo = await checkConflict(accessToken);
    if (conflictInfo.hasConflict) {
        alertError(language.syncConflictDetected || 'Sync conflict detected! Another device has made changes.');
        return;
    }

    const db = getDatabase();
    const serverManifest = await downloadManifest(accessToken) || createManifestFromLocal();

    for (const item of changedItems) {
        if (item.type === 'character' && item.id) {
            const char = db.characters.find(c => c.chaId === item.id);
            if (char) {
                const fileName = `char_${char.chaId}.json.bin`;
                const existingFileId = serverManifest.characters[char.chaId]?.fileId;
                const content = new TextEncoder().encode(JSON.stringify(char));
                const fileId = await uploadSyncFile(accessToken, fileName, content, existingFileId);
                serverManifest.characters[char.chaId] = { modifiedAt: char.modifiedAt || Date.now(), fileId };
            }
        } else if (item.type === 'chat' && item.id) {
            // item.id is chatKey (chaId_chatId), convert to chaId/chatId for file path
            const [chaId, chatId] = item.id.split('_')
            const fileName = `chat_${item.id}.json.bin`;
            const existingFileId = serverManifest.chats[item.id]?.fileId;

            // Load chat from OPFS
            const data = await loadFromWorker(`database/chats/${chaId}/${chatId}.bin`);
            if (data) {
                const fileId = await uploadSyncFile(accessToken, fileName, data as Uint8Array<ArrayBuffer>, existingFileId);
                const chat = await decodeChat(data);
                serverManifest.chats[item.id] = { modifiedAt: chat?.modifiedAt || Date.now(), fileId };
            }
        } else if (item.type === 'settings') {
            const settingsToUpload = { ...db };
            delete (settingsToUpload as any).characters;
            delete (settingsToUpload as any).botPresets;
            const settingsContent = new TextEncoder().encode(JSON.stringify(settingsToUpload));
            const fileId = await uploadSyncFile(accessToken, 'settings.json.bin', settingsContent, serverManifest.settings.fileId);
            serverManifest.settings = { modifiedAt: Date.now(), fileId };
        } else if (item.type === 'botPresets') {
            const presetsContent = new TextEncoder().encode(JSON.stringify(db.botPresets));
            const fileId = await uploadSyncFile(accessToken, 'botpresets.json.bin', presetsContent, serverManifest.botPresets.fileId);
            serverManifest.botPresets = { modifiedAt: Date.now(), fileId };
        }
    }

    // Update manifest - local first, then server
    serverManifest.version++;
    db.lastSyncedVersion = serverManifest.version;
    db.lastSyncTime = Date.now();
    setDatabase(db);

    await uploadManifest(accessToken, serverManifest);
}

/**
 * Initial sync on app startup
 */
export async function initialSync(accessToken: string): Promise<void> {
    const db = getDatabase();

    if (!db.syncEnabled) {
        return;
    }

    console.log('[Sync] Starting initial sync...');

    const conflictInfo = await checkConflict(accessToken);

    if (conflictInfo.hasConflict) {
        // Server is newer - show conflict dialog
        const choice = await showConflictDialog(
            conflictInfo.serverVersion,
            conflictInfo.serverTime,
            conflictInfo.localVersion,
            conflictInfo.localTime
        );

        if (choice === 'cancel') {
            return;
        }

        await performSync(accessToken, choice);
    } else if (conflictInfo.serverVersion === conflictInfo.localVersion) {
        // Already in sync - nothing to do
        console.log('[Sync] Already in sync, skipping');
    } else {
        // Local is newer (or first sync) - upload
        await performSync(accessToken, 'upload');
    }

    console.log('[Sync] Initial sync complete');
}

/**
 * Clean up old tombstones (called periodically)
 */
export async function cleanupTombstones(accessToken: string): Promise<void> {
    const serverManifest = await downloadManifest(accessToken);
    if (!serverManifest) return;

    const now = Date.now();
    const tombstoneThreshold = TOMBSTONE_DAYS * 24 * 60 * 60 * 1000;

    let cleaned = false;
    for (const [assetName, deletedAt] of Object.entries(serverManifest.deletedAssets)) {
        if (now - deletedAt > tombstoneThreshold) {
            delete serverManifest.deletedAssets[assetName];
            cleaned = true;
        }
    }

    if (cleaned) {
        serverManifest.version++;
        await uploadManifest(accessToken, serverManifest);
    }
}

// ============================================================================
// Asset Sync Operations
// ============================================================================

/**
 * Get list of assets that are currently in use (from DB references)
 */
function getLocalAssetList(): string[] {
    const db = getDatabase();
    return getUnpargeables(db, 'basename');
}

/**
 * Upload assets from local to server
 */
async function syncAssetsUpload(
    accessToken: string,
    manifest: SyncManifest,
    baseCount: number,
    grandTotal: number
): Promise<{ uploadCount: number; skipCount: number }> {
    const localAssets = getLocalAssetList();
    const db = getDatabase();
    const PARALLEL_UPLOADS = db.driveParallelConnections || 20;

    let uploadCount = 0;
    let skipCount = 0;
    let processedCount = 0;

    console.log(`[Sync Assets] Local assets to sync: ${localAssets.length}, parallel: ${PARALLEL_UPLOADS}`);

    // Build list of assets to upload, track skipped for progress
    const toUpload: { assetName: string; serverFileName: string; existingFileId?: string }[] = [];

    for (const assetName of localAssets) {
        const serverFileName = `asset_${assetName}.bin`;

        // Check if asset is in deletedAssets tombstone - remove it since it's being uploaded
        if (manifest.deletedAssets[assetName]) {
            delete manifest.deletedAssets[assetName];
        }

        // Check if already exists on server (using manifest.assets)
        if (manifest.assets[assetName]) {
            skipCount++;
            processedCount++;
            // Update progress for skipped assets too
            syncManager.updateProgress(baseCount + processedCount, grandTotal, 'assets');
            continue;
        }

        toUpload.push({ assetName, serverFileName });
    }

    console.log(`[Sync Assets] Assets to upload: ${toUpload.length}, skipped: ${skipCount}`);

    // Parallel upload with sliding window
    let currentIndex = 0;

    async function uploadOne(): Promise<void> {
        while (currentIndex < toUpload.length && !syncManager.isCancelled()) {
            const idx = currentIndex++;
            const { assetName, serverFileName } = toUpload[idx];

            try {
                const assetData = await forageStorage.getItem(`assets/${assetName}`) as Uint8Array<ArrayBuffer> | null;
                if (!assetData) {
                    console.warn(`[Sync Assets] Asset not found in IndexedDB: ${assetName}`);
                    processedCount++;
                    syncManager.updateProgress(baseCount + processedCount, grandTotal, 'assets');
                    continue;
                }

                const fileId = await uploadSyncFile(accessToken, serverFileName, assetData);
                manifest.assets[assetName] = { fileId };
                uploadCount++;
                processedCount++;
                syncManager.updateProgress(baseCount + processedCount, grandTotal, 'assets');

                if (uploadCount % 100 === 0) {
                    console.log(`[Sync Assets] Progress: ${processedCount}/${localAssets.length}`);
                }
            } catch (e) {
                console.error(`[Sync Assets] Failed to upload asset ${assetName}:`, e);
                processedCount++;
                syncManager.updateProgress(baseCount + processedCount, grandTotal, 'assets');
            }
        }
    }

    // Start parallel uploads
    if (toUpload.length > 0) {
        await Promise.all(
            Array.from({ length: Math.min(PARALLEL_UPLOADS, toUpload.length) }, () => uploadOne())
        );
    }

    // Mark assets that are on server but not in local as deleted (tombstone) - parallel deletion
    const localAssetSet = new Set(localAssets);
    const assetsToDelete: { assetName: string; fileId: string }[] = [];

    for (const assetName of Object.keys(manifest.assets)) {
        if (!localAssetSet.has(assetName) && !manifest.deletedAssets[assetName]) {
            // Asset exists on server but not locally - mark as deleted
            manifest.deletedAssets[assetName] = Date.now();
            console.log(`[Sync Assets] Marked asset as deleted: ${assetName}`);

            const assetInfo = manifest.assets[assetName];
            if (assetInfo?.fileId) {
                assetsToDelete.push({ assetName, fileId: assetInfo.fileId });
            }
            delete manifest.assets[assetName];
        }
    }

    // Delete assets in parallel
    if (assetsToDelete.length > 0) {
        let assetDelIdx = 0;
        let assetDeleted = 0;
        async function deleteOneAsset(): Promise<void> {
            while (assetDelIdx < assetsToDelete.length && !syncManager.isCancelled()) {
                const { assetName, fileId } = assetsToDelete[assetDelIdx++];
                try {
                    await deleteSyncFile(accessToken, fileId);
                    assetDeleted++;
                    syncManager.updateProgress(assetDeleted, assetsToDelete.length, 'deleting');
                } catch (e) {
                    console.error(`[Sync Assets] Failed to delete asset file ${assetName}:`, e);
                    assetDeleted++;
                    syncManager.updateProgress(assetDeleted, assetsToDelete.length, 'deleting');
                }
            }
        }
        await Promise.all(
            Array.from({ length: Math.min(PARALLEL_UPLOADS, assetsToDelete.length) }, () => deleteOneAsset())
        );
    }

    console.log(`[Sync Assets] Upload complete: ${uploadCount} uploaded, ${skipCount} skipped`);
    return { uploadCount, skipCount };
}

/**
 * Download assets from server to local
 */
async function syncAssetsDownload(
    accessToken: string,
    manifest: SyncManifest
): Promise<{ downloadCount: number; skipCount: number }> {
    const db = getDatabase();
    const PARALLEL_DOWNLOADS = db.driveParallelConnections || 20;

    // Ensure assets object exists (for legacy manifests)
    if (!manifest.assets) {
        console.log('[Sync Assets] No assets in manifest, nothing to download');
        return { downloadCount: 0, skipCount: 0 };
    }

    let downloadCount = 0;
    let skipCount = 0;

    // Get list of local assets for comparison
    const localAssetKeys = await forageStorage.keys();
    const localAssetSet = new Set(localAssetKeys.filter(k => k.startsWith('assets/')).map(k => k.slice(7)));

    // Build list of assets to download (using fileId from manifest)
    const toDownload: { assetName: string; fileId: string }[] = [];

    for (const [assetName, assetInfo] of Object.entries(manifest.assets)) {
        // Skip if in deleted tombstone
        if (manifest.deletedAssets[assetName]) {
            skipCount++;
            continue;
        }

        // Check if already exists locally
        if (localAssetSet.has(assetName)) {
            skipCount++;
            continue;
        }

        if (!assetInfo.fileId) {
            console.warn(`[Sync Assets] No fileId for asset ${assetName}, skipping`);
            continue;
        }

        toDownload.push({ assetName, fileId: assetInfo.fileId });
    }

    console.log(`[Sync Assets] Assets to download: ${toDownload.length}, skipping: ${skipCount}, parallel: ${PARALLEL_DOWNLOADS}`);

    // Parallel download with sliding window
    let currentIndex = 0;

    async function downloadOne(): Promise<void> {
        while (currentIndex < toDownload.length && !syncManager.isCancelled()) {
            const idx = currentIndex++;
            const { assetName, fileId } = toDownload[idx];

            try {
                const data = await downloadSyncFile(accessToken, fileId);
                await forageStorage.setItem(`assets/${assetName}`, data as Uint8Array<ArrayBuffer>);
                downloadCount++;

                if (downloadCount % 10 === 0) {
                    console.log(`[Sync Assets] Download progress: ${downloadCount}/${toDownload.length}`);
                }
            } catch (e) {
                console.error(`[Sync Assets] Failed to download asset ${assetName}:`, e);
            }
        }
    }

    // Start parallel downloads
    if (toDownload.length > 0) {
        await Promise.all(
            Array.from({ length: Math.min(PARALLEL_DOWNLOADS, toDownload.length) }, () => downloadOne())
        );
    }

    // Delete local assets that are in the tombstone
    for (const [assetName, _] of Object.entries(manifest.deletedAssets)) {
        if (localAssetSet.has(assetName)) {
            try {
                await forageStorage.removeItem(`assets/${assetName}`);
                console.log(`[Sync Assets] Deleted local asset (tombstoned): ${assetName}`);
            } catch (e) {
                console.error(`[Sync Assets] Failed to delete local asset ${assetName}:`, e);
            }
        }
    }

    console.log(`[Sync Assets] Download complete: ${downloadCount} downloaded, ${skipCount} skipped`);
    return { downloadCount, skipCount };
}
