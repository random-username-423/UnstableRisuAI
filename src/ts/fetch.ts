/**
 * HTTP fetch utilities for RisuAI.
 * Handles fetch requests across different environments (Tauri, Web).
 */

import { sleep } from './util'
import { getDatabase } from './storage/database.svelte'
import { DBState } from './stores.svelte'
import { hubURL } from './character/characterCards'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { fetch as TauriHTTPFetch } from '@tauri-apps/plugin-http'

// Environment detection (duplicated to avoid circular dependency with globalApi)
//@ts-ignore
const isTauri = !!window.__TAURI_INTERNALS__
//@ts-ignore
const isNodeServer = !!globalThis.__NODE__

// Declare userScriptFetch on window
declare global {
    interface Window {
        userScriptFetch?: typeof fetch
    }
}

//
// Types and Interfaces
//

interface FetchLogEntry {
    body: string
    header: string
    response: string
    success: boolean
    date: string
    url: string
    responseType?: string
    chatId?: string
}

/**
 * Interface representing the arguments for the global fetch function.
 */
export interface GlobalFetchArgs {
    plainFetchForce?: boolean
    plainFetchDeforce?: boolean
    body?: any
    headers?: { [key: string]: string }
    rawResponse?: boolean
    method?: 'POST' | 'GET'
    abortSignal?: AbortSignal
    useRisuToken?: boolean
    chatId?: string
}

/**
 * Interface representing the result of the global fetch function.
 */
export interface GlobalFetchResult {
    ok: boolean
    data: any
    headers: { [key: string]: string }
    status: number
}

interface StreamedFetchChunkData {
    type: 'chunk'
    body: string
    id: string
}

interface StreamedFetchHeaderData {
    type: 'headers'
    body: { [key: string]: string }
    id: string
    status: number
}

interface StreamedFetchEndData {
    type: 'end'
    id: string
}

type StreamedFetchChunk = StreamedFetchChunkData | StreamedFetchHeaderData | StreamedFetchEndData

//
// Module-level state
//

let fetchLog: FetchLogEntry[] = []
const knownHostes = ['localhost', '127.0.0.1', '0.0.0.0']
let fetchIndex = 0
let nativeFetchData: { [key: string]: StreamedFetchChunk[] } = {}
let streamedFetchListening = false

//
// Event listeners for streamed fetch
//

if (isTauri) {
    listen('streamed_fetch', (event) => {
        try {
            const parsed = JSON.parse(event.payload as string)
            const id = parsed.id
            nativeFetchData[id]?.push(parsed)
        } catch (error) {
            console.error(error)
        }
    }).then(() => {
        streamedFetchListening = true
    })
}

//
// Helper classes
//

/**
 * A class to manage a buffer that can be appended to and deappended from.
 */
export class AppendableBuffer {
    buffer: Uint8Array
    deapended: number = 0

    constructor() {
        this.buffer = new Uint8Array(0)
    }

    append(data: Uint8Array) {
        const newBuffer = new Uint8Array(this.buffer.length + data.length)
        newBuffer.set(this.buffer, 0)
        newBuffer.set(data, this.buffer.length)
        this.buffer = newBuffer
    }

    deappend(length: number) {
        this.buffer = this.buffer.slice(length)
        this.deapended += length
    }

    slice(start: number, end: number) {
        return this.buffer.slice(start - this.deapended, end - this.deapended)
    }

    length() {
        return this.buffer.length + this.deapended
    }
}

//
// Fetch log functions
//

export async function getFetchData(id: string) {
    for (const log of fetchLog) {
        if (log.chatId === id) {
            return log
        }
    }
    return null
}

export function addFetchLog(arg: {
    body: any
    headers?: { [key: string]: string }
    response: any
    success: boolean
    url: string
    resType?: string
    chatId?: string
}): number {
    fetchLog.unshift({
        body: typeof arg.body === 'string' ? arg.body : JSON.stringify(arg.body, null, 2),
        header: JSON.stringify(arg.headers ?? {}, null, 2),
        response: typeof arg.response === 'string' ? arg.response : JSON.stringify(arg.response, null, 2),
        responseType: arg.resType ?? 'json',
        success: arg.success,
        date: new Date().toLocaleTimeString(),
        url: arg.url,
        chatId: arg.chatId
    })
    return 0
}

function addFetchLogInGlobalFetch(response: any, success: boolean, url: string, arg: GlobalFetchArgs) {
    try {
        fetchLog.unshift({
            body: JSON.stringify(arg.body, null, 2),
            header: JSON.stringify(arg.headers ?? {}, null, 2),
            response: JSON.stringify(response, null, 2),
            success: success,
            date: new Date().toLocaleTimeString(),
            url: url,
            chatId: arg.chatId
        })
    } catch {
        fetchLog.unshift({
            body: JSON.stringify(arg.body, null, 2),
            header: JSON.stringify(arg.headers ?? {}, null, 2),
            response: `${response}`,
            success: success,
            date: new Date().toLocaleTimeString(),
            url: url,
            chatId: arg.chatId
        })
    }

    if (fetchLog.length > 20) {
        fetchLog.pop()
    }
}

export function getRequestLog() {
    let logString = ''
    const b = '\n```json\n'
    const bend = '\n```\n'

    for (const log of fetchLog) {
        logString +=
            `## ${log.date}\n\n* Request URL\n\n${b}${log.url}${bend}\n\n* Request Body\n\n${b}${log.body}${bend}\n\n* Request Header\n\n${b}${log.header}${bend}\n\n` +
            `* Response Body\n\n${b}${log.response}${bend}\n\n* Response Success\n\n${b}${log.success}${bend}\n\n`
    }
    return logString
}

//
// Fetch implementations
//

async function fetchWithPlainFetch(url: string, arg: GlobalFetchArgs): Promise<GlobalFetchResult> {
    try {
        const headers = { 'Content-Type': 'application/json', ...arg.headers }
        const response = await fetch(new URL(url), {
            body: JSON.stringify(arg.body),
            headers,
            method: arg.method ?? 'POST',
            signal: arg.abortSignal
        })
        const data = arg.rawResponse ? new Uint8Array(await response.arrayBuffer()) : await response.json()
        const ok = response.ok && response.status >= 200 && response.status < 300
        addFetchLogInGlobalFetch(data, ok, url, arg)
        return { ok, data, headers: Object.fromEntries(response.headers), status: response.status }
    } catch (error) {
        return { ok: false, data: `${error}`, headers: {}, status: 400 }
    }
}

async function fetchWithUSFetch(url: string, arg: GlobalFetchArgs): Promise<GlobalFetchResult> {
    try {
        const headers = { 'Content-Type': 'application/json', ...arg.headers }
        const response = await window.userScriptFetch!(url, {
            body: JSON.stringify(arg.body),
            headers,
            method: arg.method ?? 'POST',
            signal: arg.abortSignal
        })
        const data = arg.rawResponse ? new Uint8Array(await response.arrayBuffer()) : await response.json()
        const ok = response.ok && response.status >= 200 && response.status < 300
        addFetchLogInGlobalFetch(data, ok, url, arg)
        return { ok, data, headers: Object.fromEntries(response.headers), status: response.status }
    } catch (error) {
        return { ok: false, data: `${error}`, headers: {}, status: 400 }
    }
}

async function fetchWithTauri(url: string, arg: GlobalFetchArgs): Promise<GlobalFetchResult> {
    try {
        const headers = { 'Content-Type': 'application/json', ...arg.headers }
        const response = await TauriHTTPFetch(new URL(url), {
            body: JSON.stringify(arg.body),
            headers,
            method: arg.method ?? 'POST',
            signal: arg.abortSignal
        })
        const data = arg.rawResponse ? new Uint8Array(await response.arrayBuffer()) : await response.json()
        const ok = response.status >= 200 && response.status < 300
        addFetchLogInGlobalFetch(data, ok, url, arg)
        return { ok, data, headers: Object.fromEntries(response.headers), status: response.status }
    } catch (error) {
        return { ok: false, data: `${error}`, headers: {}, status: 400 }
    }
}

async function fetchWithProxy(url: string, arg: GlobalFetchArgs): Promise<GlobalFetchResult> {
    try {
        const furl = !isTauri && !isNodeServer ? `${hubURL}/proxy2` : `/proxy2`
        arg.headers!['Content-Type'] ??= arg.body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json'
        const headers: { [key: string]: string } = {
            'risu-header': encodeURIComponent(JSON.stringify(arg.headers)),
            'risu-url': encodeURIComponent(url),
            'Content-Type': arg.body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json',
            ...(arg.useRisuToken && { 'x-risu-tk': 'use' }),
            ...(DBState?.db?.requestLocation && { 'risu-location': DBState.db.requestLocation })
        }

        // Add risu-auth header for Node.js server
        if (isNodeServer) {
            const auth = localStorage.getItem('risuauth')
            if (auth) {
                headers['risu-auth'] = auth
            }
        }

        const body = arg.body instanceof URLSearchParams ? arg.body.toString() : JSON.stringify(arg.body)

        const response = await fetch(furl, { body, headers, method: arg.method ?? 'POST', signal: arg.abortSignal })
        const isSuccess = response.ok && response.status >= 200 && response.status < 300

        if (arg.rawResponse) {
            const data = new Uint8Array(await response.arrayBuffer())
            addFetchLogInGlobalFetch('Uint8Array Response', isSuccess, url, arg)
            return { ok: isSuccess, data, headers: Object.fromEntries(response.headers), status: response.status }
        }

        const text = await response.text()
        try {
            const data = JSON.parse(text)
            addFetchLogInGlobalFetch(data, isSuccess, url, arg)
            return { ok: isSuccess, data, headers: Object.fromEntries(response.headers), status: response.status }
        } catch (error) {
            const errorMsg = text.startsWith('<!DOCTYPE') ? 'Responded HTML. Is your URL, API key, and password correct?' : text
            addFetchLogInGlobalFetch(text, false, url, arg)
            return { ok: false, data: errorMsg, headers: Object.fromEntries(response.headers), status: response.status }
        }
    } catch (error) {
        return { ok: false, data: `${error}`, headers: {}, status: 400 }
    }
}

//
// Main fetch functions
//

/**
 * Performs a global fetch request.
 */
export async function globalFetch(url: string, arg: GlobalFetchArgs = {}): Promise<GlobalFetchResult> {
    try {
        const db = getDatabase()
        const method = arg.method ?? 'POST'
        db.requestmet = 'normal'

        if (arg.abortSignal?.aborted) {
            return { ok: false, data: 'aborted', headers: {}, status: 400 }
        }

        const urlHost = new URL(url).hostname
        const forcePlainFetch = ((knownHostes.includes(urlHost) && !isTauri) || db.usePlainFetch || arg.plainFetchForce) && !arg.plainFetchDeforce

        if (knownHostes.includes(urlHost) && !isTauri && !isNodeServer) {
            return {
                ok: false,
                headers: {},
                status: 400,
                data: 'You are trying local request on web version. This is not allowed due to browser security policy. Use the desktop version instead, or use a tunneling service like ngrok and set the CORS to allow all.'
            }
        }

        if (forcePlainFetch) {
            return await fetchWithPlainFetch(url, arg)
        }
        // userScriptFetch is provided by userscript
        if (window.userScriptFetch) {
            return await fetchWithUSFetch(url, arg)
        }
        if (isTauri) {
            return await fetchWithTauri(url, arg)
        }
        return await fetchWithProxy(url, arg)
    } catch (error) {
        console.error(error)
        return { ok: false, data: `${error}`, headers: {}, status: 400 }
    }
}

//
// Native fetch (streaming)
//

const pipeFetchLog = (fetchLogIndex: number, readableStream: ReadableStream<Uint8Array>) => {
    let textDecoderBuffer = new AppendableBuffer()
    let textDecoderPointer = 0
    const textDecoder = TextDecoderStream
        ? new TextDecoderStream()
        : new TransformStream<Uint8Array, string>({
              transform(chunk, controller) {
                  try {
                      textDecoderBuffer.append(chunk)
                      const decoded = new TextDecoder('utf-8', {
                          fatal: true
                      }).decode(textDecoderBuffer.buffer)
                      let newString = decoded.slice(textDecoderPointer)
                      textDecoderPointer = decoded.length
                      controller.enqueue(newString)
                  } catch {}
              }
          })
    textDecoder.readable.pipeTo(
        new WritableStream({
            write(chunk) {
                fetchLog[fetchLogIndex].response += chunk
            }
        })
    )
    const writer = textDecoder.writable.getWriter()
    return new ReadableStream<Uint8Array>({
        start(controller) {
            readableStream.pipeTo(
                new WritableStream({
                    write(chunk) {
                        controller.enqueue(chunk)
                        writer.write(chunk as any)
                    },
                    close() {
                        controller.close()
                        writer.close()
                    }
                })
            )
        }
    })
}

/**
 * Fetches data from a given URL using native fetch or through a proxy (streaming).
 */
export async function fetchNative(
    url: string,
    arg: {
        body?: string | Uint8Array | ArrayBuffer
        headers?: { [key: string]: string }
        method?: 'POST' | 'GET' | 'PUT' | 'DELETE'
        signal?: AbortSignal
        useRisuTk?: boolean
        chatId?: string
    }
): Promise<Response> {
    console.log(arg.body, 'body')
    if (arg.body === undefined && (arg.method === 'POST' || arg.method === 'PUT')) {
        throw new Error('Body is required for POST and PUT requests')
    }

    arg.method = arg.method ?? 'POST'

    let headers = arg.headers ?? {}
    let realBody: Uint8Array | undefined

    if (arg.method === 'GET' || arg.method === 'DELETE') {
        realBody = undefined
    } else if (typeof arg.body === 'string') {
        realBody = new TextEncoder().encode(arg.body)
    } else if (arg.body instanceof Uint8Array) {
        realBody = arg.body
    } else if (arg.body instanceof ArrayBuffer) {
        realBody = new Uint8Array(arg.body)
    } else {
        throw new Error('Invalid body type')
    }

    const db = getDatabase()
    let throughProxy = !isTauri && !isNodeServer && !db.usePlainFetch
    let fetchLogIndex = addFetchLog({
        body: realBody ? new TextDecoder().decode(realBody) : '',
        headers: arg.headers,
        response: 'Streamed Fetch',
        success: true,
        url: url,
        resType: 'stream',
        chatId: arg.chatId
    })

    if (window.userScriptFetch) {
        return await window.userScriptFetch(url, {
            body: realBody as any,
            headers: headers,
            method: arg.method,
            signal: arg.signal
        })
    } else if (isTauri) {
        fetchIndex++
        if (arg.signal && arg.signal.aborted) {
            throw new Error('aborted')
        }
        if (fetchIndex >= 100000) {
            fetchIndex = 0
        }
        let fetchId = fetchIndex.toString().padStart(5, '0')
        nativeFetchData[fetchId] = []
        let resolved = false

        let error = ''
        while (!streamedFetchListening) {
            await sleep(100)
        }
        if (isTauri) {
            invoke('streamed_fetch', {
                id: fetchId,
                url: url,
                headers: JSON.stringify(headers),
                body: realBody ? Buffer.from(realBody).toString('base64') : '',
                method: arg.method
            }).then((res) => {
                try {
                    const parsedRes = JSON.parse(res as string)
                    if (!parsedRes.success) {
                        error = parsedRes.body
                        resolved = true
                    }
                } catch (e) {
                    error = JSON.stringify(e)
                    resolved = true
                }
            })
        }

        let resHeaders: { [key: string]: string } | null = null
        let status = 400

        let readableStream = pipeFetchLog(
            fetchLogIndex,
            new ReadableStream<Uint8Array>({
                async start(controller) {
                    while (!resolved || nativeFetchData[fetchId].length > 0) {
                        if (nativeFetchData[fetchId].length > 0) {
                            const data = nativeFetchData[fetchId].shift()!
                            if (data.type === 'chunk') {
                                const chunk = Buffer.from(data.body, 'base64')
                                controller.enqueue(chunk as unknown as Uint8Array)
                            }
                            if (data.type === 'headers') {
                                resHeaders = data.body
                                status = data.status
                            }
                            if (data.type === 'end') {
                                resolved = true
                            }
                        }
                        await sleep(10)
                    }
                    controller.close()
                }
            })
        )

        while (resHeaders === null && !resolved) {
            await sleep(10)
        }

        if (resHeaders === null) {
            resHeaders = {}
        }

        if (error !== '') {
            throw new Error(error)
        }

        return new Response(readableStream, {
            headers: new Headers(resHeaders),
            status: status
        })
    } else if (throughProxy) {
        const r = await fetch(hubURL + `/proxy2`, {
            body: realBody as any,
            headers: arg.useRisuTk
                ? {
                      'risu-header': encodeURIComponent(JSON.stringify(headers)),
                      'risu-url': encodeURIComponent(url),
                      'Content-Type': 'application/json',
                      'x-risu-tk': 'use',
                      ...(isNodeServer && localStorage.getItem('risuauth') ? { 'risu-auth': localStorage.getItem('risuauth')! } : {}),
                      ...(DBState?.db?.requestLocation && { 'risu-location': DBState.db.requestLocation })
                  }
                : {
                      'risu-header': encodeURIComponent(JSON.stringify(headers)),
                      'risu-url': encodeURIComponent(url),
                      'Content-Type': 'application/json',
                      ...(isNodeServer && localStorage.getItem('risuauth') ? { 'risu-auth': localStorage.getItem('risuauth')! } : {}),
                      ...(DBState?.db?.requestLocation && { 'risu-location': DBState.db.requestLocation })
                  },
            method: arg.method,
            signal: arg.signal
        })

        return new Response(r.body, {
            headers: r.headers,
            status: r.status
        })
    } else {
        return await fetch(url, {
            body: realBody as any,
            headers: headers,
            method: arg.method,
            signal: arg.signal
        })
    }
}

/**
 * Converts a ReadableStream of Uint8Array to a text string.
 */
export function textifyReadableStream(stream: ReadableStream<Uint8Array>) {
    return new Response(stream).text()
}
