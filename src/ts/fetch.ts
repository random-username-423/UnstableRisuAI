import { fetch as TauriHTTPFetch } from "@tauri-apps/plugin-http";
import { AppendableBuffer } from "./globalApi.svelte";
import { CapacitorHttp, registerPlugin } from "@capacitor/core";
import { hubURL } from "./characterCards";
import { isTauri, isNodeServer, isCapacitor } from "./platform";
import { DBState } from "./stores.svelte";
import { listen } from '@tauri-apps/api/event'
import { getDatabase } from "./storage/database.svelte";
import { sleep } from "./util"
import { invoke } from "@tauri-apps/api/core";

/**
 * Performs a fetch request using plain fetch.
 *
 * @param {string} url - The URL to fetch.
 * @param {GlobalFetchArgs} arg - The arguments for the fetch request.
 * @returns {Promise<GlobalFetchResult>} - The result of the fetch request.
 */
export async function fetchWithPlainFetch(url: string, arg: GlobalFetchArgs): Promise<GlobalFetchResult> {
    try {
        const headers = { 'Content-Type': 'application/json', ...arg.headers };
        const response = await fetch(new URL(url), { body: JSON.stringify(arg.body), headers, method: arg.method ?? "POST", signal: arg.abortSignal });
        const data = arg.rawResponse ? new Uint8Array(await response.arrayBuffer()) : await response.json();
        const ok = response.ok && response.status >= 200 && response.status < 300;
        addFetchLogInGlobalFetch(data, ok, url, arg, response.status);
        return { ok, data, headers: Object.fromEntries(response.headers), status: response.status };
    } catch (error) {
        return { ok: false, data: `${error}`, headers: {}, status: 400 };
    }
}/**
 * Performs a fetch request using userscript provided fetch.
 *
 * @param {string} url - The URL to fetch.
 * @param {GlobalFetchArgs} arg - The arguments for the fetch request.
 * @returns {Promise<GlobalFetchResult>} - The result of the fetch request.
 */
export async function fetchWithUSFetch(url: string, arg: GlobalFetchArgs): Promise<GlobalFetchResult> {
    try {
        const headers = { 'Content-Type': 'application/json', ...arg.headers };
        const response = await userScriptFetch(url, { body: JSON.stringify(arg.body), headers, method: arg.method ?? "POST", signal: arg.abortSignal });
        const data = arg.rawResponse ? new Uint8Array(await response.arrayBuffer()) : await response.json();
        const ok = response.ok && response.status >= 200 && response.status < 300;
        addFetchLogInGlobalFetch(data, ok, url, arg, response.status);
        return { ok, data, headers: Object.fromEntries(response.headers), status: response.status };
    } catch (error) {
        return { ok: false, data: `${error}`, headers: {}, status: 400 };
    }
}
/**
 * Performs a fetch request using Tauri.
 *
 * @param {string} url - The URL to fetch.
 * @param {GlobalFetchArgs} arg - The arguments for the fetch request.
 * @returns {Promise<GlobalFetchResult>} - The result of the fetch request.
 */
export async function fetchWithTauri(url: string, arg: GlobalFetchArgs): Promise<GlobalFetchResult> {
    try {
        const headers = { 'Content-Type': 'application/json', ...arg.headers };
        const response = await TauriHTTPFetch(new URL(url), { body: JSON.stringify(arg.body), headers, method: arg.method ?? "POST", signal: arg.abortSignal });
        const data = arg.rawResponse ? new Uint8Array(await response.arrayBuffer()) : await response.json();
        const ok = response.status >= 200 && response.status < 300;
        addFetchLogInGlobalFetch(data, ok, url, arg, response.status);
        return { ok, data, headers: Object.fromEntries(response.headers), status: response.status };
    } catch (error) {
    }
}
// Decoupled globalFetch built-in function
export async function fetchWithCapacitor(url: string, arg: GlobalFetchArgs): Promise<GlobalFetchResult> {
    const { body, headers = {}, rawResponse } = arg;
    headers["Content-Type"] = body instanceof URLSearchParams ? "application/x-www-form-urlencoded" : "application/json";

    const res = await CapacitorHttp.request({ url, method: arg.method ?? "POST", headers, data: body, responseType: rawResponse ? "arraybuffer" : "json" });

    addFetchLogInGlobalFetch(rawResponse ? "Uint8Array Response" : res.data, true, url, arg, res.status);

    return {
        ok: true,
        data: rawResponse ? new Uint8Array(res.data as ArrayBuffer) : res.data,
        headers: res.headers,
        status: res.status
    };
}
/**
 * Performs a fetch request using a proxy.
 *
 * @param {string} url - The URL to fetch.
 * @param {GlobalFetchArgs} arg - The arguments for the fetch request.
 * @returns {Promise<GlobalFetchResult>} - The result of the fetch request.
 */
export async function fetchWithProxy(url: string, arg: GlobalFetchArgs): Promise<GlobalFetchResult> {
    try {
        const furl = !isTauri && !isNodeServer ? `${hubURL}/proxy2` : `/proxy2`;
        arg.headers["Content-Type"] ??= arg.body instanceof URLSearchParams ? "application/x-www-form-urlencoded" : "application/json";
        const headers = {
            "risu-header": encodeURIComponent(JSON.stringify(arg.headers)),
            "risu-url": encodeURIComponent(url),
            "Content-Type": arg.body instanceof URLSearchParams ? "application/x-www-form-urlencoded" : "application/json",
            ...(arg.useRisuToken && { "x-risu-tk": "use" }),
            ...(DBState?.db?.requestLocation && { "risu-location": DBState.db.requestLocation }),
        };

        // Add risu-auth header for Node.js server
        if (isNodeServer) {
            const auth = localStorage.getItem('risuauth');
            if (auth) {
                headers["risu-auth"] = auth;
            }
        }

        const body = arg.body instanceof URLSearchParams ? arg.body.toString() : JSON.stringify(arg.body);

        const response = await fetch(furl, { body, headers, method: arg.method ?? "POST", signal: arg.abortSignal });
        const isSuccess = response.ok && response.status >= 200 && response.status < 300;

        if (arg.rawResponse) {
            const data = new Uint8Array(await response.arrayBuffer());
            addFetchLogInGlobalFetch("Uint8Array Response", isSuccess, url, arg, response.status);
            return { ok: isSuccess, data, headers: Object.fromEntries(response.headers), status: response.status };
        }

        const text = await response.text();
        try {
            const data = JSON.parse(text);
            addFetchLogInGlobalFetch(data, isSuccess, url, arg, response.status);
            return { ok: isSuccess, data, headers: Object.fromEntries(response.headers), status: response.status };
        } catch (error) {
            const errorMsg = text.startsWith('<!DOCTYPE') ? "Responded HTML. Is your URL, API key, and password correct?" : text;
            addFetchLogInGlobalFetch(text, false, url, arg, response.status);
            return { ok: false, data: errorMsg, headers: Object.fromEntries(response.headers), status: response.status };
        }
    } catch (error) {
        return { ok: false, data: `${error}`, headers: {}, status: 400 };
    }
}
/**
 * Adds a fetch log entry in the global fetch log.
 *
 * @param {any} response - The response data.
 * @param {boolean} success - Indicates if the fetch was successful.
 * @param {string} url - The URL of the fetch request.
 * @param {GlobalFetchArgs} arg - The arguments for the fetch request.
 */

export function addFetchLogInGlobalFetch(response: any, success: boolean, url: string, arg: GlobalFetchArgs, status?: number) {
    try {
        fetchLog.unshift({
            body: JSON.stringify(arg.body, null, 2),
            header: JSON.stringify(arg.headers ?? {}, null, 2),
            response: JSON.stringify(response, null, 2),
            success: success,
            date: (new Date()).toLocaleTimeString(),
            url: url,
            chatId: arg.chatId,
            status: status
        });
    }
    catch {
        fetchLog.unshift({
            body: JSON.stringify(arg.body, null, 2),
            header: JSON.stringify(arg.headers ?? {}, null, 2),
            response: `${response}`,
            success: success,
            date: (new Date()).toLocaleTimeString(),
            url: url,
            chatId: arg.chatId,
            status: status
        });
    }

    if (fetchLog.length > 20) {
        fetchLog.pop();
    }
}
/**
 * Pipes the fetch log to a readable stream.
 * @param {number} fetchLogIndex - The index of the fetch log.
 * @param {ReadableStream<Uint8Array>} readableStream - The readable stream to pipe.
 * @returns {ReadableStream<Uint8Array>} - The new readable stream.
 */
export const pipeFetchLog = (fetchLogIndex: number, readableStream: ReadableStream<Uint8Array>) => {
    const textDecoderBuffer = new AppendableBuffer();
    let textDecoderPointer = 0;
    const textDecoder = TextDecoderStream ? (new TextDecoderStream()) : new TransformStream<Uint8Array, string>({
        transform(chunk, controller) {
            try {
                textDecoderBuffer.append(chunk);
                const decoded = new TextDecoder('utf-8', {
                    fatal: true
                }).decode(textDecoderBuffer.buffer);
                const newString = decoded.slice(textDecoderPointer);
                textDecoderPointer = decoded.length;
                controller.enqueue(newString);
            } catch { }
        }
    });
    textDecoder.readable.pipeTo(new WritableStream({
        write(chunk) {
            fetchLog[fetchLogIndex].response += chunk;
        }
    }));
    const writer = textDecoder.writable.getWriter();
    return new ReadableStream<Uint8Array>({
        start(controller) {
            readableStream.pipeTo(new WritableStream({
                write(chunk) {
                    controller.enqueue(chunk);
                    writer.write(chunk as any);
                },
                close() {
                    controller.close();
                    writer.close();
                }
            }));
        }
    });
};
export interface fetchLog {
    body: string;
    header: string;
    response: string;
    success: boolean;
    date: string;
    url: string;
    responseType?: string;
    chatId?: string;
    status?: number;
}
export const fetchLog: fetchLog[] = [];
/**
 * Interface representing the arguments for the global fetch function.
 *
 * @interface GlobalFetchArgs
 * @property {boolean} [plainFetchForce] - Whether to force plain fetch.
 * @property {any} [body] - The body of the request.
 * @property {{ [key: string]: string }} [headers] - The headers of the request.
 * @property {boolean} [rawResponse] - Whether to return the raw response.
 * @property {'POST' | 'GET'} [method] - The HTTP method to use.
 * @property {AbortSignal} [abortSignal] - The abort signal to cancel the request.
 * @property {boolean} [useRisuToken] - Whether to use the Risu token.
 * @property {string} [chatId] - The chat ID associated with the request.
 */

export interface GlobalFetchArgs {
    plainFetchForce?: boolean;
    plainFetchDeforce?: boolean;
    body?: any;
    headers?: { [key: string]: string; };
    rawResponse?: boolean;
    method?: 'POST' | 'GET';
    abortSignal?: AbortSignal;
    useRisuToken?: boolean;
    chatId?: string;
}
/**
 * Interface representing the result of the global fetch function.
 *
 * @interface GlobalFetchResult
 * @property {boolean} ok - Whether the request was successful.
 * @property {any} data - The data returned from the request.
 * @property {{ [key: string]: string }} headers - The headers returned from the request.
 */

export interface GlobalFetchResult {
    ok: boolean;
    data: any;
    headers: { [key: string]: string; };
    status: number;
}
/**
 * Index for fetch operations.
 * @type {number}
 */
export let fetchIndex = 0;
/**
 * Stores native fetch data.
 * @type {{ [key: string]: StreamedFetchChunk[] }}
 */
export const nativeFetchData: { [key: string]: StreamedFetchChunk[]; } = {};
/**
 * Interface representing a streamed fetch chunk data.
 * @interface
 */
export interface StreamedFetchChunkData {
    type: 'chunk';
    body: string;
    id: string;
}
/**
 * Interface representing a streamed fetch header data.
 * @interface
 */
export interface StreamedFetchHeaderData {
    type: 'headers';
    body: { [key: string]: string; };
    id: string;
    status: number;
}
/**
 * Interface representing a streamed fetch end data.
 * @interface
 */
export interface StreamedFetchEndData {
    type: 'end';
    id: string;
}
/**
 * Type representing a streamed fetch chunk.
 * @typedef {StreamedFetchChunkData | StreamedFetchHeaderData | StreamedFetchEndData} StreamedFetchChunk
 */

export type StreamedFetchChunk = StreamedFetchChunkData | StreamedFetchHeaderData | StreamedFetchEndData;
/**
 * Interface representing a streamed fetch plugin.
 * @interface
 */
export interface StreamedFetchPlugin {
    /**
     * Performs a streamed fetch operation.
     * @param {Object} options - The options for the fetch operation.
     * @param {string} options.id - The ID of the fetch operation.
     * @param {string} options.url - The URL to fetch.
     * @param {string} options.body - The body of the fetch request.
     * @param {{ [key: string]: string }} options.headers - The headers of the fetch request.
     * @returns {Promise<{ error: string, success: boolean }>} - The result of the fetch operation.
     */
    streamedFetch(options: { id: string; url: string; body: string; headers: { [key: string]: string; }; }): Promise<{ "error": string; "success": boolean; }>;

    /**
     * Adds a listener for the specified event.
     * @param {string} eventName - The name of the event.
     * @param {(data: StreamedFetchChunk) => void} listenerFunc - The function to call when the event is triggered.
     */
    addListener(eventName: 'streamed_fetch', listenerFunc: (data: StreamedFetchChunk) => void): void;
}
/**
 * Indicates whether streamed fetch listening is active.
 * @type {boolean}
 */
export let streamedFetchListening = false;
/**
 * The streamed fetch plugin instance.
 * @type {StreamedFetchPlugin | undefined}
 */
export let capStreamedFetch: StreamedFetchPlugin | undefined;

if (isTauri) {
    listen('streamed_fetch', (event) => {
        try {
            const parsed = JSON.parse(event.payload as string)
            const id = parsed.id
            nativeFetchData[id]?.push(parsed)
        } catch (error) {
            console.error(error)
        }
    }).then((v) => {
        streamedFetchListening = true
    })
}

if (isCapacitor) {
    capStreamedFetch = registerPlugin<StreamedFetchPlugin>('CapacitorHttp', CapacitorHttp)

    capStreamedFetch.addListener('streamed_fetch', (data) => {
        try {
            nativeFetchData[data.id]?.push(data)
        } catch (error) {
            console.error(error)
        }
    })
    streamedFetchListening = true
}
/**
 * Retrieves fetch data for a given chat ID.
 *
 * @param {string} id - The chat ID to search for in the fetch log.
 * @returns {fetchLog | null} - The fetch log entry if found, otherwise null.
 */

export function getFetchData(id: string) {
    for (const log of fetchLog) {
        if (log.chatId === id) {
            return log;
        }
    }
    return null;
}/**
 * Adds a fetch log entry.
 *
 * @param {Object} arg - The arguments for the fetch log entry.
 * @param {any} arg.body - The body of the request.
 * @param {{ [key: string]: string }} [arg.headers] - The headers of the request.
 * @param {any} arg.response - The response from the request.
 * @param {boolean} arg.success - Whether the request was successful.
 * @param {string} arg.url - The URL of the request.
 * @param {string} [arg.resType] - The response type.
 * @param {string} [arg.chatId] - The chat ID associated with the request.
 * @returns {number} - The index of the added fetch log entry.
 */

export function addFetchLog(arg: {
    body: any;
    headers?: { [key: string]: string; };
    response: any;
    success: boolean;
    url: string;
    resType?: string;
    chatId?: string;
    status?: number;
}): number {
    fetchLog.unshift({
        body: typeof (arg.body) === 'string' ? arg.body : JSON.stringify(arg.body, null, 2),
        header: JSON.stringify(arg.headers ?? {}, null, 2),
        response: typeof (arg.response) === 'string' ? arg.response : JSON.stringify(arg.response, null, 2),
        responseType: arg.resType ?? 'json',
        success: arg.success,
        date: (new Date()).toLocaleTimeString(),
        url: arg.url,
        chatId: arg.chatId,
        status: arg.status
    });
    return 0;
}
/**
 * Performs a global fetch request.
 *
 * @param {string} url - The URL to fetch.
 * @param {GlobalFetchArgs} [arg={}] - The arguments for the fetch request.
 * @returns {Promise<GlobalFetchResult>} - The result of the fetch request.
 */

export async function globalFetch(url: string, arg: GlobalFetchArgs = {}): Promise<GlobalFetchResult> {
    try {
        const db = getDatabase();
        const method = arg.method ?? "POST";
        db.requestmet = "normal";

        if (arg.abortSignal?.aborted) { return { ok: false, data: 'aborted', headers: {}, status: 400 }; }

        const urlHost = new URL(url).hostname;
        const forcePlainFetch = ((knownHostes.includes(urlHost) && !isTauri) || db.usePlainFetch || arg.plainFetchForce) && !arg.plainFetchDeforce;

        if (knownHostes.includes(urlHost) && !isTauri && !isNodeServer) {
            return { ok: false, headers: {}, status: 400, data: 'You are trying local request on web version. This is not allowed due to browser security policy. Use the desktop version instead, or use a tunneling service like ngrok and set the CORS to allow all.' };
        }

        if (forcePlainFetch) {
            return await fetchWithPlainFetch(url, arg);
        }
        //userScriptFetch is provided by userscript
        if (window.userScriptFetch) {
            return await fetchWithUSFetch(url, arg);
        }
        if (isTauri) {
            return await fetchWithTauri(url, arg);
        }
        if (isCapacitor) {
            return await fetchWithCapacitor(url, arg);
        }
        return await fetchWithProxy(url, arg);

    } catch (error) {
        console.error(error);
        return { ok: false, data: `${error}`, headers: {}, status: 400 };
    }
}
/**
 * Retrieves the fetch logs array.
 *
 * @returns {fetchLog[]} The fetch logs array.
 */

export function getFetchLogs() {
    return fetchLog;
}


/**
 * Fetches data from a given URL using native fetch or through a proxy.
 * @param {string} url - The URL to fetch data from.
 * @param {Object} arg - The arguments for the fetch request.
 * @param {string} arg.body - The body of the request.
 * @param {Object} [arg.headers] - The headers of the request.
 * @param {string} [arg.method="POST"] - The HTTP method of the request.
 * @param {AbortSignal} [arg.signal] - The signal to abort the request.
 * @param {boolean} [arg.useRisuTk] - Whether to use Risu token.
 * @param {string} [arg.chatId] - The chat ID associated with the request.
 * @returns {Promise<Object>} - A promise that resolves to an object containing the response body, headers, and status.
 * @returns {ReadableStream<Uint8Array>} body - The response body as a readable stream.
 * @returns {Headers} headers - The response headers.
 * @returns {number} status - The response status code.
 * @throws {Error} - Throws an error if the request is aborted or if there is an error in the response.
 */
export async function fetchNative(url: string, arg: {
    body?: string | Uint8Array | ArrayBuffer,
    headers?: { [key: string]: string },
    method?: "POST" | "GET" | "PUT" | "DELETE",
    signal?: AbortSignal,
    useRisuTk?: boolean,
    chatId?: string
}): Promise<Response> {

    console.log(arg.body, 'body')
    if (arg.body === undefined && (arg.method === 'POST' || arg.method === 'PUT')) {
        throw new Error('Body is required for POST and PUT requests')
    }

    arg.method = arg.method ?? 'POST'

    const headers = arg.headers ?? {}
    let realBody: Uint8Array

    if (arg.method === 'GET' || arg.method === 'DELETE') {
        realBody = undefined
    }
    else if (typeof arg.body === 'string') {
        realBody = new TextEncoder().encode(arg.body)
    }
    else if (arg.body instanceof Uint8Array) {
        realBody = arg.body
    }
    else if (arg.body instanceof ArrayBuffer) {
        realBody = new Uint8Array(arg.body)
    }
    else {
        throw new Error('Invalid body type')
    }

    const db = getDatabase()
    const throughProxy = (!isTauri) && (!isNodeServer) && (!db.usePlainFetch)
    const fetchLogIndex = addFetchLog({
        body: new TextDecoder().decode(realBody),
        headers: arg.headers,
        response: 'Streamed Fetch',
        success: true,
        url: url,
        resType: 'stream',
        chatId: arg.chatId,
    })
    if (window.userScriptFetch) {
        return await window.userScriptFetch(url, {
            body: realBody as any,
            headers: headers,
            method: arg.method,
            signal: arg.signal
        })
    }
    else if (isTauri) {
        fetchIndex++
        if (arg.signal && arg.signal.aborted) {
            throw new Error('aborted')
        }
        if (fetchIndex >= 100000) {
            fetchIndex = 0
        }
        const fetchId = fetchIndex.toString().padStart(5, '0')
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
        else if (capStreamedFetch) {
            capStreamedFetch.streamedFetch({
                id: fetchId,
                url: url,
                headers: headers,
                body: realBody ? Buffer.from(realBody).toString('base64') : '',
            }).then((res) => {
                if (!res.success) {
                    error = res.error
                    resolved = true
                }
            })
        }

        let resHeaders: { [key: string]: string } = null
        let status = 400

        const readableStream = pipeFetchLog(fetchLogIndex, new ReadableStream<Uint8Array>({
            async start(controller) {
                while (!resolved || nativeFetchData[fetchId].length > 0) {
                    if (nativeFetchData[fetchId].length > 0) {
                        const data = nativeFetchData[fetchId].shift()
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
        }))

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


    }
    else if (throughProxy) {

        const r = await fetch(hubURL + `/proxy2`, {
            body: realBody as any,
            headers: arg.useRisuTk ? {
                "risu-header": encodeURIComponent(JSON.stringify(headers)),
                "risu-url": encodeURIComponent(url),
                "Content-Type": "application/json",
                "x-risu-tk": "use",
                ...(isNodeServer && localStorage.getItem('risuauth') ? { "risu-auth": localStorage.getItem('risuauth') } : {}),
                ...(DBState?.db?.requestLocation && { "risu-location": DBState.db.requestLocation }),
            } : {
                "risu-header": encodeURIComponent(JSON.stringify(headers)),
                "risu-url": encodeURIComponent(url),
                "Content-Type": "application/json",
                ...(isNodeServer && localStorage.getItem('risuauth') ? { "risu-auth": localStorage.getItem('risuauth') } : {}),
                ...(DBState?.db?.requestLocation && { "risu-location": DBState.db.requestLocation }),
            },
            method: arg.method,
            signal: arg.signal
        })

        return new Response(r.body, {
            headers: r.headers,
            status: r.status
        })
    }
    else {
        return await fetch(url, {
            body: realBody as any,
            headers: headers,
            method: arg.method,
            signal: arg.signal,
        })
    }
}/**
 * Retrieves the request log as a formatted string.
 *
 * @returns {string} The formatted request log.
 */

export function getRequestLog() {
    let logString = '';
    const b = '\n\`\`\`json\n';
    const bend = '\n\`\`\`\n';

    for (const log of fetchLog) {
        logString += `## ${log.date}\n\n* Request URL\n\n${b}${log.url}${bend}\n\n* Request Body\n\n${b}${log.body}${bend}\n\n* Request Header\n\n${b}${log.header}${bend}\n\n`
            + `* Response Body\n\n${b}${log.response}${bend}\n\n* Response Success\n\n${b}${log.success}${bend}\n\n`;
    }
    return logString;
}
export const knownHostes = ["localhost", "127.0.0.1", "0.0.0.0"];

