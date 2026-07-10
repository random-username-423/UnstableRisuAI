import { type character, type MessageGenerationInfo, type Chat, type MessagePresetInfo } from "../data/storage/types"
import { setCurrentChat } from "../data/storage/database.svelte"
import { changeToPreset } from "../data/storage/utils/presetManager"
import { DBState, ChatState } from "../stores.svelte"
import { ChatTokenizer, tokenize } from "../utils/tokenizer"
import { language } from "../../lang"
import { alertError, alertToast } from "../utils/alert.svelte"
import {
    findCharacterbyId,
    getUserName,
    isLastCharPunctuation,
    trimUntilPunctuation,
    parseToggleSyntax,
    prebuiltAssetCommand,
} from "../utils/util"
import { requestChatData } from "./request/request"
import { processScript, processScriptFull, risuChatParser } from "src/ts/process/scripting/scripts"
import { exampleMessage } from "src/ts/process/prompt/exampleMessages"
import { sayTTS } from "src/ts/process/postprocess/tts"
import { supaMemory } from "./memory/supaMemory"
import { v4 } from "uuid"
import { groupOrder } from "src/ts/process/chat/group"
import { runTrigger } from "src/ts/process/scripting/triggers"
import { getInlayAsset } from "./files/inlays"
import { getGenerationModelString } from "./models/modelString"
import { connectionOpen, peerRevertChat, peerSafeCheck, peerSync } from "../data/sync/multiuser.svelte"
import { runInlayScreen } from "src/ts/process/postprocess/inlayScreen"
import { addRerolls } from "src/ts/process/chat/prereroll"
import { runImageEmbedding } from "src/ts/process/integrations/transformers"
import { hanuraiMemory } from "./memory/hanuraiMemory"
import { hypaMemoryV2 } from "./memory/hypav2"
import { runLuaEditTrigger } from "src/ts/process/scripting/scriptings"
import { parseChatML } from "../utils/parser.svelte"
import { getModelInfo } from "../model/modellist"
import { LLMFlags } from "../model/types"
import { hypaMemoryV3 } from "./memory/hypav3"
import { getModuleAssets, getModuleToggles } from "src/ts/process/scripting/modules"
import { readImage } from "../utils/fileIO"
import type { OpenAIChat, OpenAIChatFull, MultiModal, requestTokenPart } from "./chatTypes"
import {
    processEmotionScreen,
    processImageGenScreen,
    updateEmotionFromSpecial,
} from "src/ts/process/postprocess/postprocessing"
import {
    createEmptyUnformated,
    buildLegacyPrompts,
    buildAuthorNote,
    buildChainOfThought,
    buildDescription,
    buildLorebookPrompts,
    buildPersonaPrompt,
    buildInlayViewScreenPrompts,
    buildPostEverythingLorebooks,
    getInjectionLorebooks,
    createPositionParser,
    type LorebookData,
} from "src/ts/process/prompt/promptBuilder"
// New modular imports (for future refactoring)

import { saveEncryptedThinkingFromChunk } from "src/ts/process/chat/responseHandler"

export type { OpenAIChat, OpenAIChatFull, MultiModal, requestTokenPart }

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export const DoingChatState = $state({ value: false })
export const ChatProcessStageState = $state({ value: 0 })
export const AbortChatState = $state({ value: false })
export const requestTokenParts: { [key: string]: requestTokenPart[] } = {}
export let previewFormated: OpenAIChat[] = []
export let previewBody: string = ""

export async function sendChat(
    chatProcessIndex = -1,
    arg: {
        chatAdditonalTokens?: number
        signal?: AbortSignal
        continue?: boolean
        usedContinueTokens?: number
        preview?: boolean
        previewPrompt?: boolean
    } = {}
): Promise<boolean> {
    ChatProcessStageState.value = 0
    const abortSignal = arg.signal ?? new AbortController().signal

    const stageTimings = {
        stage1Start: 0,
        stage2Start: 0,
        stage3Start: 0,
        stage4Start: 0,
        stage1Duration: 0,
        stage2Duration: 0,
        stage3Duration: 0,
        stage4Duration: 0,
    }

    const isAborted = false
    const findCharCache: { [key: string]: character } = {}
    function findCharacterbyIdwithCache(id: string) {
        const d = findCharCache[id]
        if (d) {
            return d
        } else {
            const r = findCharacterbyId(id)
            findCharCache[id] = r
            return r
        }
    }

    function runCurrentChatFunction(chat: Chat) {
        chat.message = chat.message.map((v) => {
            v.data = risuChatParser(v.data, { chara: currentChar, runVar: true })
            return v
        })
        return chat
    }

    // Originally removed `${currentChar.name}:` prefix from AI responses when chatProcessIndex !== -1
    // This was removed in commit 00285cc97 ("[fix] remove trimming") on 2023-12-18
    // Now both branches do the same thing, so the condition is no longer needed
    function reformatContent(data: string) {
        return data.trim()
    }

    function throwError(error: string) {
        if (DBState.db.inlayErrorResponse) {
            if (
                DBState.db.characters[selectedChar].chats[selectedChat].message[
                    DBState.db.characters[selectedChar].chats[selectedChat].message.length - 1
                ].role === "char"
            ) {
                DBState.db.characters[selectedChar].chats[selectedChat].message[
                    DBState.db.characters[selectedChar].chats[selectedChat].message.length - 1
                ].data += `\n\`\`\`risuerror\n${error}\n\`\`\``
            } else {
                DBState.db.characters[selectedChar].chats[selectedChat].message.push({
                    role: "char",
                    data: `\`\`\`risuerror\n${error}\n\`\`\``,
                    saying: currentChar.chaId,
                    time: Date.now(),
                    generationInfo,
                })
            }

            return
        }

        alertError(error)
        return
    }

    const isDoing = DoingChatState.value

    if (isDoing) {
        if (chatProcessIndex === -1) {
            return false
        }
    }
    DoingChatState.value = true

    if (chatProcessIndex === -1 && DBState.db.presetChain) {
        const names = DBState.db.presetChain.split(",").map((v) => v.trim())
        const randomSelect = Math.floor(Math.random() * names.length)
        const ele = names[randomSelect]

        const findId = DBState.db.botPresets.findIndex((v) => {
            return v.name === ele
        })

        if (findId === -1) {
            alertToast(`Cannot find preset: ${ele}`)
        } else {
            changeToPreset(findId, true)
        }
    }

    if (connectionOpen) {
        ChatProcessStageState.value = 4
        const peerSafe = await peerSafeCheck()
        if (!peerSafe) {
            peerRevertChat()
            DoingChatState.value = false
            throwError(language.otherUserRequesting)
            return false
        }
        await peerSync()
        ChatProcessStageState.value = 0
    }

    DBState.db.statics.messages += 1
    const selectedChar = ChatState.selectedCharId
    const nowChatroom = DBState.db.characters[selectedChar]
    nowChatroom.lastInteraction = Date.now()
    const selectedChat = nowChatroom.chatPage
    nowChatroom.chats[nowChatroom.chatPage].message = nowChatroom.chats[nowChatroom.chatPage].message.map((v) => {
        v.chatId = v.chatId ?? v4()
        return v
    })

    // ─────────────────────────────────────────────────────────
    // Snapshot preset name & toggles before sending a message.
    // Ensures correct metadata is recorded, even if presets
    // change immediately after clicking "send".
    //
    // Used later in promptInfo assembly (e.g. promptInfo.promptText)
    // ─────────────────────────────────────────────────────────
    let promptInfo: MessagePresetInfo = {}
    let initialPresetNameForPromptInfo = null
    let initialPromptTogglesForPromptInfo: {
        key: string
        value: string
    }[] = []
    if (DBState.db.promptInfoInsideChat) {
        initialPresetNameForPromptInfo = DBState.db.botPresets[DBState.db.botPresetsId]?.name ?? ""
        initialPromptTogglesForPromptInfo = parseToggleSyntax(
            DBState.db.customPromptTemplateToggle + getModuleToggles()
        ).flatMap((toggle) => {
            const raw = DBState.db.globalChatVariables[`toggle_${toggle.key}`]
            if (toggle.type === "select" || toggle.type === "text") {
                return [{ key: toggle.value, value: toggle.options[raw] }]
            }
            if (raw === "1") {
                return [{ key: toggle.value, value: "ON" }]
            }
            return []
        })

        promptInfo = {
            promptName: initialPresetNameForPromptInfo,
            promptToggles: initialPromptTogglesForPromptInfo,
        }
    }
    // ─────────────────────────────────────────────────────────────

    let currentChar: character
    let caculatedChatTokens = 0
    if (DBState.db.aiModel.startsWith("gpt")) {
        caculatedChatTokens += 5
    } else {
        caculatedChatTokens += 3
    }

    if (nowChatroom.type === "group") {
        if (chatProcessIndex === -1) {
            const charNames = nowChatroom.characters.map((v) => findCharacterbyIdwithCache(v).name)

            const messages = nowChatroom.chats[nowChatroom.chatPage].message
            const lastMessage = messages[messages.length - 1]
            let order = nowChatroom.characters
                .map((v, i) => {
                    return {
                        id: v,
                        talkness: nowChatroom.characterActive[i] ? nowChatroom.characterTalks[i] : -1,
                        index: i,
                    }
                })
                .filter((v) => {
                    return v.talkness > 0
                })
            if (!nowChatroom.orderByOrder) {
                order = groupOrder(order, lastMessage?.data).filter((v) => {
                    if (v.id === lastMessage?.saying) {
                        return false
                    }
                    return true
                })
            }
            for (let i = 0; i < order.length; i++) {
                const r = await sendChat(order[i].index, {
                    chatAdditonalTokens: caculatedChatTokens,
                    signal: abortSignal,
                })
                if (!r) {
                    return false
                }
            }
            return true
        } else {
            currentChar = findCharacterbyIdwithCache(nowChatroom.characters[chatProcessIndex])
            if (!currentChar) {
                throwError(`cannot find character: ${nowChatroom.characters[chatProcessIndex]}`)
                return false
            }
        }
    } else {
        currentChar = nowChatroom
    }

    const chatAdditonalTokens = arg.chatAdditonalTokens ?? caculatedChatTokens
    const tokenizer = new ChatTokenizer(chatAdditonalTokens, DBState.db.aiModel.startsWith("gpt") ? "noName" : "name")
    let currentChat = runCurrentChatFunction(nowChatroom.chats[selectedChat])
    nowChatroom.chats[selectedChat] = currentChat
    // TODO: 모델 최대 컨텍스트 넘으면 강제로 제한할지 말지 정하기
    const maxContextTokens = DBState.db.maxContext

    ChatProcessStageState.value = 1
    stageTimings.stage1Start = Date.now()
    const unformated = createEmptyUnformated()

    let promptTemplate = safeStructuredClone(DBState.db.promptTemplate)
    const usingPromptTemplate = !!promptTemplate
    if (promptTemplate) {
        let hasPostEverything = false
        for (const card of promptTemplate) {
            if (card.type === "postEverything") {
                hasPostEverything = true
                break
            }
        }

        if (!hasPostEverything) {
            promptTemplate.push({
                type: "postEverything",
            })
        }
    }
    if (currentChar.utilityBot && !(usingPromptTemplate && DBState.db.promptSettings.utilOverride)) {
        promptTemplate = [
            {
                type: "plain",
                text: "",
                role: "system",
                type2: "main",
            },
            {
                type: "description",
            },
            {
                type: "lorebook",
            },
            {
                type: "chat",
                rangeStart: 0,
                rangeEnd: "end",
            },
            {
                type: "plain",
                text: "",
                role: "system",
                type2: "globalNote",
            },
            {
                type: "postEverything",
            },
        ]
    }

    // Build legacy prompts (main, jailbreak, globalNote) if not using template
    if (!currentChar.utilityBot && !promptTemplate) {
        buildLegacyPrompts(unformated, currentChar)
    }

    // Build author note
    buildAuthorNote(unformated, currentChat, currentChar)

    // Build chain of thought
    buildChainOfThought(unformated, usingPromptTemplate)

    // Build description
    await buildDescription(unformated, currentChar, currentChat, nowChatroom.type === "group")

    // Build lorebook prompts
    const lorepmt: LorebookData = await buildLorebookPrompts(unformated, currentChar)

    // Build persona prompt
    buildPersonaPrompt(unformated, currentChar)

    // Build inlay view screen prompts
    buildInlayViewScreenPrompts(unformated, currentChar)

    // Build postEverything lorebooks
    buildPostEverythingLorebooks(unformated, lorepmt, currentChar)

    // Get injection lorebooks
    const { injectionLorebooks, injectionLorePosSet } = getInjectionLorebooks(lorepmt)

    // Create position parser
    const positionParser = createPositionParser(injectionLorebooks, injectionLorePosSet, lorepmt)

    //await tokenize currernt
    let currentTokens = DBState.db.maxResponse
    let supaMemoryCardUsed = false

    //for unexpected error
    currentTokens += 50

    let hasCachePoint = false
    if (promptTemplate) {
        const template = promptTemplate

        async function tokenizeChatArray(chats: OpenAIChat[]) {
            for (const chat of chats) {
                const tokens = await tokenizer.tokenizeChat(chat)
                currentTokens += tokens
            }
        }

        for (const card of template) {
            switch (card.type) {
                case "persona": {
                    const pmt = safeStructuredClone(unformated.personaPrompt)
                    if (card.innerFormat && pmt.length > 0) {
                        for (let i = 0; i < pmt.length; i++) {
                            pmt[i].content = risuChatParser(positionParser(card.innerFormat, card.type), {
                                chara: currentChar,
                            }).replace("{{slot}}", pmt[i].content)
                        }
                    }

                    await tokenizeChatArray(pmt)
                    break
                }
                case "description": {
                    const pmt = safeStructuredClone(unformated.description)
                    if (card.innerFormat && pmt.length > 0) {
                        for (let i = 0; i < pmt.length; i++) {
                            pmt[i].content = risuChatParser(positionParser(card.innerFormat, card.type), {
                                chara: currentChar,
                            }).replace("{{slot}}", pmt[i].content)
                        }
                    }

                    await tokenizeChatArray(pmt)
                    break
                }
                case "authornote": {
                    const pmt = safeStructuredClone(unformated.authorNote)
                    if (card.innerFormat && pmt.length > 0) {
                        for (let i = 0; i < pmt.length; i++) {
                            pmt[i].content = risuChatParser(positionParser(card.innerFormat, card.type), {
                                chara: currentChar,
                            }).replace("{{slot}}", pmt[i].content || card.defaultText || "")
                        }
                    }

                    await tokenizeChatArray(pmt)
                    break
                }
                case "lorebook": {
                    await tokenizeChatArray(unformated.lorebook)
                    break
                }
                case "postEverything": {
                    await tokenizeChatArray(unformated.postEverything)
                    if (usingPromptTemplate && DBState.db.promptSettings.postEndInnerFormat) {
                        await tokenizeChatArray([
                            {
                                role: "system",
                                content: DBState.db.promptSettings.postEndInnerFormat,
                            },
                        ])
                    }
                    break
                }
                case "plain":
                case "jailbreak":
                case "cot": {
                    if (!DBState.db.jailbreakToggle && card.type === "jailbreak") {
                        continue
                    }
                    if (!DBState.db.chainOfThought && card.type === "cot") {
                        continue
                    }

                    const convertRole = {
                        system: "system",
                        user: "user",
                        bot: "assistant",
                    } as const

                    const posType = card.type === "plain" ? card.type2 : card.type
                    let content = positionParser(card.text, posType)

                    if (card.type2 === "globalNote") {
                        if (currentChar.replaceGlobalNote) {
                            content = positionParser(currentChar.replaceGlobalNote, posType).replaceAll(
                                "{{original}}",
                                content
                            )
                        }

                        if (currentChar.prebuiltAssetCommand && !card.text.includes("{{//@customimageinstruction}}")) {
                            content += prebuiltAssetCommand
                        }
                        content = risuChatParser(content, { chara: currentChar, role: card.role })
                    } else if (card.type2 === "main") {
                        content = risuChatParser(content, { chara: currentChar, role: card.role })
                    } else {
                        content = risuChatParser(content, { chara: currentChar, role: card.role })
                    }

                    const prompt: OpenAIChat = {
                        role: convertRole[card.role],
                        content: content,
                    }

                    await tokenizeChatArray([prompt])
                    break
                }
                case "chatML": {
                    const prompts = parseChatML(card.text)
                    await tokenizeChatArray(prompts)
                    break
                }
                case "chat": {
                    let start = card.rangeStart
                    let end = card.rangeEnd === "end" ? unformated.chats.length : card.rangeEnd
                    if (start === -1000) {
                        start = 0
                        end = unformated.chats.length
                    }
                    if (start < 0) {
                        start = unformated.chats.length + start
                        if (start < 0) {
                            start = 0
                        }
                    }
                    if (end < 0) {
                        end = unformated.chats.length + end
                        if (end < 0) {
                            end = 0
                        }
                    }

                    if (start >= end) {
                        break
                    }
                    let chats = unformated.chats.slice(start, end)

                    if (
                        usingPromptTemplate &&
                        DBState.db.promptSettings.sendChatAsSystem &&
                        !card.chatAsOriginalOnSystem
                    ) {
                        chats = systemizeChat(chats)
                    }
                    await tokenizeChatArray(chats)
                    break
                }
                case "memory": {
                    supaMemoryCardUsed = true
                    break
                }
                case "cache": {
                    hasCachePoint = true
                    break
                }
            }
        }
    } else {
        for (const key in unformated) {
            const chats = unformated[key] as OpenAIChat[]
            for (const chat of chats) {
                currentTokens += await tokenizer.tokenizeChat(chat)
            }
        }
    }

    const examples = exampleMessage(currentChar, getUserName())

    for (const example of examples) {
        currentTokens += await tokenizer.tokenizeChat(example)
    }

    let chats: OpenAIChat[] = examples

    if (!DBState.db.aiModel.startsWith("novelai") && DBState.db.newChatSeparator) {
        chats.push({
            role: "system",
            content: "[Start a new chat]",
            memo: "NewChat",
        })
    }

    if (nowChatroom.type !== "group") {
        const firstMsg =
            currentChat.fmIndex === -1 ? nowChatroom.firstMessage : nowChatroom.alternateGreetings[currentChat.fmIndex]

        const chat: OpenAIChat = {
            role: "assistant",
            content: await processScript(nowChatroom, risuChatParser(firstMsg, { chara: currentChar }), "editprocess"),
        }

        if (usingPromptTemplate && DBState.db.promptSettings.sendName) {
            chat.content = `${currentChar.name}: ${chat.content}`
            chat.attr = ["nameAdded"]
        }
        chats.push(chat)
        currentTokens += await tokenizer.tokenizeChat(chat)
    }

    let ms = currentChat.message

    const triggerResult = await runTrigger(currentChar, "start", { chat: currentChat })
    if (triggerResult) {
        currentChat = triggerResult.chat
        setCurrentChat(currentChat)
        ms = currentChat.message
        currentTokens += triggerResult.tokens
        if (triggerResult.stopSending) {
            DoingChatState.value = false
            return false
        }
    }

    // pastThinkingSend: 0 = None, 1 = Send (include in maxContext), 2 = Send (Extra Context)
    const pastThinkingSend = DBState.db.pastThinkingSend ?? 1
    const pastThinkingExtraTokens = DBState.db.pastThinkingExtraTokens ?? 16000

    let index = 0
    for (const msg of ms) {
        let formatedChat = (
            await processScriptFull(
                nowChatroom,
                risuChatParser(msg.data, { chara: currentChar, role: msg.role }),
                "editprocess",
                index,
                {
                    chatRole: msg.role,
                }
            )
        ).data
        let name = ""
        if (msg.role === "char") {
            if (msg.saying) {
                name = `${findCharacterbyIdwithCache(msg.saying).name}`
            } else {
                name = `${currentChar.name}`
            }
        } else if (msg.role === "user") {
            name = `${getUserName()}`
        }
        if (!msg.chatId) {
            msg.chatId = v4()
        }

        // Remove <Thoughts> content before extracting inlays
        // so that inlayed images inside thoughts are not sent in the request
        const thoughts: string[] = []
        const maxThoughtDepth = DBState.db.promptSettings?.maxThoughtTagDepth ?? -1
        formatedChat = formatedChat.replace(/<Thoughts>(.+)<\/Thoughts>/gms, (match, p1) => {
            if (maxThoughtDepth === -1 || maxThoughtDepth - ms.length <= index) {
                thoughts.push(p1)
            }
            return ""
        })

        const inlays: string[] = []
        if (msg.role === "char") {
            formatedChat = formatedChat.replace(
                /{{(inlay|inlayed|inlayeddata)::(.+?)}}/g,
                (match: string, p1: string, p2: string) => {
                    if (p2 && p1 === "inlayeddata") {
                        inlays.push(p2)
                    }
                    return ""
                }
            )
        } else {
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
                const inlayName = inlay.replace("{{inlayed::", "").replace("{{inlay::", "").replace("}}", "")
                const inlayData = await getInlayAsset(inlayName)
                if (inlayData?.type === "image") {
                    if (modelinfo.flags.includes(LLMFlags.hasImageInput)) {
                        multimodal.push({
                            type: "image",
                            base64: inlayData.data,
                            width: inlayData.width,
                            height: inlayData.height,
                        })
                    } else {
                        const captionResult = await runImageEmbedding(inlayData.data)
                        formatedChat += `[${captionResult[0].generated_text}]`
                    }
                }
                if (inlayData?.type === "video" || inlayData?.type === "audio") {
                    if (multimodal.length === 0) {
                        multimodal.push({
                            type: inlayData.type,
                            base64: inlayData.data,
                        })
                    }
                }
                formatedChat = formatedChat.replace(inlay, "")
            }
        }

        const attr: string[] = []
        let role: "user" | "assistant" | "system" = msg.role === "user" ? "user" : "assistant"

        if (
            (nowChatroom.type === "group" && findCharacterbyIdwithCache(msg.saying).chaId !== currentChar.chaId) ||
            (nowChatroom.type === "group" && DBState.db.groupOtherBotRole === "assistant") ||
            (usingPromptTemplate && DBState.db.promptSettings.sendName)
        ) {
            const form = DBState.db.groupTemplate || `<{{char}}'s Message>\n{{slot}}\n</{{char}}'s Message>`
            formatedChat = risuChatParser(form, { chara: findCharacterbyIdwithCache(msg.saying).name }).replace(
                "{{slot}}",
                formatedChat
            )
            switch (DBState.db.groupOtherBotRole) {
                case "user":
                case "assistant":
                case "system":
                    role = DBState.db.groupOtherBotRole
                    break
                default:
                    role = "assistant"
                    break
            }
        }

        const assetPromises: Promise<void>[] = []
        formatedChat = formatedChat.replace(/\{\{asset_?prompt::(.+?)\}\}/gimsu, (match, p1) => {
            const moduleAssets = getModuleAssets()
            const assets = (currentChar.additionalAssets ?? []).concat(moduleAssets)
            const asset = assets.find((v) => {
                return v[0] === p1
            })
            if (asset) {
                assetPromises.push(
                    (async () => {
                        const assetDataBuf = await readImage(asset[1])
                        multimodal.push({
                            type: "image",
                            base64: `data:image/png;base64,${Buffer.from(assetDataBuf).toString("base64")}`,
                        })
                    })()
                )
            } else if (p1 === "icon") {
                assetPromises.push(
                    (async () => {
                        const assetDataBuf = await readImage(currentChar.image ?? "")
                        multimodal.push({
                            type: "image",
                            base64: `data:image/png;base64,${Buffer.from(assetDataBuf).toString("base64")}`,
                        })
                    })()
                )
            }
            return ""
        })
        await Promise.all(assetPromises)

        const chat: OpenAIChat = {
            role: role,
            content: formatedChat,
            memo: msg.chatId,
            attr: attr,
            multimodals: multimodal,
            thoughts: thoughts,
            encryptedThinking:
                pastThinkingSend !== 0 && msg.encryptedThinking
                    ? msg.encryptedThinking.filter(
                          (et): et is { provider: string; data: any; tokens: number } =>
                              et.tokens != null && et.tokens > 0
                      )
                    : undefined,
        }
        if (chat.multimodals.length === 0) {
            delete chat.multimodals
        }
        if (chat.encryptedThinking && chat.encryptedThinking.length === 0) {
            delete chat.encryptedThinking
        }
        chats.push(chat)

        // Calculate tokens: base chat tokens + thinking tokens (mode 1 only)
        let chatTokens = await tokenizer.tokenizeChat(chat)
        if (pastThinkingSend === 1 && chat.encryptedThinking) {
            for (const et of chat.encryptedThinking) {
                chatTokens += et.tokens
            }
        }
        currentTokens += chatTokens
        index++
    }

    const depthPrompts = lorepmt.actives.filter((v) => {
        return (v.pos === "depth" && v.depth > 0) || v.pos === "reverse_depth"
    })

    for (const depthPrompt of depthPrompts) {
        const chat: OpenAIChat = {
            role: depthPrompt.role,
            content: risuChatParser(depthPrompt.prompt, { chara: currentChar }),
        }
        currentTokens += await tokenizer.tokenizeChat(chat)
    }

    if (
        nowChatroom.supaMemory &&
        (DBState.db.supaModelType !== "none" || DBState.db.hanuraiEnable || DBState.db.hypav2 || DBState.db.hypaV3)
    ) {
        stageTimings.stage1Duration = Date.now() - stageTimings.stage1Start
        ChatProcessStageState.value = 2
        stageTimings.stage2Start = Date.now()
        if (DBState.db.hanuraiEnable) {
            const hn = await hanuraiMemory(chats, {
                currentTokens,
                maxContextTokens,
                tokenizer,
            })

            if (hn === false) {
                return false
            }

            chats = hn.chats
            currentTokens = hn.tokens
        } else if (DBState.db.hypav2) {
            console.log("Current chat's hypaV2 Data: ", currentChat.hypaV2Data)
            const sp = await hypaMemoryV2(chats, currentTokens, maxContextTokens, currentChat, nowChatroom, tokenizer)
            if (sp.error) {
                console.log(sp)
                throwError(sp.error)
                return false
            }
            chats = sp.chats
            currentTokens = sp.currentTokens
            currentChat.hypaV2Data = sp.memory ?? currentChat.hypaV2Data
            DBState.db.characters[selectedChar].chats[selectedChat].hypaV2Data = currentChat.hypaV2Data

            currentChat = DBState.db.characters[selectedChar].chats[selectedChat]
            console.log("[Expected to be updated] chat's HypaV2Data: ", currentChat.hypaV2Data)
        } else if (DBState.db.hypaV3) {
            console.log("Current chat's hypaV3 Data: ", currentChat.hypaV3Data)
            const sp = await hypaMemoryV3(chats, currentTokens, maxContextTokens, currentChat, nowChatroom, tokenizer)
            if (sp.error) {
                // Save new summary
                if (sp.memory) {
                    currentChat.hypaV3Data = sp.memory
                    DBState.db.characters[selectedChar].chats[selectedChat].hypaV3Data = currentChat.hypaV3Data
                }
                console.log(sp)
                throwError(sp.error)
                return false
            }
            chats = sp.chats
            currentTokens = sp.currentTokens
            currentChat.hypaV3Data = sp.memory ?? currentChat.hypaV3Data
            DBState.db.characters[selectedChar].chats[selectedChat].hypaV3Data = currentChat.hypaV3Data

            currentChat = DBState.db.characters[selectedChar].chats[selectedChat]
            console.log("[Expected to be updated] chat's HypaV3Data: ", currentChat.hypaV3Data)
        } else {
            const sp = await supaMemory(chats, currentTokens, maxContextTokens, currentChat, nowChatroom, tokenizer, {
                asHyper: DBState.db.hypaMemory,
            })
            if (sp.error) {
                throwError(sp.error)
                return false
            }
            chats = sp.chats
            currentTokens = sp.currentTokens
            currentChat.supaMemoryData = sp.memory ?? currentChat.supaMemoryData
            DBState.db.characters[selectedChar].chats[selectedChat].supaMemoryData = currentChat.supaMemoryData
            console.log(currentChat.supaMemoryData)
            currentChat.lastMemory = sp.lastId ?? currentChat.lastMemory
        }
        stageTimings.stage2Duration = Date.now() - stageTimings.stage2Start
        ChatProcessStageState.value = 1
    } else {
        stageTimings.stage1Duration = Date.now() - stageTimings.stage1Start
        while (currentTokens > maxContextTokens) {
            if (chats.length <= 1) {
                throwError(language.errors.toomuchtoken + "\n\nRequired Tokens: " + currentTokens)

                return false
            }

            currentTokens -= await tokenizer.tokenizeChat(chats[0])
            chats.splice(0, 1)
        }
        currentChat.lastMemory = chats[0].memo
    }

    const biases: [string, number][] = DBState.db.bias.concat(currentChar.bias).map((v) => {
        return [
            risuChatParser(v[0].replaceAll("\\n", "\n").replaceAll("\\r", "\r").replaceAll("\\\\", "\\"), {
                chara: currentChar,
            }),
            v[1],
        ]
    })

    const memories: OpenAIChat[] = []

    if (!promptTemplate) {
        unformated.lastChat.push(chats[chats.length - 1])
        chats.splice(chats.length - 1, 1)
    }

    unformated.chats = chats
        .map((v) => {
            if (v.memo !== "supaMemory" && v.memo !== "hypaMemory") {
                v.removable = true
            } else if (supaMemoryCardUsed) {
                memories.push(v)
                return {
                    role: "system",
                    content: "",
                } as OpenAIChat
            } else {
                v.content = `<Previous Conversation>${v.content}</Previous Conversation>`
            }
            return v
        })
        .filter((v) => {
            return v.content.trim() !== "" || (v.multimodals && v.multimodals.length > 0)
        })

    for (const depthPrompt of depthPrompts) {
        const chat: OpenAIChat = {
            role: depthPrompt.role,
            content: risuChatParser(depthPrompt.prompt, { chara: currentChar }),
        }
        const depth = depthPrompt.pos === "depth" ? depthPrompt.depth : unformated.chats.length - depthPrompt.depth
        unformated.chats.splice(depth, 0, chat)
    }

    if (triggerResult) {
        if (triggerResult.additonalSysPrompt.promptend) {
            unformated.postEverything.push({
                role: "system",
                content: triggerResult.additonalSysPrompt.promptend,
            })
        }
        if (triggerResult.additonalSysPrompt.historyend) {
            unformated.lastChat.push({
                role: "system",
                content: triggerResult.additonalSysPrompt.historyend,
            })
        }
        if (triggerResult.additonalSysPrompt.start) {
            unformated.lastChat.unshift({
                role: "system",
                content: triggerResult.additonalSysPrompt.start,
            })
        }
    }

    //make into one

    let formated: OpenAIChat[] = []
    const formatOrder = safeStructuredClone(DBState.db.formatingOrder)
    if (formatOrder) {
        formatOrder.push("postEverything")
    }

    //continue chat model
    if (
        arg.continue &&
        (DBState.db.aiModel.startsWith("claude") ||
            DBState.db.aiModel.startsWith("gpt") ||
            DBState.db.aiModel.startsWith("openrouter") ||
            DBState.db.aiModel.startsWith("reverse_proxy"))
    ) {
        unformated.postEverything.push({
            role: "system",
            content: "[Continue the last response]",
        })
    }

    function pushPrompts(cha: OpenAIChat[]) {
        for (const chat of cha) {
            if (!chat.content.trim() && !(chat.multimodals && chat.multimodals.length > 0)) {
                continue
            }
            if (
                !(
                    DBState.db.aiModel.startsWith("gpt") ||
                    DBState.db.aiModel.startsWith("claude") ||
                    DBState.db.aiModel === "openrouter" ||
                    DBState.db.aiModel === "reverse_proxy"
                )
            ) {
                formated.push(chat)
                continue
            }
            if (chat.role === "system") {
                const endf = formated.at(-1)
                if (endf && endf.role === "system" && endf.memo === chat.memo && endf.name === chat.name) {
                    formated[formated.length - 1].content += "\n\n" + chat.content
                } else {
                    formated.push(chat)
                }
                formated.at(-1).content += ""
            } else {
                formated.push(chat)
            }
        }
    }

    let promptBodyformatedForChatStore: OpenAIChat[] = []
    function pushPromptInfoBody(
        role: "function" | "system" | "user" | "assistant",
        fmt: string,
        promptBody: OpenAIChat[]
    ) {
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
                case "persona": {
                    const pmt = safeStructuredClone(unformated.personaPrompt)
                    if (card.innerFormat && pmt.length > 0) {
                        for (let i = 0; i < pmt.length; i++) {
                            pmt[i].content = risuChatParser(positionParser(card.innerFormat, card.type), {
                                chara: currentChar,
                            }).replace("{{slot}}", pmt[i].content)

                            if (DBState.db.promptInfoInsideChat && DBState.db.promptTextInfoInsideChat) {
                                pushPromptInfoBody(pmt[i].role, card.innerFormat, promptBodyformatedForChatStore)
                            }
                        }
                    }

                    pushPrompts(pmt)
                    break
                }
                case "description": {
                    const pmt = safeStructuredClone(unformated.description)
                    if (card.innerFormat && pmt.length > 0) {
                        for (let i = 0; i < pmt.length; i++) {
                            pmt[i].content = risuChatParser(positionParser(card.innerFormat, card.type), {
                                chara: currentChar,
                            }).replace("{{slot}}", pmt[i].content)

                            if (DBState.db.promptInfoInsideChat && DBState.db.promptTextInfoInsideChat) {
                                pushPromptInfoBody(pmt[i].role, card.innerFormat, promptBodyformatedForChatStore)
                            }
                        }
                    }

                    pushPrompts(pmt)
                    break
                }
                case "authornote": {
                    const pmt = safeStructuredClone(unformated.authorNote)
                    if (card.innerFormat && pmt.length > 0) {
                        for (let i = 0; i < pmt.length; i++) {
                            pmt[i].content = risuChatParser(positionParser(card.innerFormat, card.type), {
                                chara: currentChar,
                            }).replace("{{slot}}", pmt[i].content || card.defaultText || "")

                            if (DBState.db.promptInfoInsideChat && DBState.db.promptTextInfoInsideChat) {
                                pushPromptInfoBody(pmt[i].role, card.innerFormat, promptBodyformatedForChatStore)
                            }
                        }
                    }

                    pushPrompts(pmt)
                    break
                }
                case "lorebook": {
                    pushPrompts(unformated.lorebook)
                    break
                }
                case "postEverything": {
                    pushPrompts(unformated.postEverything)
                    if (usingPromptTemplate && DBState.db.promptSettings.postEndInnerFormat) {
                        pushPrompts([
                            {
                                role: "system",
                                content: DBState.db.promptSettings.postEndInnerFormat,
                            },
                        ])
                    }
                    break
                }
                case "plain":
                case "jailbreak":
                case "cot": {
                    if (!DBState.db.jailbreakToggle && card.type === "jailbreak") {
                        continue
                    }
                    if (!DBState.db.chainOfThought && card.type === "cot") {
                        continue
                    }

                    const convertRole = {
                        system: "system",
                        user: "user",
                        bot: "assistant",
                    } as const

                    const posType = card.type === "plain" ? card.type2 : card.type
                    let content = positionParser(card.text, posType)

                    if (card.type2 === "globalNote") {
                        if (currentChar.replaceGlobalNote) {
                            content = positionParser(currentChar.replaceGlobalNote, posType).replaceAll(
                                "{{original}}",
                                content
                            )
                        }
                        if (currentChar.prebuiltAssetCommand && !card.text.includes("{{//@customimageinstruction}}")) {
                            content += prebuiltAssetCommand
                        }
                        content = risuChatParser(content, { chara: currentChar, role: card.role })
                    } else if (card.type2 === "main") {
                        content = risuChatParser(content, { chara: currentChar, role: card.role })
                    } else {
                        content = risuChatParser(content, { chara: currentChar, role: card.role })
                    }

                    const prompt: OpenAIChat = {
                        role: convertRole[card.role],
                        content: content,
                    }

                    if (
                        DBState.db.promptInfoInsideChat &&
                        DBState.db.promptTextInfoInsideChat &&
                        card.type2 !== "globalNote"
                    ) {
                        pushPromptInfoBody(prompt.role, prompt.content, promptBodyformatedForChatStore)
                    }

                    pushPrompts([prompt])
                    break
                }
                case "chatML": {
                    const prompts = parseChatML(card.text)
                    pushPrompts(prompts)
                    break
                }
                case "chat": {
                    let start = card.rangeStart
                    let end = card.rangeEnd === "end" ? unformated.chats.length : card.rangeEnd
                    if (start === -1000) {
                        start = 0
                        end = unformated.chats.length
                    }
                    if (start < 0) {
                        start = unformated.chats.length + start
                        if (start < 0) {
                            start = 0
                        }
                    }
                    if (end < 0) {
                        end = unformated.chats.length + end
                        if (end < 0) {
                            end = 0
                        }
                    }

                    if (start >= end) {
                        break
                    }

                    let chats = unformated.chats.slice(start, end)
                    if (
                        usingPromptTemplate &&
                        DBState.db.promptSettings.sendChatAsSystem &&
                        !card.chatAsOriginalOnSystem
                    ) {
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
                            if (formated[pointer].role === "user") {
                                formated[pointer].cachePoint = true
                                depthRemaining--
                            }
                            pointer--
                        }
                    }
                    break
                }
                case "memory": {
                    const pmt = safeStructuredClone(memories)
                    if (card.innerFormat && pmt.length > 0) {
                        for (let i = 0; i < pmt.length; i++) {
                            pmt[i].content = risuChatParser(card.innerFormat, { chara: currentChar }).replace(
                                "{{slot}}",
                                pmt[i].content
                            )

                            if (DBState.db.promptInfoInsideChat && DBState.db.promptTextInfoInsideChat) {
                                pushPromptInfoBody(pmt[i].role, card.innerFormat, promptBodyformatedForChatStore)
                            }
                        }
                    }

                    pushPrompts(pmt)
                    break
                }
                case "cache": {
                    let pointer = formated.length - 1
                    let depthRemaining = card.depth
                    while (pointer >= 0) {
                        if (depthRemaining === 0) {
                            break
                        }
                        if (formated[pointer].role === card.role || card.role === "all") {
                            formated[pointer].cachePoint = true
                            depthRemaining--
                        }
                        pointer--
                    }
                    break
                }
            }
        }
    } else {
        for (let i = 0; i < formatOrder.length; i++) {
            const cha = unformated[formatOrder[i]]
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

    if (currentChar.depth_prompt && currentChar.depth_prompt.prompt && currentChar.depth_prompt.prompt.length > 0) {
        //depth_prompt
        const depthPrompt = currentChar.depth_prompt
        formated.splice(formated.length - depthPrompt.depth, 0, {
            role: "system",
            content: risuChatParser(depthPrompt.prompt, { chara: currentChar }),
        })
    }

    formated = await runLuaEditTrigger(currentChar, "editRequest", formated)

    if (DBState.db.promptInfoInsideChat && DBState.db.promptTextInfoInsideChat) {
        promptBodyformatedForChatStore = await runLuaEditTrigger(
            currentChar,
            "editRequest",
            promptBodyformatedForChatStore
        )
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
                throwError(language.errors.toomuchtoken + "\n\nAt token rechecking. Required Tokens: " + inputTokens)
                return false
            }
            if (formated[pointer].removable) {
                inputTokens -= await tokenizer.tokenizeChat(formated[pointer])
                formated[pointer].content = ""
            }
            pointer++
        }
        formated = formated.filter((v) => {
            return v.content !== "" || (v.multimodals && v.multimodals.length > 0)
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
            stage4: 0,
        },
    }

    ChatProcessStageState.value = 3
    stageTimings.stage3Start = Date.now()
    if (arg.preview) {
        previewFormated = formated
        return true
    }

    // Mode 2: remove front encryptedThinking entries to fit within separate budget
    // (Mode 1 already handled during message creation - thinking tokens included in maxContext)
    if (pastThinkingSend === 2) {
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
            if (!removed) break // No more entries to remove
        }
    }

    // Collect encryptedThinkingHistory from formated array
    // (already truncated for mode 1, budget-limited for mode 2)
    const encryptedThinkingHistory = formated
        .flatMap((chat) => chat.encryptedThinking || [])
        .filter((et) => et.tokens > 0)

    const totalThinkingTokens = encryptedThinkingHistory.reduce((sum, et) => sum + et.tokens, 0)
    console.log("[PastThinking] Sending thinking history:", {
        count: encryptedThinkingHistory.length,
        totalTokens: totalThinkingTokens,
        mode: pastThinkingSend === 0 ? "None" : pastThinkingSend === 1 ? "Send" : "Send (Extra Context)",
        budget: pastThinkingSend === 2 ? pastThinkingExtraTokens : "maxContext",
    })

    const req = await requestChatData(
        {
            formated: formated,
            biasString: biases,
            currentChar: currentChar,
            useStreaming: true,
            isGroupChat: nowChatroom.type === "group",
            bias: {},
            continue: arg.continue,
            chatId: generationId,
            imageResponse: DBState.db.outputImageModal,
            previewBody: arg.previewPrompt,
            escape: nowChatroom.type === "character" && nowChatroom.escapeOutput,
            rememberToolUsage: DBState.db.rememberToolUsage,
            encryptedThinkingHistory: encryptedThinkingHistory.length > 0 ? encryptedThinkingHistory : undefined,
            pastThinkingExtraContext: pastThinkingSend === 2,
            pastThinkingExtraTokens: DBState.db.pastThinkingExtraTokens ?? 16000,
        },
        "model",
        abortSignal
    )

    console.log(req)
    if (req.model) {
        generationInfo.model = getGenerationModelString(req.model)
        console.log(generationInfo.model, req.model)
    }

    if (arg.previewPrompt && req.type === "success") {
        previewBody = req.result
        return true
    }

    let result = ""
    let emoChanged = false
    let resendChat = false

    if (abortSignal.aborted === true) {
        return false
    }
    if (req.type === "fail") {
        throwError(req.result)
        return false
    } else if (req.type === "streaming") {
        const reader = req.result.getReader()
        let msgIndex = DBState.db.characters[selectedChar].chats[selectedChat].message.length
        let prefix = ""
        if (arg.continue) {
            msgIndex -= 1
            prefix = DBState.db.characters[selectedChar].chats[selectedChat].message[msgIndex].data
        } else {
            DBState.db.characters[selectedChar].chats[selectedChat].message.push({
                role: "char",
                data: "",
                saying: currentChar.chaId,
                time: Date.now(),
                generationInfo,
                promptInfo,
                chatId: generationId,
            })
        }
        DBState.db.characters[selectedChar].chats[selectedChat].isStreaming = true
        let lastResponseChunk: { [key: string]: string } = {}
        while (abortSignal.aborted === false) {
            const readed = await reader.read()
            if (readed.value) {
                lastResponseChunk = readed.value
                const firstChunkKey = Object.keys(lastResponseChunk)[0]
                result = lastResponseChunk[firstChunkKey]
                if (!result) {
                    result = ""
                }
                if (DBState.db.removeIncompleteResponse) {
                    result = trimUntilPunctuation(result)
                }
                const result2 = await processScriptFull(
                    nowChatroom,
                    reformatContent(prefix + result),
                    "editoutput",
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

        addRerolls(generationId, Object.values(lastResponseChunk))

        // Save encrypted thinking from streaming response
        saveEncryptedThinkingFromChunk(
            lastResponseChunk,
            DBState.db.characters[selectedChar].chats[selectedChat].message[msgIndex]
        )

        DBState.db.characters[selectedChar].chats[selectedChat] = runCurrentChatFunction(
            DBState.db.characters[selectedChar].chats[selectedChat]
        )
        currentChat = DBState.db.characters[selectedChar].chats[selectedChat]
        const triggerResult = await runTrigger(currentChar, "output", { chat: currentChat })
        if (triggerResult && triggerResult.chat) {
            currentChat = triggerResult.chat
        }
        if (triggerResult && triggerResult.sendAIprompt) {
            resendChat = true
        }
        const inlayr = runInlayScreen(currentChar, currentChat.message[msgIndex].data)
        currentChat.message[msgIndex].data = inlayr.text
        DBState.db.characters[selectedChar].chats[selectedChat] = currentChat
        if (inlayr.promise) {
            const t = await inlayr.promise
            currentChat.message[msgIndex].data = t
            DBState.db.characters[selectedChar].chats[selectedChat] = currentChat
        }
        if (DBState.db.ttsAutoSpeech) {
            await sayTTS(currentChar, result)
        }
    } else {
        const msgs =
            req.type === "success" ? ([["char", req.result]] as const) : req.type === "multiline" ? req.result : []
        const mrerolls: string[] = []
        for (let i = 0; i < msgs.length; i++) {
            const msg = msgs[i]
            const mess = msg[1]
            let msgIndex = DBState.db.characters[selectedChar].chats[selectedChat].message.length
            let result2 = await processScriptFull(nowChatroom, reformatContent(mess), "editoutput", msgIndex)
            if (i === 0 && arg.continue) {
                msgIndex -= 1
                const beforeChat = DBState.db.characters[selectedChar].chats[selectedChat].message[msgIndex]
                result2 = await processScriptFull(
                    nowChatroom,
                    reformatContent(beforeChat.data + mess),
                    "editoutput",
                    msgIndex
                )
            }
            if (DBState.db.removeIncompleteResponse) {
                result2.data = trimUntilPunctuation(result2.data)
            }
            result = result2.data
            const inlayResult = runInlayScreen(currentChar, result)
            result = inlayResult.text
            emoChanged = result2.emoChanged
            // Get encryptedThinking from response
            const encryptedThinking =
                req.type === "success" && req.encryptedThinking ? [req.encryptedThinking] : undefined
            console.log("Saving encryptedThinking:", encryptedThinking)

            if (i === 0 && arg.continue) {
                DBState.db.characters[selectedChar].chats[selectedChat].message[msgIndex] = {
                    role: "char",
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

        if (mrerolls.length > 1) {
            addRerolls(generationId, mrerolls)
        }

        DBState.db.characters[selectedChar].chats[selectedChat] = runCurrentChatFunction(
            DBState.db.characters[selectedChar].chats[selectedChat]
        )
        currentChat = DBState.db.characters[selectedChar].chats[selectedChat]

        const triggerResult = await runTrigger(currentChar, "output", { chat: currentChat })
        if (triggerResult && triggerResult.chat) {
            DBState.db.characters[selectedChar].chats[selectedChat] = triggerResult.chat
        }
        if (triggerResult && triggerResult.sendAIprompt) {
            resendChat = true
        }
    }

    let needsAutoContinue = false
    const resultTokens = (await tokenize(result)) + (arg.usedContinueTokens || 0)
    if (DBState.db.autoContinueMinTokens > 0 && resultTokens < DBState.db.autoContinueMinTokens) {
        needsAutoContinue = true
    }

    if (DBState.db.autoContinueChat && !isLastCharPunctuation(result)) {
        //if result doesn't end with punctuation or special characters, auto continue
        needsAutoContinue = true
    }

    if (needsAutoContinue) {
        DoingChatState.value = false
        return await sendChat(chatProcessIndex, {
            chatAdditonalTokens: arg.chatAdditonalTokens,
            continue: true,
            signal: abortSignal,
            usedContinueTokens: resultTokens,
        })
    }

    const igp = risuChatParser(DBState.db.igpPrompt ?? "")

    if (igp) {
        const igpFormated = parseChatML(igp)
        const rq = await requestChatData(
            {
                formated: igpFormated,
                bias: {},
            },
            "emotion",
            abortSignal
        )

        DBState.db.characters[selectedChar].chats[selectedChat].message[
            DBState.db.characters[selectedChar].chats[selectedChat].message.length - 1
        ].data += rq
    }

    stageTimings.stage3Duration = Date.now() - stageTimings.stage3Start

    if (generationInfo.stageTiming) {
        generationInfo.stageTiming.stage3 = stageTimings.stage3Duration
    }
    ChatProcessStageState.value = 4
    stageTimings.stage4Start = Date.now()

    if (resendChat) {
        stageTimings.stage4Duration = Date.now() - stageTimings.stage4Start

        if (generationInfo.stageTiming) {
            generationInfo.stageTiming.stage1 = stageTimings.stage1Duration
            generationInfo.stageTiming.stage2 = stageTimings.stage2Duration
            generationInfo.stageTiming.stage3 = stageTimings.stage3Duration
            generationInfo.stageTiming.stage4 = stageTimings.stage4Duration
        }

        const lastMessageIndex = DBState.db.characters[selectedChar].chats[selectedChat].message.length - 1
        if (
            lastMessageIndex >= 0 &&
            DBState.db.characters[selectedChar].chats[selectedChat].message[lastMessageIndex].generationInfo
        ) {
            DBState.db.characters[selectedChar].chats[selectedChat].message[lastMessageIndex].generationInfo =
                generationInfo
        }

        DoingChatState.value = false
        return await sendChat(chatProcessIndex, {
            signal: abortSignal,
        })
    }

    if (DBState.db.notification) {
        try {
            const permission = await Notification.requestPermission()
            if (permission === "granted") {
                const noti = new Notification("RisuAI", {
                    body: result,
                })
                noti.onclick = () => {
                    window.focus()
                }
            }
        } catch (error) {}
    }

    peerSync()

    if (req.special) {
        if (req.special.emotion) {
            if (updateEmotionFromSpecial(currentChar, req.special.emotion)) {
                emoChanged = true
            }
        }
    }

    if (!currentChar.inlayViewScreen) {
        if (currentChar.viewScreen === "emotion" && !emoChanged && abortSignal.aborted === false) {
            await processEmotionScreen(currentChar, result, abortSignal, throwError)
            return true
        } else if (currentChar.viewScreen === "imggen") {
            const msgs = DBState.db.characters[selectedChar].chats[selectedChat].message
            await processImageGenScreen(currentChar, msgs, throwError, chatProcessIndex !== -1)
        }
    }

    stageTimings.stage4Duration = Date.now() - stageTimings.stage4Start

    if (generationInfo.stageTiming) {
        generationInfo.stageTiming.stage1 = stageTimings.stage1Duration
        generationInfo.stageTiming.stage2 = stageTimings.stage2Duration
        generationInfo.stageTiming.stage3 = stageTimings.stage3Duration
        generationInfo.stageTiming.stage4 = stageTimings.stage4Duration
    }

    const lastMessageIndex = DBState.db.characters[selectedChar].chats[selectedChat].message.length - 1
    if (
        lastMessageIndex >= 0 &&
        DBState.db.characters[selectedChar].chats[selectedChat].message[lastMessageIndex].generationInfo
    ) {
        DBState.db.characters[selectedChar].chats[selectedChat].message[lastMessageIndex].generationInfo =
            generationInfo
    }

    return true
}

function systemizeChat(chat: OpenAIChat[]) {
    for (let i = 0; i < chat.length; i++) {
        if (chat[i].role === "user" || chat[i].role === "assistant") {
            const attr = chat[i].attr ?? []
            if (chat[i].name?.startsWith("example_")) {
                chat[i].content = chat[i].name + ": " + chat[i].content
            } else if (!attr.includes("nameAdded")) {
                chat[i].content = chat[i].role + ": " + chat[i].content
            }
            chat[i].role = "system"
            delete chat[i].memo
            delete chat[i].name
        }
    }
    return chat
}
