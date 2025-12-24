import { getDatabase } from "../../data/storage/database.svelte"
import { globalFetch } from "../../utils/fetch"
import type { RequestDataArgumentExtended, requestDataResponse } from "./types"
import { applyParameters } from "./utils"

export async function requestCohere(arg: RequestDataArgumentExtended): Promise<requestDataResponse> {
    const formated = [...arg.formated] // shallow copy to avoid mutating original
    const db = getDatabase()
    const aiModel = arg.aiModel

    let lastChatPrompt = ""
    let preamble = ""

    let lastChat = formated[formated.length - 1]
    if (lastChat.role === "user") {
        lastChatPrompt = lastChat.content
        formated.pop()
    } else {
        while (lastChat.role !== "user") {
            lastChat = formated.pop()
            if (!lastChat) {
                return {
                    type: "fail",
                    result: "Cohere requires a user message to generate a response",
                }
            }
            lastChatPrompt =
                (lastChat.role === "user" ? "" : `${lastChat.role}: `) + "\n" + lastChat.content + lastChatPrompt
        }
    }

    const firstChat = formated[0]
    if (firstChat?.role === "system") {
        preamble = firstChat.content
        formated.shift()
    }

    //reformat chat

    const body = applyParameters(
        {
            message: lastChatPrompt,
            chat_history: formated
                .map((v) => {
                    if (v.role === "assistant") {
                        return {
                            role: "CHATBOT",
                            message: v.content,
                        }
                    }
                    if (v.role === "system") {
                        return {
                            role: "SYSTEM",
                            message: v.content,
                        }
                    }
                    if (v.role === "user") {
                        return {
                            role: "USER",
                            message: v.content,
                        }
                    }
                    return null
                })
                .filter((v) => v !== null)
                .filter((v) => {
                    return v.message
                }),
        },
        ["temperature", "top_k", "top_p", "presence_penalty", "frequency_penalty"],
        {
            top_k: "k",
            top_p: "p",
        },
        arg.mode
    )

    if (aiModel !== "cohere-command-r-03-2024" && aiModel !== "cohere-command-r-plus-04-2024") {
        body.safety_mode = "NONE"
    }

    if (preamble) {
        if (body.chat_history.length > 0) {
            body.preamble = preamble
        } else {
            body.message = `system: ${preamble}`
        }
    }

    console.log(body)

    if (arg.previewBody) {
        return {
            type: "success",
            result: JSON.stringify({
                url: arg.customURL ?? "https://api.cohere.com/v1/chat",
                body: body,
                headers: {
                    Authorization: "Bearer " + (arg.key ?? db.cohereAPIKey),
                    "Content-Type": "application/json",
                },
            }),
        }
    }

    const res = await globalFetch(arg.customURL ?? "https://api.cohere.com/v1/chat", {
        method: "POST",
        headers: {
            Authorization: "Bearer " + (arg.key ?? db.cohereAPIKey),
            "Content-Type": "application/json",
        },
        body: body,
        abortSignal: arg.abortSignal,
    })

    if (!res.ok) {
        return {
            type: "fail",
            result: JSON.stringify(res.data),
        }
    }

    const result = res?.data?.text
    if (!result) {
        return {
            type: "fail",
            result: JSON.stringify(res.data),
        }
    }

    return {
        type: "success",
        result: result,
    }
}
