import { get } from "svelte/store";
import type { character, Message } from "src/ts/data/storage/types";
import { DBState } from 'src/ts/stores.svelte';
import { CharEmotion } from "src/ts/stores.svelte";
import { tokenizeNum } from "src/ts/utils/tokenizer";
import { language } from "src/lang";
import { requestChatData } from "src/ts/process/request/request";
import { stableDiff } from "src/ts/process/integrations/stableDiff";
import { HypaProcesser } from "src/ts/process/memory/hypamemory";
import type { OpenAIChat } from "src/ts/process/chatTypes";

export interface EmotionProcessResult {
    success: boolean
    error?: string
}

/**
 * Process emotion detection for a character based on the AI response
 */
export async function processEmotionScreen(
    currentChar: character,
    result: string,
    abortSignal: AbortSignal,
    throwError: (error: string) => void
): Promise<EmotionProcessResult> {
    const currentEmotion = currentChar.emotionImages
    let emotionList = currentEmotion.map((a) => a[0])
    const charemotions = get(CharEmotion)

    let tempEmotion = charemotions[currentChar.chaId]
    if (!tempEmotion) {
        tempEmotion = []
    }
    if (tempEmotion.length > 4) {
        tempEmotion.splice(0, 1)
    }

    // Embedding-based emotion detection
    if (DBState.db.emotionProcesser === 'embedding') {
        const hypaProcesser = new HypaProcesser()
        await hypaProcesser.addText(emotionList.map((v) => 'emotion:' + v))
        let searched = (await hypaProcesser.similaritySearchScored(result)).map((v) => {
            v[0] = v[0].replace("emotion:", '')
            return v
        })

        // Apply penalties for recently used emotions
        for (let i = 0; i < tempEmotion.length; i++) {
            const emo = tempEmotion[i]
            const index = searched.findIndex((v) => v[0] === emo[0])
            const modifier = ((5 - ((tempEmotion.length - (i + 1))))) / 200

            if (index !== -1) {
                searched[index][1] -= modifier
            }
        }

        // Sort by score and select best match
        const emoresult = searched.sort((a, b) => b[1] - a[1]).map((v) => v[0])

        for (const emo of currentEmotion) {
            if (emo[0] === emoresult[0]) {
                const emos: [string, string, number] = [emo[0], emo[1], Date.now()]
                tempEmotion.push(emos)
                charemotions[currentChar.chaId] = tempEmotion
                CharEmotion.set(charemotions)
                break
            }
        }

        return { success: true }
    }

    // LLM-based emotion detection
    function shuffleArray(array: string[]) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]
        }
        return array
    }

    let emobias: { [key: number]: number } = {}

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
        currentChar: currentChar,
        maxTokens: 30,
    }, 'emotion', abortSignal)

    if (rq.type === 'fail' || rq.type === 'streaming' || rq.type === 'multiline') {
        if (abortSignal.aborted) {
            return { success: true }
        }
        throwError(`${rq.result}`)
        return { success: true }
    }

    emotionList = currentEmotion.map((a) => a[0])
    try {
        const emotion: string = rq.result.replace(/ |\n/g, '').trim().toLocaleLowerCase()
        let emotionSelected = false

        // Exact match
        for (const emo of currentEmotion) {
            if (emo[0] === emotion) {
                const emos: [string, string, number] = [emo[0], emo[1], Date.now()]
                tempEmotion.push(emos)
                charemotions[currentChar.chaId] = tempEmotion
                CharEmotion.set(charemotions)
                emotionSelected = true
                break
            }
        }

        // Partial match
        if (!emotionSelected) {
            for (const emo of currentEmotion) {
                if (emotion.includes(emo[0])) {
                    const emos: [string, string, number] = [emo[0], emo[1], Date.now()]
                    tempEmotion.push(emos)
                    charemotions[currentChar.chaId] = tempEmotion
                    CharEmotion.set(charemotions)
                    emotionSelected = true
                    break
                }
            }
        }

        // Fallback to neutral
        if (!emotionSelected && emotionList.includes('neutral')) {
            const emo = currentEmotion[emotionList.indexOf('neutral')]
            const emos: [string, string, number] = [emo[0], emo[1], Date.now()]
            tempEmotion.push(emos)
            charemotions[currentChar.chaId] = tempEmotion
            CharEmotion.set(charemotions)
        }
    } catch (error) {
        throwError(language.errors.httpError + `${error}`)
        return { success: true }
    }

    return { success: true }
}

/**
 * Process image generation for a character
 */
export async function processImageGenScreen(
    currentChar: character,
    messages: Message[],
    throwError: (error: string) => void,
    isGroupChat: boolean
): Promise<void> {
    if (isGroupChat) {
        throwError("Stable diffusion in group chat is not supported")
        return
    }

    let msgStr = ''
    for (let i = (messages.length - 1); i >= 0; i--) {
        if (messages[i].role === 'char') {
            msgStr = `character: ${messages[i].data.replace(/\n/g, ' ')} \n` + msgStr
        } else {
            msgStr = `user: ${messages[i].data.replace(/\n/g, ' ')} \n` + msgStr
            break
        }
    }

    await stableDiff(currentChar, msgStr)
}

/**
 * Update emotion from special response data
 */
export function updateEmotionFromSpecial(
    currentChar: character,
    emotionName: string
): boolean {
    const charemotions = get(CharEmotion)
    const currentEmotion = currentChar.emotionImages

    let tempEmotion = charemotions[currentChar.chaId]
    if (!tempEmotion) {
        tempEmotion = []
    }
    if (tempEmotion.length > 4) {
        tempEmotion.splice(0, 1)
    }

    for (const emo of currentEmotion) {
        if (emo[0] === emotionName) {
            const emos: [string, string, number] = [emo[0], emo[1], Date.now()]
            tempEmotion.push(emos)
            charemotions[currentChar.chaId] = tempEmotion
            CharEmotion.set(charemotions)
            return true
        }
    }

    return false
}
