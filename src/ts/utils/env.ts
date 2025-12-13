import { platform } from '@tauri-apps/plugin-os';

/**
 * Environment detection constants.
 * This file has almost no imports to avoid circular dependencies.
 */

export const isTauri = !!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
export const isNodeServer = !!(globalThis as typeof globalThis & { __NODE__?: boolean }).__NODE__

export const currentUserAgent = navigator.userAgent

export const isMobileUserAgent = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent)

export const currentPlatform = isTauri ? await platform() : 'web';
export const isMobileTauri = currentPlatform === 'android' || currentPlatform === 'ios';

export const isFirefox = navigator.userAgent.toLowerCase().includes('firefox')

export function isStandaloneMode(): boolean {
    try {
        if (typeof window === 'undefined' || typeof document === 'undefined' || typeof navigator === 'undefined') {
            return false
        }
        const nav = navigator as Navigator & { standalone?: boolean }
        const mql = window.matchMedia?.('(display-mode: standalone)')
        return Boolean(mql?.matches) || Boolean(nav.standalone) || document.referrer.includes('android-app://')
    } catch {
        return false
    }
}

// App version and build info
export const appVer = "166.6.0"
export const googleBuild = false

/**
 * Gets the version string for display in UI.
 * Returns different strings based on the hostname.
 */
export function getVersionString(): string {
    let versionString = appVer
    if(window.location.hostname === 'nightly.risuai.xyz'){
        versionString = 'Nightly Build'
    }
    if(window.location.hostname === 'stable.risuai.xyz'){
        versionString += ' (Stable)';
    }
    return versionString
}
