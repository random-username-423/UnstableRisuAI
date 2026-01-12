import { findCharacterbyId } from "../characters.svelte"
import type { character } from "../storage/types/character"
import type { Chat } from "../storage/types/chat"
import { risuChatParser } from "./scripts"
import { type OpenAIChat } from "./types"

export function systemizeChat(chat: OpenAIChat[]) {
    for (let i = 0; i < chat.length; i++) {
        if (chat[i].role === 'user' || chat[i].role === 'assistant') {
            const attr = chat[i].attr ?? []
            if (chat[i].name?.startsWith('example_')) {
                chat[i].content = chat[i].name + ': ' + chat[i].content
            }
            else if (!attr.includes('nameAdded')) {
                chat[i].content = chat[i].role + ': ' + chat[i].content
            }
            chat[i].role = 'system'
            delete chat[i].memo
            delete chat[i].name
        }
    }
    return chat
}

export function shuffleArray(array: string[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]
    }
    return array
}

export function formatPrompt(data: string) {
    if (!data.startsWith('@@')) {
        data = "@@system\n" + data
    }
    const parts = data.split(/@@@?(user|assistant|system)\n/)

    // Initialize empty array for the chat objects
    const chatObjects: OpenAIChat[] = []

    // Loop through the parts array two elements at a time
    for (let i = 1; i < parts.length; i += 2) {
        const role = parts[i] as 'user' | 'assistant' | 'system'
        const content = parts[i + 1]?.trim() || ''
        chatObjects.push({ role, content })
    }

    return chatObjects
}

export function reformatContent(data: string) {
    // if (chatProcessIndex === -1) {
    //     return data.trim()
    // }
    return data.trim()
}

// Cache for character lookups to avoid repeated findCharacterbyId() calls
// This improves performance especially in group chats where the same character is referenced multiple times
const findCharCache: { [key: string]: character } = {}
export function findCharacterbyIdwithCache(id: string) {
    const d = findCharCache[id]
    if (d) {
        return d
    }
    else {
        const r = findCharacterbyId(id)
        findCharCache[id] = r
        return r
    }
}

export function parseChatTemplates(chat: Chat, character: character) {
    chat.message = chat.message.map((v) => {
        v.data = risuChatParser(v.data, { chara: character, runVar: true })
        return v
    })
    return chat
}