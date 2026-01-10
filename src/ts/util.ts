import { getDatabase } from "./storage/database.svelte"
import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from "@tauri-apps/plugin-fs"
import { basename } from "@tauri-apps/api/path"
import { isIOS, isTauri } from "src/ts/platform"


/**
 * Delays execution for a specified number of milliseconds.
 * @param ms - The number of milliseconds to sleep.
 * @returns A promise that resolves after the specified delay.
 */
export function sleep(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

const baseNameRegex = /\\/g

/**
 * Gets the basename of a given path.
 * @param data - The path to get the basename from.
 * @returns The basename of the path.
 */
export function getBasename(data: string) {
    const splited = data.replace(baseNameRegex, '/').split('/')
    const lasts = splited[splited.length - 1]
    return lasts
}

/**
 * Checks if a value is null or undefined.
 * @param data - The value to check.
 * @returns True if the value is null or undefined, false otherwise.
 */
export function checkNullish(data:any){
    return data === undefined || data === null
}

const domSelect = true

/**
 * Opens a file picker dialog and returns a single selected file.
 * @param ext - Array of allowed file extensions.
 * @returns The selected file with name and data, or null if cancelled.
 */
export async function selectSingleFile(ext:string[]){
    if(domSelect){
        const v = await selectFileByDom(ext, 'single')
        const file = v[0]
        return {name: file.name,data:await readFileAsUint8Array(file)}
    }

    const selected = await open({
        filters: [{
            name: ext.join(', '),
            extensions: ext
        }]
    });
    if (Array.isArray(selected)) {
        return null
    } else if (selected === null) {
        return null
    } else {
        return {name: await basename(selected),data:await readFile(selected)}
    }
}

/**
 * Opens a file picker dialog and returns multiple selected files.
 * @param ext - Array of allowed file extensions.
 * @returns Array of selected files with name and data, or null if cancelled.
 */
export async function selectMultipleFile(ext:string[]){
    if(!isTauri){
        const v = await selectFileByDom(ext, 'multiple')
        const arr:{name:string, data:Uint8Array}[] = []
        for(const file of v){
            arr.push({name: file.name,data:await readFileAsUint8Array(file)})
        }
        return arr
    }

    const selected = await open({
        filters: [{
            name: ext.join(', '),
            extensions: ext,
        }],
        multiple: true
    });
    if (Array.isArray(selected)) {
        const arr:{name:string, data:Uint8Array}[] = []
        for(const file of selected){
            arr.push({name: await basename(file),data:await readFile(file)})
        }
        return arr
    } else if (selected === null) {
        return null
    } else {
        return [{name: await basename(selected),data:await readFile(selected)}]
    }
}

/**
 * Creates a hidden file input element to select files via DOM.
 * @param allowedExtensions - Array of allowed file extensions.
 * @param multiple - Whether to allow multiple file selection.
 * @returns A promise that resolves to an array of selected File objects.
 */
export function selectFileByDom(allowedExtensions:string[], multiple:'multiple'|'single' = 'single') {
    return new Promise<null|File[]>((resolve) => {
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

    
        fileInput.addEventListener('change', (event) => {
            if (fileInput.files.length === 0) {
                resolve([]);
                return;
            }
    
            const files = acceptAll ? Array.from(fileInput.files) :(Array.from(fileInput.files).filter(file => {
                const fileExtension = file.name.split('.').pop().toLowerCase();
                return !allowedExtensions || allowedExtensions.includes(fileExtension);
            })) 
    
            fileInput.remove()
            resolve(files);
        });
    
        document.body.appendChild(fileInput);
        fileInput.click();
        fileInput.style.display = 'none'; // Hide the file input element
    });
}

/**
 * Reads a File object and returns its contents as a Uint8Array.
 * @param file - The File object to read.
 * @returns A promise that resolves to the file contents as Uint8Array.
 */
function readFileAsUint8Array(file: File) {
    return new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
  
      reader.onload = (event) => {
        const buffer = event.target.result;
        const uint8Array = new Uint8Array(buffer as ArrayBuffer);
        resolve(uint8Array);
      };
  
      reader.onerror = () => {
        reject(new Error('Failed to read file', { cause: reader.error }));
      };
  
      reader.readAsArrayBuffer(file);
    });
}

/**
 * Encrypts a buffer using AES-GCM with a SHA-256 hashed key.
 * @param data - The data to encrypt.
 * @param keys - The encryption key string.
 * @returns A promise that resolves to the encrypted ArrayBuffer.
 */
export async function encryptBuffer(data:Uint8Array, keys:string){
    // hash the key to get a fixed length key value
    const keyArray = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(keys))

    const key = await window.crypto.subtle.importKey(
        "raw",
        keyArray,
        "AES-GCM",
        false,
        ["encrypt", "decrypt"]
    )

    // use web crypto api to encrypt the data
    const result = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: new Uint8Array(12),
        },
        key,
        asBuffer(data)
    )

    return result
}

/**
 * Decrypts a buffer using AES-GCM with a SHA-256 hashed key.
 * @param data - The data to decrypt.
 * @param keys - The decryption key string.
 * @returns A promise that resolves to the decrypted ArrayBuffer.
 */
export async function decryptBuffer(data:Uint8Array, keys:string){
    // hash the key to get a fixed length key value
    const keyArray = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(keys))

    const key = await window.crypto.subtle.importKey(
        "raw",
        keyArray,
        "AES-GCM",
        false,
        ["encrypt", "decrypt"]
    )

    // use web crypto api to encrypt the data
    const result = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: new Uint8Array(12),
        },
        key,
        asBuffer(data)
    )

    return result
}

/**
 * Converts a Uint8Array buffer to a UTF-8 text string.
 * @param data - The buffer to convert.
 * @returns The decoded text string.
 */
export function BufferToText(data:Uint8Array){
    if(!TextDecoder){
        return Buffer.from(data).toString('utf-8')
    }
    return new TextDecoder().decode(data)
}

/**
 * Encodes a multilingual string object into a formatted string.
 * @param data - Object with language codes as keys and translations as values.
 * @returns The encoded multilingual string.
 */
export function encodeMultilangString(data:{[code:string]:string}){
    let result = ''
    if(data.xx){
        result = data.xx
    }
    for(const key in data){
        result = `${result}\n# \`${key}\`\n${data[key]}`
    }
    return result
}

/**
 * Parses a formatted multilingual string into a language code object.
 * @param data - The encoded multilingual string.
 * @returns Object with language codes as keys and translations as values.
 */
export function parseMultilangString(data:string){
    const result:{[code:string]:string} = {}
    const regex = /# `(.+?)`\n([\s\S]+?)(?=\n# `|$)/g
    let m:RegExpExecArray
    while ((m = regex.exec(data)) !== null) {
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        result[m[1]] = m[2]
    }
    result.xx = data.replace(regex, '')
    return result
}

/**
 * Converts a language code to its display name.
 * @param code - The ISO language code.
 * @returns The localized language name.
 */
export const toLangName = (code:string) => {
    try {
        switch(code){
            case 'xx':{ //Special case for unknown language
                return 'Unknown Language'
            }
            default:{
                return new Intl.DisplayNames([code, 'en'], {type: 'language'}).of(code)
            }
        }   
    } catch (error) {
        return code
    }
}

/**
 * Capitalizes the first character of a string.
 * @param s - The string to capitalize.
 * @returns The string with the first character capitalized.
 */
export const capitalize = (s:string) => {
    return s.charAt(0).toUpperCase() + s.slice(1)
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

export const languageCodes = ["af","ak","am","an","ar","as","ay","az","be","bg","bh","bm","bn","br","bs","ca","co","cs","cy","da","de","dv","ee","el","en","eo","es","et","eu","fa","fi","fo","fr","fy","ga","gd","gl","gn","gu","ha","he","hi","hr","ht","hu","hy","ia","id","ig","is","it","iu","ja","jv","ka","kk","km","kn","ko","ku","ky","la","lb","lg","ln","lo","lt","lv","mg","mi","mk","ml","mn","mr","ms","mt","my","nb","ne","nl","nn","no","ny","oc","om","or","pa","pl","ps","pt","qu","rm","ro","ru","rw","sa","sd","si","sk","sl","sm","sn","so","sq","sr","st","su","sv","sw","ta","te","tg","th","ti","tk","tl","tn","to","tr","ts","tt","tw","ug","uk","ur","uz","vi","wa","wo","xh","yi","yo","zh","zu"]

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
 * Checks if the last character of a string is a punctuation mark.
 * @param s - The string to check.
 * @returns True if the last character is punctuation, false otherwise.
 */
export function isLastCharPunctuation(s:string){
    const lastChar = s.trim().at(-1)
    const punctuation = [
        '.', '!', '?', '。', '！', '？', '…', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '+', '=', '{', '}', '[', ']', '|', '\\', ':', ';', '<', '>', ',', '.', '/', '~', '`', ' ',
        '¡', '¿', '‽', '⁉', "'", '"'
    ]
    if(lastChar && !(punctuation.indexOf(lastChar) !== -1
        //spacing modifier letters
        || (lastChar.charCodeAt(0) >= 0x02B0 && lastChar.charCodeAt(0) <= 0x02FF)
        //combining diacritical marks
        || (lastChar.charCodeAt(0) >= 0x0300 && lastChar.charCodeAt(0) <= 0x036F)
        //hebrew punctuation
        || (lastChar.charCodeAt(0) >= 0x0590 && lastChar.charCodeAt(0) <= 0x05CF)
        //CJK symbols and punctuation
        || (lastChar.charCodeAt(0) >= 0x3000 && lastChar.charCodeAt(0) <= 0x303F)
    )){
        return false
    }
    return true
}

/**
 * Trims characters from the end of a string until a punctuation mark is reached.
 * @param s - The string to trim.
 * @returns The trimmed string ending with punctuation.
 */
export function trimUntilPunctuation(s:string){
    let result = s
    while(result.length > 0 && !isLastCharPunctuation(result)){
        result = result.slice(0, -1)
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
export function appendLastPath(url, lastPath) {
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
    } catch (error) {
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
        type:'text'|undefined,
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
            } else if((key && value)){
                keyValue.push({
                    key,
                    value,
                    type: type === 'select' || type === 'text' ? type : undefined,
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
    onMove: (event) => {
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
 */
export function simplifySchema(schema:any, args:{
    upperType?:boolean,
} = {}){
    if(!schema || typeof schema !== 'object'){
        console.error('Schema is not an object', schema)
        return schema
    }


    if(Array.isArray(schema.type)){
        if(schema.type.includes('null')){
            schema.nullable = true
        }
        schema.type = (schema.type as string[]).filter(v => v !== 'null')[0]
    }
    
    console.log('schema',schema)
    const result:any = {
    }

    if(schema.type){
        result.type = (schema.type as string)?.toLowerCase()
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
    if(schema.type === 'array'){
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
        result.anyOf = schema.anyOf.map((v:any) => simplifySchema(v, args))
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

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/**
 * Splits a string into an array of grapheme clusters.
 * @param str - The string to split.
 * @returns An array of grapheme clusters.
 */
export function toGraphemes(str: string): string[] {
    return [...graphemeSegmenter.segment(str)].map(s => s.segment)
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
 * Generates a list of valid ISO 639-1 language codes with localized display names.
 * Iterates through all possible two-letter combinations (AA-ZZ),
 * uses the browser's Intl.DisplayNames API to filter only valid language codes,
 * and returns them with names displayed in the specified UI language.
 * @param uiLanguage - The UI language code to display language names in (e.g., 'en', 'ko', 'cn').
 * @returns An array of language objects sorted by localized name.
 */
export function getLanguageCodes(uiLanguage: string) {
    let languageCodes: {
        code: string;
        name: string;
    }[] = [];

    for (let i = 0x41; i <= 0x5A; i++) {
        for (let j = 0x41; j <= 0x5A; j++) {
            languageCodes.push({
                code: String.fromCharCode(i) + String.fromCharCode(j),
                name: ''
            });
        }
    }

    languageCodes = languageCodes.map(v => {
        return {
            code: v.code.toLocaleLowerCase(),
            name: new Intl.DisplayNames([
                uiLanguage === 'cn' ? 'zh' : uiLanguage
            ], {
                type: 'language',
                fallback: 'none'
            }).of(v.code)
        };
    }).filter((a) => {
        return a.name;
    }).sort((a, b) => a.name.localeCompare(b.name));

    return languageCodes;
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
