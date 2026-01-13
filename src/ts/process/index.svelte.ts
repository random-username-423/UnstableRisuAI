import { get } from "svelte/store"
import { setCurrentChat } from "../storage/database.svelte"
import { changeToPreset } from '../storage/preset-manager'
import { type Message, type MessagePresetInfo, type MessageGenerationInfo, type Chat } from '../storage/types/chat'
import { type character } from '../storage/types/character'
import { DBState } from '../stores.svelte'
import { CharEmotion } from "../stores.svelte"
import { ChatTokenizer, tokenize, tokenizeNum } from "../tokenizer"
import { language } from "../../lang"
import { alertError } from "../alert.svelte"
import { loadLoreBookV3Prompt } from "./lorebook.svelte"
import { isLastCharPunctuation, trimUntilPunctuation, parseToggleSyntax } from "../utils/util"
import { getAuthorNoteDefaultText } from "./prompt"
import { getPersonaPrompt } from "../persona"
import { getUserName } from "../persona"
import { requestChatData } from "./request/request"
import { stableDiff } from "./stableDiff"
import { processScript, processScriptFull, risuChatParser } from "./scripts"
import { exampleMessage } from "./exampleMessages"
import { sayTTS } from "./tts"
import { supaMemory } from "./memory/supaMemory"
import { v4 } from "uuid"
import { groupOrder } from "./group.svelte"
import { runTrigger } from "./triggers"
import { HypaProcesser } from "./memory/hypamemory"
import { additionalInformations } from "./embedding/addinfo"
import { getInlayAsset } from "./files/inlays"
import { getGenerationModelString } from "./models/modelString"
import { connectionOpen, peerRevertChat, peerSafeCheck, peerSync } from "../sync/multiuser"
import { runInlayScreen } from "./inlayScreen"
import { addRerolls } from "./prereroll"
import { runImageEmbedding } from "./transformers"
import { hanuraiMemory } from "./memory/hanuraiMemory"
import { hypaMemoryV2 } from "./memory/hypav2"
import { runLuaEditTrigger } from "./scriptings"
import { parseChatML } from "../parser.svelte"
import { getModelInfo, LLMFlags } from "../model/modellist"
import { hypaMemoryV3 } from "./memory/hypav3.svelte"
import { getModuleAssets, getModuleToggles } from "./modules"
import { readImage } from "../globalApi.svelte"
import { type OpenAIChat, type MultiModal } from "./types"
import { addToast } from "../toast.svelte"
import { findCharacterbyIdwithCache, formatPrompt, parseChatCBS, reformatContent, shuffleArray, systemizeChat } from "./index_util.svelte"
export type { MultiModal }

const defaultPrebuiltAssetCommand = `
<Image Tag Instruction>Insert HTML image tags between paragraphs based on context.
Set src as keywords from the list below that matches current character, outfit, situation sentiment and etc.
print as many different images as possible. Use only available keywords.
if there are no matching keywords, try to put clostest matching image src.
try to put at least 1 image per output.
<keywords>{{join::{{chardisplayasset}}::,}}</keywords>
Example: <img src="{{ele::{{chardisplayasset}}::0}}">
<Image Tag Instruction>
`

export const chatGenState = $state({
    generating: false,
    stage: 0,

})

export let previewFormated: OpenAIChat[] = []
export let previewBody: string = ''

/**
 * Sends a chat message and processes the AI response.
 *
 * This is the main entry point for chat interactions. It handles both single character
 * and group chats, processes prompts through templates, manages memory systems,
 * and handles streaming/non-streaming responses.
 *
 * @param chatProcessIndex - Character index for group chats. Use `-1` for single chats
 *                           or as the orchestrator call that triggers all group members.
 *                           Values `0, 1, 2...` indicate specific character indices in group chat.
 * @param arg - Optional configuration object
 * @param arg.signal - AbortSignal to cancel the request
 * @param arg.continue - If true, continues the last AI response instead of generating a new one
 * @param arg.usedContinueTokens - Token count already used when continuing a response
 * @param arg.preview - If true, returns formatted prompts without sending to AI
 * @param arg.previewPrompt - If true, returns the raw request body for debugging
 * @returns Promise resolving to `true` on success, `false` on failure or abort
 */
export async function sendChat(chatProcessIndex = -1, arg: {
    signal?: AbortSignal,
    continue?: boolean,
    usedContinueTokens?: number,
    preview?: boolean
    previewPrompt?: boolean
} = {}): Promise<boolean> {

    /* ========================================
     *            INITIALIZING
     * ======================================== */
    chatGenState.stage = 0
    const abortSignal = arg.signal ?? (new AbortController()).signal

    // Make snapshot in order to prevent overwritten if user is able to change character/chat during sendChat
    const chatOwner = DBState.currentChar
    const selectedChatPage = chatOwner.chatPage
    let speakingChar: character

    const perChatAdditonalTokens = DBState.db.aiModel.startsWith('gpt') ? 5 : 3
    const tokenizer = new ChatTokenizer(perChatAdditonalTokens, DBState.db.aiModel.startsWith('gpt') ? 'noName' : 'name')

    const maxContextTokens = DBState.db.maxContext

    const stageTimings = {
        stage1Start: 0,
        stage2Start: 0,
        stage3Start: 0,
        stage4Start: 0,
        stage1Duration: 0,
        stage2Duration: 0,
        stage3Duration: 0,
        stage4Duration: 0
    }

    function displayError(error: string) {
        if (DBState.db.inlayErrorResponse) {
            if (DBState.currentMessages.at(-1).role === 'char') {
                DBState.currentMessages.at(-1).data += `\n\`\`\`risuerror\n${error}\n\`\`\``
            }
            else {
                DBState.currentMessages.push({
                    role: 'char',
                    data: `\`\`\`risuerror\n${error}\n\`\`\``,
                    saying: speakingChar.chaId,
                    time: Date.now(),
                    generationInfo,
                })
            }

            return
        }

        alertError(error)
        return
    }

    // Block new generation requests while already generating.
    // However, allow group chat member calls (chatProcessIndex >= 0) to proceed,
    // since the orchestrator (chatProcessIndex === -1) sequentially invokes each character.
    if (chatGenState.generating && chatProcessIndex === -1) {
        return false
    }
    chatGenState.generating = true

    // Preset chain: randomly select one preset from a comma-separated list each generation.
    // Only runs on orchestrator/single chat calls, not individual group member calls.
    if (chatProcessIndex === -1 && DBState.db.presetChain) {
        const names = DBState.db.presetChain.split(',').map((v) => v.trim())
        const randomSelect = Math.floor(Math.random() * names.length)
        const ele = names[randomSelect]

        const findId = DBState.db.botPresets.findIndex((v) => {
            return v.name === ele
        })

        if (findId === -1) {
            addToast(`Cannot find preset: ${ele}`)
        }
        else {
            changeToPreset(findId, true)
        }
    }

    if (connectionOpen) {
        chatGenState.stage = 4
        const peerSafe = await peerSafeCheck()
        if (!peerSafe) {
            peerRevertChat()
            chatGenState.generating = false
            displayError(language.otherUserRequesting)
            return false
        }
        await peerSync()
        chatGenState.stage = 0
    }

    DBState.db.statics.messages += 1
    chatOwner.lastInteraction = Date.now()
    DBState.currentChat.message = DBState.currentChat.message.map((v) => {
        v.chatId = v.chatId ?? v4()
        return v
    })

    let promptInfo: MessagePresetInfo = {}
    let initialPresetNameForPromptInfo = null
    let initialPromptTogglesForPromptInfo: {
        key: string,
        value: string,
    }[] = []
    if (DBState.db.promptInfoInsideChat) {
        initialPresetNameForPromptInfo = DBState.db.botPresets[DBState.db.botPresetsId]?.name ?? ''
        initialPromptTogglesForPromptInfo = parseToggleSyntax(DBState.db.customPromptTemplateToggle + getModuleToggles())
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

        promptInfo = {
            promptName: initialPresetNameForPromptInfo,
            promptToggles: initialPromptTogglesForPromptInfo,
        }
    }

    // Determine which character(s) should respond
    // - 1:1 chat: The chatroom itself is the character
    // - Group chat + index specified: Only the specified character responds
    // - Group chat + index=-1: All active characters respond sequentially based on talkness order
    if (chatOwner.type === "character") {
        speakingChar = chatOwner
    }
    else if (chatOwner.type === 'group' && chatProcessIndex !== -1) {
        speakingChar = findCharacterbyIdwithCache(chatOwner.characters[chatProcessIndex])
        if (!speakingChar) {
            displayError(`cannot find character: ${chatOwner.characters[chatProcessIndex]}`)
            return false
        }
    }

    else if (chatOwner.type === 'group' && chatProcessIndex === -1) {
        // Get all character names for reference
        const charNames = chatOwner.characters.map((v) => findCharacterbyIdwithCache(v).name)

        // Get the last message to determine speaking order
        const lastMessage = DBState.currentMessages.at(-1)

        // Build list of active characters with their talkness values
        let order = chatOwner.characters.map((v, i) => {
            return {
                id: v,
                talkness: chatOwner.characterActive[i] ? chatOwner.characterTalks[i] : -1,
                index: i
            }
        }).filter((v) => {
            return v.talkness > 0
        })

        // Reorder characters based on context, excluding the last speaker
        if (!chatOwner.orderByOrder) {
            order = groupOrder(order, lastMessage?.data).filter((v) => {
                if (v.id === lastMessage?.saying) {
                    return false
                }
                return true
            })
        }

        // Recursively call sendChat for each character in order
        for (let i = 0; i < order.length; i++) {
            const r = await sendChat(order[i].index, {
                signal: abortSignal
            })
            if (!r) {
                return false
            }
        }
        return true
    }
    else {
        displayError("Unknown characrer type")
        return false
    }

    let workingChat = parseChatCBS(chatOwner.chats[selectedChatPage], speakingChar)
    chatOwner.chats[selectedChatPage] = workingChat

    /* ========================================
     *       STAGE 1: PROMPT BUILDING
     * ======================================== */
    chatGenState.stage = 1
    stageTimings.stage1Start = Date.now()
    const promptParts = {
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

    if (promptTemplate) {
        const hasPostEverything = promptTemplate.some(card => card.type === 'postEverything')
        if (!hasPostEverything) {
            promptTemplate.push({
                type: 'postEverything'
            })
        }
    }

    if (speakingChar.utilityBot && (!(promptTemplate && DBState.db.promptSettings.utilOverride))) {
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

    // legacy
    if ((!speakingChar.utilityBot) && (!promptTemplate)) {
        const mainp = speakingChar.systemPrompt?.replaceAll('{{original}}', DBState.db.mainPrompt) || DBState.db.mainPrompt

        promptParts.main.push(...formatPrompt(risuChatParser(mainp + ((DBState.db.additionalPrompt === '' || (!DBState.db.promptPreprocess)) ? '' : `\n${DBState.db.additionalPrompt}`), { chara: speakingChar })))

        if (DBState.db.jailbreakToggle) {
            promptParts.jailbreak.push(...formatPrompt(risuChatParser(DBState.db.jailbreak, { chara: speakingChar })))
        }

        promptParts.globalNote.push(...formatPrompt(risuChatParser(speakingChar.replaceGlobalNote?.replaceAll('{{original}}', DBState.db.globalNote) || DBState.db.globalNote, { chara: speakingChar })))
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

    // 
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

    let hasCachePoint = false
    let reservedTokens = DBState.db.maxResponse
    let supaMemoryCardUsed = false
    if (promptTemplate) {
        const template = promptTemplate

        async function tokenizeChatArray(chats: OpenAIChat[]) {
            for (const chat of chats) {
                const tokens = await tokenizer.tokenizeChat(chat)
                reservedTokens += tokens
            }
        }

        for (const card of template) {
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
                    if (promptTemplate && DBState.db.promptSettings.postEndInnerFormat) {
                        await tokenizeChatArray([{
                            role: 'system',
                            content: DBState.db.promptSettings.postEndInnerFormat
                        }])
                    }
                    break
                }
                case 'plain':
                case 'jailbreak': {
                    if ((!DBState.db.jailbreakToggle) && (card.type === 'jailbreak')) {
                        continue
                    }

                    const convertRole = {
                        "system": "system",
                        "user": "user",
                        "bot": "assistant"
                    } as const

                    const posType = card.type === 'plain' ? card.type2 : card.type
                    let content = positionParser(card.text, posType)

                    if (card.type2 === 'globalNote') {
                        if (speakingChar.replaceGlobalNote) {
                            content = positionParser(speakingChar.replaceGlobalNote, posType).replaceAll('{{original}}', content)
                        }

                        if (speakingChar.prebuiltAssetCommand && !card.text.includes('{{//@customimageinstruction}}')) {
                            content += defaultPrebuiltAssetCommand
                        }
                        content = (risuChatParser(content, { chara: speakingChar, role: card.role }))
                    }
                    else if (card.type2 === 'main') {
                        content = (risuChatParser(content, { chara: speakingChar, role: card.role }))
                    }
                    else {
                        content = risuChatParser(content, { chara: speakingChar, role: card.role })
                    }

                    const prompt: OpenAIChat = {
                        role: convertRole[card.role],
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
                    let start = card.rangeStart
                    let end = (card.rangeEnd === 'end') ? promptParts.chats.length : card.rangeEnd
                    if (start === -1000) {
                        start = 0
                        end = promptParts.chats.length
                    }
                    if (start < 0) {
                        start = promptParts.chats.length + start
                        if (start < 0) {
                            start = 0
                        }
                    }
                    if (end < 0) {
                        end = promptParts.chats.length + end
                        if (end < 0) {
                            end = 0
                        }
                    }

                    if (start >= end) {
                        break
                    }
                    let chats = promptParts.chats.slice(start, end)

                    if (promptTemplate && DBState.db.promptSettings.sendChatAsSystem && (!card.chatAsOriginalOnSystem)) {
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
    }
    else {
        for (const key in promptParts) {
            const chats = promptParts[key] as OpenAIChat[]
            for (const chat of chats) {
                reservedTokens += await tokenizer.tokenizeChat(chat)
            }
        }
    }

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


    let msReseted = false
    const makeMs = (currentChat: Chat) => {
        const mss: Message[] = []
        msReseted = false
        for (let i = currentChat.message.length - 1; i >= 0; i--) {
            const d = currentChat.message[i]
            if (d.disabled === true) {
                continue
            }
            if (d.disabled === 'allBefore') {
                msReseted = true
                break
            }
            mss.unshift(d)
        }
        return mss
    }

    let ms: Message[] = makeMs(workingChat)

    if (chatOwner.type !== 'group' && !msReseted) {
        const firstMsg = workingChat.fmIndex === -1 ? chatOwner.firstMessage : chatOwner.alternateGreetings[workingChat.fmIndex]

        const chat: OpenAIChat = {
            role: 'assistant',
            content: await (processScript(chatOwner,
                risuChatParser(firstMsg, { chara: speakingChar }),
                'editprocess'))
        }

        if (promptTemplate && DBState.db.promptSettings.sendName) {
            chat.content = `${speakingChar.name}: ${chat.content}`
            chat.attr = ['nameAdded']
        }
        chats.push(chat)
        reservedTokens += await tokenizer.tokenizeChat(chat)
    }

    console.log('Prepared messages for token calculation:', ms)

    const triggerResult = await runTrigger(speakingChar, 'start', { chat: workingChat })
    if (triggerResult) {
        workingChat = triggerResult.chat
        setCurrentChat(workingChat)
        ms = makeMs(workingChat)
        reservedTokens += triggerResult.tokens
        if (triggerResult.stopSending) {
            chatGenState.generating = false
            return false
        }
    }

    let index = 0
    for (const msg of ms) {
        let formatedChat = (await processScriptFull(chatOwner, risuChatParser(msg.data, { chara: speakingChar, role: msg.role }), 'editprocess', index, {
            chatRole: msg.role,
        })).data
        let name = ''
        if (msg.role === 'char') {
            if (msg.saying) {
                name = `${findCharacterbyIdwithCache(msg.saying).name}`
            }
            else {
                name = `${speakingChar.name}`
            }
        }
        else if (msg.role === 'user') {
            name = `${getUserName()}`
        }
        if (!msg.chatId) {
            msg.chatId = v4()
        }
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

        const multimodal: MultiModal[] = []
        const modelinfo = getModelInfo(DBState.db.aiModel)
        if (inlays.length > 0) {
            for (const inlay of inlays) {
                const inlayName = inlay.replace('{{inlayed::', '').replace('{{inlay::', '').replace('}}', '')
                const inlayData = await getInlayAsset(inlayName)
                if (inlayData?.type === 'image') {
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

        const attr: string[] = []
        let role: 'user' | 'assistant' | 'system' = msg.role === 'user' ? 'user' : 'assistant'

        if (
            (chatOwner.type === 'group' && findCharacterbyIdwithCache(msg.saying).chaId !== speakingChar.chaId) ||
            (chatOwner.type === 'group' && DBState.db.groupOtherBotRole === 'assistant') ||
            (promptTemplate && DBState.db.promptSettings.sendName)
        ) {
            const form = DBState.db.groupTemplate || `<{{char}}\'s Message>\n{{slot}}\n</{{char}}\'s Message>`
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
        const thoughts: string[] = []
        const maxThoughtDepth = DBState.db.promptSettings?.maxThoughtTagDepth ?? -1
        formatedChat = formatedChat.replace(/<Thoughts>(.+)<\/Thoughts>/gms, (match, p1) => {
            if (maxThoughtDepth === -1 || (maxThoughtDepth - ms.length) <= index) {
                thoughts.push(p1)
            }
            return ''
        })

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
                return false
            }

            chats = hn.chats
            reservedTokens = hn.tokens
        }
        else if (DBState.db.hypav2) {
            console.log("Current chat's hypaV2 Data: ", workingChat.hypaV2Data)
            const sp = await hypaMemoryV2(chats, reservedTokens, maxContextTokens, workingChat, chatOwner, tokenizer)
            if (sp.error) {
                console.log(sp)
                displayError(sp.error)
                return false
            }
            chats = sp.chats
            reservedTokens = sp.currentTokens
            workingChat.hypaV2Data = sp.memory ?? workingChat.hypaV2Data
            DBState.currentChat.hypaV2Data = workingChat.hypaV2Data

            workingChat = DBState.currentChat
            console.log("[Expected to be updated] chat's HypaV2Data: ", workingChat.hypaV2Data)
        }
        else if (DBState.db.hypaV3) {
            console.log("Current chat's hypaV3 Data: ", workingChat.hypaV3Data)
            const sp = await hypaMemoryV3(chats, reservedTokens, maxContextTokens, workingChat, chatOwner, tokenizer)
            if (sp.error) {
                // Save new summary
                if (sp.memory) {
                    workingChat.hypaV3Data = sp.memory
                    DBState.currentChat.hypaV3Data = workingChat.hypaV3Data
                }
                console.log(sp)
                displayError(sp.error)
                return false
            }
            chats = sp.chats
            reservedTokens = sp.currentTokens
            workingChat.hypaV3Data = sp.memory ?? workingChat.hypaV3Data
            DBState.currentChat.hypaV3Data = workingChat.hypaV3Data

            workingChat = DBState.currentChat
            console.log("[Expected to be updated] chat's HypaV3Data: ", workingChat.hypaV3Data)
        }
        else {
            const sp = await supaMemory(chats, reservedTokens, maxContextTokens, workingChat, chatOwner, tokenizer, {
                asHyper: DBState.db.hypaMemory
            })
            if (sp.error) {
                displayError(sp.error)
                return false
            }
            chats = sp.chats
            reservedTokens = sp.currentTokens
            workingChat.supaMemoryData = sp.memory ?? workingChat.supaMemoryData
            DBState.currentChat.supaMemoryData = workingChat.supaMemoryData
            console.log(workingChat.supaMemoryData)
            workingChat.lastMemory = sp.lastId ?? workingChat.lastMemory
        }
        stageTimings.stage2Duration = Date.now() - stageTimings.stage2Start
        chatGenState.stage = 1
    }
    else {
        stageTimings.stage1Duration = Date.now() - stageTimings.stage1Start
        while (reservedTokens > maxContextTokens) {
            if (chats.length <= 1) {
                displayError(language.errors.toomuchtoken + "\n\nRequired Tokens: " + reservedTokens)

                return false
            }

            reservedTokens -= await tokenizer.tokenizeChat(chats[0])
            chats.splice(0, 1)
        }
        workingChat.lastMemory = chats[0].memo
    }

    const biases: [string, number][] = DBState.db.bias.concat(speakingChar.bias).map((v) => {
        return [risuChatParser(v[0].replaceAll("\\n", "\n").replaceAll("\\r", "\r").replaceAll("\\\\", "\\"), { chara: speakingChar }), v[1]]
    })

    const memories: OpenAIChat[] = []



    if (!promptTemplate) {
        promptParts.lastChat.push(chats.at(-1))
        chats.splice(chats.length - 1, 1)
    }

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


    //make into one

    let formated: OpenAIChat[] = []
    const formatOrder = $state.snapshot(DBState.db.formatingOrder)
    if (formatOrder) {
        formatOrder.push('postEverything')
    }

    //continue chat model
    if (arg.continue && (DBState.db.aiModel.startsWith('claude') || DBState.db.aiModel.startsWith('gpt') || DBState.db.aiModel.startsWith('openrouter') || DBState.db.aiModel.startsWith('reverse_proxy'))) {
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
                formated.push(chat)
                continue
            }
            if (chat.role === 'system') {
                const endf = formated.at(-1)
                if (endf && endf.role === 'system' && endf.memo === chat.memo && endf.name === chat.name) {
                    formated.at(-1).content += '\n\n' + chat.content
                }
                else {
                    formated.push(chat)
                }
                formated.at(-1).content += ''
            }
            else {
                formated.push(chat)
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

    if (promptTemplate) {
        const template = promptTemplate

        for (const card of template) {
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
                    if (promptTemplate && DBState.db.promptSettings.postEndInnerFormat) {
                        pushPrompts([{
                            role: 'system',
                            content: DBState.db.promptSettings.postEndInnerFormat
                        }])
                    }
                    break
                }
                case 'plain':
                case 'jailbreak': {
                    if ((!DBState.db.jailbreakToggle) && (card.type === 'jailbreak')) {
                        continue
                    }

                    const convertRole = {
                        "system": "system",
                        "user": "user",
                        "bot": "assistant"
                    } as const

                    const posType = card.type === 'plain' ? card.type2 : card.type
                    let content = positionParser(card.text, posType)

                    if (card.type2 === 'globalNote') {
                        if (speakingChar.replaceGlobalNote) {
                            content = positionParser(speakingChar.replaceGlobalNote, posType).replaceAll('{{original}}', content)
                        }
                        if (speakingChar.prebuiltAssetCommand && !card.text.includes('{{//@customimageinstruction}}')) {
                            content += defaultPrebuiltAssetCommand
                        }
                        content = (risuChatParser(content, { chara: speakingChar, role: card.role }))
                    }
                    else if (card.type2 === 'main') {
                        content = (risuChatParser(content, { chara: speakingChar, role: card.role }))
                    }
                    else {
                        content = risuChatParser(content, { chara: speakingChar, role: card.role })
                    }

                    const prompt: OpenAIChat = {
                        role: convertRole[card.role],
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
                    let start = card.rangeStart
                    let end = (card.rangeEnd === 'end') ? promptParts.chats.length : card.rangeEnd
                    if (start === -1000) {
                        start = 0
                        end = promptParts.chats.length
                    }
                    if (start < 0) {
                        start = promptParts.chats.length + start
                        if (start < 0) {
                            start = 0
                        }
                    }
                    if (end < 0) {
                        end = promptParts.chats.length + end
                        if (end < 0) {
                            end = 0
                        }
                    }

                    if (start >= end) {
                        break
                    }

                    let chats = promptParts.chats.slice(start, end)
                    if (promptTemplate && DBState.db.promptSettings.sendChatAsSystem && (!card.chatAsOriginalOnSystem)) {
                        chats = systemizeChat(chats)
                    }
                    pushPrompts(chats)

                    if (DBState.db.automaticCachePoint && !hasCachePoint) {
                        let pointer = formated.length - 1
                        let depthRemaining = 3
                        while (pointer >= 0) {
                            if (depthRemaining === 0) {
                                break
                            }
                            if (formated[pointer].role === 'user') {
                                formated[pointer].cachePoint = true
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
                    let pointer = formated.length - 1
                    let depthRemaining = card.depth
                    while (pointer >= 0) {
                        if (depthRemaining === 0) {
                            break
                        }
                        if (formated[pointer].role === card.role || card.role === 'all') {
                            formated[pointer].cachePoint = true
                            depthRemaining--
                        }
                        pointer--
                    }
                    break
                }
            }
        }
    }
    else {
        for (let i = 0; i < formatOrder.length; i++) {
            const cha = promptParts[formatOrder[i]]
            pushPrompts(cha)
        }
    }


    formated = formated.map((v) => {
        v.content = v.content.trim()
        return v
    })

    if (DBState.db.promptInfoInsideChat && DBState.db.promptTextInfoInsideChat) {
        promptBodyformatedForChatStore = promptBodyformatedForChatStore.map((v) => {
            v.content = v.content.trim()
            return v
        })
    }


    if (speakingChar.depth_prompt && speakingChar.depth_prompt.prompt && speakingChar.depth_prompt.prompt.length > 0) {
        //depth_prompt
        const depthPrompt = speakingChar.depth_prompt
        formated.splice(formated.length - depthPrompt.depth, 0, {
            role: 'system',
            content: risuChatParser(depthPrompt.prompt, { chara: speakingChar })
        })
    }

    formated = await runLuaEditTrigger(speakingChar, 'editRequest', formated)

    if (DBState.db.promptInfoInsideChat && DBState.db.promptTextInfoInsideChat) {
        promptBodyformatedForChatStore = await runLuaEditTrigger(speakingChar, 'editRequest', promptBodyformatedForChatStore)
        promptInfo.promptText = promptBodyformatedForChatStore
    }

    //token rechecking
    let inputTokens = 0

    for (const chat of formated) {
        inputTokens += await tokenizer.tokenizeChat(chat)
    }

    if (inputTokens > maxContextTokens) {
        let pointer = 0
        while (inputTokens > maxContextTokens) {
            if (pointer >= formated.length) {
                displayError(language.errors.toomuchtoken + "\n\nAt token rechecking. Required Tokens: " + inputTokens)
                return false
            }
            if (formated[pointer].removable) {
                inputTokens -= await tokenizer.tokenizeChat(formated[pointer])
                formated[pointer].content = ''
            }
            pointer++
        }
        formated = formated.filter((v) => {
            return v.content !== '' || (v.multimodals && v.multimodals.length > 0)
        })
    }

    //estimate tokens
    let outputTokens = DBState.db.maxResponse
    if (inputTokens + outputTokens > maxContextTokens) {
        outputTokens = maxContextTokens - inputTokens
    }
    const generationId = v4()
    const generationModel = getGenerationModelString()

    const generationInfo: MessageGenerationInfo = {
        model: generationModel,
        generationId: generationId,
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        maxContext: maxContextTokens,
        stageTiming: {
            stage1: stageTimings.stage1Duration,
            stage2: stageTimings.stage2Duration,
            stage3: 0,
            stage4: 0
        }
    }

    /* ========================================
     *       STAGE 3: AI REQUEST
     * ======================================== */
    chatGenState.stage = 3
    stageTimings.stage3Start = Date.now()
    if (arg.preview) {
        previewFormated = formated
        return true
    }

    const req = await requestChatData({
        formated: formated,
        biasString: biases,
        currentChar: speakingChar,
        useStreaming: true,
        isGroupChat: chatOwner.type === 'group',
        bias: {},
        continue: arg.continue,
        chatId: generationId,
        imageResponse: DBState.db.outputImageModal,
        previewBody: arg.previewPrompt,
        escape: chatOwner.type === 'character' && chatOwner.escapeOutput,
        rememberToolUsage: DBState.db.rememberToolUsage,
    }, 'model', abortSignal)

    console.log(req)
    if (req.model) {
        generationInfo.model = getGenerationModelString(req.model)
        console.log(generationInfo.model, req.model)
    }

    if (arg.previewPrompt && req.type === 'success') {
        previewBody = req.result
        return true
    }

    let result = ''
    let emoChanged = false
    let resendChat = false

    if (abortSignal.aborted === true) {
        return false
    }
    if (req.type === 'fail') {
        displayError(req.result)
        return false
    }
    else if (req.type === 'streaming') {
        const reader = req.result.getReader()
        let msgIndex = DBState.currentMessages.length
        let prefix = ''
        if (arg.continue) {
            msgIndex -= 1
            prefix = DBState.currentMessages[msgIndex].data
        }
        else {
            DBState.currentMessages.push({
                role: 'char',
                data: "",
                saying: speakingChar.chaId,
                time: Date.now(),
                generationInfo,
                promptInfo,
                chatId: generationId,
            })
        }
        DBState.currentChat.isStreaming = true
        let lastResponseChunk: { [key: string]: string } = {}
        while (abortSignal.aborted === false) {
            const readed = (await reader.read())
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
                const result2 = await processScriptFull(chatOwner, reformatContent(prefix + result), 'editoutput', msgIndex)
                DBState.currentMessages[msgIndex].data = result2.data
                emoChanged = result2.emoChanged
                chatOwner.reloadKeys += 1
            }
            if (readed.done) {
                DBState.currentChat.isStreaming = false
                chatOwner.reloadKeys += 1
                break
            }
        }

        addRerolls(generationId, Object.values(lastResponseChunk))

        chatOwner.chats[selectedChatPage] = parseChatCBS(DBState.currentChat, speakingChar)
        workingChat = DBState.currentChat
        const triggerResult = await runTrigger(speakingChar, 'output', { chat: workingChat })
        if (triggerResult && triggerResult.chat) {
            workingChat = triggerResult.chat
        }
        if (triggerResult && triggerResult.sendAIprompt) {
            resendChat = true
        }
        const inlayr = runInlayScreen(speakingChar, workingChat.message[msgIndex].data)
        workingChat.message[msgIndex].data = inlayr.text
        chatOwner.chats[selectedChatPage] = workingChat
        if (inlayr.promise) {
            const t = await inlayr.promise
            workingChat.message[msgIndex].data = t
            chatOwner.chats[selectedChatPage] = workingChat
        }
        if (DBState.db.ttsAutoSpeech) {
            await sayTTS(speakingChar, result)
        }
    }
    else {
        const msgs = (req.type === 'success') ? [['char', req.result]] as const
            : (req.type === 'multiline') ? req.result
                : []
        const mrerolls: string[] = []
        for (let i = 0; i < msgs.length; i++) {
            const msg = msgs[i]
            const mess = msg[1]
            let msgIndex = DBState.currentMessages.length
            let result2 = await processScriptFull(chatOwner, reformatContent(mess), 'editoutput', msgIndex)
            if (i === 0 && arg.continue) {
                msgIndex -= 1
                const beforeChat = DBState.currentMessages[msgIndex]
                result2 = await processScriptFull(chatOwner, reformatContent(beforeChat.data + mess), 'editoutput', msgIndex)
            }
            if (DBState.db.removeIncompleteResponse) {
                result2.data = trimUntilPunctuation(result2.data)
            }
            result = result2.data
            const inlayResult = runInlayScreen(speakingChar, result)
            result = inlayResult.text
            emoChanged = result2.emoChanged
            if (i === 0 && arg.continue) {
                DBState.currentMessages[msgIndex] = {
                    role: 'char',
                    data: result,
                    saying: speakingChar.chaId,
                    time: Date.now(),
                    generationInfo,
                    promptInfo,
                    chatId: generationId,
                }
                if (inlayResult.promise) {
                    const p = await inlayResult.promise
                    DBState.currentMessages[msgIndex].data = p
                }
            }
            else if (i === 0) {
                DBState.currentMessages.push({
                    role: msg[0],
                    data: result,
                    saying: speakingChar.chaId,
                    time: Date.now(),
                    generationInfo,
                    promptInfo,
                    chatId: generationId,
                })
                const ind = DBState.currentMessages.length - 1
                if (inlayResult.promise) {
                    const p = await inlayResult.promise
                    DBState.currentMessages[ind].data = p
                }
                mrerolls.push(result)
            }
            else {
                mrerolls.push(result)
            }
            chatOwner.reloadKeys += 1
            if (DBState.db.ttsAutoSpeech) {
                await sayTTS(speakingChar, result)
            }
        }

        if (mrerolls.length > 1) {
            addRerolls(generationId, mrerolls)
        }

        chatOwner.chats[selectedChatPage] = parseChatCBS(DBState.currentChat, speakingChar)
        workingChat = DBState.currentChat

        const triggerResult = await runTrigger(speakingChar, 'output', { chat: workingChat })
        if (triggerResult && triggerResult.chat) {
            chatOwner.chats[selectedChatPage] = triggerResult.chat
        }
        if (triggerResult && triggerResult.sendAIprompt) {
            resendChat = true
        }
    }

    let needsAutoContinue = false
    const resultTokens = await tokenize(result) + (arg.usedContinueTokens || 0)
    if (DBState.db.autoContinueMinTokens > 0 && resultTokens < DBState.db.autoContinueMinTokens) {
        needsAutoContinue = true
    }

    if (DBState.db.autoContinueChat && (!isLastCharPunctuation(result))) {
        //if result doesn't end with punctuation or special characters, auto continue
        needsAutoContinue = true
    }

    if (needsAutoContinue) {
        chatGenState.generating = false
        return await sendChat(chatProcessIndex, {
            continue: true,
            signal: abortSignal,
            usedContinueTokens: resultTokens
        })
    }

    const igp = risuChatParser(DBState.db.igpPrompt ?? "")

    if (igp) {
        const igpFormated = parseChatML(igp)
        const rq = await requestChatData({
            formated: igpFormated,
            bias: {}
        }, 'emotion', abortSignal)

        DBState.currentMessages.at(-1).data += rq
    }

    stageTimings.stage3Duration = Date.now() - stageTimings.stage3Start

    if (generationInfo.stageTiming) {
        generationInfo.stageTiming.stage3 = stageTimings.stage3Duration
    }

    /* ========================================
     *       STAGE 4: POST PROCESSING
     * ======================================== */
    chatGenState.stage = 4
    stageTimings.stage4Start = Date.now()

    if (resendChat) {
        stageTimings.stage4Duration = Date.now() - stageTimings.stage4Start

        if (generationInfo.stageTiming) {
            generationInfo.stageTiming.stage1 = stageTimings.stage1Duration
            generationInfo.stageTiming.stage2 = stageTimings.stage2Duration
            generationInfo.stageTiming.stage3 = stageTimings.stage3Duration
            generationInfo.stageTiming.stage4 = stageTimings.stage4Duration
        }

        const lastMessage = DBState.currentMessages.at(-1)
        if (lastMessage?.generationInfo) {
            lastMessage.generationInfo = generationInfo
        }

        chatGenState.generating = false
        return await sendChat(chatProcessIndex, {
            signal: abortSignal
        })
    }

    if (DBState.db.notification) {
        try {
            const permission = await Notification.requestPermission()
            if (permission === 'granted') {
                const noti = new Notification('Risuai', {
                    body: result
                })
                noti.onclick = () => {
                    window.focus()
                }
            }
        } catch (error) {

        }
    }

    peerSync()

    if (req.special) {
        if (req.special.emotion) {
            const charemotions = get(CharEmotion)
            const currentEmotion = speakingChar.emotionImages

            let tempEmotion = charemotions[speakingChar.chaId]
            if (!tempEmotion) {
                tempEmotion = []
            }
            if (tempEmotion.length > 4) {
                tempEmotion.splice(0, 1)
            }

            for (const emo of currentEmotion) {
                if (emo[0] === req.special.emotion) {
                    const emos: [string, string, number] = [emo[0], emo[1], Date.now()]
                    tempEmotion.push(emos)
                    charemotions[speakingChar.chaId] = tempEmotion
                    CharEmotion.set(charemotions)
                    emoChanged = true
                    break
                }
            }
        }
    }

    if (!speakingChar.inlayViewScreen) {
        if (speakingChar.viewScreen === 'emotion' && (!emoChanged) && (abortSignal.aborted === false)) {

            const currentEmotion = speakingChar.emotionImages
            let emotionList = currentEmotion.map((a) => {
                return a[0]
            })
            const charemotions = get(CharEmotion)

            let tempEmotion = charemotions[speakingChar.chaId]
            if (!tempEmotion) {
                tempEmotion = []
            }
            if (tempEmotion.length > 4) {
                tempEmotion.splice(0, 1)
            }

            if (DBState.db.emotionProcesser === 'embedding') {
                const hypaProcesser = new HypaProcesser()
                await hypaProcesser.addText(emotionList.map((v) => 'emotion:' + v))
                const searched = (await hypaProcesser.similaritySearchScored(result)).map((v) => {
                    v[0] = v[0].replace("emotion:", '')
                    return v
                })

                //give panaltys
                for (let i = 0; i < tempEmotion.length; i++) {
                    const emo = tempEmotion[i]
                    //give panalty index
                    const index = searched.findIndex((v) => {
                        return v[0] === emo[0]
                    })

                    const modifier = ((5 - ((tempEmotion.length - (i + 1))))) / 200

                    if (index !== -1) {
                        searched[index][1] -= modifier
                    }
                }

                //make a sorted array by score
                const emoresult = searched.sort((a, b) => {
                    return b[1] - a[1]
                }).map((v) => {
                    return v[0]
                })

                for (const emo of currentEmotion) {
                    if (emo[0] === emoresult[0]) {
                        const emos: [string, string, number] = [emo[0], emo[1], Date.now()]
                        tempEmotion.push(emos)
                        charemotions[speakingChar.chaId] = tempEmotion
                        CharEmotion.set(charemotions)
                        break
                    }
                }



                return true
            }

            const emobias: { [key: number]: number } = {}

            for (const emo of emotionList) {
                const tokens = await tokenizeNum(emo)
                for (const token of tokens) {
                    emobias[token] = 10
                }
            }

            for (let i = 0; i < tempEmotion.length; i++) {
                const emo = tempEmotion[i]

                const tokens = await tokenizeNum(emo[0])
                const modifier = 20 - ((tempEmotion.length - (i + 1)) * (20 / 4))

                for (const token of tokens) {
                    emobias[token] -= modifier
                    if (emobias[token] < -100) {
                        emobias[token] = -100
                    }
                }
            }

            const promptbody: OpenAIChat[] = [
                {
                    role: 'system',
                    content: `${DBState.db.emotionPrompt2 || "From the list below, choose a word that best represents a character's outfit description, action, or emotion in their dialogue. Prioritize selecting words related to outfit first, then action, and lastly emotion. Print out the chosen word."}\n\n list: ${shuffleArray(emotionList).join(', ')} \noutput only one word.`
                },
                {
                    role: 'user',
                    content: `"Good morning, Master! Is there anything I can do for you today?"`
                },
                {
                    role: 'assistant',
                    content: 'happy'
                },
                {
                    role: 'user',
                    content: result
                },
            ]

            const rq = await requestChatData({
                formated: promptbody,
                bias: emobias,
                currentChar: speakingChar,
                maxTokens: 30,
            }, 'emotion', abortSignal)

            if (rq.type === 'fail') {
                if (abortSignal.aborted) {
                    return true
                }
                displayError(rq.result)
                return true
            }
            if (rq.type === 'streaming' || rq.type === 'multiline') {
                if (abortSignal.aborted) {
                    return true
                }
                displayError('Unexpected response type')
                return true
            }
            else {
                emotionList = currentEmotion.map((a) => {
                    return a[0]
                })
                try {
                    const emotion: string = rq.result.replace(/ |\n/g, '').trim().toLocaleLowerCase()
                    let emotionSelected = false
                    for (const emo of currentEmotion) {
                        if (emo[0] === emotion) {
                            const emos: [string, string, number] = [emo[0], emo[1], Date.now()]
                            tempEmotion.push(emos)
                            charemotions[speakingChar.chaId] = tempEmotion
                            CharEmotion.set(charemotions)
                            emotionSelected = true
                            break
                        }
                    }
                    if (!emotionSelected) {
                        for (const emo of currentEmotion) {
                            if (emotion.includes(emo[0])) {
                                const emos: [string, string, number] = [emo[0], emo[1], Date.now()]
                                tempEmotion.push(emos)
                                charemotions[speakingChar.chaId] = tempEmotion
                                CharEmotion.set(charemotions)
                                emotionSelected = true
                                break
                            }
                        }
                    }
                    if (!emotionSelected && emotionList.includes('neutral')) {
                        const emo = currentEmotion[emotionList.indexOf('neutral')]
                        const emos: [string, string, number] = [emo[0], emo[1], Date.now()]
                        tempEmotion.push(emos)
                        charemotions[speakingChar.chaId] = tempEmotion
                        CharEmotion.set(charemotions)
                        emotionSelected = true
                    }
                } catch (error) {
                    displayError(language.errors.httpError + `${error}`)
                    return true
                }
            }

            return true


        }
        else if (speakingChar.viewScreen === 'imggen') {
            if (chatProcessIndex !== -1) {
                displayError("Stable diffusion in group chat is not supported")
                return false
            }

            const msgs = DBState.currentMessages
            let msgStr = ''
            for (let i = (msgs.length - 1); i >= 0; i--) {
                if (msgs[i].role === 'char') {
                    msgStr = `character: ${msgs[i].data.replace(/\n/g, ' ')} \n` + msgStr
                }
                else {
                    msgStr = `user: ${msgs[i].data.replace(/\n/g, ' ')} \n` + msgStr
                    break
                }
            }


            await stableDiff(speakingChar, msgStr)
        }
    }

    stageTimings.stage4Duration = Date.now() - stageTimings.stage4Start

    if (generationInfo.stageTiming) {
        generationInfo.stageTiming.stage1 = stageTimings.stage1Duration
        generationInfo.stageTiming.stage2 = stageTimings.stage2Duration
        generationInfo.stageTiming.stage3 = stageTimings.stage3Duration
        generationInfo.stageTiming.stage4 = stageTimings.stage4Duration
    }

    const lastMessage = DBState.currentMessages.at(-1)
    if (lastMessage?.generationInfo) {
        lastMessage.generationInfo = generationInfo
    }

    return true
}

