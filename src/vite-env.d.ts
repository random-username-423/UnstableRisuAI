/// <reference types="svelte" />
/// <reference types="vite/client" />


declare global {
  var Buffer: BufferConstructor
  var safeStructuredClone: <T>(data: T) => T
  var userScriptFetch: (url: string, arg: RequestInit) => Promise<Response>

  interface GlobalThis {
    CompressionStream?: any
    DecompressionStream?: any
  }

  interface Window {
    __TAURI_INTERNALS__?: unknown
    tauriOpenedFiles?: string[]
    launchQueue?: {
      setConsumer: (consumer: (launchParams: { files?: FileSystemFileHandle[] }) => void) => void
    }
  }

  var __NODE__: boolean | undefined
}

export {}
