import { alertError } from "../alert";
import { hubURL } from "../character/characterCards";
import { language } from "../../lang";
import type { Database } from "../storage/database.svelte";
import { isTauri } from "src/ts/env";
import { fetch as TauriFetch } from "@tauri-apps/plugin-http";

/**
 * Checks if backup data is corrupted by sending it to the server.
 * Returns true if backup should proceed, false if it should be aborted.
 */
export async function checkBackupCorruption(db: Database): Promise<boolean> {
    if (!db.checkCorruption) {
        return true
    }

    try {
        console.log('[BackupCheck] Checking backup corruption...')
        // Use Tauri HTTP plugin to bypass CORS
        const fetchFn = isTauri ? TauriFetch : fetch
        const response = await fetchFn(hubURL + '/backupcheck', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(db),
        })

        console.log(`[BackupCheck] Response status: ${response.status}`)

        if (response.status === 400) {
            alertError('Failed, Backup data is corrupted')
            return false
        }

        if (response.status === 413) {
            alertError(language.backupTooLargeError)
            return false
        }

        if (!response.ok) {
            // Other HTTP errors (500, 404, etc.)
            const errorText = await response.text().catch(() => 'Unknown error')
            console.error(`[BackupCheck] Server error: ${response.status} - ${errorText}`)
            alertError(`Backup check failed: Server error ${response.status}`)
            return false
        }

        console.log('[BackupCheck] Backup data is valid')
        return true
    } catch (e) {
        // Network error - log it but let the backup proceed
        // The actual backup will handle its own errors
        console.warn('[BackupCheck] Network error, skipping check:', e)
        return true
    }
}
