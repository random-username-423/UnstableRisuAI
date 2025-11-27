import { alertError } from "../alert";
import { hubURL } from "../characterCards";
import { language } from "../../lang";
import type { Database } from "../storage/database.svelte";

/**
 * Checks if backup data is corrupted by sending it to the server.
 * Returns true if backup should proceed, false if it should be aborted.
 */
export async function checkBackupCorruption(db: Database): Promise<boolean> {
    if (!db.checkCorruption) {
        return true
    }

    try {
        const response = await fetch(hubURL + '/backupcheck', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(db),
        })

        if (response.status === 400) {
            alertError('Failed, Backup data is corrupted')
            return false
        }

        if (response.status === 413) {
            alertError(language.backupTooLargeError)
            return false
        }

        return true
    } catch (e) {
        // Network error - let the backup proceed
        // The actual backup will handle its own errors
        return true
    }
}
