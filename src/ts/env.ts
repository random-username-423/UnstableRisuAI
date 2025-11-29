import { platform } from '@tauri-apps/plugin-os';

/**
 * Environment detection constants.
 * This file has almost no imports to avoid circular dependencies.
 */

//@ts-ignore
export const isTauri = !!window.__TAURI_INTERNALS__
//@ts-ignore
export const isNodeServer = !!globalThis.__NODE__

export const isMobileUserAgent = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent)

export const currentPlatform = isTauri ? await platform() : 'web';
export const isMobileTauri = currentPlatform === 'android' || currentPlatform === 'ios';

export const isFirefox = navigator.userAgent.toLowerCase().includes('firefox')
