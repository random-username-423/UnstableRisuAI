import { getDatabase } from "src/ts/storage/database.svelte"
import { isIOS } from "src/ts/platform"
import type { MoveEvent } from "sortablejs"

/**
 * JSON Schema type definition for tool input validation.
 * Based on JSON Schema draft-2020-12 specification.
 */
export type JSONSchema = {
    type?: string | string[]
    properties?: Record<string, JSONSchema>
    items?: JSONSchema
    anyOf?: JSONSchema[]
    required?: string[]
    enum?: string[]
    format?: string
    description?: string
    nullable?: boolean
    maxLength?: number
    minLength?: number
    minProperties?: number
    maxProperties?: number
    [key: string]: unknown
}

/**
 * Delays execution for a specified number of milliseconds.
 * @param ms - The number of milliseconds to sleep.
 * @returns A promise that resolves after the specified delay.
 */
export function sleep(ms: number): Promise<void> {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

/**
 * Creates a debounced version of a function.
 * The debounced function delays invoking fn until after ms milliseconds have elapsed
 * since the last time the debounced function was invoked.
 * @param fn - The function to debounce
 * @param ms - The number of milliseconds to delay
 * @returns Debounced function with cancel method
 */
export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
    let timer: number | null = null

    const debounced = (...args: Parameters<T>) => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => fn(...args), ms) as unknown as number
    }

    debounced.cancel = () => {
        if (timer) clearTimeout(timer)
        timer = null
    }

    return debounced
}

/**
 * Gets the basename of a given path.
 * @param data - The path to get the basename from.
 * @returns The basename of the path.
 */
export function getBasename(data: string): string {
    return data.split(/[/\\]/).at(-1) ?? ''
}

/**
 * Checks if a value is null or undefined.
 * @param data - The value to check.
 * @returns True if the value is null or undefined, false otherwise.
 */
export function checkNullish(data: unknown): data is null | undefined {
    return data === undefined || data === null
}

/**
 * Creates a hidden file input element to select files via DOM.
 * @param allowedExtensions - Array of allowed file extensions.
 * @param multiple - Whether to allow multiple file selection.
 * @returns A promise that resolves to an array of selected File objects, or null if cancelled.
 */
function selectFileByDom(allowedExtensions:string[], multiple:'multiple'|'single' = 'single') {
    return new Promise<File[] | null>((resolve) => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = multiple === 'multiple';
        const acceptAll = (getDatabase().allowAllExtentionFiles || isIOS() || allowedExtensions[0] === '*')
        if(!acceptAll){
            if (allowedExtensions && allowedExtensions.length) {
                fileInput.accept = allowedExtensions.map(ext => `.${ext}`).join(',');
            }
        }
        else{
            fileInput.accept = '*'
        }

        fileInput.addEventListener('change', () => {
            if (!fileInput.files || fileInput.files.length === 0) {
                fileInput.remove()
                resolve([]);
                return;
            }

            const files = acceptAll ? Array.from(fileInput.files) : Array.from(fileInput.files).filter(file => {
                const fileExtension = file.name.split('.').pop()?.toLowerCase();
                return !allowedExtensions || allowedExtensions.includes(fileExtension ?? '');
            })

            fileInput.remove()
            resolve(files);
        });

        fileInput.addEventListener('cancel', () => {
            fileInput.remove()
            resolve(null);
        });

        document.body.appendChild(fileInput);
        fileInput.click();
        fileInput.style.display = 'none';
    });
}

export type FilePickerResult = { name: string, data: Uint8Array }

export interface FilePickerOptions {
    multiple?: boolean
    readContent?: boolean
}

/**
 * Opens a file picker dialog with flexible options.
 * @param ext - Array of allowed file extensions.
 * @param options - Configuration options.
 * @param options.multiple - Whether to allow multiple file selection. Defaults to false.
 * @param options.readContent - Whether to read file contents as Uint8Array. Defaults to false.
 * @returns Selected file(s) or null if cancelled.
 */
export async function openFilePicker(ext: string[], options: { multiple: true, readContent: true }): Promise<FilePickerResult[] | null>
export async function openFilePicker(ext: string[], options: { multiple: true, readContent?: false }): Promise<File[] | null>
export async function openFilePicker(ext: string[], options: { multiple?: false, readContent: true }): Promise<FilePickerResult | null>
export async function openFilePicker(ext: string[], options?: { multiple?: false, readContent?: false }): Promise<File | null>
export async function openFilePicker(ext: string[], options: FilePickerOptions = {}): Promise<File | File[] | FilePickerResult | FilePickerResult[] | null> {
    const { multiple = false, readContent = false } = options
    const files = await selectFileByDom(ext, multiple ? 'multiple' : 'single')

    if (!files || files.length === 0) return null

    if (readContent) {
        const results = await Promise.all(files.map(async file => ({
            name: file.name,
            data: new Uint8Array(await file.arrayBuffer())
        })))
        return multiple ? results : results[0]
    }

    return multiple ? files : files[0]
}

/**
 * Encrypts a buffer using AES-GCM with a SHA-256 hashed key.
 * @param data - The data to encrypt.
 * @param keys - The encryption key string.
 * @returns A promise that resolves to the encrypted ArrayBuffer.
 */
export async function encryptBuffer(data: Uint8Array, keys: string): Promise<ArrayBuffer> {
    const key = await deriveObfuscationKey(keys, ["encrypt"])
    return window.crypto.subtle.encrypt({ name: "AES-GCM", iv: new Uint8Array(12) }, key, asBuffer(data))
}

/**
 * Decrypts a buffer using AES-GCM with a SHA-256 hashed key.
 * @param data - The data to decrypt.
 * @param keys - The decryption key string.
 * @returns A promise that resolves to the decrypted ArrayBuffer.
 */
export async function decryptBuffer(data: Uint8Array, keys: string): Promise<ArrayBuffer> {
    const key = await deriveObfuscationKey(keys, ["decrypt"])
    return window.crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(12) }, key, asBuffer(data))
}

/**
 * Derives a CryptoKey from a string using SHA-256 hash.
 * @param keys - The key string to derive from.
 * @param usage - The allowed key usages (encrypt/decrypt).
 * @returns A promise that resolves to the derived CryptoKey.
 */
async function deriveObfuscationKey(keys: string, usage: KeyUsage[]): Promise<CryptoKey> {
    const keyArray = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(keys))
    return window.crypto.subtle.importKey("raw", keyArray, "AES-GCM", false, usage)
}

/**
 * Converts a Uint8Array buffer to a UTF-8 text string.
 * @param data - The buffer to convert.
 * @returns The decoded text string.
 */
export function bufferToText(data: Uint8Array){
    return new TextDecoder().decode(data)
}


/**
 * Converts a Blob to a Uint8Array.
 * @param data - The Blob to convert.
 * @returns A promise that resolves to the Uint8Array.
 */
export function blobToUint8Array(data:Blob){
    return new Promise<Uint8Array>((resolve,reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            if(reader.result instanceof ArrayBuffer){
                resolve(new Uint8Array(reader.result))
            }
            else{
                reject(new Error('reader.result is not ArrayBuffer'))
            }
        }
        reader.onerror = () => {
            reject(reader.error)
        }
        reader.readAsArrayBuffer(data)
    })
}

/**
 * Simple Fast Counter 32-bit PRNG (pseudo-random number generator).
 * @param a - First seed value.
 * @param b - Second seed value.
 * @param c - Third seed value.
 * @param d - Fourth seed value.
 * @returns A function that generates random numbers between 0 and 1.
 */
export function sfc32(a:number, b:number, c:number, d:number) {
    return function() {
      a |= 0; b |= 0; c |= 0; d |= 0;
      const t = (a + b | 0) + d | 0;
      d = d + 1 | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = (c << 21 | c >>> 11);
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    }
}

/**
 * Converts a UUID string to a numeric hash.
 * @param uuid - The UUID string.
 * @returns A numeric representation of the UUID.
 */
export function uuidtoNumber(uuid:string){
    let result = 0
    for(let i=0;i<uuid.length;i++){
        result += uuid.charCodeAt(i)
    }
    return result
}

/**
 * Appends the given last path to the provided URL.
 * @param url - The base URL to which the last path will be appended.
 * @param lastPath - The path to be appended to the URL.
 * @returns The modified URL with the last path appended.
 * @example
 * appendLastPath("https://github.com/kwaroran/Risuai", "/commits/main")
 * // returns 'https://github.com/kwaroran/Risuai/commits/main'
 * @example
 * appendLastPath("https://github.com/kwaroran/Risuai/", "/commits/main")
 * // returns 'https://github.com/kwaroran/Risuai/commits/main'
 * @example
 * appendLastPath("http://127.0.0.1:7997", "embeddings")
 * // returns 'http://127.0.0.1:7997/embeddings'
 */
export function appendLastPath(url:string, lastPath:string) {
    // Remove trailing slash from url if exists
    url = url.replace(/\/$/, '');
    
    // Remove leading slash from lastPath if exists
    lastPath = lastPath.replace(/^\//, '');

    // Concat the url and lastPath
    return url + '/' + lastPath;
}

/**
 * Converts the text content of a given Node object, including HTML elements, into a plain text sentence.
 * Converts HTML formatting elements to markdown equivalents.
 * @param node - The Node object from which the text content will be extracted.
 * @returns The plain text sentence representing the content of the Node object.
 * @example
 * const div = document.createElement('div');
 * div.innerHTML = 'Hello<br>World<del>Deleted</del>';
 * getNodetextToSentence(div); // returns "Hello\nWorld~Deleted~"
 */
export function getNodetextToSentence(node: Node): string {
    let result = '';
    for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            result += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            if (child.nodeName === 'BR') {
                result += '\n';
                continue;
            }
            
            // If a child has a style it's not for a markdown formatting
            const childStyle = (child as HTMLElement)?.style;
            if (childStyle?.cssText!== '') {
                result += getNodetextToSentence(child);
                continue;
            }
            
            // convert HTML elements to markdown format
            if (child.nodeName === 'DEL') {
                result += '~' + getNodetextToSentence(child) + '~';
            } else if (child.nodeName === 'STRONG' || child.nodeName === 'B') {
                result += '**' + getNodetextToSentence(child) + '**';
            } else if (child.nodeName === 'EM' || child.nodeName === 'I') {
                result += '*' + getNodetextToSentence(child) + '*';
            } 
            else {
                result += getNodetextToSentence(child);
            }
        }
    }
    return result;
}


/**
 * Checks if a URI has a known/supported protocol.
 * @param uri - The URI to check.
 * @returns True if the URI has a known protocol (http, https, ccdefault, embeded).
 */
export const isKnownUri = (uri:string) => {
    return uri.startsWith('http://')
            || uri.startsWith('https://')
            || uri.startsWith('ccdefault:')
            || uri.startsWith('embeded://')
}

/**
 * Parses a key=value formatted string into an array of tuples.
 * @param template - The template string with key=value pairs separated by newlines.
 * @returns An array of [key, value] tuples.
 */
export function parseKeyValue(template:string){
    try {
        if(!template){
            return []
        }
    
        const keyValue:[string, string][] = []
    
        for(const line of template.split('\n')){
            const [key, value] = line.split('=')
            if(key && value){
                keyValue.push([key, value])
            }
        }
    
        return keyValue   
    } catch {
        return []
    }
}

export type sidebarToggleGroup = {
    key?:string,
    value?:string,
    type:'group',
    children:sidebarToggle[]
}

export type sidebarToggleGroupEnd = {
    key?:string,
    value?:string,
    type:'groupEnd',
}

export type sidebarToggle =
    | sidebarToggleGroup
    | sidebarToggleGroupEnd
    | {
        key?:string,
        value?:string,
        type:'caption',
    }
    | {
        key?:string,
        value?:string,
        type:'divider',
    }
    | {
        key:string,
        value:string,
        type:'select',
        options:string[]
    }
    | {
        key:string,
        value:string,
        type:'text'|'textarea'|undefined,
        options?:string[]
    }

/**
 * Parses a toggle syntax formatted string into sidebar toggle configuration.
 * @param template - The template string with toggle definitions.
 * @returns An array of sidebar toggle configurations.
 */
export function parseToggleSyntax(template:string){
    try {
        if(!template){
            return []
        }
    
        const keyValue:sidebarToggle[] = []
    
        const splited = template.split('\n')

        for(const line of splited){
            const [key, value, type, option] = line.split('=')
            if(type === 'group' || type === 'groupEnd' || type === 'divider'){
                keyValue.push({
                    key,
                    value,
                    type,
                    children: []
                })
            } else if(type === 'caption' && value){
                keyValue.push({
                    key,
                    value,
                    type
                })
            } else if((key && value)){
                keyValue.push({
                    key,
                    value,
                    type: type === 'select' || type === 'text' || type === 'textarea' ? type : undefined,
                    options: option?.split(',') ?? []
                })
            }
        }

        return keyValue   
    } catch (error) {
        console.error(error)
        return []
    }
}

/** Default options for sortable drag-and-drop functionality. */
export const sortableOptions = {
	delay: 300, // time in milliseconds to define when the sorting should start
	delayOnTouchOnly: true,
    filter: '.no-sort',
    onMove: (event: MoveEvent) => {
        return event.related.className.indexOf('no-sort') === -1
    }
} as const


/**
 * Generates a deterministic random number based on a character ID and word.
 * @param cid - The character ID used for seeding.
 * @param word - The word used for hashing.
 * @returns A random number between 0 and 1.
 */
export function pickHashRand(cid:number,word:string) {
    let hashAddress = 5515
    const rand = (word:string) => {
        for (let counter = 0; counter<word.length; counter++){
            hashAddress = ((hashAddress << 5) + hashAddress) + word.charCodeAt(counter)
        }
        return hashAddress
    }
    const randF = sfc32(rand(word), rand(word), rand(word), rand(word))
    const v = cid % 1000
    for (let i = 0; i < v; i++){
        randF()
    }
    return randF()
}

/**
 * Performs string replacement with an async replacer function.
 * @param string - The string to perform replacements on.
 * @param regexp - The regular expression pattern to match.
 * @param replacerFunction - Async function that returns the replacement string.
 * @returns A promise that resolves to the string with replacements applied.
 */
export async function replaceAsync(string:string, regexp:RegExp, replacerFunction: (...args: string[]) => Promise<string>) {
    const replacements = await Promise.all(
        Array.from(string.matchAll(regexp),
            match => replacerFunction(...(match as string[]))))
    let i = 0;
    return string.replace(regexp, () => replacements[i++])
}

/**
 * Simplifies a JSON schema by removing unnecessary properties and normalizing types.
 * @param schema - The JSON schema to simplify.
 * @param args - Optional configuration arguments.
 * @returns The simplified schema object.
 *
 * TODO: Refactoring needed
 * - Remove console.log statements
 * - Fix mutation of original schema object (side effect)
 * - Remove unused parameter `upperType`
 * - Consider provider-specific functions (nullable handling is Google-only; OpenAI/Anthropic use type: ["string", "null"])
 * - Missing keywords: oneOf, allOf, additionalProperties, minimum, maximum, default, etc.
 */
export function simplifySchema(schema: JSONSchema, args:{
    upperType?:boolean,
} = {}): JSONSchema{
    if(!schema || typeof schema !== 'object'){
        console.error('Schema is not an object', schema)
        return schema
    }


    if(Array.isArray(schema.type)){
        if(schema.type.includes('null')){
            schema.nullable = true
        }
        schema.type = schema.type.filter(v => v !== 'null')[0]
    }

    console.log('schema',schema)
    const result: JSONSchema = {
    }

    if(schema.type){
        result.type = typeof schema.type === 'string' ? schema.type.toLowerCase() : schema.type
    }
    if(schema.type === 'object'){
        result.properties = {}
        for(const key in schema.properties){
            result.properties[key] = simplifySchema(schema.properties[key], args)
        }
        if(schema.required && schema.required.length > 0){
            result.required = schema.required
        }
    }
    if(schema.type === 'array' && schema.items){
        result.items = simplifySchema(schema.items, args)
    }

    if(schema.type === 'string' && schema.enum && schema.enum.length > 0){
        result.enum = schema.enum
    }

    if(schema.type === 'string' && schema.format){
        result.format = schema.format
    }

    if(schema.nullable){
        result.nullable = true
    }

    if(schema.maxLength !== undefined && schema.maxLength !== null){
        result.maxLength = schema.maxLength
    }

    if(schema.minLength !== undefined && schema.minLength !== null){
        result.minLength = schema.minLength
    }

    if(schema.minProperties !== undefined && schema.minProperties !== null){
        result.minProperties = schema.minProperties
    }

    if(schema.maxProperties !== undefined && schema.maxProperties !== null){
        result.maxProperties = schema.maxProperties
    }

    if(schema.description){
        result.description = schema.description
    }

    if(schema.anyOf && schema.anyOf.length > 0){
        console.log('anyOf', schema.anyOf)
        result.anyOf = schema.anyOf.map((v) => simplifySchema(v, args))
    }

    return result

}

/**
 * Trims JSON output by removing thought tags and markdown code block wrappers.
 * @param data - The raw string data to trim.
 * @returns The cleaned JSON string.
 */
export const jsonOutputTrimmer = (data:string) => {
    
    data = data.replace(/<Thoughts>(.+?)<\/Thoughts>/gms, '').trim()
    if(data.startsWith('```json') && data.endsWith('```')){
        data = data.slice(7, -3).trim()
    }
    return data.trim()
}

/**
 * Casts a buffer to ensure proper ArrayBuffer typing.
 * @param arr - The array or buffer to cast.
 * @returns The properly typed buffer.
 */
export function asBuffer(arr: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBuffer>;
export function asBuffer(arr: ArrayBufferLike): ArrayBuffer;
export function asBuffer(arr: Uint8Array<ArrayBufferLike> | ArrayBufferLike): Uint8Array<ArrayBuffer> | ArrayBuffer {
    if (arr instanceof Uint8Array) {
        return arr as unknown as Uint8Array<ArrayBuffer>;
    }
    else {
        return arr as unknown as ArrayBuffer
    }
}

/**
 * Converts a ReadableStream of Uint8Array to a text string.
 * @param stream - The readable stream to convert.
 * @returns A promise that resolves to the text content of the stream.
 */
export function textifyReadableStream(stream: ReadableStream<Uint8Array>) {
    return new Response(stream).text();
}

/**
 * Concurrency control mechanism that limits simultaneous operations.
 * When max concurrent operations are running, new operations wait in queue.
 * For example, if max=3, only 3 operations can run at once.
 * The 4th operation waits until one of the first 3 completes.
 */
export class Semaphore {
    private available: number
    private readonly max: number
    private waiting: Array<() => void> = []

    constructor(max: number) {
        this.available = max
        this.max = max
    }

    async acquire(): Promise<void> {
        if (this.available > 0) {
            this.available -= 1
            return
        }
        await new Promise<void>(resolve => this.waiting.push(resolve))
    }

    release(): void {
        const next = this.waiting.shift()
        if (next) {
            next()
            return
        }
        if (this.available < this.max) {
            this.available += 1
        }
    }
}

// Re-export string utilities for backward compatibility
export * from './util_string'
