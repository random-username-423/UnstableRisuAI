import { sleep } from "./util"
import { language } from "../../lang"
import { isNodeServer, isTauri } from "./env"
import { getDatabase } from "../data/storage/database.svelte"
import type { MessageGenerationInfo } from "../data/storage/types"
import { ModalState } from "../stores.svelte"

export interface alertData {
    type:
        | "error"
        | "normal"
        | "none"
        | "ask"
        | "wait"
        | "selectChar"
        | "input"
        | "toast"
        | "wait2"
        | "markdown"
        | "select"
        | "login"
        | "tos"
        | "cardexport"
        | "requestdata"
        | "addchar"
        | "hypaV2"
        | "selectModule"
        | "chatOptions"
        | "pukmakkurit"
        | "branches"
        | "progress"
        | "pluginconfirm"
    msg: string
    submsg?: string
    datalist?: [string, string][]
    stackTrace?: string
}

export type AlertGenerationInfoData = {
    genInfo: MessageGenerationInfo
    idx: number
}
export const AlertGenerationInfoState = $state({
    data: null as AlertGenerationInfoData | null,
})
export const alertStore = {
    set: (d: alertData) => {
        ModalState.alert = d
    },
}

export function alertError(msg: string | Error) {
    console.error(msg)
    const db = getDatabase()

    let stackTrace: string | undefined = undefined

    if (typeof msg !== "string") {
        try {
            if (msg instanceof Error) {
                stackTrace = msg.stack
                msg = msg.message
            } else {
                msg = JSON.stringify(msg)
            }
        } catch {
            msg = `${msg}`
        }
    }

    msg = msg.trim()

    const ignoredErrors = ["{}"]

    if (ignoredErrors.includes(msg)) {
        return
    }

    let submsg = ""

    //check if it's a known error
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError when attempting to fetch resource.")) {
        submsg = db.usePlainFetch
            ? language.errors.networkFetchPlain
            : !isTauri && !isNodeServer
              ? language.errors.networkFetchWeb
              : language.errors.networkFetch
    }

    ModalState.alert = {
        type: "error",
        msg: msg,
        submsg: submsg,
        stackTrace: stackTrace,
    }
}

export async function waitAlert() {
    while (true) {
        if (ModalState.alert.type === "none") {
            break
        }
        await sleep(10)
    }
}

export function alertNormal(msg: string) {
    ModalState.alert = {
        type: "normal",
        msg: msg,
    }
}

export async function alertNormalWait(msg: string) {
    ModalState.alert = {
        type: "normal",
        msg: msg,
    }
    await waitAlert()
}

export async function alertAddCharacter() {
    ModalState.alert = {
        type: "addchar",
        msg: language.addCharacter,
    }
    await waitAlert()

    return ModalState.alert.msg
}

export async function alertChatOptions() {
    ModalState.alert = {
        type: "chatOptions",
        msg: language.chatOptions,
    }
    await waitAlert()

    return parseInt(ModalState.alert.msg)
}

export async function alertLogin() {
    ModalState.alert = {
        type: "login",
        msg: "login",
    }
    await waitAlert()

    return ModalState.alert.msg
}

export async function alertSelect(msg: string[], display?: string) {
    const message = display !== undefined ? `__DISPLAY__${display}||${msg.join("||")}` : msg.join("||")
    ModalState.alert = {
        type: "select",
        msg: message,
    }

    await waitAlert()

    return ModalState.alert.msg
}

export async function alertErrorWait(msg: string) {
    ModalState.alert = {
        type: "wait2",
        msg: msg,
    }
    await waitAlert()
}

export function alertMd(msg: string) {
    ModalState.alert = {
        type: "markdown",
        msg: msg,
    }
}

export function doingAlert() {
    return ModalState.alert.type !== "none" && ModalState.alert.type !== "toast" && ModalState.alert.type !== "wait"
}

export function alertToast(msg: string) {
    ModalState.alert = {
        type: "toast",
        msg: msg,
    }
}

export function alertWait(msg: string) {
    ModalState.alert = {
        type: "wait",
        msg: msg,
    }
}

export function alertClear() {
    ModalState.alert = {
        type: "none",
        msg: "",
    }
}

export async function alertSelectChar() {
    ModalState.alert = {
        type: "selectChar",
        msg: "",
    }

    await waitAlert()

    return ModalState.alert.msg
}

export async function alertConfirm(msg: string) {
    ModalState.alert = {
        type: "ask",
        msg: msg,
    }

    await waitAlert()

    return ModalState.alert.msg === "yes"
}

export async function alertPluginConfirm(msg: string) {
    ModalState.alert = {
        type: "pluginconfirm",
        msg: msg,
    }

    await waitAlert()

    return ModalState.alert.msg === "yes"
}

export async function alertCardExport(type: string = "") {
    ModalState.alert = {
        type: "cardexport",
        msg: "",
        submsg: type,
    }

    await waitAlert()

    return JSON.parse(ModalState.alert.msg) as {
        type: string
        type2: string
    }
}

export async function alertTOS() {
    if (localStorage.getItem("tos2") === "true") {
        return true
    }

    ModalState.alert = {
        type: "tos",
        msg: "tos",
    }

    await waitAlert()

    if (ModalState.alert.msg === "yes") {
        localStorage.setItem("tos2", "true")
        return true
    }

    return false
}

export async function alertInput(msg: string, datalist?: [string, string][]) {
    ModalState.alert = {
        type: "input",
        msg: msg,
        datalist: datalist ?? [],
    }

    await waitAlert()

    return ModalState.alert.msg
}

export async function alertModuleSelect() {
    ModalState.alert = {
        type: "selectModule",
        msg: "",
    }

    while (true) {
        if (ModalState.alert.type === "none") {
            break
        }
        await sleep(20)
    }

    return ModalState.alert.msg
}

export function alertRequestData(info: AlertGenerationInfoData) {
    AlertGenerationInfoState.data = info
    ModalState.alert = {
        type: "requestdata",
        msg: info.genInfo.generationId ?? "none",
    }
}

export function showHypaV2Alert() {
    ModalState.alert = {
        type: "hypaV2",
        msg: "",
    }
}
