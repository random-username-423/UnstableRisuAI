/**
 * ChatRuntimeController
 *
 * Manages chat runtime state and business logic, separated from UI concerns.
 * This controller handles:
 * - Message input state (messageInput, fileInput)
 * - Chat sending logic (send, sendContinue, sendMain)
 * - Reroll history and navigation
 * - Auto mode for group chats
 * - Abort control for cancelling generation
 */

import { get } from 'svelte/store'
import { selectedCharID } from '../stores.svelte'
import { DBState } from '../stores.svelte'
import { sendChat, doingChat } from '../process/index.svelte'
import { alertError } from '../alert.svelte'
import { processScript } from '../process/scripts'
import { runTrigger } from '../process/triggers'
import { processMultiCommand } from '../process/command'
import { Prereroll, PreUnreroll } from '../process/prereroll'
import { ConnectionOpenStore } from '../sync/multiuser'
import { sleep } from '../utils/util'
import type { Message } from '../storage/types/chat'
import sendSound from '../../etc/send.mp3'

// Declare global safeStructuredClone from polyfill
declare const safeStructuredClone: <T>(data: T) => T

class ChatRuntimeController {
    // ============================================================
    // STATE
    // ============================================================

    // Input states
    messageInput = $state('')
    messageInputTranslate = $state('')
    fileInput = $state<string[]>([])

    // Auto mode (for group chats)
    autoMode = $state(false)

    // Reroll history management
    rerolls: Message[][] = []
    rerollid = -1
    private lastCharId = -1

    // Abort control
    abortController: AbortController | null = null

    // ============================================================
    // HOOKS (for DOM callbacks)
    // ============================================================

    private inputClearedCallbacks: Set<() => void> = new Set()
    private menuCloseCallbacks: Set<() => void> = new Set()

    /**
     * Register a callback to be called when input is cleared
     * @returns Unsubscribe function
     */
    registerOnInputCleared(cb: () => void): () => void {
        this.inputClearedCallbacks.add(cb)
        return () => this.inputClearedCallbacks.delete(cb)
    }

    /**
     * Register a callback to be called when menu should close
     * @returns Unsubscribe function
     */
    registerOnMenuClose(cb: () => void): () => void {
        this.menuCloseCallbacks.add(cb)
        return () => this.menuCloseCallbacks.delete(cb)
    }

    private notifyInputCleared() {
        this.inputClearedCallbacks.forEach(cb => cb())
    }

    private notifyMenuClose() {
        this.menuCloseCallbacks.forEach(cb => cb())
    }

    // ============================================================
    // CHAT ACTIONS
    // ============================================================

    /**
     * Send a new message (wrapper)
     */
    async send() {
        if (this.messageInput === '' && this.fileInput.length === 0) return
        await this.sendMain(false)
    }

    /**
     * Continue the AI's previous response (wrapper)
     */
    async sendContinue() {
        await this.sendMain(true)
    }

    /**
     * Main message sending logic
     * - Handles slash commands (/command)
     * - Processes file attachments (inlays)
     * - Runs input triggers and scripts
     * - Manages "say nothing" feature for empty input
     */
    async sendMain(continueResponse: boolean) {
        const selectedChar = get(selectedCharID)

        // Prevent sending while AI is generating
        if (get(doingChat)) {
            return
        }

        // Reset reroll history when switching characters
        if (this.lastCharId !== selectedChar) {
            this.rerolls = []
            this.rerollid = -1
        }

        let cha = DBState.db.characters[selectedChar].chats[DBState.db.characters[selectedChar].chatPage].message

        // Check for slash commands (e.g., /reset, /clear, etc.)
        if (this.messageInput.startsWith('/')) {
            const commandProcessed = await processMultiCommand(this.messageInput)
            if (commandProcessed !== false) {
                this.messageInput = ''
                return
            }
        }

        // Append inlay tags for attached files (images, videos, audio)
        if (this.fileInput.length > 0) {
            for (const file of this.fileInput) {
                this.messageInput += `{{inlayed::${file}}}`
            }
            this.fileInput = []
        }

        // Handle empty message input
        if (this.messageInput === '') {
            if (DBState.db.characters[selectedChar].type !== 'group') {
                // If last message wasn't from user, optionally add "says nothing"
                if (cha.length === 0 || cha[cha.length - 1].role !== 'user') {
                    if (DBState.db.useSayNothing) {
                        cha.push({
                            role: 'user',
                            data: '*says nothing*',
                            name: get(ConnectionOpenStore) ? DBState.db.username : null
                        })
                    }
                }
            }
        }
        else {
            // Process and add user message
            const char = DBState.db.characters[selectedChar]
            if (char.type === 'character') {
                // Run input trigger (custom automation)
                let triggerResult = await runTrigger(char, 'input', { chat: char.chats[char.chatPage] })
                if (triggerResult) {
                    cha = triggerResult.chat.message
                }

                // Process through editinput script and add message
                cha.push({
                    role: 'user',
                    data: await processScript(char, this.messageInput, 'editinput'),
                    time: Date.now(),
                    name: get(ConnectionOpenStore) ? DBState.db.username : null
                })
            }
            else {
                // Group chat - no script processing
                cha.push({
                    role: 'user',
                    data: this.messageInput,
                    time: Date.now(),
                    name: get(ConnectionOpenStore) ? DBState.db.username : null
                })
            }
        }

        // Clear input fields and save message
        this.messageInput = ''
        this.messageInputTranslate = ''
        DBState.db.characters[selectedChar].chats[DBState.db.characters[selectedChar].chatPage].message = cha
        this.rerolls = []
        await sleep(10)
        this.notifyInputCleared()

        // Trigger AI response generation
        await this.sendChatMain(continueResponse)
    }

    // ============================================================
    // REROLL FUNCTIONS
    // ============================================================

    /**
     * Regenerate the AI's last response (reroll forward)
     */
    async reroll() {
        // Prevent reroll while generating
        if (get(doingChat)) {
            return
        }

        // Reset reroll history when switching characters
        if (this.lastCharId !== get(selectedCharID)) {
            this.rerolls = []
            this.rerollid = -1
        }

        // Check for prereroll (cached streaming chunks)
        const genId = DBState.currentChat.message.at(-1)?.generationInfo?.generationId
        if (genId) {
            const r = Prereroll(genId)
            if (r) {
                DBState.currentChat.message[DBState.currentChat.message.length - 1].data = r
                return
            }
        }

        // Navigate forward in existing reroll history
        if (this.rerollid < this.rerolls.length - 1) {
            if (Array.isArray(this.rerolls[this.rerollid + 1])) {
                this.rerollid += 1
                let rerollData = safeStructuredClone(this.rerolls[this.rerollid])
                let msgs = DBState.currentChat.message
                for (let i = 0; i < rerollData.length; i++) {
                    msgs[msgs.length - rerollData.length + i] = rerollData[i]
                }
                DBState.currentChat.message = msgs
            }
            return
        }

        // Save current response to history before generating new one
        if (this.rerolls.length === 0) {
            this.rerolls.push(safeStructuredClone([DBState.currentChat.message.at(-1)]))
            this.rerollid = this.rerolls.length - 1
        }

        let cha = safeStructuredClone(DBState.currentChat.message)
        if (cha.length === 0) {
            return
        }

        // Close menu via hook
        this.notifyMenuClose()

        // Remove the last AI message(s) to regenerate
        const saying = cha[cha.length - 1].saying
        let sayingQu = 2
        while (cha[cha.length - 1].role !== 'user') {
            if (cha[cha.length - 1].saying === saying) {
                sayingQu -= 1
                if (sayingQu === 0) {
                    break
                }
            }
            let msg = cha.pop()
            if (!msg) {
                return
            }
        }
        DBState.currentChat.message = cha

        // Generate new response
        await this.sendChatMain()
    }

    /**
     * Navigate backward in reroll history (undo reroll)
     */
    async unReroll() {
        // Prevent unreroll while generating
        if (get(doingChat)) {
            return
        }

        // Reset reroll history when switching characters
        if (this.lastCharId !== get(selectedCharID)) {
            this.rerolls = []
            this.rerollid = -1
        }

        // Check for pre-unreroll cache
        const genId = DBState.currentChat.message.at(-1)?.generationInfo?.generationId
        if (genId) {
            const r = PreUnreroll(genId)
            if (r) {
                DBState.currentChat.message[DBState.currentChat.message.length - 1].data = r
                return
            }
        }

        // Can't go back past first version
        if (this.rerollid <= 0) {
            return
        }

        // Restore previous version from history
        if (Array.isArray(this.rerolls[this.rerollid - 1])) {
            this.rerollid -= 1
            let rerollData = safeStructuredClone(this.rerolls[this.rerollid])
            let msgs = DBState.currentChat.message
            for (let i = 0; i < rerollData.length; i++) {
                msgs[msgs.length - rerollData.length + i] = rerollData[i]
            }
            DBState.currentChat.message = msgs
        }
    }

    // ============================================================
    // CHAT GENERATION CORE
    // ============================================================

    /**
     * Core function that triggers AI response generation
     */
    async sendChatMain(continued: boolean = false) {
        let previousLength = DBState.currentChat.message.length
        this.messageInput = ''
        this.abortController = new AbortController()

        try {
            await sendChat(-1, {
                signal: this.abortController.signal,
                continue: continued
            })

            // Save new messages to reroll history
            if (previousLength < DBState.currentChat.message.length) {
                this.rerolls.push(safeStructuredClone(DBState.currentChat.message).slice(previousLength))
                this.rerollid = this.rerolls.length - 1
            }
        } catch (error) {
            console.error(error)
            alertError(error)
        }

        // Cleanup after generation
        this.lastCharId = get(selectedCharID)
        doingChat.set(false)

        // Play notification sound if enabled
        if (DBState.db.playMessage) {
            const audio = new Audio(sendSound)
            audio.play()
        }
    }

    /**
     * Cancels the current AI generation
     */
    abortChat() {
        if (this.abortController) {
            this.abortController.abort()
        }
    }

    // ============================================================
    // AUTO MODE (Group Chats)
    // ============================================================

    /**
     * Toggles auto mode for group chats
     */
    async runAutoMode() {
        if (this.autoMode) {
            this.autoMode = false
            return
        }

        const selectedChar = get(selectedCharID)
        this.autoMode = true

        while (this.autoMode) {
            await this.sendChatMain()
            if (selectedChar !== get(selectedCharID)) {
                this.autoMode = false
            }
        }
    }

    // ============================================================
    // LIFECYCLE
    // ============================================================

    /**
     * Reset all runtime state (call on character change)
     */
    resetOnCharChange() {
        this.messageInput = ''
        this.messageInputTranslate = ''
        this.fileInput = []
        this.autoMode = false
        this.rerolls = []
        this.rerollid = -1
        this.abortController = null
    }

    /**
     * Check if character changed and reset if needed
     */
    checkCharChange(currentCharId: number) {
        if (this.lastCharId !== currentCharId && this.lastCharId !== -1) {
            this.resetOnCharChange()
        }
        this.lastCharId = currentCharId
    }
}

export const chatRuntime = new ChatRuntimeController()
