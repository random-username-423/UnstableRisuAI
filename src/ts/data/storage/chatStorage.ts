import { getDatabase } from "./database.svelte"
import type { Chat } from "./types"
import { encodeChat, decodeChat } from "./risuSave"
import { saveToWorker, loadFromWorker } from "./opfsWorkerClient.svelte"
import { syncManager } from "../drive/syncManager"
import { untrack } from "svelte"

// Cache for in-progress loadChat calls to prevent duplicate concurrent loads
const loadingPromises = new Map<string, Promise<Chat | null>>()

/**
 * Loads a chat's full data from individual file (lazy loading).
 * Updates the chat in the character's chats array with message data.
 * Uses Promise caching to prevent duplicate concurrent loads.
 *
 * @param chaId - Character ID
 * @param chatId - Chat ID
 * @returns The loaded chat, or null if not found
 */
export async function loadChat(chaId: string, chatId: string): Promise<Chat | null> {
    const db = getDatabase()
    const char = db.characters.find(c => c.chaId === chaId)
    if (!char) {
        console.warn(`[loadChat] Character not found: ${chaId}`)
        return null
    }

    const chatIndex = char.chats.findIndex(c => c.id === chatId)
    if (chatIndex === -1) {
        console.warn(`[loadChat] Chat not found: ${chatId}`)
        return null
    }

    const chat = char.chats[chatIndex]

    // Already loaded
    if (chat.message !== undefined) {
        return chat
    }

    // Check if already loading - return existing promise to prevent duplicate loads
    const cacheKey = `${chaId}_${chatId}`
    const existingPromise = loadingPromises.get(cacheKey)
    if (existingPromise) {
        console.log(`[loadChat] Already loading ${cacheKey}, returning existing promise`)
        return existingPromise
    }

    // Create and cache the loading promise
    const loadPromise = loadChatInternal(chaId, chatId, chat)
    loadingPromises.set(cacheKey, loadPromise)

    try {
        return await loadPromise
    } finally {
        loadingPromises.delete(cacheKey)
    }
}

/**
 * Internal function that performs the actual chat loading.
 */
async function loadChatInternal(chaId: string, chatId: string, chat: Chat): Promise<Chat | null> {
    try {
        const filePath = `database/chats/${chaId}/${chatId}.bin`
        console.log(`[loadChat] Loading file: ${filePath}`)
        const data = await loadFromWorker(filePath)
        console.log(`[loadChat] File load result:`, data ? `${data.byteLength} bytes` : 'null')
        if (!data) {
            console.warn(`[loadChat] Chat file not found: ${chaId}/${chatId}.bin`)
            // Initialize empty message array
            console.log(`[DEBUG chat.message=[]] chatStorage.ts:loadChat - file not found, chaId=${chaId}, chatId=${chatId}`)
            untrack(() => {
                chat.message = []
            })
            return chat
        }

        const fullChat = await decodeChat(data)
        if (!fullChat) {
            console.warn(`[loadChat] Failed to decode chat: ${chatId}`)
            console.log(`[DEBUG chat.message=[]] chatStorage.ts:loadChat - decode failed, chaId=${chaId}, chatId=${chatId}`)
            untrack(() => {
                chat.message = []
            })
            return chat
        }

        // Update chat with loaded data (preserve metadata, load message)
        // Use untrack to prevent triggering $effect (loading is not a "change")
        untrack(() => {
            chat.message = fullChat.message || []
            // Also update other fields that might be stored in the file
            if (fullChat.note !== undefined) chat.note = fullChat.note
            if (fullChat.localLore !== undefined) chat.localLore = fullChat.localLore
            if (fullChat.sdData !== undefined) chat.sdData = fullChat.sdData
            if (fullChat.supaMemoryData !== undefined) chat.supaMemoryData = fullChat.supaMemoryData
            if (fullChat.hypaV2Data !== undefined) chat.hypaV2Data = fullChat.hypaV2Data
            if (fullChat.hypaV3Data !== undefined) chat.hypaV3Data = fullChat.hypaV3Data
            if (fullChat.lastMemory !== undefined) chat.lastMemory = fullChat.lastMemory
            if (fullChat.suggestMessages !== undefined) chat.suggestMessages = fullChat.suggestMessages
            if (fullChat.scriptstate !== undefined) chat.scriptstate = fullChat.scriptstate
        })

        console.log(`[loadChat] Loaded chat ${chatId} for character ${chaId}`)
        return chat
    } catch (e) {
        console.error(`[loadChat] Error loading chat ${chatId}:`, e)
        console.log(`[DEBUG chat.message=[]] chatStorage.ts:loadChat - catch error, chaId=${chaId}, chatId=${chatId}`)
        untrack(() => {
            chat.message = []
        })
        return chat
    }
}

/**
 * Saves a single chat to its individual file.
 *
 * @param chaId - Character ID
 * @param chat - Chat to save
 */
export async function saveChat(chaId: string, chat: Chat): Promise<void> {
    if (!chat.id || !chaId) return

    // Don't save if message is not loaded (nothing to save)
    if (chat.message === undefined) return

    try {
        const now = Date.now()
        const chatToSave = { ...chat, modifiedAt: now }
        const encodedChat = await encodeChat(chatToSave)
        await saveToWorker(`database/chats/${chaId}/${chat.id}.bin`, encodedChat)

        // Update memory without triggering $effect
        untrack(() => {
            chat.modifiedAt = now
        })

        // Mark for sync (debounced)
        syncManager.markChatChanged(chaId, chat.id)
    } catch (e) {
        console.error(`[saveChat] Error saving chat ${chat.id}:`, e)
    }
}
