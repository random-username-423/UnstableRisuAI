import { v4 } from "uuid"

import { language } from "src/lang"

import { readImage } from "../globalApi.svelte"
import { getModelInfo, LLMFlags } from "../model/modellist"
import { risuChatParser } from "../parser.svelte"
import { getPersonaPrompt, getUserName } from "../persona"
import { setCurrentChat } from "../storage/database.svelte"
import type { character, groupChat } from "../storage/types/character"
import type { Chat, Message, MessagePresetInfo } from "../storage/types/chat"
import { DBState } from "../stores.svelte"
import { ChatTokenizer } from "../tokenizer"
import { parseToggleSyntax } from "../utils/util"
import { parseChatML } from "../parser/chatML"

import { additionalInformations } from "./embedding/addinfo"
import { exampleMessage } from "./exampleMessages"
import { getInlayAsset } from "./files/inlays"
import { chatGenState, type StageTimings } from "./index.svelte"
import { findCharacterbyIdwithCache, formatPrompt, parseChatCBS, systemizeChat } from "./index_util.svelte"
import { loadLoreBookV3Prompt } from "./lorebook.svelte"
import { hanuraiMemory } from "./memory/hanuraiMemory"
import { hypaMemoryV2 } from "./memory/hypav2"
import { hypaMemoryV3 } from "./memory/hypav3.svelte"
import { supaMemory } from "./memory/supaMemory"
import { getModuleAssets, getModuleToggles } from "./modules"
import { getAuthorNoteDefaultText, type PromptItem } from "./prompt"
import { processScript, processScriptFull } from "./scripts"
import { runLuaEditTrigger } from "./scriptings"
import { runImageEmbedding } from "./transformers"
import { runTrigger } from "./triggers"
import type { OpenAIChat, MultiModal } from "./types"

interface BuildPromptOutput {
    promptInfo: MessagePresetInfo,
    finalPrompt: OpenAIChat[],
    inputTokens: number,
    outputTokens: number
}

type BuildPromptResult =
    | { success: true; data: BuildPromptOutput }
    | { success: false; error?: string }

type PromptSection = 'main' | 'jailbreak' | 'chats' | 'lorebook' | 'globalNote' | 'authorNote' | 'lastChat' | 'description' | 'postEverything' | 'personaPrompt'

const DEFAULT_PREBUILT_ASSET_COMMAND = `
<Image Tag Instruction>Insert HTML image tags between paragraphs based on context.
Set src as keywords from the list below that matches current character, outfit, situation sentiment and etc.
print as many different images as possible. Use only available keywords.
if there are no matching keywords, try to put clostest matching image src.
try to put at least 1 image per output.
<keywords>{{join::{{chardisplayasset}}::,}}</keywords>
Example: <img src="{{ele::{{chardisplayasset}}::0}}">
<Image Tag Instruction>
`

const CONVERT_ROLE = {
    "system": "system",
    "user": "user",
    "bot": "assistant"
} as const

/**
 * Normalizes chat range indices, handling negative indices and special values.
 * Returns null if the range is invalid (start >= end).
 */
function normalizeChatRange(
    rangeStart: number,
    rangeEnd: number | 'end',
    chatLength: number
): { start: number; end: number } | null {
    let start = rangeStart
    let end = rangeEnd === 'end' ? chatLength : rangeEnd

    // -1000 means include all chats
    if (start === -1000) {
        return { start: 0, end: chatLength }
    }

    // Handle negative indices (count from end)
    if (start < 0) {
        start = Math.max(0, chatLength + start)
    }
    if (end < 0) {
        end = Math.max(0, chatLength + end)
    }

    if (start >= end) {
        return null
    }

    return { start, end }
}

/**
 * Converts legacy formatingOrder to promptTemplate
 * This allows removing the legacy code path that handles formatingOrder separately
 */
function convertFormatingOrderToTemplate(order: string[]): PromptItem[] {
    const hasLastChat = order.includes('lastChat')

    const result: PromptItem[] = []

    // Helper to convert formatPrompt output to PromptItem cards
    function pushFormattedPrompts(text: string, type: 'plain' | 'jailbreak', type2: 'main' | 'globalNote' | 'normal') {
        const parsed = formatPrompt(text)
        for (const chat of parsed) {
            // Convert 'assistant' to 'bot' for PromptItem role
            const role = chat.role === 'assistant' ? 'bot' : chat.role as 'user' | 'system'
            result.push({ type, text: chat.content, role, type2 })
        }
    }

    for (const slot of order) {
        switch (slot) {
            case 'main': {
                const mainText = DBState.db.mainPrompt + ((DBState.db.additionalPrompt === '' || (!DBState.db.promptPreprocess)) ? '' : `\n${DBState.db.additionalPrompt}`)
                pushFormattedPrompts(mainText, 'plain', 'main')
                break
            }
            case 'jailbreak': {
                pushFormattedPrompts(DBState.db.jailbreak, 'jailbreak', 'normal')
                break
            }
            case 'globalNote': {
                pushFormattedPrompts(DBState.db.globalNote, 'plain', 'globalNote')
                break
            }
            case 'description':
                result.push({ type: 'description' })
                break
            case 'personaPrompt':
                result.push({ type: 'persona' })
                break
            case 'lorebook':
                result.push({ type: 'lorebook' })
                break
            case 'authorNote':
                result.push({ type: 'authornote' })
                break
            case 'chats':
                result.push({ type: 'chat', rangeStart: 0, rangeEnd: hasLastChat ? -1 : 'end' })
                break
            case 'lastChat':
                result.push({ type: 'chat', rangeStart: -1, rangeEnd: 'end' })
                break
            case 'postEverything':
                result.push({ type: 'postEverything' })
                break
        }
    }

    // Ensure postEverything is always present
    if (!result.some(item => item.type === 'postEverything')) {
        result.push({ type: 'postEverything' })
    }

    return result
}

export async function buildPrompt(
    chatOwner: character | groupChat,
    selectedChatPage: number,
    speakingChar: character,
    stageTimings: StageTimings,
    continueResponse?: boolean
): Promise<BuildPromptResult> {

    const perChatAdditonalTokens = DBState.db.aiModel.startsWith('gpt') ? 5 : 3
    const tokenizer = new ChatTokenizer(perChatAdditonalTokens, DBState.db.aiModel.startsWith('gpt') ? 'noName' : 'name')
    const maxContextTokens = DBState.db.maxContext

    let workingChat = parseChatCBS(chatOwner.chats[selectedChatPage], speakingChar)
    chatOwner.chats[selectedChatPage] = workingChat

    let promptInfo: MessagePresetInfo = {}
    if (DBState.db.promptInfoInsideChat) {
        const presetName = DBState.db.botPresets[DBState.db.botPresetsId]?.name ?? ''
        const promptToggles = parseToggleSyntax(DBState.db.customPromptTemplateToggle + getModuleToggles())
            .flatMap(toggle => {
                const raw = DBState.db.globalChatVariables[`toggle_${toggle.key}`]
                if (toggle.type === 'select' || toggle.type === 'text') {
                    return [{ key: toggle.value, value: toggle.options[raw] }]
                }
                if (raw === '1') {
                    return [{ key: toggle.value, value: 'ON' }]
                }
                return []
            })

        promptInfo = { promptName: presetName, promptToggles }
    }

    /* ========================================
     *       STAGE 1: PROMPT BUILDING
     * ======================================== */
    chatGenState.stage = 1
    stageTimings.stage1Start = Date.now()
    const promptParts: Record<PromptSection, OpenAIChat[]> = {
        'main': ([] as OpenAIChat[]),
        'jailbreak': ([] as OpenAIChat[]),
        'chats': ([] as OpenAIChat[]),
        'lorebook': ([] as OpenAIChat[]),
        'globalNote': ([] as OpenAIChat[]),
        'authorNote': ([] as OpenAIChat[]),
        'lastChat': ([] as OpenAIChat[]),
        'description': ([] as OpenAIChat[]),
        'postEverything': ([] as OpenAIChat[]),
        'personaPrompt': ([] as OpenAIChat[])
    }

    let promptTemplate = $state.snapshot(DBState.db.promptTemplate)

    // Convert legacy formatingOrder to promptTemplate if needed
    if (!promptTemplate && DBState.db.formatingOrder) {
        console.info('[Migration] Converting legacy formatingOrder to promptTemplate')
        promptTemplate = convertFormatingOrderToTemplate($state.snapshot(DBState.db.formatingOrder))
    }

    if (!promptTemplate) {
        return { success: false, error: 'No promptTemplate or formatingOrder configured' }
    }

    const hasPostEverything = promptTemplate.some(card => card.type === 'postEverything')
    if (!hasPostEverything) {
        promptTemplate.push({
            type: 'postEverything'
        })
    }

    if (speakingChar.utilityBot && (!DBState.db.promptSettings.utilOverride)) {
        promptTemplate = [
            {
                "type": "plain",
                "text": "",
                "role": "system",
                "type2": "main"
            },
            {
                "type": "description",
            },
            {
                "type": "lorebook",
            },
            {
                "type": "chat",
                "rangeStart": 0,
                "rangeEnd": "end"
            },
            {
                "type": "plain",
                "text": "",
                "role": "system",
                "type2": "globalNote"
            },
            {
                'type': "postEverything"
            }
        ]
    }

    // authorNote
    if (workingChat.note) {
        promptParts.authorNote.push({
            role: 'system',
            content: risuChatParser(workingChat.note, { chara: speakingChar })
        })
    }
    else if (getAuthorNoteDefaultText() !== '') {
        promptParts.authorNote.push({
            role: 'system',
            content: risuChatParser(getAuthorNoteDefaultText(), { chara: speakingChar })
        })
    }

    // build Character Description
    {
        let description = risuChatParser((DBState.db.promptPreprocess ? DBState.db.descriptionPrefix : '') + speakingChar.desc, { chara: speakingChar })

        const additionalInfo = await additionalInformations(speakingChar, workingChat)

        if (additionalInfo) {
            description += '\n\n' + risuChatParser(additionalInfo, { chara: speakingChar })
        }

        if (speakingChar.personality) {
            description += risuChatParser("\n\nDescription of {{char}}: " + speakingChar.personality, { chara: speakingChar })
        }

        if (speakingChar.scenario) {
            description += risuChatParser("\n\nCircumstances and context of the dialogue: " + speakingChar.scenario, { chara: speakingChar })
        }

        promptParts.description.push({
            role: 'system',
            content: description
        })

        if (chatOwner.type === 'group') {
            const systemMsg = `[Write the next reply only as ${speakingChar.name}]`
            promptParts.postEverything.push({
                role: 'system',
                content: systemMsg
            })
        }
    }

    const lorePrompt = await loadLoreBookV3Prompt()

    // Lorebook entries with no specific position - goes to default lorebook section
    const unpositionedLores = lorePrompt.actives.filter(v => {
        return v.pos === '' && v.inject === null
    })
    console.log(unpositionedLores)

    for (const lorebook of unpositionedLores) {
        promptParts.lorebook.push({
            role: lorebook.role,
            content: risuChatParser(lorebook.prompt, { chara: speakingChar })
        })
    }

    // Lorebook entries positioned around character description
    const descRelatedLores = lorePrompt.actives.filter(v => {
        return v.pos === 'after_desc' || v.pos === 'before_desc' || v.pos === 'personality' || v.pos === 'scenario'
    })

    for (const lorebook of descRelatedLores) {
        const c = {
            role: lorebook.role,
            content: risuChatParser(lorebook.prompt, { chara: speakingChar })
        }
        if (lorebook.pos === 'before_desc') {
            promptParts.description.unshift(c)
        }
        else {
            promptParts.description.push(c)
        }
    }

    // persona
    if (DBState.db.personaPrompt) {
        promptParts.personaPrompt.push({
            role: 'system',
            content: risuChatParser(getPersonaPrompt(), { chara: speakingChar })
        })
    }

    // Inlay view screen instructions
    if (speakingChar.inlayViewScreen) {
        if (speakingChar.viewScreen === 'emotion') {
            promptParts.postEverything.push({
                role: 'system',
                content: speakingChar.newGenData.emotionInstructions.replaceAll('{{slot}}', speakingChar.emotionImages.map((v) => v[0]).join(', '))
            })
        }
        if (speakingChar.viewScreen === 'imggen') {
            promptParts.postEverything.push({
                role: 'system',
                content: speakingChar.newGenData.instructions
            })
        }
    }

    // postEverything
    const postEverythingLorebooks = lorePrompt.actives.filter(v => {
        return v.pos === 'depth' && v.depth === 0 && v.role !== 'assistant'
    })
    for (const lorebook of postEverythingLorebooks) {
        promptParts.postEverything.push({
            role: lorebook.role,
            content: risuChatParser(lorebook.prompt, { chara: speakingChar })
        })
    }

    //Since assistant needs to be prefill, we need to add assistant lorebooks after user/system lorebooks
    const postEverythingAssistantLorebooks = lorePrompt.actives.filter(v => {
        return v.pos === 'depth' && v.depth === 0 && v.role === 'assistant'
    })

    // Lorebooks that inject content into specific {{position::location}} markers via append/prepend
    const injectionLorebooks = lorePrompt.actives.filter(v => {
        return v.inject && !v.inject.lore
    })

    const injectionLorePosSet = new Set<string>()
    for (const lorebook of injectionLorebooks) {
        injectionLorePosSet.add(lorebook.inject.location)
    }

    for (const lorebook of postEverythingAssistantLorebooks) {
        promptParts.postEverything.push({
            role: lorebook.role,
            content: risuChatParser(lorebook.prompt, { chara: speakingChar })
        })
    }

    const positionRegex = /{{position::(.+?)}}/g
    const positionParser = (text: string, loc: string) => {
        console.log(injectionLorePosSet)
        if (injectionLorePosSet.has(loc)) {
            const matchings = injectionLorebooks.filter(v => {
                return v.inject.location === loc
            })
            for (const lore of matchings) {
                switch (lore.inject.operation) {
                    case 'append': {
                        text += ' ' + lore.prompt
                        break
                    }
                    case 'prepend': {
                        text = lore.prompt + ' ' + text
                        break
                    }
                    case 'replace': {
                        text = text.replace(lore.inject.param, lore.prompt)
                        break
                    }
                }
            }
        }
        return text.replace(positionRegex, (match, p1) => {
            const MatchingLorebooks = lorePrompt.actives.filter(v => {
                return v.pos === ('pt_' + p1)
            })

            return MatchingLorebooks.map(v => {
                return v.prompt
            }).join('\n')
        })
    }

    // Pre-calculate token count for fixed prompts to determine available space for chat history
    let hasCachePoint = false
    let reservedTokens = DBState.db.maxResponse
    let supaMemoryCardUsed = false

    // Helper function to accumulate token count from chat array into reservedTokens
    async function tokenizeChatArray(chats: OpenAIChat[]) {
        for (const chat of chats) {
            const tokens = await tokenizer.tokenizeChat(chat)
            reservedTokens += tokens
        }
    }

    // Iterate through each template card and calculate tokens based on card type
    for (const card of promptTemplate) {
        switch (card.type) {
            case 'persona': {
                const pmt = safeStructuredClone(promptParts.personaPrompt)
                if (card.innerFormat && pmt.length > 0) {
                    for (let i = 0; i < pmt.length; i++) {
                        pmt[i].content = risuChatParser(positionParser(card.innerFormat, card.type), { chara: speakingChar }).replace('{{slot}}', pmt[i].content)
                    }
                }

                await tokenizeChatArray(pmt)
                break
            }
            case 'description': {
                const pmt = safeStructuredClone(promptParts.description)
                if (card.innerFormat && pmt.length > 0) {
                    for (let i = 0; i < pmt.length; i++) {
                        pmt[i].content = risuChatParser(positionParser(card.innerFormat, card.type), { chara: speakingChar }).replace('{{slot}}', pmt[i].content)
                    }
                }

                await tokenizeChatArray(pmt)
                break
            }
            case 'authornote': {
                const pmt = safeStructuredClone(promptParts.authorNote)
                if (card.innerFormat && pmt.length > 0) {
                    for (let i = 0; i < pmt.length; i++) {
                        pmt[i].content = risuChatParser(positionParser(card.innerFormat, card.type), { chara: speakingChar }).replace('{{slot}}', pmt[i].content || card.defaultText || '')
                    }
                }

                await tokenizeChatArray(pmt)
                break
            }
            case 'lorebook': {
                await tokenizeChatArray(promptParts.lorebook)
                break
            }
            case 'postEverything': {
                await tokenizeChatArray(promptParts.postEverything)
                if (DBState.db.promptSettings.postEndInnerFormat) {
                    await tokenizeChatArray([{
                        role: 'system',
                        content: DBState.db.promptSettings.postEndInnerFormat
                    }])
                }
                break
            }
            // Handle plain text and jailbreak prompts with role conversion
            case 'plain':
            case 'jailbreak': {
                if ((!DBState.db.jailbreakToggle) && (card.type === 'jailbreak')) {
                    continue
                }

                const posType = card.type === 'plain' ? card.type2 : card.type
                let content = positionParser(card.text, posType)

                if (card.type2 === 'globalNote') {
                    if (speakingChar.replaceGlobalNote) {
                        content = positionParser(speakingChar.replaceGlobalNote, posType).replaceAll('{{original}}', content)
                    }

                    if (speakingChar.prebuiltAssetCommand && !card.text.includes('{{//@customimageinstruction}}')) {
                        content += DEFAULT_PREBUILT_ASSET_COMMAND
                    }
                    content = (risuChatParser(content, { chara: speakingChar, role: card.role }))
                }
                else if (card.type2 === 'main') {
                    if (speakingChar.systemPrompt) {
                        content = positionParser(speakingChar.systemPrompt, posType).replaceAll('{{original}}', content)
                    }
                    content = (risuChatParser(content, { chara: speakingChar, role: card.role }))
                }
                else {
                    content = risuChatParser(content, { chara: speakingChar, role: card.role })
                }

                const prompt: OpenAIChat = {
                    role: CONVERT_ROLE[card.role],
                    content: content
                }

                await tokenizeChatArray([prompt])
                break
            }
            case 'chatML': {
                const prompts = parseChatML(card.text)
                await tokenizeChatArray(prompts)
                break
            }
            case 'chat': {
                const range = normalizeChatRange(card.rangeStart, card.rangeEnd, promptParts.chats.length)
                if (!range) {
                    break
                }
                let chats = promptParts.chats.slice(range.start, range.end)

                if (DBState.db.promptSettings.sendChatAsSystem && !card.chatAsOriginalOnSystem) {
                    chats = systemizeChat(chats)
                }
                await tokenizeChatArray(chats)
                break
            }
            case 'memory': {
                supaMemoryCardUsed = true
                break
            }
            case 'cache': {
                hasCachePoint = true
                break
            }
        }
    }

    // build chats
    const examples = exampleMessage(speakingChar, getUserName())

    for (const example of examples) {
        reservedTokens += await tokenizer.tokenizeChat(example)
    }

    let chats: OpenAIChat[] = examples

    if (!DBState.db.aiModel.startsWith('novelai') && !DBState.db?.promptSettings?.trimStartNewChat) {
        chats.push({
            role: 'system',
            content: '[Start a new chat]',
            memo: "NewChat"
        })
    }

    // Filter messages based on disabled state, iterating backwards for efficient 'allBefore' handling
    let msReseted = false
    const makeMs = (currentChat: Chat) => {
        const mss: Message[] = []
        msReseted = false
        for (let i = currentChat.message.length - 1; i >= 0; i--) {
            const d = currentChat.message[i]
            // Skip this single message
            if (d.disabled === true) {
                continue
            }
            // Exclude this message and all messages before it
            if (d.disabled === 'allBefore') {
                msReseted = true
                break
            }
            mss.unshift(d)
        }
        return mss
    }

    let ms: Message[] = makeMs(workingChat)

    // Add first message (greeting) for non-group chats when history is not reset
    if (chatOwner.type !== 'group' && !msReseted) {
        const firstMsg = workingChat.fmIndex === -1 ? chatOwner.firstMessage : chatOwner.alternateGreetings[workingChat.fmIndex]

        const chat: OpenAIChat = {
            role: 'assistant',
            content: await (processScript(chatOwner,
                risuChatParser(firstMsg, { chara: speakingChar }),
                'editprocess'))
        }

        // Prepend character name if sendName option is enabled
        if (DBState.db.promptSettings.sendName) {
            chat.content = `${speakingChar.name}: ${chat.content}`
            chat.attr = ['nameAdded']
        }
        chats.push(chat)
        reservedTokens += await tokenizer.tokenizeChat(chat)
    }

    console.log('Prepared messages for token calculation:', ms)

    // Execute 'start' trigger and update chat state if needed
    const triggerResult = await runTrigger(speakingChar, 'start', { chat: workingChat })
    if (triggerResult) {
        workingChat = triggerResult.chat
        setCurrentChat(workingChat)
        ms = makeMs(workingChat)
        reservedTokens += triggerResult.tokens
        if (triggerResult.stopSending) {
            chatGenState.generating = false
            return { success: false }
        }
    }

    // Process each message and convert to OpenAI chat format
    let index = 0
    for (const msg of ms) {
        let formatedChat = (await processScriptFull(chatOwner, risuChatParser(msg.data, { chara: speakingChar, role: msg.role }), 'editprocess', index, {
            chatRole: msg.role,
        })).data

        // Generate unique chat ID if not present
        if (!msg.chatId) {
            msg.chatId = v4()
        }

        // Extract inlay tags (for embedded images/media) from message content
        const inlays: string[] = []
        if (msg.role === 'char') {
            formatedChat = formatedChat.replace(/{{(inlay|inlayed|inlayeddata)::(.+?)}}/g, (
                match: string,
                p1: string,
                p2: string
            ) => {
                if (p2 && p1 === 'inlayeddata') {
                    inlays.push(p2)
                }
                return ''
            })
        }
        else {
            const inlayMatch = formatedChat.match(/{{(inlay|inlayed|inlayeddata)::(.+?)}}/g)
            if (inlayMatch) {
                for (const inlay of inlayMatch) {
                    inlays.push(inlay)
                }
            }
        }

        // Process inlay assets (images, videos, audio) into multimodal content
        const multimodal: MultiModal[] = []
        const modelinfo = getModelInfo(DBState.db.aiModel)
        if (inlays.length > 0) {
            for (const inlay of inlays) {
                const inlayName = inlay.replace('{{inlayed::', '').replace('{{inlay::', '').replace('}}', '')
                const inlayData = await getInlayAsset(inlayName)
                if (inlayData?.type === 'image') {
                    // If model supports image input, add as multimodal; otherwise use image captioning
                    if (modelinfo.flags.includes(LLMFlags.hasImageInput)) {
                        multimodal.push({
                            type: 'image',
                            base64: inlayData.data,
                            width: inlayData.width,
                            height: inlayData.height
                        })
                    }
                    else {
                        const captionResult = await runImageEmbedding(inlayData.data)
                        formatedChat += `[${captionResult[0].generated_text}]`
                    }
                }
                if (inlayData?.type === 'video' || inlayData?.type === 'audio') {
                    if (multimodal.length === 0) {
                        multimodal.push({
                            type: inlayData.type,
                            base64: inlayData.data
                        })
                    }
                }
                formatedChat = formatedChat.replace(inlay, '')
            }
        }

        // Determine role and apply group chat template if applicable
        const attr: string[] = []
        let role: 'user' | 'assistant' | 'system' = msg.role === 'user' ? 'user' : 'assistant'

        // Apply group template formatting for multi-character conversations
        if (
            (chatOwner.type === 'group' && findCharacterbyIdwithCache(msg.saying).chaId !== speakingChar.chaId) ||
            (chatOwner.type === 'group' && DBState.db.groupOtherBotRole === 'assistant') ||
            (DBState.db.promptSettings.sendName)
        ) {
            const form = DBState.db.groupTemplate || `<{{char}}'s Message>\n{{slot}}\n</{{char}}'s Message>`
            formatedChat = risuChatParser(form, { chara: findCharacterbyIdwithCache(msg.saying).name }).replace('{{slot}}', formatedChat)
            switch (DBState.db.groupOtherBotRole) {
                case 'user':
                case 'assistant':
                case 'system':
                    role = DBState.db.groupOtherBotRole
                    break
                default:
                    role = 'assistant'
                    break
            }
        }

        // Extract and preserve <Thoughts> tags based on depth setting
        const thoughts: string[] = []
        const maxThoughtDepth = DBState.db.promptSettings?.maxThoughtTagDepth ?? -1
        formatedChat = formatedChat.replace(/<Thoughts>(.+)<\/Thoughts>/gms, (match, p1) => {
            if (maxThoughtDepth === -1 || (maxThoughtDepth - ms.length) <= index) {
                thoughts.push(p1)
            }
            return ''
        })

        // Process {{asset_prompt::name}} tags to embed character assets as images
        const assetPromises: Promise<void>[] = []
        formatedChat = formatedChat.replace(/\{\{asset_?prompt::(.+?)\}\}/gmsiu, (match, p1) => {
            const moduleAssets = getModuleAssets()
            const assets = (speakingChar.additionalAssets ?? []).concat(moduleAssets)
            const asset = assets.find(v => {
                return v[0] === p1
            })
            if (asset) {
                assetPromises.push((async () => {
                    const assetDataBuf = await readImage(asset[1])
                    multimodal.push({
                        type: "image",
                        base64: `data:image/png;base64,${Buffer.from(assetDataBuf).toString('base64')}`
                    })
                })())
            }
            else if (p1 === 'icon') {
                assetPromises.push((async () => {
                    const assetDataBuf = await readImage(speakingChar.image ?? '')
                    multimodal.push({
                        type: "image",
                        base64: `data:image/png;base64,${Buffer.from(assetDataBuf).toString('base64')}`
                    })
                })())
            }
            return ''
        })
        await Promise.all(assetPromises)

        // Build final OpenAI chat object with all processed content
        const chat: OpenAIChat = {
            role: role,
            content: formatedChat,
            memo: msg.chatId,
            attr: attr,
            multimodals: multimodal,
            thoughts: thoughts
        }
        if (chat.multimodals.length === 0) {
            delete chat.multimodals
        }
        chats.push(chat)
        reservedTokens += await tokenizer.tokenizeChat(chat)
        index++
    }
    console.log(JSON.stringify(chats, null, 2))

    // Calculate tokens for depth-based lorebook prompts (inserted at specific positions in chat)
    const depthPrompts = lorePrompt.actives.filter(v => {
        return (v.pos === 'depth' && v.depth > 0) || v.pos === 'reverse_depth'
    })

    for (const depthPrompt of depthPrompts) {
        const chat: OpenAIChat = {
            role: depthPrompt.role,
            content: risuChatParser(depthPrompt.prompt, { chara: speakingChar })
        }
        reservedTokens += await tokenizer.tokenizeChat(chat)
    }

    /* ========================================
     *       STAGE 2: MEMORY PROCESSING
     * ======================================== */
    if (chatOwner.supaMemory && (DBState.db.supaModelType !== 'none' || DBState.db.hanuraiEnable || DBState.db.hypav2 || DBState.db.hypaV3)) {
        stageTimings.stage1Duration = Date.now() - stageTimings.stage1Start
        chatGenState.stage = 2
        stageTimings.stage2Start = Date.now()
        if (DBState.db.hanuraiEnable) {
            const hn = await hanuraiMemory(chats, {
                currentTokens: reservedTokens,
                maxContextTokens,
                tokenizer
            })

            if (hn === false) {
                return { success: false }
            }

            chats = hn.chats
            reservedTokens = hn.tokens
        }
        else if (DBState.db.hypav2) {
            console.log("Current chat's hypaV2 Data: ", workingChat.hypaV2Data)
            const sp = await hypaMemoryV2(chats, reservedTokens, maxContextTokens, workingChat, chatOwner, tokenizer)
            if (sp.error) {
                console.log(sp)
                return { success: false, error: sp.error }
            }
            chats = sp.chats
            reservedTokens = sp.currentTokens
            workingChat.hypaV2Data = sp.memory ?? workingChat.hypaV2Data

            console.log("[Expected to be updated] chat's HypaV2Data: ", workingChat.hypaV2Data)
        }
        else if (DBState.db.hypaV3) {
            console.log("Current chat's hypaV3 Data: ", workingChat.hypaV3Data)
            const sp = await hypaMemoryV3(chats, reservedTokens, maxContextTokens, workingChat, chatOwner, tokenizer)
            if (sp.error) {
                // Save new summary
                if (sp.memory) {
                    workingChat.hypaV3Data = sp.memory
                }
                console.log(sp)
                return { success: false, error: sp.error }
            }
            chats = sp.chats
            reservedTokens = sp.currentTokens
            workingChat.hypaV3Data = sp.memory ?? workingChat.hypaV3Data

            console.log("[Expected to be updated] chat's HypaV3Data: ", workingChat.hypaV3Data)
        }
        else {
            const sp = await supaMemory(chats, reservedTokens, maxContextTokens, workingChat, chatOwner, tokenizer, {
                asHyper: DBState.db.hypaMemory
            })
            if (sp.error) {
                return { success: false, error: sp.error }
            }
            chats = sp.chats
            reservedTokens = sp.currentTokens
            workingChat.supaMemoryData = sp.memory ?? workingChat.supaMemoryData

            console.log(workingChat.supaMemoryData)
            workingChat.lastMemory = sp.lastId ?? workingChat.lastMemory
        }
        stageTimings.stage2Duration = Date.now() - stageTimings.stage2Start
        // Return to stage 1 for prompt assembly after memory processing
        chatGenState.stage = 1
    }
    else {
        stageTimings.stage1Duration = Date.now() - stageTimings.stage1Start

        let skipCount = 0
        while (reservedTokens > maxContextTokens) {
            if (skipCount >= chats.length - 1) {
                return { success: false, error: language.errors.toomuchtoken + "\n\nRequired Tokens: " + reservedTokens }
            }
            reservedTokens -= await tokenizer.tokenizeChat(chats[skipCount])
            skipCount++
        }
        chats = chats.slice(skipCount)

        workingChat.lastMemory = chats[0].memo
    }

    /* ========================================
     *       STAGE 1: PROMPT ASSEMBLY (cont.)
     * ======================================== */
    const memories: OpenAIChat[] = []

    promptParts.chats = chats.map((v) => {
        if (v.memo !== 'supaMemory' && v.memo !== 'hypaMemory') {
            v.removable = true
        }
        else if (supaMemoryCardUsed) {
            memories.push(v)
            return {
                role: 'system',
                content: '',
            } as OpenAIChat
        }
        else {
            v.content = `<Previous Conversation>${v.content}</Previous Conversation>`
        }
        return v
    }).filter((v) => {
        return v.content.trim() !== '' || (v.multimodals && v.multimodals.length > 0)
    })

    for (const depthPrompt of depthPrompts) {
        const chat: OpenAIChat = {
            role: depthPrompt.role,
            content: risuChatParser(depthPrompt.prompt, { chara: speakingChar })
        }
        const depth = depthPrompt.pos === 'depth' ? (depthPrompt.depth) : (promptParts.chats.length - depthPrompt.depth)
        promptParts.chats.splice(depth, 0, chat)
    }

    if (triggerResult) {
        if (triggerResult.additonalSysPrompt.promptend) {
            promptParts.postEverything.push({
                role: 'system',
                content: triggerResult.additonalSysPrompt.promptend
            })
        }
        if (triggerResult.additonalSysPrompt.historyend) {
            promptParts.lastChat.push({
                role: 'system',
                content: triggerResult.additonalSysPrompt.historyend
            })
        }
        if (triggerResult.additonalSysPrompt.start) {
            promptParts.lastChat.unshift({
                role: 'system',
                content: triggerResult.additonalSysPrompt.start
            })
        }
    }

    // Build final formatted prompt array
    let finalPrompt: OpenAIChat[] = []

    // Continue chat model
    if (continueResponse && (DBState.db.aiModel.startsWith('claude') || DBState.db.aiModel.startsWith('gpt') || DBState.db.aiModel.startsWith('openrouter') || DBState.db.aiModel.startsWith('reverse_proxy'))) {
        promptParts.postEverything.push({
            role: 'system',
            content: '[Continue the last response]'
        })
    }

    function pushPrompts(cha: OpenAIChat[]) {
        for (const chat of cha) {
            if (!chat.content.trim() && !(chat.multimodals && chat.multimodals.length > 0)) {
                continue
            }
            if (!(DBState.db.aiModel.startsWith('gpt') || DBState.db.aiModel.startsWith('claude') || DBState.db.aiModel === 'openrouter' || DBState.db.aiModel === 'reverse_proxy')) {
                finalPrompt.push(chat)
                continue
            }
            if (chat.role === 'system') {
                const lastChat = finalPrompt.at(-1)
                if (lastChat && lastChat.role === 'system' && lastChat.memo === chat.memo && lastChat.name === chat.name) {
                    lastChat.content += '\n\n' + chat.content
                }
                else {
                    finalPrompt.push(chat)
                }
            }
            else {
                finalPrompt.push(chat)
            }
        }
    }

    let promptBodyformatedForChatStore: OpenAIChat[] = []
    function pushPromptInfoBody(role: "function" | "system" | "user" | "assistant", fmt: string, promptBody: OpenAIChat[]) {
        if (!fmt.trim()) {
            return
        }
        promptBody.push({
            role: role,
            content: risuChatParser(fmt),
        })
    }

    for (const card of promptTemplate) {
        switch (card.type) {
            case 'persona': {
                const pmt = safeStructuredClone(promptParts.personaPrompt)
                if (card.innerFormat && pmt.length > 0) {
                    for (let i = 0; i < pmt.length; i++) {
                        pmt[i].content = risuChatParser(positionParser(card.innerFormat, card.type), { chara: speakingChar }).replace('{{slot}}', pmt[i].content)

                        if (DBState.db.promptInfoInsideChat && DBState.db.promptTextInfoInsideChat) {
                            pushPromptInfoBody(pmt[i].role, card.innerFormat, promptBodyformatedForChatStore)
                        }
                    }
                }

                pushPrompts(pmt)
                break
            }
            case 'description': {
                const pmt = safeStructuredClone(promptParts.description)
                if (card.innerFormat && pmt.length > 0) {
                    for (let i = 0; i < pmt.length; i++) {
                        pmt[i].content = risuChatParser(positionParser(card.innerFormat, card.type), { chara: speakingChar }).replace('{{slot}}', pmt[i].content)

                        if (DBState.db.promptInfoInsideChat && DBState.db.promptTextInfoInsideChat) {
                            pushPromptInfoBody(pmt[i].role, card.innerFormat, promptBodyformatedForChatStore)
                        }
                    }
                }

                pushPrompts(pmt)
                break
            }
            case 'authornote': {
                const pmt = safeStructuredClone(promptParts.authorNote)
                if (card.innerFormat && pmt.length > 0) {
                    for (let i = 0; i < pmt.length; i++) {
                        pmt[i].content = risuChatParser(positionParser(card.innerFormat, card.type), { chara: speakingChar }).replace('{{slot}}', pmt[i].content || card.defaultText || '')

                        if (DBState.db.promptInfoInsideChat && DBState.db.promptTextInfoInsideChat) {
                            pushPromptInfoBody(pmt[i].role, card.innerFormat, promptBodyformatedForChatStore)
                        }
                    }
                }

                pushPrompts(pmt)
                break
            }
            case 'lorebook': {
                pushPrompts(promptParts.lorebook)
                break
            }
            case 'postEverything': {
                pushPrompts(promptParts.postEverything)
                if (DBState.db.promptSettings.postEndInnerFormat) {
                    pushPrompts([{
                        role: 'system',
                        content: DBState.db.promptSettings.postEndInnerFormat
                    }])
                }
                break
            }
            case 'plain':
            case 'jailbreak': {
                if (!DBState.db.jailbreakToggle && card.type === 'jailbreak') {
                    continue
                }

                const posType = card.type === 'plain' ? card.type2 : card.type
                let content = positionParser(card.text, posType)

                if (card.type2 === 'globalNote') {
                    if (speakingChar.replaceGlobalNote) {
                        content = positionParser(speakingChar.replaceGlobalNote, posType).replaceAll('{{original}}', content)
                    }
                    if (speakingChar.prebuiltAssetCommand && !card.text.includes('{{//@customimageinstruction}}')) {
                        content += DEFAULT_PREBUILT_ASSET_COMMAND
                    }
                    content = risuChatParser(content, { chara: speakingChar, role: card.role })
                }
                else if (card.type2 === 'main') {
                    if (speakingChar.systemPrompt) {
                        content = positionParser(speakingChar.systemPrompt, posType).replaceAll('{{original}}', content)
                    }
                    content = risuChatParser(content, { chara: speakingChar, role: card.role })
                }
                else {
                    content = risuChatParser(content, { chara: speakingChar, role: card.role })
                }

                const prompt: OpenAIChat = {
                    role: CONVERT_ROLE[card.role],
                    content: content
                }

                if (DBState.db.promptInfoInsideChat && DBState.db.promptTextInfoInsideChat && card.type2 !== 'globalNote') {
                    pushPromptInfoBody(prompt.role, prompt.content, promptBodyformatedForChatStore)
                }

                pushPrompts([prompt])
                break
            }
            case 'chatML': {
                const prompts = parseChatML(card.text)
                pushPrompts(prompts)
                break
            }
            case 'chat': {
                const range = normalizeChatRange(card.rangeStart, card.rangeEnd, promptParts.chats.length)
                if (!range) {
                    break
                }

                let chats = promptParts.chats.slice(range.start, range.end)
                if (DBState.db.promptSettings.sendChatAsSystem && !card.chatAsOriginalOnSystem) {
                    chats = systemizeChat(chats)
                }
                pushPrompts(chats)

                if (DBState.db.automaticCachePoint && !hasCachePoint) {
                    let pointer = finalPrompt.length - 1
                    let depthRemaining = 3
                    while (pointer >= 0) {
                        if (depthRemaining === 0) {
                            break
                        }
                        if (finalPrompt[pointer].role === 'user') {
                            finalPrompt[pointer].cachePoint = true
                            depthRemaining--
                        }
                        pointer--
                    }
                }
                break
            }
            case 'memory': {
                const pmt = safeStructuredClone(memories)
                if (card.innerFormat && pmt.length > 0) {
                    for (let i = 0; i < pmt.length; i++) {
                        pmt[i].content = risuChatParser(card.innerFormat, { chara: speakingChar }).replace('{{slot}}', pmt[i].content)

                        if (DBState.db.promptInfoInsideChat && DBState.db.promptTextInfoInsideChat) {
                            pushPromptInfoBody(pmt[i].role, card.innerFormat, promptBodyformatedForChatStore)
                        }
                    }
                }

                pushPrompts(pmt)
                break
            }
            case 'cache': {
                let pointer = finalPrompt.length - 1
                let depthRemaining = card.depth
                while (pointer >= 0) {
                    if (depthRemaining === 0) {
                        break
                    }
                    if (finalPrompt[pointer].role === card.role || card.role === 'all') {
                        finalPrompt[pointer].cachePoint = true
                        depthRemaining--
                    }
                    pointer--
                }
                break
            }
        }
    }

    finalPrompt = finalPrompt.map((v) => {
        v.content = v.content.trim()
        return v
    })

    if (DBState.db.promptInfoInsideChat && DBState.db.promptTextInfoInsideChat) {
        promptBodyformatedForChatStore = promptBodyformatedForChatStore.map((v) => {
            v.content = v.content.trim()
            return v
        })
    }

    // Character depth prompt insertion
    if (speakingChar.depth_prompt && speakingChar.depth_prompt.prompt && speakingChar.depth_prompt.prompt.length > 0) {
        const depthPrompt = speakingChar.depth_prompt
        finalPrompt.splice(finalPrompt.length - depthPrompt.depth, 0, {
            role: 'system',
            content: risuChatParser(depthPrompt.prompt, { chara: speakingChar })
        })
    }

    finalPrompt = await runLuaEditTrigger(speakingChar, 'editRequest', finalPrompt)

    if (DBState.db.promptInfoInsideChat && DBState.db.promptTextInfoInsideChat) {
        promptBodyformatedForChatStore = await runLuaEditTrigger(speakingChar, 'editRequest', promptBodyformatedForChatStore)
        promptInfo.promptText = promptBodyformatedForChatStore
    }

    //token rechecking
    let inputTokens = 0

    for (const chat of finalPrompt) {
        inputTokens += await tokenizer.tokenizeChat(chat)
    }

    if (inputTokens > maxContextTokens) {
        let pointer = 0
        while (inputTokens > maxContextTokens) {
            if (pointer >= finalPrompt.length) {
                return { success: false, error: language.errors.toomuchtoken + "\n\nAt token rechecking. Required Tokens: " + inputTokens }
            }
            if (finalPrompt[pointer].removable) {
                inputTokens -= await tokenizer.tokenizeChat(finalPrompt[pointer])
                finalPrompt[pointer].content = ''
            }
            pointer++
        }
        finalPrompt = finalPrompt.filter((v) => {
            return v.content !== '' || (v.multimodals && v.multimodals.length > 0)
        })
    }

    //estimate tokens
    let outputTokens = DBState.db.maxResponse
    if (inputTokens + outputTokens > maxContextTokens) {
        outputTokens = maxContextTokens - inputTokens
    }

    return { success: true, data: { finalPrompt, promptInfo, inputTokens, outputTokens } }
}