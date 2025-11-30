/**
 * Google Drive Real-time Sync
 *
 * Implements manifest-based optimistic locking for real-time synchronization.
 */

import { alertError, alertSelect, alertStore } from "../alert";
import { getDatabase, setDatabase, type character, type groupChat, type Chat, type Database } from "../storage/database.svelte";
import { forageStorage, saveToWorker, loadFromWorker, listFromWorker, getUnpargeables } from "../globalApi.svelte";
import { sleep, getBasename } from '../util';
import { language } from "../../lang";
import { syncManager } from "./syncManager";

// ============================================================================
// Types
// ============================================================================

export interface SyncManifest {
    version: number;  // Incremented on every change

    chats: {
        [chatId: string]: { modifiedAt: number }
    };

    characters: {
        [charId: string]: { modifiedAt: number }
    };

    settings: {
        modifiedAt: number;
    };

    botPresets: {
        modifiedAt: number;
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
    const searchResponse = await fetch(searchUrl, {
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
    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
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
        const response = await fetch(url, {
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
async function uploadSyncFile(accessToken: string, fileName: string, content: Uint8Array, existingFileId?: string): Promise<string> {
    const folderId = await getSyncFolderId(accessToken);

    if (existingFileId) {
        // Update existing file
        const response = await fetch(
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

        const response = await fetch(
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
async function downloadSyncFile(accessToken: string, fileId: string): Promise<Uint8Array> {
    const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`);
    }

    return new Uint8Array(await response.arrayBuffer());
}

/**
 * Delete a file from sync folder
 */
async function deleteSyncFile(accessToken: string, fileId: string): Promise<void> {
    const response = await fetch(
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
        const files = await listSyncFiles(accessToken);
        const manifestFile = files.find(f => f.name === MANIFEST_FILE);

        if (!manifestFile) {
            return null;
        }

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
    const files = await listSyncFiles(accessToken);
    const manifestFile = files.find(f => f.name === MANIFEST_FILE);

    const content = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    await uploadSyncFile(accessToken, MANIFEST_FILE, content, manifestFile?.id);
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
    const files = await listSyncFiles(accessToken);
    const fileMap = new Map(files.map(f => [f.name, f]));

    let downloadCount = 0;
    let skipCount = 0;

    // Download characters
    for (const [charId, serverItem] of Object.entries(serverManifest.characters)) {
        const localItem = localManifest.characters[charId];

        if (localItem && localItem.modifiedAt === serverItem.modifiedAt) {
            skipCount++;
            continue;
        }

        const fileName = `char_${charId}.json.bin`;
        const file = fileMap.get(fileName);

        if (file) {
            try {
                const data = await downloadSyncFile(accessToken, file.id);
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
    }

    // Delete characters not in server manifest
    db.characters = db.characters.filter(c =>
        serverManifest.characters[c.chaId] !== undefined
    );

    // Download chats
    for (const [chatKey, serverItem] of Object.entries(serverManifest.chats)) {
        const localItem = localManifest.chats[chatKey];

        if (localItem && localItem.modifiedAt === serverItem.modifiedAt) {
            skipCount++;
            continue;
        }

        const fileName = `chat_${chatKey}.json.bin`;
        const file = fileMap.get(fileName);

        if (file) {
            try {
                const data = await downloadSyncFile(accessToken, file.id);
                // Save to local OPFS
                await saveToWorker(`database/chats/${chatKey}.bin`, data);
                downloadCount++;
            } catch (e) {
                console.error(`[Sync] Failed to download chat ${chatKey}:`, e);
            }
        }
    }

    // Download settings
    const settingsFile = fileMap.get('settings.json.bin');
    if (settingsFile) {
        try {
            const data = await downloadSyncFile(accessToken, settingsFile.id);
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

    // Download botPresets
    const presetsFile = fileMap.get('botpresets.json.bin');
    if (presetsFile) {
        try {
            const data = await downloadSyncFile(accessToken, presetsFile.id);
            const presets = JSON.parse(new TextDecoder().decode(data));
            db.botPresets = presets;
        } catch (e) {
            console.error('[Sync] Failed to download botPresets:', e);
        }
    }

    setDatabase(db);

    // Sync assets
    alertStore.set({
        type: 'wait',
        msg: language.syncDownloadingAssets || 'Downloading assets...'
    });
    const assetResult = await syncAssetsDownload(accessToken, files, serverManifest);

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
    const files = await listSyncFiles(accessToken);
    const fileMap = new Map(files.map(f => [f.name, f]));

    // If no server manifest, create one
    const manifest = serverManifest || {
        version: 0,
        chats: {},
        characters: {},
        settings: { modifiedAt: 0 },
        botPresets: { modifiedAt: 0 },
        deletedAssets: {}
    };

    // ========== Build upload lists ==========

    // Characters to upload
    type CharUploadItem = { char: character | groupChat; fileName: string; existingFileId?: string };
    const charsToUpload: CharUploadItem[] = [];

    for (const char of db.characters) {
        const serverItem = manifest.characters[char.chaId];
        if (serverItem && serverItem.modifiedAt === (char.modifiedAt || 0)) {
            continue;
        }
        const fileName = `char_${char.chaId}.json.bin`;
        const existingFile = fileMap.get(fileName);
        charsToUpload.push({ char, fileName, existingFileId: existingFile?.id });
    }

    // Chats to upload
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
            const existingFile = fileMap.get(fileName);
            chatsToUpload.push({ chatKey, chat, fileName, existingFileId: existingFile?.id });
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
            while (charIndex < charsToUpload.length) {
                const idx = charIndex++;
                const { char, fileName, existingFileId } = charsToUpload[idx];

                try {
                    const content = new TextEncoder().encode(JSON.stringify(char));
                    await uploadSyncFile(accessToken, fileName, content, existingFileId);
                    manifest.characters[char.chaId] = { modifiedAt: char.modifiedAt || Date.now() };
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

    // Delete characters not in local from manifest
    for (const charId of Object.keys(manifest.characters)) {
        if (!db.characters.find(c => c.chaId === charId)) {
            delete manifest.characters[charId];
            const fileName = `char_${charId}.json.bin`;
            const file = fileMap.get(fileName);
            if (file) {
                try {
                    await deleteSyncFile(accessToken, file.id);
                } catch (e) {
                    console.error(`[Sync] Failed to delete character file ${charId}:`, e);
                }
            }
        }
    }

    // ========== Parallel chat uploads ==========
    if (chatsToUpload.length > 0) {
        let chatIndex = 0;

        async function uploadOneChat(): Promise<void> {
            while (chatIndex < chatsToUpload.length) {
                const idx = chatIndex++;
                const { chatKey, chat, fileName, existingFileId } = chatsToUpload[idx];

                try {
                    // Load chat content from OPFS if not loaded
                    let chatData = chat;
                    if (chat.message === undefined) {
                        try {
                            const data = await loadFromWorker(`database/chats/${chatKey}.bin`);
                            if (data) {
                                chatData = JSON.parse(new TextDecoder().decode(data));
                            }
                        } catch (e) {
                            // Use chat as-is
                        }
                    }

                    const content = new TextEncoder().encode(JSON.stringify(chatData));
                    await uploadSyncFile(accessToken, fileName, content, existingFileId);
                    manifest.chats[chatKey] = { modifiedAt: chat.modifiedAt || Date.now() };
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

    // Delete chats not in local from manifest
    const localChatKeys = new Set<string>();
    for (const char of db.characters) {
        for (const chat of char.chats || []) {
            if (chat.id) {
                localChatKeys.add(`${char.chaId}_${chat.id}`);
            }
        }
    }

    for (const chatKey of Object.keys(manifest.chats)) {
        if (!localChatKeys.has(chatKey)) {
            delete manifest.chats[chatKey];

            const fileName = `chat_${chatKey}.json.bin`;
            const file = fileMap.get(fileName);
            if (file) {
                try {
                    await deleteSyncFile(accessToken, file.id);
                } catch (e) {
                    console.error(`[Sync] Failed to delete chat file ${chatKey}:`, e);
                }
            }
        }
    }

    // Upload settings (exclude characters, botPresets, and sync fields)
    const settingsToUpload = { ...db };
    delete (settingsToUpload as any).characters;
    delete (settingsToUpload as any).botPresets;
    delete (settingsToUpload as any).lastSyncedVersion;
    delete (settingsToUpload as any).lastSyncTime;
    delete (settingsToUpload as any).syncEnabled;

    const settingsContent = new TextEncoder().encode(JSON.stringify(settingsToUpload));
    const settingsFile = fileMap.get('settings.json.bin');
    await uploadSyncFile(accessToken, 'settings.json.bin', settingsContent, settingsFile?.id);
    manifest.settings.modifiedAt = Date.now();

    // Upload botPresets
    const presetsContent = new TextEncoder().encode(JSON.stringify(db.botPresets));
    const presetsFile = fileMap.get('botpresets.json.bin');
    await uploadSyncFile(accessToken, 'botpresets.json.bin', presetsContent, presetsFile?.id);
    manifest.botPresets.modifiedAt = Date.now();

    // Sync assets (runs in background, no UI blocking)
    console.log('[Sync] Starting asset upload...');
    const assetResult = await syncAssetsUpload(accessToken, files, manifest, uploadedCount, totalItems);

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
    if (await checkConflict(accessToken)) {
        alertError(language.syncConflictDetected || 'Sync conflict detected! Another device has made changes.');
        return;
    }

    const db = getDatabase();
    const serverManifest = await downloadManifest(accessToken) || createManifestFromLocal();
    const files = await listSyncFiles(accessToken);
    const fileMap = new Map(files.map(f => [f.name, f]));

    for (const item of changedItems) {
        if (item.type === 'character' && item.id) {
            const char = db.characters.find(c => c.chaId === item.id);
            if (char) {
                const fileName = `char_${char.chaId}.json.bin`;
                const existingFile = fileMap.get(fileName);
                const content = new TextEncoder().encode(JSON.stringify(char));
                await uploadSyncFile(accessToken, fileName, content, existingFile?.id);
                serverManifest.characters[char.chaId] = { modifiedAt: char.modifiedAt || Date.now() };
            }
        } else if (item.type === 'chat' && item.id) {
            // item.id is chatKey (chaId_chatId)
            const fileName = `chat_${item.id}.json.bin`;
            const existingFile = fileMap.get(fileName);

            // Load chat from OPFS
            const data = await loadFromWorker(`database/chats/${item.id}.bin`);
            if (data) {
                await uploadSyncFile(accessToken, fileName, data, existingFile?.id);
                const chat = JSON.parse(new TextDecoder().decode(data));
                serverManifest.chats[item.id] = { modifiedAt: chat.modifiedAt || Date.now() };
            }
        } else if (item.type === 'settings') {
            const settingsToUpload = { ...db };
            delete (settingsToUpload as any).characters;
            delete (settingsToUpload as any).botPresets;
            const settingsContent = new TextEncoder().encode(JSON.stringify(settingsToUpload));
            const settingsFile = fileMap.get('settings.json.bin');
            await uploadSyncFile(accessToken, 'settings.json.bin', settingsContent, settingsFile?.id);
            serverManifest.settings.modifiedAt = Date.now();
        } else if (item.type === 'botPresets') {
            const presetsContent = new TextEncoder().encode(JSON.stringify(db.botPresets));
            const presetsFile = fileMap.get('botpresets.json.bin');
            await uploadSyncFile(accessToken, 'botpresets.json.bin', presetsContent, presetsFile?.id);
            serverManifest.botPresets.modifiedAt = Date.now();
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
    } else {
        // No conflict - upload local changes
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
    files: DriveFile[],
    manifest: SyncManifest,
    baseCount: number,
    grandTotal: number
): Promise<{ uploadCount: number; skipCount: number }> {
    const fileMap = new Map(files.map(f => [f.name, f]));
    const localAssets = getLocalAssetList();
    const db = getDatabase();
    const PARALLEL_UPLOADS = db.driveParallelConnections || 20;

    let uploadCount = 0;
    let skipCount = 0;
    let processedCount = 0;

    console.log(`[Sync Assets] Local assets to sync: ${localAssets.length}, parallel: ${PARALLEL_UPLOADS}`);

    // Build list of assets to upload, track skipped for progress
    const toUpload: { assetName: string; serverFileName: string }[] = [];

    for (const assetName of localAssets) {
        const serverFileName = `asset_${assetName}.bin`;

        // Check if asset is in deletedAssets tombstone - remove it since it's being uploaded
        if (manifest.deletedAssets[assetName]) {
            delete manifest.deletedAssets[assetName];
        }

        // Check if already exists on server
        if (fileMap.has(serverFileName)) {
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
        while (currentIndex < toUpload.length) {
            const idx = currentIndex++;
            const { assetName, serverFileName } = toUpload[idx];

            try {
                const assetData = await forageStorage.getItem(`assets/${assetName}`) as Uint8Array | null;
                if (!assetData) {
                    console.warn(`[Sync Assets] Asset not found in IndexedDB: ${assetName}`);
                    processedCount++;
                    syncManager.updateProgress(baseCount + processedCount, grandTotal, 'assets');
                    continue;
                }

                await uploadSyncFile(accessToken, serverFileName, assetData);
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

    // Mark assets that are on server but not in local as deleted (tombstone)
    const localAssetSet = new Set(localAssets);
    for (const file of files) {
        if (!file.name.startsWith('asset_') || !file.name.endsWith('.bin')) continue;

        const assetName = file.name.slice(6, -4);  // Remove 'asset_' prefix and '.bin' suffix
        if (!localAssetSet.has(assetName) && !manifest.deletedAssets[assetName]) {
            // Asset exists on server but not locally - mark as deleted
            manifest.deletedAssets[assetName] = Date.now();
            console.log(`[Sync Assets] Marked asset as deleted: ${assetName}`);

            // Delete the file from server
            try {
                await deleteSyncFile(accessToken, file.id);
            } catch (e) {
                console.error(`[Sync Assets] Failed to delete asset file ${assetName}:`, e);
            }
        }
    }

    console.log(`[Sync Assets] Upload complete: ${uploadCount} uploaded, ${skipCount} skipped`);
    return { uploadCount, skipCount };
}

/**
 * Download assets from server to local
 */
async function syncAssetsDownload(
    accessToken: string,
    files: DriveFile[],
    manifest: SyncManifest
): Promise<{ downloadCount: number; skipCount: number }> {
    const db = getDatabase();
    const PARALLEL_DOWNLOADS = db.driveParallelConnections || 20;

    let downloadCount = 0;
    let skipCount = 0;

    // Get list of local assets for comparison
    const localAssetKeys = await forageStorage.keys();
    const localAssetSet = new Set(localAssetKeys.filter(k => k.startsWith('assets/')).map(k => k.slice(7)));

    // Build list of assets to download
    const toDownload: { file: DriveFile; assetName: string }[] = [];

    for (const file of files) {
        if (!file.name.startsWith('asset_') || !file.name.endsWith('.bin')) continue;

        const assetName = file.name.slice(6, -4);  // Remove 'asset_' prefix and '.bin' suffix

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

        toDownload.push({ file, assetName });
    }

    console.log(`[Sync Assets] Assets to download: ${toDownload.length}, skipping: ${skipCount}, parallel: ${PARALLEL_DOWNLOADS}`);

    // Parallel download with sliding window
    let currentIndex = 0;

    async function downloadOne(): Promise<void> {
        while (currentIndex < toDownload.length) {
            const idx = currentIndex++;
            const { file, assetName } = toDownload[idx];

            try {
                const data = await downloadSyncFile(accessToken, file.id);
                await forageStorage.setItem(`assets/${assetName}`, data);
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
    await Promise.all(
        Array.from({ length: Math.min(PARALLEL_DOWNLOADS, toDownload.length) }, () => downloadOne())
    );

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
