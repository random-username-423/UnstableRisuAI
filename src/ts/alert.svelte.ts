import { language } from "../lang"
import { isTauri, isNodeServer, isCapacitor } from "src/ts/platform"
import { getDatabase } from "./storage/database.svelte"
import { type MessageGenerationInfo } from './storage/types/chat'
import { alertState } from "./stores.svelte"

export interface alertData {
    type: 'error' | 'normal' | 'none' | 'ask' | 'wait' | 'selectChar'
    | 'input' | 'wait2' | 'markdown' | 'select' | 'login'
    | 'tos' | 'cardexport' | 'requestdata' | 'addchar' | 'hypaV2' | 'selectModule'
    | 'chatOptions' | 'branches' | 'progress' | 'pluginconfirm' | 'requestlogs',
    msg: string,
    submsg?: string
    datalist?: [string, string][],
    stackTrace?: string;
}

type AlertGenerationInfoStateData = {
    genInfo: MessageGenerationInfo,
    idx: number
}

export const alertGenerationInfoState = $state({} as AlertGenerationInfoStateData)

export function alertError(msg: string | Error) {
    console.error(msg)
    const db = getDatabase()

    let stackTrace: string | undefined = undefined;

    if (typeof (msg) !== 'string') {
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

    const ignoredErrors = [
        '{}'
    ]

    if (ignoredErrors.includes(msg)) {
        return
    }

    let submsg = ''

    //check if it's a known error
    if (msg.includes('Failed to fetch') || msg.includes("NetworkError when attempting to fetch resource.")) {
        submsg = db.usePlainFetch ? language.errors.networkFetchPlain :
            (!isTauri && !isNodeServer && !isCapacitor) ? language.errors.networkFetchWeb : language.errors.networkFetch
    }

    alertState.type = 'error'
    alertState.msg = msg
    alertState.submsg = submsg
    alertState.stackTrace = stackTrace
}

export async function waitAlert() {
    // Return immediately if already closed
    if (alertState.type === 'none') {
        return alertState.msg
    }

    // Wait reactively using Svelte $effect instead of polling
    return new Promise<string>((resolve) => {
        const cleanup = $effect.root(() => {
            $effect(() => {
                if (alertState.type === 'none') {
                    cleanup()
                    resolve(alertState.msg)
                }
            })
        })
    })
}

export function alertNormal(msg: string) {
    alertState.type = 'normal'
    alertState.msg = msg
}

export async function alertNormalWait(msg: string) {
    alertState.type = 'normal'
    alertState.msg = msg
    await waitAlert()
}

export async function alertAddCharacter() {
    alertState.type = 'addchar'
    alertState.msg = language.addCharacter
    await waitAlert()

    return alertState.msg
}

export async function alertChatOptions() {
    alertState.type = 'chatOptions'
    alertState.msg = language.chatOptions
    await waitAlert()

    return parseInt(alertState.msg)
}

export async function alertLogin() {
    alertState.type = 'login'
    alertState.msg = 'login'
    await waitAlert()

    return alertState.msg
}

export async function alertSelect(msg: string[], display?: string) {
    const message = display !== undefined ? `__DISPLAY__${display}||${msg.join('||')}` : msg.join('||')
    alertState.type = 'select'
    alertState.msg = message

    await waitAlert()

    return alertState.msg
}

export function alertWaitOpaque(msg: string) {
    alertState.type = 'wait2'
    alertState.msg = msg
}

export function alertMd(msg: string) {
    alertState.type = 'markdown'
    alertState.msg = msg
}

export function doingAlert() {
    return alertState.type !== 'none' && alertState.type !== 'wait'
}

export function alertWait(msg: string) {
    alertState.type = 'wait'
    alertState.msg = msg
}


export function alertClear(msg: string = "") {
    alertState.type = 'none'
    alertState.msg = msg
    alertState.submsg = undefined
    alertState.datalist = undefined
    alertState.stackTrace = undefined
}

export async function alertSelectChar() {
    alertState.type = 'selectChar'
    alertState.msg = ''

    await waitAlert()

    return alertState.msg
}

export async function alertConfirm(msg: string) {

    alertState.type = 'ask'
    alertState.msg = msg

    await waitAlert()

    return alertState.msg === 'yes'
}

export async function alertPluginConfirm(msg: string) {

    alertState.type = 'pluginconfirm'
    alertState.msg = msg

    await waitAlert()

    return alertState.msg === 'yes'
}

export async function alertCardExport(type: string = '') {

    alertState.type = 'cardexport'
    alertState.msg = ''
    alertState.submsg = type

    await waitAlert()

    return JSON.parse(alertState.msg) as {
        type: string,
        type2: string,
    }
}

export async function alertTOS() {

    if (localStorage.getItem('tos2') === 'true') {
        return true
    }

    alertState.type = 'tos'
    alertState.msg = 'tos'

    await waitAlert()

    if (alertState.msg === 'yes') {
        localStorage.setItem('tos2', 'true')
        return true
    }

    return false
}

export async function alertInput(msg: string, datalist?: [string, string][]) {

    alertState.type = 'input'
    alertState.msg = msg
    alertState.datalist = datalist ?? []

    await waitAlert()

    return alertState.msg
}

export async function alertModuleSelect() {

    alertState.type = 'selectModule'
    alertState.msg = ''

    await waitAlert()

    return alertState.msg
}

export function alertRequestData(info: AlertGenerationInfoStateData) {
    Object.assign(alertGenerationInfoState, info)
    alertState.type = 'requestdata'
    alertState.msg = info.genInfo.generationId ?? 'none'
}

export function showHypaV2Alert() {
    alertState.type = 'hypaV2'
    alertState.msg = ""
}

export function alertBranches() {
    alertState.type = 'branches'
    alertState.msg = ''
}

export function alertProgress(msg: string = '', submsg: string = '') {
    alertState.type = 'progress'
    alertState.msg = msg
    alertState.submsg = submsg
}
