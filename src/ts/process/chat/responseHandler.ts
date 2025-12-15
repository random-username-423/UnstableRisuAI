import type { character, Chat, MessageGenerationInfo, MessagePresetInfo, groupChat } from "src/ts/data/storage/types";
import { DBState } from 'src/ts/stores.svelte';
import { processScriptFull, risuChatParser } from "src/ts/process/scripting/scripts";
import { runTrigger } from "src/ts/process/scripting/triggers";
import { runInlayScreen } from "src/ts/process/postprocess/inlayScreen";
import { addRerolls } from "src/ts/process/chat/prereroll";
import { sayTTS } from "src/ts/process/postprocess/tts";
import { trimUntilPunctuation } from "src/ts/utils/util";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EncryptedThinkingEntry {
    provider: string
    data: any
    tokens?: number
}

export interface ResponseHandlerContext {
    selectedChar: number
    selectedChat: number
    currentChar: character
    nowChatroom: character | groupChat
    generationInfo: MessageGenerationInfo
    promptInfo: MessagePresetInfo
    generationId: string
    abortSignal: AbortSignal
    isContinue: boolean
    reformatContent: (data: string) => string
}

export interface ResponseHandlerResult {
    result: string
    emoChanged: boolean
    resendChat: boolean
    currentChat: Chat
}

export interface StreamingChunk {
    [key: string]: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Encrypted Thinking Processing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save encrypted thinking data from streaming response chunk
 */
export function saveEncryptedThinkingFromChunk(
    lastResponseChunk: StreamingChunk,
    message: { encryptedThinking?: EncryptedThinkingEntry[] }
): void {
    // Gemini
    if (lastResponseChunk['__sign_text'] || lastResponseChunk['__sign_function']) {
        const signatures: string[] = []
        if (lastResponseChunk['__sign_text']) signatures.push(lastResponseChunk['__sign_text'])
        if (lastResponseChunk['__sign_function']) signatures.push(lastResponseChunk['__sign_function'])
        if (signatures.length > 0) {
            const thoughtsTokens = parseInt(lastResponseChunk['__thoughts_tokens'] || '0', 10)
            console.log('[Gemini] Saving thinking tokens:', thoughtsTokens)
            message.encryptedThinking = [{
                provider: 'gemini',
                data: { thoughtSignatures: signatures },
                tokens: thoughtsTokens > 0 ? thoughtsTokens : undefined
            }]
        }
    }

    // Anthropic
    if (lastResponseChunk['__anthropic_signatures'] || lastResponseChunk['__anthropic_redacted']) {
        try {
            const signatures = lastResponseChunk['__anthropic_signatures']
                ? JSON.parse(lastResponseChunk['__anthropic_signatures'])
                : undefined
            const redacted = lastResponseChunk['__anthropic_redacted']
                ? JSON.parse(lastResponseChunk['__anthropic_redacted'])
                : undefined
            const thinkingTokens = parseInt(lastResponseChunk['__anthropic_thinking_tokens'] || '0', 10)
            if ((signatures || redacted) && thinkingTokens > 0) {
                console.log('[Anthropic] Saving thinking tokens:', thinkingTokens)
                message.encryptedThinking = [{
                    provider: 'anthropic',
                    data: { signatures, redacted },
                    tokens: thinkingTokens
                }]
            }
        } catch (e) {
            console.error('Failed to parse Anthropic encrypted thinking:', e)
        }
    }

    // OpenAI
    if (lastResponseChunk['__oai_reasoning_tokens']) {
        const reasoningTokens = parseInt(lastResponseChunk['__oai_reasoning_tokens'] || '0', 10)
        if (reasoningTokens > 0) {
            console.log('[OpenAI] Saving reasoning tokens:', reasoningTokens)
            if (!message.encryptedThinking) {
                message.encryptedThinking = [{
                    provider: 'openai',
                    data: {},
                    tokens: reasoningTokens
                }]
            } else {
                message.encryptedThinking[0].tokens = reasoningTokens
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Streaming Response Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle streaming response from AI
 */
export async function handleStreamingResponse(
    reader: ReadableStreamDefaultReader<StreamingChunk>,
    ctx: ResponseHandlerContext
): Promise<ResponseHandlerResult> {
    const { selectedChar, selectedChat, currentChar, nowChatroom, generationInfo, promptInfo, generationId, abortSignal, isContinue, reformatContent } = ctx

    let msgIndex = DBState.db.characters[selectedChar].chats[selectedChat].message.length
    let prefix = ''
    let result = ''
    let emoChanged = false
    let resendChat = false

    if (isContinue) {
        msgIndex -= 1
        prefix = DBState.db.characters[selectedChar].chats[selectedChat].message[msgIndex].data
    } else {
        DBState.db.characters[selectedChar].chats[selectedChat].message.push({
            role: 'char',
            data: "",
            saying: currentChar.chaId,
            time: Date.now(),
            generationInfo,
            promptInfo,
            chatId: generationId,
        })
    }

    DBState.db.characters[selectedChar].chats[selectedChat].isStreaming = true
    let lastResponseChunk: StreamingChunk = {}

    while (abortSignal.aborted === false) {
        const readed = await reader.read()

        if (readed.value) {
            lastResponseChunk = readed.value
            const firstChunkKey = Object.keys(lastResponseChunk)[0]
            result = lastResponseChunk[firstChunkKey]

            if (!result) {
                result = ''
            }

            if (DBState.db.removeIncompleteResponse) {
                result = trimUntilPunctuation(result)
            }

            const result2 = await processScriptFull(
                nowChatroom,
                reformatContent(prefix + result),
                'editoutput',
                msgIndex
            )

            DBState.db.characters[selectedChar].chats[selectedChat].message[msgIndex].data = result2.data
            emoChanged = result2.emoChanged
            DBState.db.characters[selectedChar].reloadKeys += 1
        }

        if (readed.done) {
            DBState.db.characters[selectedChar].chats[selectedChat].isStreaming = false
            DBState.db.characters[selectedChar].reloadKeys += 1
            break
        }
    }

    // Save reroll options
    addRerolls(generationId, Object.values(lastResponseChunk))

    // Save encrypted thinking from streaming response
    saveEncryptedThinkingFromChunk(
        lastResponseChunk,
        DBState.db.characters[selectedChar].chats[selectedChat].message[msgIndex]
    )

    // Run chat function and triggers
    let currentChat = runCurrentChatFunction(
        DBState.db.characters[selectedChar].chats[selectedChat],
        currentChar
    )
    DBState.db.characters[selectedChar].chats[selectedChat] = currentChat

    const triggerResult = await runTrigger(currentChar, 'output', { chat: currentChat })
    if (triggerResult?.chat) {
        currentChat = triggerResult.chat
    }
    if (triggerResult?.sendAIprompt) {
        resendChat = true
    }

    // Process inlay screen
    const inlayr = runInlayScreen(currentChar, currentChat.message[msgIndex].data)
    currentChat.message[msgIndex].data = inlayr.text
    DBState.db.characters[selectedChar].chats[selectedChat] = currentChat

    if (inlayr.promise) {
        const t = await inlayr.promise
        currentChat.message[msgIndex].data = t
        DBState.db.characters[selectedChar].chats[selectedChat] = currentChat
    }

    // TTS
    if (DBState.db.ttsAutoSpeech) {
        await sayTTS(currentChar, result)
    }

    return { result, emoChanged, resendChat, currentChat }
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct (Non-Streaming) Response Handler
// ─────────────────────────────────────────────────────────────────────────────

export interface DirectResponseData {
    type: 'success' | 'multiline'
    result: string | readonly (readonly ['char' | 'user', string])[]
    encryptedThinking?: EncryptedThinkingEntry
}

/**
 * Handle non-streaming (direct) response from AI
 */
export async function handleDirectResponse(
    response: DirectResponseData,
    ctx: ResponseHandlerContext
): Promise<ResponseHandlerResult> {
    const { selectedChar, selectedChat, currentChar, nowChatroom, generationInfo, promptInfo, generationId, isContinue, reformatContent } = ctx

    const msgs: readonly (readonly ['char' | 'user', string])[] = response.type === 'success'
        ? [['char', response.result as string] as const]
        : (response.result as readonly (readonly ['char' | 'user', string])[])

    let result = ''
    let emoChanged = false
    let resendChat = false
    const mrerolls: string[] = []

    for (let i = 0; i < msgs.length; i++) {
        const msg = msgs[i]
        const mess = msg[1]
        let msgIndex = DBState.db.characters[selectedChar].chats[selectedChat].message.length

        let result2 = await processScriptFull(nowChatroom, reformatContent(mess), 'editoutput', msgIndex)

        if (i === 0 && isContinue) {
            msgIndex -= 1
            const beforeChat = DBState.db.characters[selectedChar].chats[selectedChat].message[msgIndex]
            result2 = await processScriptFull(nowChatroom, reformatContent(beforeChat.data + mess), 'editoutput', msgIndex)
        }

        if (DBState.db.removeIncompleteResponse) {
            result2.data = trimUntilPunctuation(result2.data)
        }

        result = result2.data
        const inlayResult = runInlayScreen(currentChar, result)
        result = inlayResult.text
        emoChanged = result2.emoChanged

        // Get encryptedThinking from response
        const encryptedThinking = (response.type === 'success' && response.encryptedThinking)
            ? [response.encryptedThinking]
            : undefined

        if (i === 0 && isContinue) {
            DBState.db.characters[selectedChar].chats[selectedChat].message[msgIndex] = {
                role: 'char',
                data: result,
                saying: currentChar.chaId,
                time: Date.now(),
                generationInfo,
                promptInfo,
                chatId: generationId,
                encryptedThinking,
            }
            if (inlayResult.promise) {
                const p = await inlayResult.promise
                DBState.db.characters[selectedChar].chats[selectedChat].message[msgIndex].data = p
            }
        } else if (i === 0) {
            DBState.db.characters[selectedChar].chats[selectedChat].message.push({
                role: msg[0],
                data: result,
                saying: currentChar.chaId,
                time: Date.now(),
                generationInfo,
                promptInfo,
                chatId: generationId,
                encryptedThinking,
            })
            const ind = DBState.db.characters[selectedChar].chats[selectedChat].message.length - 1
            if (inlayResult.promise) {
                const p = await inlayResult.promise
                DBState.db.characters[selectedChar].chats[selectedChat].message[ind].data = p
            }
            mrerolls.push(result)
        } else {
            mrerolls.push(result)
        }

        DBState.db.characters[selectedChar].reloadKeys += 1

        if (DBState.db.ttsAutoSpeech) {
            await sayTTS(currentChar, result)
        }
    }

    // Save reroll options if multiple
    if (mrerolls.length > 1) {
        addRerolls(generationId, mrerolls)
    }

    // Run chat function and triggers
    let currentChat = runCurrentChatFunction(
        DBState.db.characters[selectedChar].chats[selectedChat],
        currentChar
    )
    DBState.db.characters[selectedChar].chats[selectedChat] = currentChat

    const triggerResult = await runTrigger(currentChar, 'output', { chat: currentChat })
    if (triggerResult?.chat) {
        DBState.db.characters[selectedChar].chats[selectedChat] = triggerResult.chat
        currentChat = triggerResult.chat
    }
    if (triggerResult?.sendAIprompt) {
        resendChat = true
    }

    return { result, emoChanged, resendChat, currentChat }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run risuChatParser on all messages in a chat with runVar enabled
 */
function runCurrentChatFunction(chat: Chat, currentChar: character): Chat {
    chat.message = chat.message.map((v) => {
        v.data = risuChatParser(v.data, { chara: currentChar, runVar: true })
        return v
    })
    return chat
}

/**
 * Create a reformat content function that trims whitespace
 */
export function createReformatContent(): (data: string) => string {
    return (data: string) => data.trim()
}
