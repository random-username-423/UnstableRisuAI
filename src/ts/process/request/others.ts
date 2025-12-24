import { language } from "../../../lang"
import { getCurrentCharacter, getDatabase } from "../../data/storage/database.svelte"
import { globalFetch } from "../../utils/fetch"
import { pluginProcess, pluginV2 } from "../../plugins/plugins.svelte"
import { stringlizeAINChat, unstringlizeAIN, unstringlizeChat } from "src/ts/process/prompt/stringlize"
import { applyChatTemplate } from "../templates/chatTemplate"
import { runTransformers } from "src/ts/process/integrations/transformers"
import type { RequestDataArgumentExtended, requestDataResponse, StreamResponseChunk } from "./types"
import { applyParameters } from "./utils"

export async function requestNovelList(arg: RequestDataArgumentExtended): Promise<requestDataResponse> {
    const formated = arg.formated
    const db = getDatabase()
    const maxTokens = arg.maxTokens
    const temperature = arg.temperature
    const biasString = arg.biasString
    const currentChar = getCurrentCharacter()
    const aiModel = arg.aiModel
    const auth_key = db.novellistAPI
    const api_server_url = "https://api.tringpt.com/"
    const logit_bias: string[] = []
    const logit_bias_values: string[] = []
    for (let i = 0; i < biasString.length; i++) {
        const bia = biasString[i]
        logit_bias.push(bia[0])
        logit_bias_values.push(bia[1].toString())
    }
    const headers = {
        Authorization: `Bearer ${auth_key}`,
        "Content-Type": "application/json",
    }

    const send_body = {
        text: stringlizeAINChat(formated, currentChar?.name ?? "", arg.continue),
        length: maxTokens,
        temperature: temperature,
        top_p: db.ainconfig.top_p,
        top_k: db.ainconfig.top_k,
        rep_pen: db.ainconfig.rep_pen,
        top_a: db.ainconfig.top_a,
        rep_pen_slope: db.ainconfig.rep_pen_slope,
        rep_pen_range: db.ainconfig.rep_pen_range,
        typical_p: db.ainconfig.typical_p,
        badwords: db.ainconfig.badwords,
        model: aiModel === "novellist_damsel" ? "damsel" : "supertrin",
        stoptokens: ["「"].join("<<|>>") + db.ainconfig.stoptokens,
        logit_bias: logit_bias.length > 0 ? logit_bias.join("<<|>>") : undefined,
        logit_bias_values: logit_bias_values.length > 0 ? logit_bias_values.join("|") : undefined,
    }

    if (arg.previewBody) {
        return {
            type: "success",
            result: JSON.stringify({
                url: api_server_url + "/api",
                body: send_body,
                headers: headers,
            }),
        }
    }
    const response = await globalFetch(arg.customURL ?? api_server_url + "/api", {
        method: "POST",
        headers: headers,
        body: send_body,
        chatId: arg.chatId,
        abortSignal: arg.abortSignal,
    })

    if (!response.ok) {
        return {
            type: "fail",
            result: response.data,
        }
    }

    if (response.data.error) {
        return {
            type: "fail",
            result: `${response.data.error.replace("token", "api key")}`,
        }
    }

    const result = response.data.data[0]
    const unstr = unstringlizeAIN(result, formated, currentChar?.name ?? "")
    return {
        type: "multiline",
        result: unstr,
    }
}

export async function requestPlugin(arg: RequestDataArgumentExtended): Promise<requestDataResponse> {
    const db = getDatabase()
    try {
        const formated = arg.formated
        const maxTokens = arg.maxTokens
        const bias = arg.biasString
        const v2Function = pluginV2.providers.get(db.currentPluginProvider)

        if (arg.previewBody) {
            return {
                type: "success",
                result: JSON.stringify({
                    error: "Plugin is not supported in preview mode",
                }),
            }
        }

        const d = v2Function
            ? await v2Function(
                  applyParameters(
                      {
                          prompt_chat: formated,
                          mode: arg.mode,
                          bias: [],
                          max_tokens: maxTokens,
                      },
                      [
                          "frequency_penalty",
                          "min_p",
                          "presence_penalty",
                          "repetition_penalty",
                          "top_k",
                          "top_p",
                          "temperature",
                      ],
                      {},
                      arg.mode
                  ) as any,
                  arg.abortSignal
              )
            : await pluginProcess({
                  bias: bias,
                  prompt_chat: formated,
                  temperature: db.temperature / 100,
                  max_tokens: maxTokens,
                  presence_penalty: db.PresensePenalty / 100,
                  frequency_penalty: db.frequencyPenalty / 100,
              })

        if (!d) {
            return {
                type: "fail",
                result: language.errors.unknownModel,
                model: "custom",
            }
        } else if (!d.success) {
            return {
                type: "fail",
                result: d.content instanceof ReadableStream ? await new Response(d.content).text() : d.content,
                model: "custom",
            }
        } else if (d.content instanceof ReadableStream) {
            let fullText = ""
            const piper = new TransformStream<string, StreamResponseChunk>({
                transform(chunk, control) {
                    fullText += chunk
                    control.enqueue({
                        "0": fullText,
                    })
                },
            })

            return {
                type: "streaming",
                result: d.content.pipeThrough(piper),
                model: "custom",
            }
        } else {
            return {
                type: "success",
                result: d.content,
                model: "custom",
            }
        }
    } catch (error) {
        console.error(error)
        return {
            type: "fail",
            result: `Plugin Error from ${db.currentPluginProvider}: ` + JSON.stringify(error),
            model: "custom",
        }
    }
}

export async function requestWebLLM(arg: RequestDataArgumentExtended): Promise<requestDataResponse> {
    const formated = arg.formated
    const db = getDatabase()
    const aiModel = arg.aiModel
    const currentChar = getCurrentCharacter()
    const maxTokens = arg.maxTokens
    const temperature = arg.temperature
    const realModel = aiModel.split(":::")[1]
    const prompt = applyChatTemplate(formated)

    if (arg.previewBody) {
        return {
            type: "success",
            result: JSON.stringify({
                error: "Preview body is not supported for WebLLM",
            }),
        }
    }
    const v = await runTransformers(prompt, realModel, {
        temperature: temperature,
        max_new_tokens: maxTokens,
        top_k: db.ooba.top_k,
        top_p: db.ooba.top_p,
        repetition_penalty: db.ooba.repetition_penalty,
        typical_p: db.ooba.typical_p,
    } as any)
    return {
        type: "success",
        result: unstringlizeChat(v.generated_text as string, formated, currentChar?.name ?? ""),
    }
}
