import { get } from "svelte/store"
import { changeToPreset } from '../storage/preset-manager'
import { type Chat, type MessageGenerationInfo } from '../storage/types/chat'
import { type character } from '../storage/types/character'
import { DBState } from '../stores.svelte'
import { CharEmotion } from "../stores.svelte"
import { tokenize, tokenizeNum } from "../tokenizer"
import { language } from "../../lang"
import { alertError } from "../alert.svelte"
import { isLastCharPunctuation, trimUntilPunctuation } from "../utils/util"
import { requestChatData } from "./request/request"
import { stableDiff } from "./stableDiff"
import { processScriptFull, risuChatParser } from "./scripts"
import { sayTTS } from "./tts"
import { v4 } from "uuid"
import { groupOrder } from "./group.svelte"
import { runTrigger } from "./triggers"
import { HypaProcesser } from "./memory/hypamemory"
import { getGenerationModelString } from "./models/modelString"
import { connectionOpen, peerRevertChat, peerSafeCheck, peerSync } from "../sync/multiuser"
import { runInlayScreen } from "./inlayScreen"
import { addRerolls } from "./prereroll"
import { parseChatML } from "../parser/chatML"
import { type OpenAIChat, type MultiModal } from "./types"
import { addToast } from "../toast.svelte"
import { findCharacterbyIdwithCache, parseChatCBS, reformatContent, shuffleArray } from "./index_util.svelte"
import { buildPrompt } from "./index_promptBuild.svelte"
export type { MultiModal }

export const chatGenState = $state({
    generating: false,
    stage: 0,

})

export let previewFormated: OpenAIChat[] = []
export let previewBody: string = ''


export interface StageTimings {
    stage1Start: number
    stage2Start: number
    stage3Start: number
    stage4Start: number
    stage1Duration: number
    stage2Duration: number
    stage3Duration: number
    stage4Duration: number
}

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
        displayError("Unknown character type")
        return false
    }

    /* ========================================
     *       STAGE 1,2: PROMPT BUILDING
     * ======================================== */
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

    const promptResult = await buildPrompt(chatOwner, selectedChatPage, speakingChar, stageTimings, arg.continue)
    if (!promptResult.success) {
        const errorMsg = ('error' in promptResult && promptResult.error)
            ? promptResult.error
            : 'Unknown error during prompt building'
        displayError(errorMsg)
        return false
    }

    const { finalPrompt, promptInfo, inputTokens, outputTokens } = promptResult.data

    const generationId = v4()
    const generationModel = getGenerationModelString()

    const generationInfo: MessageGenerationInfo = {
        model: generationModel,
        generationId: generationId,
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        maxContext: DBState.db.maxContext,
        stageTiming: {
            stage1: stageTimings.stage1Duration,
            stage2: stageTimings.stage2Duration,
            stage3: 0,
            stage4: 0
        }
    }

    const biases: [string, number][] = DBState.db.bias.concat(speakingChar.bias).map((v) => {
        return [risuChatParser(v[0].replaceAll("\\n", "\n").replaceAll("\\r", "\r").replaceAll("\\\\", "\\"), { chara: speakingChar }), v[1]]
    })

    /* ========================================
     *       STAGE 3: AI REQUEST
     * ======================================== */
    chatGenState.stage = 3
    stageTimings.stage3Start = Date.now()
    if (arg.preview) {
        previewFormated = finalPrompt
        return true
    }

    const req = await requestChatData({
        formated: finalPrompt,
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
        let workingChat = DBState.currentChat

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
        const workingChat = DBState.currentChat

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

