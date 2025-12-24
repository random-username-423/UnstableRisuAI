import type { character, Chat, groupChat } from "src/ts/data/storage/types"
import { DBState } from "src/ts/stores.svelte"
import { getAuthorNoteDefaultText, getPersonaPrompt } from "src/ts/utils/util"
import { risuChatParser } from "src/ts/process/scripting/scripts"
import { loadLoreBookV3Prompt } from "src/ts/process/prompt/lorebook.svelte"
import { additionalInformations } from "src/ts/process/embedding/addinfo"
import type { OpenAIChat } from "src/ts/process/chatTypes"

export interface UnformatedPrompts {
    main: OpenAIChat[]
    jailbreak: OpenAIChat[]
    chats: OpenAIChat[]
    lorebook: OpenAIChat[]
    globalNote: OpenAIChat[]
    authorNote: OpenAIChat[]
    lastChat: OpenAIChat[]
    description: OpenAIChat[]
    postEverything: OpenAIChat[]
    personaPrompt: OpenAIChat[]
}

export interface LorebookData {
    actives: {
        prompt: string
        pos: string
        depth?: number
        role: "system" | "user" | "assistant"
        inject: {
            location: string
            operation: "append" | "prepend" | "replace"
            param?: string
            lore?: boolean
        } | null
    }[]
}

export interface PromptBuilderContext {
    currentChar: character
    currentChat: Chat
    nowChatroom: character | groupChat
    usingPromptTemplate: boolean
}

/**
 * Create empty unformated prompts object
 */
export function createEmptyUnformated(): UnformatedPrompts {
    return {
        main: [],
        jailbreak: [],
        chats: [],
        lorebook: [],
        globalNote: [],
        authorNote: [],
        lastChat: [],
        description: [],
        postEverything: [],
        personaPrompt: [],
    }
}

/**
 * Parse prompt string with @@ role markers into OpenAIChat array
 */
export function formatPrompt(data: string): OpenAIChat[] {
    if (!data.startsWith("@@")) {
        data = "@@system\n" + data
    }
    const parts = data.split(/@@@?(user|assistant|system)\n/)

    const chatObjects: OpenAIChat[] = []

    for (let i = 1; i < parts.length; i += 2) {
        const role = parts[i] as "user" | "assistant" | "system"
        const content = parts[i + 1]?.trim() || ""
        chatObjects.push({ role, content })
    }

    return chatObjects
}

/**
 * Build main, jailbreak, and globalNote prompts (legacy mode without template)
 */
export function buildLegacyPrompts(unformated: UnformatedPrompts, currentChar: character): void {
    const mainp = currentChar.systemPrompt?.replaceAll("{{original}}", DBState.db.mainPrompt) || DBState.db.mainPrompt

    const additionalPrompt =
        DBState.db.additionalPrompt === "" || !DBState.db.promptPreprocess ? "" : `\n${DBState.db.additionalPrompt}`

    unformated.main.push(...formatPrompt(risuChatParser(mainp + additionalPrompt, { chara: currentChar })))

    if (DBState.db.jailbreakToggle) {
        unformated.jailbreak.push(...formatPrompt(risuChatParser(DBState.db.jailbreak, { chara: currentChar })))
    }

    const globalNote =
        currentChar.replaceGlobalNote?.replaceAll("{{original}}", DBState.db.globalNote) || DBState.db.globalNote
    unformated.globalNote.push(...formatPrompt(risuChatParser(globalNote, { chara: currentChar })))
}

/**
 * Build author note prompt
 */
export function buildAuthorNote(unformated: UnformatedPrompts, currentChat: Chat, currentChar: character): void {
    if (currentChat.note) {
        unformated.authorNote.push({
            role: "system",
            content: risuChatParser(currentChat.note, { chara: currentChar }),
        })
    } else if (getAuthorNoteDefaultText() !== "") {
        unformated.authorNote.push({
            role: "system",
            content: risuChatParser(getAuthorNoteDefaultText(), { chara: currentChar }),
        })
    }
}

/**
 * Build chain of thought prompt
 */
export function buildChainOfThought(unformated: UnformatedPrompts, usingPromptTemplate: boolean): void {
    if (DBState.db.chainOfThought && !(usingPromptTemplate && DBState.db.promptSettings.customChainOfThought)) {
        unformated.postEverything.push({
            role: "system",
            content: `<instruction> - before respond everything, Think step by step as a ai assistant how would you respond inside <Thoughts> xml tag. this must be less than 5 paragraphs.</instruction>`,
        })
    }
}

/**
 * Build description prompt including personality, scenario, and additional info
 */
export async function buildDescription(
    unformated: UnformatedPrompts,
    currentChar: character,
    currentChat: Chat,
    isGroup: boolean
): Promise<void> {
    let description = risuChatParser(
        (DBState.db.promptPreprocess ? DBState.db.descriptionPrefix : "") + currentChar.desc,
        { chara: currentChar }
    )

    const additionalInfo = await additionalInformations(currentChar, currentChat)
    if (additionalInfo) {
        description += "\n\n" + risuChatParser(additionalInfo, { chara: currentChar })
    }

    if (currentChar.personality) {
        description += risuChatParser("\n\nDescription of {{char}}: " + currentChar.personality, { chara: currentChar })
    }

    if (currentChar.scenario) {
        description += risuChatParser("\n\nCircumstances and context of the dialogue: " + currentChar.scenario, {
            chara: currentChar,
        })
    }

    unformated.description.push({
        role: "system",
        content: description,
    })

    if (isGroup) {
        unformated.postEverything.push({
            role: "system",
            content: `[Write the next reply only as ${currentChar.name}]`,
        })
    }
}

/**
 * Build lorebook prompts
 */
export async function buildLorebookPrompts(
    unformated: UnformatedPrompts,
    currentChar: character
): Promise<LorebookData> {
    const lorepmt = await loadLoreBookV3Prompt()

    // Normal lorebook entries
    const normalActives = lorepmt.actives.filter((v) => v.pos === "" && v.inject === null)
    for (const lorebook of normalActives) {
        unformated.lorebook.push({
            role: lorebook.role,
            content: risuChatParser(lorebook.prompt, { chara: currentChar }),
        })
    }

    // Description position entries
    const descActives = lorepmt.actives.filter(
        (v) => v.pos === "after_desc" || v.pos === "before_desc" || v.pos === "personality" || v.pos === "scenario"
    )
    for (const lorebook of descActives) {
        const c = {
            role: lorebook.role,
            content: risuChatParser(lorebook.prompt, { chara: currentChar }),
        }
        if (lorebook.pos === "before_desc") {
            unformated.description.unshift(c)
        } else {
            unformated.description.push(c)
        }
    }

    return lorepmt
}

/**
 * Build persona prompt
 */
export function buildPersonaPrompt(unformated: UnformatedPrompts, currentChar: character): void {
    if (DBState.db.personaPrompt) {
        unformated.personaPrompt.push({
            role: "system",
            content: risuChatParser(getPersonaPrompt(), { chara: currentChar }),
        })
    }
}

/**
 * Build inlay view screen prompts (emotion/imggen)
 */
export function buildInlayViewScreenPrompts(unformated: UnformatedPrompts, currentChar: character): void {
    if (currentChar.inlayViewScreen) {
        if (currentChar.viewScreen === "emotion") {
            unformated.postEverything.push({
                role: "system",
                content: currentChar.newGenData.emotionInstructions.replaceAll(
                    "{{slot}}",
                    currentChar.emotionImages.map((v) => v[0]).join(", ")
                ),
            })
        }
        if (currentChar.viewScreen === "imggen") {
            unformated.postEverything.push({
                role: "system",
                content: currentChar.newGenData.instructions,
            })
        }
    }
}

/**
 * Build postEverything lorebook prompts (depth 0)
 */
export function buildPostEverythingLorebooks(
    unformated: UnformatedPrompts,
    lorepmt: LorebookData,
    currentChar: character
): void {
    // Non-assistant lorebooks first
    const postEverythingLorebooks = lorepmt.actives.filter(
        (v) => v.pos === "depth" && v.depth === 0 && v.role !== "assistant"
    )
    for (const lorebook of postEverythingLorebooks) {
        unformated.postEverything.push({
            role: lorebook.role,
            content: risuChatParser(lorebook.prompt, { chara: currentChar }),
        })
    }

    // Assistant lorebooks after (for prefill)
    const postEverythingAssistantLorebooks = lorepmt.actives.filter(
        (v) => v.pos === "depth" && v.depth === 0 && v.role === "assistant"
    )
    for (const lorebook of postEverythingAssistantLorebooks) {
        unformated.postEverything.push({
            role: lorebook.role,
            content: risuChatParser(lorebook.prompt, { chara: currentChar }),
        })
    }
}

/**
 * Get injection lorebooks data
 */
export function getInjectionLorebooks(lorepmt: LorebookData): {
    injectionLorebooks: LorebookData["actives"]
    injectionLorePosSet: Set<string>
} {
    const injectionLorebooks = lorepmt.actives.filter((v) => v.inject && !v.inject.lore)
    const injectionLorePosSet = new Set<string>()
    for (const lorebook of injectionLorebooks) {
        injectionLorePosSet.add(lorebook.inject!.location)
    }
    return { injectionLorebooks, injectionLorePosSet }
}

/**
 * Create position parser function for lorebook injection
 */
export function createPositionParser(
    injectionLorebooks: LorebookData["actives"],
    injectionLorePosSet: Set<string>,
    lorepmt: LorebookData
): (text: string, loc: string) => string {
    const positionRegex = /{{position::(.+?)}}/g

    return (text: string, loc: string) => {
        if (injectionLorePosSet.has(loc)) {
            const matchings = injectionLorebooks.filter((v) => v.inject!.location === loc)
            for (const lore of matchings) {
                switch (lore.inject!.operation) {
                    case "append":
                        text += " " + lore.prompt
                        break
                    case "prepend":
                        text = lore.prompt + " " + text
                        break
                    case "replace":
                        text = text.replace(lore.inject!.param || "", lore.prompt)
                        break
                }
            }
        }
        return text.replace(positionRegex, (match, p1) => {
            const matchingLorebooks = lorepmt.actives.filter((v) => v.pos === "pt_" + p1)
            return matchingLorebooks.map((v) => v.prompt).join("\n")
        })
    }
}

/**
 * Get depth prompts for insertion into chat history
 */
export function getDepthPrompts(lorepmt: LorebookData, currentChar: character): OpenAIChat[] {
    const depthPrompts = lorepmt.actives.filter((v) => (v.pos === "depth" && v.depth! > 0) || v.pos === "reverse_depth")

    return depthPrompts.map((dp) => ({
        role: dp.role,
        content: risuChatParser(dp.prompt, { chara: currentChar }),
    }))
}

/**
 * Insert depth prompts into unformated chats
 */
export function insertDepthPrompts(unformated: UnformatedPrompts, lorepmt: LorebookData, currentChar: character): void {
    const depthPrompts = lorepmt.actives.filter((v) => (v.pos === "depth" && v.depth! > 0) || v.pos === "reverse_depth")

    for (const depthPrompt of depthPrompts) {
        const chat: OpenAIChat = {
            role: depthPrompt.role,
            content: risuChatParser(depthPrompt.prompt, { chara: currentChar }),
        }
        const depth = depthPrompt.pos === "depth" ? depthPrompt.depth! : unformated.chats.length - depthPrompt.depth!
        unformated.chats.splice(depth, 0, chat)
    }
}
