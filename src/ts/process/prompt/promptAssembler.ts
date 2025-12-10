import type { character, Chat } from "src/ts/data/storage/types";
import type { OpenAIChat } from "src/ts/process/chatTypes";
import type { UnformatedPrompts, LorebookData } from "src/ts/process/prompt/promptBuilder";
import { DBState } from 'src/ts/stores.svelte';
import { ChatTokenizer } from "src/ts/utils/tokenizer";
import { risuChatParser } from "src/ts/process/scripting/scripts";
import { parseChatML } from "src/ts/utils/parser.svelte";
import { prebuiltAssetCommand } from "src/ts/utils/util";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PromptCard {
    type: string
    text?: string
    role?: 'system' | 'user' | 'bot'
    type2?: string
    innerFormat?: string
    defaultText?: string
    rangeStart?: number
    rangeEnd?: number | 'end'
    chatAsOriginalOnSystem?: boolean
    depth?: number
}

export interface AssembleContext {
    currentChar: character
    currentChat: Chat
    tokenizer: ChatTokenizer
    usingPromptTemplate: boolean
    positionParser: (text: string, loc: string) => string
}

export interface AssembleResult {
    formated: OpenAIChat[]
    totalTokens: number
    hasCachePoint: boolean
    memories: OpenAIChat[]
    supaMemoryCardUsed: boolean
}

export interface TokenizeOnlyResult {
    totalTokens: number
    hasCachePoint: boolean
    supaMemoryCardUsed: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Role Conversion
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_CONVERSION = {
    "system": "system",
    "user": "user",
    "bot": "assistant"
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Card Processors - Tokenize
// ─────────────────────────────────────────────────────────────────────────────

async function tokenizePersonaCard(
    card: PromptCard,
    unformated: UnformatedPrompts,
    ctx: AssembleContext
): Promise<number> {
    let pmt = safeStructuredClone(unformated.personaPrompt)
    if (card.innerFormat && pmt.length > 0) {
        for (let i = 0; i < pmt.length; i++) {
            pmt[i].content = risuChatParser(ctx.positionParser(card.innerFormat, card.type), { chara: ctx.currentChar })
                .replace('{{slot}}', pmt[i].content)
        }
    }
    return await tokenizeChatArray(pmt, ctx.tokenizer)
}

async function tokenizeDescriptionCard(
    card: PromptCard,
    unformated: UnformatedPrompts,
    ctx: AssembleContext
): Promise<number> {
    let pmt = safeStructuredClone(unformated.description)
    if (card.innerFormat && pmt.length > 0) {
        for (let i = 0; i < pmt.length; i++) {
            pmt[i].content = risuChatParser(ctx.positionParser(card.innerFormat, card.type), { chara: ctx.currentChar })
                .replace('{{slot}}', pmt[i].content)
        }
    }
    return await tokenizeChatArray(pmt, ctx.tokenizer)
}

async function tokenizeAuthorNoteCard(
    card: PromptCard,
    unformated: UnformatedPrompts,
    ctx: AssembleContext
): Promise<number> {
    let pmt = safeStructuredClone(unformated.authorNote)
    if (card.innerFormat && pmt.length > 0) {
        for (let i = 0; i < pmt.length; i++) {
            pmt[i].content = risuChatParser(ctx.positionParser(card.innerFormat, card.type), { chara: ctx.currentChar })
                .replace('{{slot}}', pmt[i].content || card.defaultText || '')
        }
    }
    return await tokenizeChatArray(pmt, ctx.tokenizer)
}

async function tokenizeLorebookCard(
    unformated: UnformatedPrompts,
    ctx: AssembleContext
): Promise<number> {
    return await tokenizeChatArray(unformated.lorebook, ctx.tokenizer)
}

async function tokenizePostEverythingCard(
    unformated: UnformatedPrompts,
    ctx: AssembleContext
): Promise<number> {
    let tokens = await tokenizeChatArray(unformated.postEverything, ctx.tokenizer)
    if (ctx.usingPromptTemplate && DBState.db.promptSettings.postEndInnerFormat) {
        tokens += await tokenizeChatArray([{
            role: 'system',
            content: DBState.db.promptSettings.postEndInnerFormat
        }], ctx.tokenizer)
    }
    return tokens
}

async function tokenizePlainCard(
    card: PromptCard,
    ctx: AssembleContext
): Promise<number> {
    if ((!DBState.db.jailbreakToggle) && (card.type === 'jailbreak')) {
        return 0
    }
    if ((!DBState.db.chainOfThought) && (card.type === 'cot')) {
        return 0
    }

    const posType = card.type === 'plain' ? card.type2 : card.type
    let content = ctx.positionParser(card.text || '', posType || '')

    if (card.type2 === 'globalNote') {
        if (ctx.currentChar.replaceGlobalNote) {
            content = ctx.positionParser(ctx.currentChar.replaceGlobalNote, posType || '').replaceAll('{{original}}', content)
        }
        if (ctx.currentChar.prebuiltAssetCommand && !card.text?.includes('{{//@customimageinstruction}}')) {
            content += prebuiltAssetCommand
        }
    }

    content = risuChatParser(content, { chara: ctx.currentChar, role: card.role })

    const prompt: OpenAIChat = {
        role: ROLE_CONVERSION[card.role || 'system'],
        content: content
    }

    return await tokenizeChatArray([prompt], ctx.tokenizer)
}

async function tokenizeChatMLCard(
    card: PromptCard,
    ctx: AssembleContext
): Promise<number> {
    const prompts = parseChatML(card.text || '')
    return await tokenizeChatArray(prompts, ctx.tokenizer)
}

async function tokenizeChatCard(
    card: PromptCard,
    unformated: UnformatedPrompts,
    ctx: AssembleContext
): Promise<number> {
    let start = card.rangeStart ?? 0
    let end = (card.rangeEnd === 'end') ? unformated.chats.length : (card.rangeEnd ?? unformated.chats.length)

    if (start === -1000) {
        start = 0
        end = unformated.chats.length
    }
    if (start < 0) {
        start = unformated.chats.length + start
        if (start < 0) start = 0
    }
    if (end < 0) {
        end = unformated.chats.length + end
        if (end < 0) end = 0
    }

    if (start >= end) {
        return 0
    }

    let chats = unformated.chats.slice(start, end)

    if (ctx.usingPromptTemplate && DBState.db.promptSettings.sendChatAsSystem && (!card.chatAsOriginalOnSystem)) {
        chats = systemizeChat(chats)
    }

    return await tokenizeChatArray(chats, ctx.tokenizer)
}

// ─────────────────────────────────────────────────────────────────────────────
// Card Processors - Assemble
// ─────────────────────────────────────────────────────────────────────────────

function assemblePersonaCard(
    card: PromptCard,
    unformated: UnformatedPrompts,
    ctx: AssembleContext
): OpenAIChat[] {
    let pmt = safeStructuredClone(unformated.personaPrompt)
    if (card.innerFormat && pmt.length > 0) {
        for (let i = 0; i < pmt.length; i++) {
            pmt[i].content = risuChatParser(ctx.positionParser(card.innerFormat, card.type), { chara: ctx.currentChar })
                .replace('{{slot}}', pmt[i].content)
        }
    }
    return pmt
}

function assembleDescriptionCard(
    card: PromptCard,
    unformated: UnformatedPrompts,
    ctx: AssembleContext
): OpenAIChat[] {
    let pmt = safeStructuredClone(unformated.description)
    if (card.innerFormat && pmt.length > 0) {
        for (let i = 0; i < pmt.length; i++) {
            pmt[i].content = risuChatParser(ctx.positionParser(card.innerFormat, card.type), { chara: ctx.currentChar })
                .replace('{{slot}}', pmt[i].content)
        }
    }
    return pmt
}

function assembleAuthorNoteCard(
    card: PromptCard,
    unformated: UnformatedPrompts,
    ctx: AssembleContext
): OpenAIChat[] {
    let pmt = safeStructuredClone(unformated.authorNote)
    if (card.innerFormat && pmt.length > 0) {
        for (let i = 0; i < pmt.length; i++) {
            pmt[i].content = risuChatParser(ctx.positionParser(card.innerFormat, card.type), { chara: ctx.currentChar })
                .replace('{{slot}}', pmt[i].content || card.defaultText || '')
        }
    }
    return pmt
}

function assembleLorebookCard(unformated: UnformatedPrompts): OpenAIChat[] {
    return unformated.lorebook
}

function assemblePostEverythingCard(
    unformated: UnformatedPrompts,
    ctx: AssembleContext
): OpenAIChat[] {
    const result = [...unformated.postEverything]
    if (ctx.usingPromptTemplate && DBState.db.promptSettings.postEndInnerFormat) {
        result.push({
            role: 'system',
            content: DBState.db.promptSettings.postEndInnerFormat
        })
    }
    return result
}

function assemblePlainCard(
    card: PromptCard,
    ctx: AssembleContext
): OpenAIChat[] {
    if ((!DBState.db.jailbreakToggle) && (card.type === 'jailbreak')) {
        return []
    }
    if ((!DBState.db.chainOfThought) && (card.type === 'cot')) {
        return []
    }

    const posType = card.type === 'plain' ? card.type2 : card.type
    let content = ctx.positionParser(card.text || '', posType || '')

    if (card.type2 === 'globalNote') {
        if (ctx.currentChar.replaceGlobalNote) {
            content = ctx.positionParser(ctx.currentChar.replaceGlobalNote, posType || '').replaceAll('{{original}}', content)
        }
        if (ctx.currentChar.prebuiltAssetCommand && !card.text?.includes('{{//@customimageinstruction}}')) {
            content += prebuiltAssetCommand
        }
    }

    content = risuChatParser(content, { chara: ctx.currentChar, role: card.role })

    return [{
        role: ROLE_CONVERSION[card.role || 'system'],
        content: content
    }]
}

function assembleChatMLCard(card: PromptCard): OpenAIChat[] {
    return parseChatML(card.text || '')
}

function assembleChatCard(
    card: PromptCard,
    unformated: UnformatedPrompts,
    ctx: AssembleContext
): OpenAIChat[] {
    let start = card.rangeStart ?? 0
    let end = (card.rangeEnd === 'end') ? unformated.chats.length : (card.rangeEnd ?? unformated.chats.length)

    if (start === -1000) {
        start = 0
        end = unformated.chats.length
    }
    if (start < 0) {
        start = unformated.chats.length + start
        if (start < 0) start = 0
    }
    if (end < 0) {
        end = unformated.chats.length + end
        if (end < 0) end = 0
    }

    if (start >= end) {
        return []
    }

    let chats = unformated.chats.slice(start, end)

    if (ctx.usingPromptTemplate && DBState.db.promptSettings.sendChatAsSystem && (!card.chatAsOriginalOnSystem)) {
        chats = systemizeChat(chats)
    }

    return chats
}

function assembleMemoryCard(
    card: PromptCard,
    memories: OpenAIChat[],
    ctx: AssembleContext
): OpenAIChat[] {
    let pmt = safeStructuredClone(memories)
    if (card.innerFormat && pmt.length > 0) {
        for (let i = 0; i < pmt.length; i++) {
            pmt[i].content = risuChatParser(card.innerFormat, { chara: ctx.currentChar })
                .replace('{{slot}}', pmt[i].content)
        }
    }
    return pmt
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate tokens for template cards (first pass)
 */
export async function tokenizeTemplate(
    template: PromptCard[],
    unformated: UnformatedPrompts,
    ctx: AssembleContext
): Promise<TokenizeOnlyResult> {
    let totalTokens = 0
    let hasCachePoint = false
    let supaMemoryCardUsed = false

    for (const card of template) {
        switch (card.type) {
            case 'persona':
                totalTokens += await tokenizePersonaCard(card, unformated, ctx)
                break
            case 'description':
                totalTokens += await tokenizeDescriptionCard(card, unformated, ctx)
                break
            case 'authornote':
                totalTokens += await tokenizeAuthorNoteCard(card, unformated, ctx)
                break
            case 'lorebook':
                totalTokens += await tokenizeLorebookCard(unformated, ctx)
                break
            case 'postEverything':
                totalTokens += await tokenizePostEverythingCard(unformated, ctx)
                break
            case 'plain':
            case 'jailbreak':
            case 'cot':
                totalTokens += await tokenizePlainCard(card, ctx)
                break
            case 'chatML':
                totalTokens += await tokenizeChatMLCard(card, ctx)
                break
            case 'chat':
                totalTokens += await tokenizeChatCard(card, unformated, ctx)
                break
            case 'memory':
                supaMemoryCardUsed = true
                break
            case 'cache':
                hasCachePoint = true
                break
        }
    }

    return { totalTokens, hasCachePoint, supaMemoryCardUsed }
}

/**
 * Assemble final formatted prompts from template (second pass)
 */
export function assembleTemplate(
    template: PromptCard[],
    unformated: UnformatedPrompts,
    memories: OpenAIChat[],
    ctx: AssembleContext,
    hasCachePoint: boolean
): OpenAIChat[] {
    const formated: OpenAIChat[] = []

    function pushPrompts(prompts: OpenAIChat[]) {
        for (const chat of prompts) {
            if (!chat.content.trim() && !(chat.multimodals && chat.multimodals.length > 0)) {
                continue
            }

            const isOpenAIStyle = DBState.db.aiModel.startsWith('gpt') ||
                DBState.db.aiModel.startsWith('claude') ||
                DBState.db.aiModel === 'openrouter' ||
                DBState.db.aiModel === 'reverse_proxy'

            if (!isOpenAIStyle) {
                formated.push(chat)
                continue
            }

            if (chat.role === 'system') {
                const endf = formated.at(-1)
                if (endf && endf.role === 'system' && endf.memo === chat.memo && endf.name === chat.name) {
                    formated[formated.length - 1].content += '\n\n' + chat.content
                } else {
                    formated.push(chat)
                }
            } else {
                formated.push(chat)
            }
        }
    }

    for (const card of template) {
        switch (card.type) {
            case 'persona':
                pushPrompts(assemblePersonaCard(card, unformated, ctx))
                break
            case 'description':
                pushPrompts(assembleDescriptionCard(card, unformated, ctx))
                break
            case 'authornote':
                pushPrompts(assembleAuthorNoteCard(card, unformated, ctx))
                break
            case 'lorebook':
                pushPrompts(assembleLorebookCard(unformated))
                break
            case 'postEverything':
                pushPrompts(assemblePostEverythingCard(unformated, ctx))
                break
            case 'plain':
            case 'jailbreak':
            case 'cot':
                pushPrompts(assemblePlainCard(card, ctx))
                break
            case 'chatML':
                pushPrompts(assembleChatMLCard(card))
                break
            case 'chat':
                pushPrompts(assembleChatCard(card, unformated, ctx))

                // Apply automatic cache points if not already set
                if (DBState.db.automaticCachePoint && !hasCachePoint) {
                    let pointer = formated.length - 1
                    let depthRemaining = 3
                    while (pointer >= 0) {
                        if (depthRemaining === 0) break
                        if (formated[pointer].role === 'user') {
                            formated[pointer].cachePoint = true
                            depthRemaining--
                        }
                        pointer--
                    }
                }
                break
            case 'memory':
                pushPrompts(assembleMemoryCard(card, memories, ctx))
                break
            case 'cache':
                // Apply cache points based on card configuration
                let pointer = formated.length - 1
                let depthRemaining = card.depth ?? 1
                const cacheRole = (card as any).role ?? 'user'
                while (pointer >= 0) {
                    if (depthRemaining === 0) break
                    if (formated[pointer].role === cacheRole || cacheRole === 'all') {
                        formated[pointer].cachePoint = true
                        depthRemaining--
                    }
                    pointer--
                }
                break
        }
    }

    return formated
}

/**
 * Assemble prompts using legacy format order (no template)
 */
export function assembleLegacy(
    unformated: UnformatedPrompts,
    formatOrder: string[]
): OpenAIChat[] {
    const formated: OpenAIChat[] = []
    const order = [...formatOrder, 'postEverything']

    for (const key of order) {
        const prompts = (unformated as any)[key] as OpenAIChat[]
        if (prompts) {
            for (const chat of prompts) {
                if (!chat.content.trim() && !(chat.multimodals && chat.multimodals.length > 0)) {
                    continue
                }
                formated.push(chat)
            }
        }
    }

    return formated
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

async function tokenizeChatArray(chats: OpenAIChat[], tokenizer: ChatTokenizer): Promise<number> {
    let total = 0
    for (const chat of chats) {
        total += await tokenizer.tokenizeChat(chat)
    }
    return total
}

function systemizeChat(chats: OpenAIChat[]): OpenAIChat[] {
    for (let i = 0; i < chats.length; i++) {
        if (chats[i].role === 'user' || chats[i].role === 'assistant') {
            const attr = chats[i].attr ?? []
            if (chats[i].name?.startsWith('example_')) {
                chats[i].content = chats[i].name + ': ' + chats[i].content
            } else if (!attr.includes('nameAdded')) {
                chats[i].content = chats[i].role + ': ' + chats[i].content
            }
            chats[i].role = 'system'
            delete chats[i].memo
            delete chats[i].name
        }
    }
    return chats
}

function safeStructuredClone<T>(obj: T): T {
    try {
        return structuredClone(obj)
    } catch {
        return JSON.parse(JSON.stringify(obj))
    }
}

/**
 * Apply depth prompts to chats
 */
export function applyDepthPrompts(
    unformatedChats: OpenAIChat[],
    lorepmt: LorebookData,
    currentChar: character
): void {
    const depthPrompts = lorepmt.actives.filter(v =>
        (v.pos === 'depth' && v.depth! > 0) || v.pos === 'reverse_depth'
    )

    for (const depthPrompt of depthPrompts) {
        const chat: OpenAIChat = {
            role: depthPrompt.role,
            content: risuChatParser(depthPrompt.prompt, { chara: currentChar })
        }
        const depth = depthPrompt.pos === 'depth'
            ? depthPrompt.depth!
            : (unformatedChats.length - depthPrompt.depth!)
        unformatedChats.splice(depth, 0, chat)
    }
}

/**
 * Recheck tokens and remove excess messages
 */
export async function recheckTokens(
    formated: OpenAIChat[],
    maxContextTokens: number,
    tokenizer: ChatTokenizer
): Promise<{ formated: OpenAIChat[], inputTokens: number }> {
    let inputTokens = 0

    for (const chat of formated) {
        inputTokens += await tokenizer.tokenizeChat(chat)
    }

    if (inputTokens > maxContextTokens) {
        let pointer = 0
        while (inputTokens > maxContextTokens) {
            if (pointer >= formated.length) {
                throw new Error(`Token limit exceeded. Required: ${inputTokens}`)
            }
            if (formated[pointer].removable) {
                inputTokens -= await tokenizer.tokenizeChat(formated[pointer])
                formated[pointer].content = ''
            }
            pointer++
        }
        formated = formated.filter(v =>
            v.content !== '' || (v.multimodals && v.multimodals.length > 0)
        )
    }

    return { formated, inputTokens }
}

/**
 * Trim formated array content
 */
export function trimFormated(formated: OpenAIChat[]): OpenAIChat[] {
    return formated.map(v => {
        v.content = v.content.trim()
        return v
    })
}

/**
 * Handle past thinking in extra context mode (mode 2)
 */
export function applyPastThinkingBudget(
    formated: OpenAIChat[],
    pastThinkingExtraTokens: number
): void {
    let totalThinkingTokens = 0

    for (const chat of formated) {
        if (chat.encryptedThinking) {
            for (const et of chat.encryptedThinking) {
                totalThinkingTokens += et.tokens
            }
        }
    }

    // Remove from front (oldest) until within budget
    while (totalThinkingTokens > pastThinkingExtraTokens) {
        let removed = false
        for (const chat of formated) {
            if (chat.encryptedThinking && chat.encryptedThinking.length > 0) {
                const removedEntry = chat.encryptedThinking.shift()
                totalThinkingTokens -= removedEntry?.tokens ?? 0
                if (chat.encryptedThinking.length === 0) {
                    chat.encryptedThinking = undefined
                }
                removed = true
                break
            }
        }
        if (!removed) break
    }
}

/**
 * Collect encrypted thinking history from formated array
 */
export function collectEncryptedThinkingHistory(
    formated: OpenAIChat[]
): { provider: string; data: any; tokens: number }[] {
    return formated
        .flatMap(chat => chat.encryptedThinking || [])
        .filter(et => et.tokens > 0)
}
