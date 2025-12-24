import { Ollama } from "ollama/dist/browser.mjs"
import { getDatabase } from "../../data/storage/database.svelte"
import type { RequestDataArgumentExtended, requestDataResponse, StreamResponseChunk } from "./types"

export async function requestOllama(arg: RequestDataArgumentExtended): Promise<requestDataResponse> {
    const formated = arg.formated
    const db = getDatabase()

    if (arg.previewBody) {
        return {
            type: "success",
            result: JSON.stringify({
                error: "Preview body is not supported for Ollama",
            }),
        }
    }

    const ollama = new Ollama({ host: db.ollamaURL })

    const response = await ollama.chat({
        model: db.ollamaModel,
        messages: formated
            .map((v) => {
                return {
                    role: v.role,
                    content: v.content,
                }
            })
            .filter((v) => {
                return v.role === "assistant" || v.role === "user" || v.role === "system"
            }),
        stream: true,
    })

    let fullText = ""
    const readableStream = new ReadableStream<StreamResponseChunk>({
        async start(controller) {
            for await (const chunk of response) {
                fullText += chunk.message.content
                controller.enqueue({
                    "0": fullText,
                })
            }
            controller.close()
        },
    })

    return {
        type: "streaming",
        result: readableStream,
    }
}
