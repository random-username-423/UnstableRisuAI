import { getDatabase } from "../../data/storage/database.svelte";
import { sleep } from "../../utils/util";
import { unstringlizeChat } from "../stringlize";
import { applyChatTemplate } from "../templates/chatTemplate";
import type { RequestDataArgumentExtended, requestDataResponse } from "./types";

const HORDE_API_URL = "https://stablehorde.net/api/v2"
const HORDE_POLL_INTERVAL = 2000
const HORDE_MAX_POLL_ATTEMPTS = 150 // 5 minutes max (150 * 2 seconds)

export async function requestHorde(arg:RequestDataArgumentExtended):Promise<requestDataResponse> {
    const formated = arg.formated
    const db = getDatabase()
    const aiModel = arg.aiModel
    const abortSignal = arg.abortSignal

    if(arg.previewBody){
        return {
            type: 'success',
            result: JSON.stringify({
                error: "Preview body is not supported for Horde"
            })
        }
    }

    const prompt = applyChatTemplate(formated)

    const realModel = aiModel.split(":::")[1]

    const argument = {
        "prompt": prompt,
        "params": {
            "n": 1,
            "max_context_length": db.maxContext + 100,
            "max_length": db.maxResponse,
            "singleline": false,
            "temperature": db.temperature / 100,
            "top_k": db.top_k,
            "top_p": db.top_p,
        },
        "trusted_workers": false,
        "slow_workers": true,
        "_blacklist": false,
        "dry_run": false,
        "models": [realModel, realModel.trim(), ' ' + realModel, realModel + ' ']
    }

    if(realModel === 'auto'){
        delete argument.models
    }

    let apiKey = '0000000000'
    if(db.hordeConfig.apiKey.length > 2){
        apiKey = db.hordeConfig.apiKey
    }

    const da = await fetch(`${HORDE_API_URL}/generate/text/async`, {
        body: JSON.stringify(argument),
        method: "POST",
        headers: {
            "content-type": "application/json",
            "apikey": apiKey
        },
        signal: abortSignal
    })

    if(da.status !== 202){
        return {
            type: "fail",
            result: await da.text()
        }
    }

    const json:{
        id:string,
        kudos:number,
        message:string
    } = await da.json()

    let warnMessage = ""
    if(json.message){
        warnMessage = "with " + json.message
    }

    let pollAttempts = 0
    while(pollAttempts < HORDE_MAX_POLL_ATTEMPTS){
        if(abortSignal?.aborted){
            // Cancel the request on abort
            fetch(`${HORDE_API_URL}/generate/text/status/${json.id}`, {
                method: "DELETE"
            }).catch(() => {})
            return {
                type: 'fail',
                result: 'Aborted'
            }
        }

        await sleep(HORDE_POLL_INTERVAL)
        pollAttempts++

        try {
            const statusRes = await fetch(`${HORDE_API_URL}/generate/text/status/${json.id}`, {
                signal: abortSignal
            })
            const data = await statusRes.json()

            if(!data.is_possible){
                fetch(`${HORDE_API_URL}/generate/text/status/${json.id}`, {
                    method: "DELETE"
                }).catch(() => {})
                return {
                    type: 'fail',
                    result: "Response not possible" + warnMessage,
                    noRetry: true
                }
            }
            if(data.done && Array.isArray(data.generations) && data.generations.length > 0){
                const generations:{text:string}[] = data.generations
                if(generations && generations.length > 0){
                    return {
                        type: "success",
                        result: unstringlizeChat(generations[0].text, formated, arg.currentChar?.name ?? '')
                    }
                }
                return {
                    type: 'fail',
                    result: "No Generations when done",
                    noRetry: true
                }
            }
        } catch (error) {
            if(abortSignal?.aborted){
                return {
                    type: 'fail',
                    result: 'Aborted'
                }
            }
            // Continue polling on network errors
        }
    }

    // Timeout - cancel the request
    fetch(`${HORDE_API_URL}/generate/text/status/${json.id}`, {
        method: "DELETE"
    }).catch(() => {})

    return {
        type: 'fail',
        result: 'Horde request timed out after 5 minutes',
        noRetry: true
    }
}
