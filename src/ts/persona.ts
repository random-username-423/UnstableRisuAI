import { getDatabase, saveImage, setDatabase } from "./storage/database.svelte"
import { selectSingleFile, sleep } from "./util"
import { alertError, alertNormal, alertWait } from "./alert"
import { AppendableBuffer, downloadFile, readImage } from "./globalApi.svelte"
import { language } from "src/lang"
import { reencodeImage } from "./process/files/inlays"
import { PngChunk } from "./pngChunk"
import { v4 } from "uuid"
import { get } from "svelte/store"
import { selectedCharID } from "./stores.svelte"

export async function selectUserImg() {
    const selected = await selectSingleFile(['png'])
    if (!selected) {
        return
    }
    const img = selected.data
    const db = getDatabase()
    const imgp = await saveImage(img)
    db.userIcon = imgp
    db.personas[db.selectedPersona] = {
        ...db.personas[db.selectedPersona],
        name: db.username,
        icon: db.userIcon,
        personaPrompt: db.personaPrompt,
        note: db.userNote,
        id: v4()
    }
    setDatabase(db)
}

export function saveUserPersona() {
    const db = getDatabase()
    db.personas[db.selectedPersona].name = db.username
    db.personas[db.selectedPersona].icon = db.userIcon
    db.personas[db.selectedPersona].personaPrompt = db.personaPrompt
    db.personas[db.selectedPersona].note = db.userNote
    setDatabase(db)
}

export function changeUserPersona(id: number, save: 'save' | 'noSave' = 'save') {
    if (save === 'save') {
        saveUserPersona()
    }
    const db = getDatabase()
    const pr = db.personas[id]
    db.personaPrompt = pr.personaPrompt
    db.username = pr.name
    db.userIcon = pr.icon
    db.userNote = pr.note
    db.selectedPersona = id
    setDatabase(db)
}

interface PersonaCard {
    name: string
    personaPrompt: string
    note?: string
}

export async function exportUserPersona() {
    const db = getDatabase({ snapshot: true })
    if ((!db.username) || (!db.personaPrompt)) {
        alertError("username or persona prompt is empty")
        return
    }

    let img: Uint8Array
    if (!db.userIcon) {
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 256
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = 'rgb(100, 116, 139)'
        ctx.fillRect(0, 0, 256, 256)
        const dataUrl = canvas.toDataURL('image/png')
        const base64 = dataUrl.split(',')[1]
        img = new Uint8Array(Buffer.from(base64, 'base64'))
    } else {
        img = await readImage(db.userIcon)
    }

    const card: PersonaCard = safeStructuredClone({
        name: db.username,
        personaPrompt: db.personaPrompt,
        note: db.userNote,
    })

    alertWait('Loading... (Writing Exif)')

    await sleep(10)

    img = (await PngChunk.write(await reencodeImage(img), {
        "persona": Buffer.from(JSON.stringify(card)).toString('base64')
    })) as Uint8Array

    alertWait('Loading... (Writing)')

    await sleep(10)
    await downloadFile(`${db.username.replace(/[<>:"/\\|?*\.\,]/g, "")}_export.png`, img)

    alertNormal(language.successExport)
}

export async function importUserPersona() {
    try {
        const v = await selectSingleFile(['png'])
        if (!v) {
            return
        }
        const readGenerator = PngChunk.readGenerator(v.data)
        let decoded: string | undefined;

        for await (const chunk of readGenerator) {
            if (chunk && !(chunk instanceof AppendableBuffer) && chunk.key === 'persona') {
                decoded = chunk.value
                break
            }
        }

        if (!decoded) {
            alertError(language.errors.noData)
            return
        }
        const data: PersonaCard = JSON.parse(Buffer.from(decoded, 'base64').toString('utf-8'))
        if (data.name && data.personaPrompt) {
            const db = getDatabase()
            db.personas.push({
                name: data.name,
                icon: await saveImage(await reencodeImage(v.data)),
                personaPrompt: data.personaPrompt,
                note: data.note,
                id: v4()
            })
            setDatabase(db)
            alertNormal(language.successImport)
        } else {
            alertError(language.errors.noData)
        }
    } catch (error) {
        alertError(error)
        return
    }
}
export function getUserName() {
    const bindedPersona = checkPersonaBinded()
    if (bindedPersona) {
        return bindedPersona.name
    }
    const db = getDatabase()
    return db.username ?? 'User'
}export function checkPersonaBinded() {
    try {
        const db = getDatabase()
        const selectedChar = get(selectedCharID)
        const character = db.characters[selectedChar]
        const chat = character.chats[character.chatPage]
        if (!chat.bindedPersona) {
            return null
        }
        const persona = db.personas.find(v => v.id === chat.bindedPersona)
        return persona
    } catch (error) {
        return null
    }
}
export function getUserIcon() {
    const bindedPersona = checkPersonaBinded()
    if (bindedPersona) {
        return bindedPersona.icon
    }
    const db = getDatabase()
    return db.userIcon ?? ''
}
export function getPersonaPrompt() {
    const bindedPersona = checkPersonaBinded()
    if (bindedPersona) {
        return bindedPersona.personaPrompt
    }
    const db = getDatabase()
    return db.personaPrompt ?? ''
}
export function getUserIconProtrait() {
    try {
        const bindedPersona = checkPersonaBinded()
        if (bindedPersona) {
            return bindedPersona.largePortrait
        }
        const db = getDatabase()
        return db.personas[db.selectedPersona].largePortrait
    } catch (error) {
        return false
    }
}

