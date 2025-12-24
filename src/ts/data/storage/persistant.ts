import { getDatabase } from "./database.svelte"
import { alertNormal } from "../../utils/alert.svelte"
import { language } from "src/lang"
import { isTauri, isNodeServer, isFirefox } from "src/ts/utils/env"

/**
 * Requests persistent storage permission from the browser.
 * Chrome requires notification permission first, Firefox can request directly.
 * @returns true if persistent storage is granted, false otherwise.
 */
async function requestPersistantStorageMain() {
    if (navigator.storage && navigator.storage.persist) {
        if (await navigator.storage.persisted()) {
            return true
        }

        //if is chromium
        const isChromium = "chrome" in window
        if (isChromium) {
            //chromium requires notification to persist
            alertNormal("For chromium based browsers, you need to allow notifications to persist data")
            const status = await Notification.requestPermission()

            if (status === "granted") {
                return navigator.storage.persist()
            }
        }

        if (isFirefox) {
            //firefox can just ask for persist
            return navigator.storage.persist()
        }

        return false
    }
    return false
}

/**
 * Checks if persistent storage request is recommended.
 * Returns true if: Web environment + not persisted yet + more than 5 characters.
 * @returns true if persistent storage should be recommended to user.
 */
export async function persistantStorageRecommended() {
    const db = getDatabase()
    if (navigator.storage && navigator.storage.persist && !isTauri && !isNodeServer) {
        if (await navigator.storage.persisted()) {
            return false
        }
        if (db.characters.length > 5) {
            return true
        }
    }
    return false
}

/**
 * Requests persistent storage and shows result alert to user.
 * @returns true if persistent storage is granted, false otherwise.
 */
export async function requestPersistantStorage() {
    const status = await requestPersistantStorageMain()
    if (status) {
        alertNormal(language.persistentStorageSuccess)
    } else {
        alertNormal(language.persistentStorageFail)
    }
    return status
}
