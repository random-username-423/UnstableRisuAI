import { writeFile } from "@tauri-apps/plugin-fs"
import { save } from "@tauri-apps/plugin-dialog"
import { AppendableBuffer } from './fetch'
import { isTauri, isMobileTauri } from "./env"

/**
 * A writer class for Tauri environment.
 */
export class TauriWriter{
    path: string
    firstWrite: boolean = true

    /**
     * Creates an instance of TauriWriter.
     *
     * @param {string} path - The file path to write to.
     */
    constructor(path: string){
        this.path = path
    }

    /**
     * Writes data to the file.
     *
     * @param {Uint8Array} data - The data to write.
     */
    async write(data:Uint8Array) {
        await writeFile(this.path, data, {
            append: !this.firstWrite
        })
        this.firstWrite = false
    }

    /**
     * Closes the writer. (No operation for TauriWriter)
     */
    async close(){
        // do nothing
    }
}

/**
 * A streaming writer for mobile Tauri that writes directly to Android's Downloads folder.
 * Uses Rust commands for efficient file I/O without buffering in JS memory.
 */
export class MobileTauriWriter{
    filename: string
    filePath: string | null = null

    constructor(filename: string){
        this.filename = filename
    }

    async write(data:Uint8Array) {
        const { invoke } = await import('@tauri-apps/api/core')

        if (!this.filePath) {
            // First write: create file
            this.filePath = await invoke('create_download_file', {
                filename: this.filename
            }) as string
        }

        // Append data
        await invoke('append_download_file', {
            path: this.filePath,
            data: Array.from(data)
        })
    }

    async close(){
        // File is already written, nothing to do
    }
}

/**
 * Class representing a local writer.
 */
export class LocalWriter {
    writer: WritableStreamDefaultWriter | TauriWriter | MobileTauriWriter

    /**
     * Initializes the writer.
     *
     * @param {string} [name='Binary'] - The name of the file.
     * @param {string[]} [ext=['bin']] - The file extensions.
     * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating success.
     */
    async init(name = 'Binary', ext = ['bin']): Promise<boolean> {
        if (isTauri && !isMobileTauri) {
            // Desktop Tauri: use native save dialog + streaming writer
            const filePath = await save({
                filters: [{
                    name: name,
                    extensions: ext
                }]
            });
            if (!filePath) {
                return false
            }
            this.writer = new TauriWriter(filePath)
            return true
        }
        if (isMobileTauri) {
            // Mobile Tauri: streaming write to /storage/emulated/0/Download/
            this.writer = new MobileTauriWriter(name + '.' + ext[0])
            return true
        }
        // Web: use streamsaver
        const streamSaver = await import('streamsaver')
        const writableStream = streamSaver.createWriteStream(name + '.' + ext[0])
        this.writer = writableStream.getWriter()
        return true
    }

    /**
     * Writes backup data to the file.
     *
     * @param {string} name - The name of the backup.
     * @param {Uint8Array} data - The data to write.
     */
    async writeBackup(name: string, data: Uint8Array): Promise<void> {
        const encodedName = new TextEncoder().encode(name)
        const nameLength = new Uint32Array([encodedName.byteLength])
        await this.writer.write(new Uint8Array(nameLength.buffer))
        await this.writer.write(encodedName)
        const dataLength = new Uint32Array([data.byteLength])
        await this.writer.write(new Uint8Array(dataLength.buffer))
        await this.writer.write(data)
    }

    /**
     * Writes data to the file.
     *
     * @param {Uint8Array} data - The data to write.
     */
    async write(data: Uint8Array): Promise<void> {
        await this.writer.write(data)
    }

    /**
     * Closes the writer.
     */
    async close(): Promise<void> {
        await this.writer.close()
    }
}

/**
 * Class representing a virtual writer.
 */
export class VirtualWriter {
    buf = new AppendableBuffer()

    /**
     * Writes data to the buffer.
     *
     * @param {Uint8Array} data - The data to write.
     */
    async write(data: Uint8Array): Promise<void> {
        this.buf.append(data)
    }

    /**
     * Closes the writer. (No operation for VirtualWriter)
     */
    async close(): Promise<void> {
        // do nothing
    }
}

/**
 * A class that provides a blank writer implementation.
 *
 * This class is used to provide a no-op implementation of a writer, making it compatible with other writer interfaces.
 */
export class BlankWriter{
    constructor(){
    }

    /**
     * Initializes the writer.
     *
     * This method does nothing and is provided for compatibility with other writer interfaces.
     */
    async init(){
        //do nothing, just to make compatible with other writer
    }

    /**
     * Writes data to the writer.
     *
     * This method does nothing and is provided for compatibility with other writer interfaces.
     *
     * @param {string} key - The key associated with the data.
     * @param {Uint8Array|string} data - The data to be written.
     */
    async write(key:string,data:Uint8Array|string){
        //do nothing, just to make compatible with other writer
    }

    /**
     * Ends the writing process.
     *
     * This method does nothing and is provided for compatibility with other writer interfaces.
     */
    async end(){
        //do nothing, just to make compatible with other writer
    }
}
