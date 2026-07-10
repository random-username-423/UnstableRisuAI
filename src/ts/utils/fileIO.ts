import { writeFile, BaseDirectory, readFile } from "@tauri-apps/plugin-fs"
import { sleep } from "./util"
import { convertFileSrc } from "@tauri-apps/api/core"
import { v4 as uuidv4 } from "uuid"
import { appDataDir, join } from "@tauri-apps/api/path"
import { hasher } from "./parser.svelte"
import { hubURL } from "../character/characterCards.svelte"
import { forageStorage } from "../data/storage/autoStorage"
import { isTauri, isMobileTauri } from "./env"

export async function downloadFile(name: string, dat: Uint8Array | ArrayBuffer | string) {
    if (typeof dat === "string") {
        dat = Buffer.from(dat, "utf-8")
    }
    const data = new Uint8Array(dat)

    if (isTauri && !isMobileTauri) {
        // Desktop Tauri: write to Downloads folder
        await writeFile(name, data, { baseDir: BaseDirectory.Download })
    } else if (isMobileTauri) {
        // Mobile Tauri: use Rust commands to write to /storage/emulated/0/Download/
        const { invoke } = await import("@tauri-apps/api/core")
        const path = await invoke("create_download_file", { filename: name })
        await invoke("append_download_file", { path, data: Array.from(data) })
    } else {
        // Web: use blob download
        const blob = new Blob([data], { type: "application/octet-stream" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = name
        document.body.appendChild(a)
        a.style.display = "none"
        a.click()
        a.remove()
        setTimeout(() => {
            URL.revokeObjectURL(url)
        }, 10000)
    }
}

const fileCache: {
    origin: string[]
    res: (Uint8Array | "loading" | "done")[]
} = {
    origin: [],
    res: [],
}

// 에셋 파일 캐시 (IndexedDB 로드 결과를 캐싱)
const assetFileCache: { [key: string]: string | "loading" | null } = {}

let appDataDirPath = ""

/**
 * Gets the source URL of a file.
 *
 * @param {string} loc - The location of the file.
 * @returns {Promise<string>} - A promise that resolves to the source URL of the file.
 */
// 디버그용 카운터
let getFileSrcCallCount = 0

export async function getFileSrc(loc: string) {
    const callId = ++getFileSrcCallCount
    const shouldLog = callId <= 5
    if (shouldLog) {
        console.log(`[getFileSrc #${callId}] START loc="${loc}"`)
    }
    if (isTauri) {
        if (loc.startsWith("assets")) {
            // 캐시 확인
            const cached = assetFileCache[loc]
            if (cached && cached !== "loading") {
                return cached
            }
            if (cached === "loading") {
                // 다른 호출이 로딩 중이면 대기
                while (assetFileCache[loc] === "loading") {
                    await sleep(10)
                }
                return assetFileCache[loc] || ""
            }

            // 로딩 시작
            assetFileCache[loc] = "loading"

            // IndexedDB (forageStorage)에서 로드
            try {
                const data = (await forageStorage.getItem(loc)) as unknown as Uint8Array
                if (data && data.byteLength > 0) {
                    const dataUrl = `data:image/png;base64,${Buffer.from(data).toString("base64")}`
                    assetFileCache[loc] = dataUrl
                    return dataUrl
                }
            } catch (e) {
                // IndexedDB 실패 시 무시하고 폴백
            }

            // 폴백: 기존 Tauri fs (마이그레이션 전 레거시 데이터용)
            if (appDataDirPath === "") {
                appDataDirPath = await appDataDir()
            }
            const joined = await join(appDataDirPath, loc)
            const result = convertFileSrc(joined)
            assetFileCache[loc] = result
            return result
        }
        return convertFileSrc(loc)
    }
    if (forageStorage.isAccount && loc.startsWith("assets")) {
        if (shouldLog) console.log(`[getFileSrc #${callId}] → Account hub URL`)
        return hubURL + `/rs/` + loc
    }
    try {
        if (navigator.serviceWorker) {
            const encoded = Buffer.from(loc, "utf-8").toString("hex")
            let ind = fileCache.origin.indexOf(loc)
            if (ind === -1) {
                ind = fileCache.origin.length
                fileCache.origin.push(loc)
                fileCache.res.push("loading")
                try {
                    const hasCache: boolean = (await (await fetch("/sw/check/" + encoded)).json()).able
                    if (hasCache) {
                        if (shouldLog) console.log(`[getFileSrc #${callId}] → SW cache HIT`)
                        fileCache.res[ind] = "done"
                        return "/sw/img/" + encoded
                    } else {
                        if (shouldLog)
                            console.log(`[getFileSrc #${callId}] → SW cache MISS, loading from forageStorage...`)
                        const f: Uint8Array = (await forageStorage.getItem(loc)) as unknown as Uint8Array
                        if (shouldLog)
                            console.log(
                                `[getFileSrc #${callId}] → forageStorage returned: ${f ? f.byteLength + " bytes" : "null"}`
                            )
                        await fetch("/sw/register/" + encoded, {
                            method: "POST",
                            body: f as any,
                        })
                        fileCache.res[ind] = "done"
                        await sleep(10)
                    }
                    return "/sw/img/" + encoded
                } catch {
                    /* ignore */
                }
            } else {
                const f = fileCache.res[ind]
                if (f === "loading") {
                    while (fileCache.res[ind] === "loading") {
                        await sleep(10)
                    }
                }
                return "/sw/img/" + encoded
            }
        } else {
            let ind = fileCache.origin.indexOf(loc)
            if (ind === -1) {
                ind = fileCache.origin.length
                fileCache.origin.push(loc)
                fileCache.res.push("loading")
                const f: Uint8Array = (await forageStorage.getItem(loc)) as unknown as Uint8Array
                fileCache.res[ind] = f
                return `data:image/png;base64,${Buffer.from(f).toString("base64")}`
            } else {
                const f = fileCache.res[ind]
                if (f === "loading") {
                    while (fileCache.res[ind] === "loading") {
                        await sleep(10)
                    }
                    return `data:image/png;base64,${Buffer.from(fileCache.res[ind]).toString("base64")}`
                }
                return `data:image/png;base64,${Buffer.from(f).toString("base64")}`
            }
        }
    } catch (error) {
        console.error(error)
        return ""
    }
}

/**
 * Reads an image file and returns its data.
 *
 * @param {string} data - The path to the image file.
 * @returns {Promise<Uint8Array<ArrayBuffer> | null>} - A promise that resolves to the data of the image file.
 */
export async function readImage(data: string): Promise<Uint8Array<ArrayBuffer> | null> {
    // Assets are stored in IndexedDB (forageStorage) for all platforms
    const result = (await forageStorage.getItem(data)) as unknown as Uint8Array<ArrayBuffer>
    if (result) {
        return result
    }
    // Fallback to Tauri fs for legacy data
    if (isTauri) {
        try {
            if (data.startsWith("assets")) {
                if (appDataDirPath === "") {
                    appDataDirPath = await appDataDir()
                }
                return (await readFile(await join(appDataDirPath, data))) as Uint8Array<ArrayBuffer>
            }
            return (await readFile(data)) as Uint8Array<ArrayBuffer>
        } catch (e) {
            return null
        }
    }
    return null
}

/**
 * Saves an asset file with the given data, custom ID, and file name.
 *
 * @param {Uint8Array} data - The data of the asset file.
 * @param {string} [customId=''] - The custom ID for the asset file.
 * @param {string} [fileName=''] - The name of the asset file.
 * @returns {Promise<string>} - A promise that resolves to the path of the saved asset file.
 */
export async function saveAsset(data: Uint8Array<ArrayBuffer>, customId: string = "", fileName: string = "") {
    let id = ""
    if (customId !== "") {
        id = customId
    } else {
        try {
            id = await hasher(data)
        } catch (error) {
            id = uuidv4()
        }
    }
    let fileExtension: string = "png"
    if (fileName && fileName.split(".").length > 0) {
        fileExtension = fileName.split(".").pop()
    }
    const form = `assets/${id}.${fileExtension}`
    // Tauri와 웹 모두 IndexedDB (forageStorage) 사용
    const replacer = await forageStorage.setItem(form, data)
    if (replacer) {
        return replacer
    }
    return form
}

/**
 * Loads an asset file with the given ID.
 *
 * @param {string} id - The ID of the asset file to load.
 * @returns {Promise<Uint8Array<ArrayBuffer> | null>} - A promise that resolves to the data of the loaded asset file.
 */
export async function loadAsset(id: string): Promise<Uint8Array<ArrayBuffer> | null> {
    // Tauri와 웹 모두 IndexedDB (forageStorage) 사용
    const data = (await forageStorage.getItem(id)) as unknown as Uint8Array<ArrayBuffer>
    if (data) {
        return data
    }
    // 폴백: Tauri fs (마이그레이션 전 레거시 데이터용)
    if (isTauri) {
        try {
            return (await readFile(id, { baseDir: BaseDirectory.AppData })) as Uint8Array<ArrayBuffer>
        } catch {
            return null
        }
    }
    return null
}
