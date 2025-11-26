import { Sha256 } from "@aws-crypto/sha256-js"
import { HttpRequest } from "@smithy/protocol-http"
import { SignatureV4 } from "@smithy/signature-v4"
import { fetchNative, globalFetch, textifyReadableStream } from "src/ts/globalApi.svelte"
import { LLMFormat } from "src/ts/model/modellist"
import { registerClaudeObserver } from "src/ts/observer.svelte"
import { getDatabase } from "src/ts/storage/database.svelte"
import { replaceAsync, simplifySchema, sleep } from "src/ts/util"
import { v4 } from "uuid"
import type { MultiModal } from "../index.svelte"
import { extractJSON } from "../templates/jsonSchema"
import { applyParameters, type RequestDataArgumentExtended, type requestDataResponse, type StreamResponseChunk } from "./request"
import { callTool, decodeToolCall, encodeToolCall } from "../mcp/mcp"
import { tokenize } from "src/ts/tokenizer"

interface Claude3TextBlock {
    type: 'text',
    text: string,
    cache_control?: {
        "type": "ephemeral",
        "ttl"?: "5m" | "1h"
    }
}

interface Claude3ImageBlock {
    type: 'image',
    source: {
        type: 'base64'
        media_type: string,
        data: string
    }
    cache_control?: {
        "type": "ephemeral"
        "ttl"?: "5m" | "1h"
    }
}

interface Claude3ToolUseBlock {
    "type": "tool_use",
    "id": string,
    "name": string,
    "input": any,
    cache_control?: {
        "type": "ephemeral"
        "ttl"?: "5m" | "1h"
    }
}

interface Claude3ToolResponseBlock {
    type: "tool_result",
    tool_use_id: string
    content: Claude3ContentBlock[]
    cache_control?: {
        "type": "ephemeral"
        "ttl"?: "5m" | "1h"
    }
}

type Claude3ContentBlock = Claude3TextBlock|Claude3ImageBlock|Claude3ToolUseBlock|Claude3ToolResponseBlock

interface Claude3Chat {
    role: 'user'|'assistant'
    content: Claude3ContentBlock[]
}

interface Claude3ExtendedChat {
    role: 'user'|'assistant'
    content: Claude3ContentBlock[]|string
}

export async function requestClaude(arg:RequestDataArgumentExtended):Promise<requestDataResponse> {
    const formated = arg.formated
    const db = getDatabase()
    const aiModel = arg.aiModel
    const useStreaming = arg.useStreaming
    let replacerURL = arg.customURL ?? ('https://api.anthropic.com/v1/messages')
    let apiKey = arg.key || ((aiModel === 'reverse_proxy') ? db.proxyKey : db.claudeAPIKey)
    const maxTokens = arg.maxTokens
    if(aiModel === 'reverse_proxy' && db.autofillRequestUrl){
        if(replacerURL.endsWith('v1')){
            replacerURL += '/messages'
        }
        else if(replacerURL.endsWith('v1/')){
            replacerURL += 'messages'
        }
        else if(!(replacerURL.endsWith('messages') || replacerURL.endsWith('messages/'))){
            if(replacerURL.endsWith('/')){
                replacerURL += 'v1/messages'
            }
            else{
                replacerURL += '/v1/messages'
            }
        }
    }

    let claudeChat: Claude3Chat[] = []
    let systemPrompt:string = ''

    const addClaudeChat = (chat:{
        role: 'user'|'assistant'
        content: string,
        cache: boolean
    }, multimodals?:MultiModal[]) => {
        if(claudeChat.length > 0 && claudeChat[claudeChat.length-1].role === chat.role){
            let content = claudeChat[claudeChat.length-1].content
            if(multimodals && multimodals.length > 0 && !Array.isArray(content)){
                content = [{    
                    type: 'text',
                    text: content
                }]
            }

            if(Array.isArray(content)){
                let lastContent = content[content.length-1]
                if( lastContent?.type === 'text'){
                    lastContent.text += "\n\n" + chat.content
                    content[content.length-1] = lastContent
                }
                else{
                    content.push({
                        type: 'text',
                        text: chat.content
                    })
                }

                if(multimodals && multimodals.length > 0){
                    for(const modal of multimodals){
                        if(modal.type === 'image'){
                            const dataurl = modal.base64
                            const base64 = dataurl.split(',')[1]
                            const mediaType = dataurl.split(';')[0].split(':')[1]

                            content.unshift({
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: mediaType,
                                    data: base64
                                }
                            })
                        }
                    }
                }
            }
            if(chat.cache){

                if(db.claude1HourCaching){
                    content[content.length-1].cache_control = {
                        type: 'ephemeral',
                        ttl: "1h"
                    }
                }
                else{
                    content[content.length-1].cache_control = {
                        type: 'ephemeral'
                    }
                }
            }
            claudeChat[claudeChat.length-1].content = content
        }
        else{
            let formatedChat:Claude3Chat = {
                role: chat.role,
                content: [{
                    type: 'text',
                    text: chat.content
                }]
            }
            if(multimodals && multimodals.length > 0){
                formatedChat.content = [{
                    type: 'text',
                    text: chat.content
                }]
                for(const modal of multimodals){
                    if(modal.type === 'image'){
                        const dataurl = modal.base64
                        const base64 = dataurl.split(',')[1]
                        const mediaType = dataurl.split(';')[0].split(':')[1]

                        formatedChat.content.unshift({
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mediaType,
                                data: base64
                            }
                        })
                    }
                }

            }
            if(chat.cache){
                if(db.claude1HourCaching){
                    formatedChat.content[0].cache_control = {
                        type: 'ephemeral',
                        ttl: "1h"
                    }
                }
                else{
                    formatedChat.content[0].cache_control = {
                        type: 'ephemeral'
                    }
                }
            }
            claudeChat.push(formatedChat)
        }
    }
    // Build a map of assistant index -> encrypted thinking data
    const anthropicThinkingMap = new Map<number, any>()
    for(const et of (arg.encryptedThinkingHistory || [])){
        if(et.provider === 'anthropic'){
            anthropicThinkingMap.set(et.index, et)
        }
    }
    let assistantMsgIndex = 0

    for(const chat of formated){
        switch(chat.role){
            case 'user':{
                addClaudeChat({
                    role: 'user',
                    content: chat.content,
                    cache: chat.cachePoint
                }, chat.multimodals)
                break
            }
            case 'assistant':{
                // Check for thinking data to include (matched by assistant order index)
                const anthropicThinking = anthropicThinkingMap.get(assistantMsgIndex)
                assistantMsgIndex++

                if(anthropicThinking?.data?.signatures || anthropicThinking?.data?.redacted){
                    // Build content with thinking blocks
                    const content: any[] = []

                    // Add thinking blocks with signatures
                    if(anthropicThinking.data.signatures){
                        for(const sig of anthropicThinking.data.signatures){
                            content.push({
                                type: 'thinking',
                                thinking: '', // Original thinking content is not stored
                                signature: sig
                            })
                        }
                    }

                    // Add redacted thinking blocks
                    if(anthropicThinking.data.redacted){
                        for(const red of anthropicThinking.data.redacted){
                            content.push({
                                type: 'redacted_thinking',
                                data: red
                            })
                        }
                    }

                    // Add text content
                    content.push({
                        type: 'text',
                        text: chat.content
                    })

                    claudeChat.push({
                        role: 'assistant',
                        content: content
                    })
                }
                else{
                    addClaudeChat({
                        role: 'assistant',
                        content: chat.content,
                        cache: chat.cachePoint
                    }, chat.multimodals)
                }
                break
            }
            case 'system':{
                if(claudeChat.length === 0){
                    systemPrompt += '\n\n' + chat.content
                }
                else{
                    addClaudeChat({
                        role: 'user',
                        content: "System: " + chat.content,
                        cache: chat.cachePoint
                    })
                }
                break
            }
            case 'function':{
                //ignore function for now
                break
            }
        }
    }
    if(claudeChat.length === 0 && systemPrompt === ''){
        return {
            type: 'fail',
            result: 'No input'
        }
    }
    if(claudeChat.length === 0 && systemPrompt !== ''){
        claudeChat.push({
            role: 'user',
            content: [{
                type: 'text',
                text: 'Start'
            }]
        })
        systemPrompt = ''
    }
    if(claudeChat[0].role !== 'user'){
        claudeChat.unshift({
            role: 'user',
            content: [{
                type: 'text',
                text: 'Start'
            }]
        })
    }

    //check for tool calls
    for(let j=0;j<claudeChat.length;j++){
        let chat = claudeChat[j]
        for(let i=0;i<chat.content.length;i++){
            let content = chat.content[i]
            if(content.type === 'text'){
                content.text = await replaceAsync(content.text,/<tool_call>(.*?)<\/tool_call>/g, async (match:string, p1:string) => {
                    try {
                        const parsed = await decodeToolCall(p1)
                        if(parsed?.call && parsed?.response){
                            const toolUse:Claude3ToolUseBlock = {
                                type: 'tool_use',
                                id: parsed.call.id,
                                name: parsed.call.name,
                                input: parsed.call.arg
                            }
                            const toolResponse:Claude3ToolResponseBlock = {
                                type: 'tool_result',
                                tool_use_id: parsed.call.id,
                                content: parsed.response.map((v:any) => {
                                    if(v.type === 'text'){
                                        return {
                                            type: 'text',
                                            text: v.text
                                        }
                                    }
                                    if(v.type === 'image'){
                                        return {
                                            type: 'image',
                                            source: {
                                                type: 'base64',
                                                media_type: v.mimeType,
                                                data: v.data
                                            }
                                        }
                                    }
                                    return {
                                        type: 'text',
                                        text: `Unsupported tool response type: ${v.type}`
                                    }
                                })
                            }
                            claudeChat.splice(j, 0, {
                                role: 'assistant',
                                content: [toolUse]
                            })

                            claudeChat.splice(j+1, 0, {
                                role: 'user',
                                content: [toolResponse]
                            })
                            j+=2
                            chat = claudeChat[j]
                            return ''
                        }
                    } catch (error) {
                        
                    }

                    return ''
                })
            }
        }
    }

    let finalChat:Claude3ExtendedChat[] = claudeChat

    if(aiModel === 'reverse_proxy'){
        finalChat = claudeChat.map((v) => {
            if(v.content.length > 0 && v.content[0].type === 'text'){
                return {
                    role: v.role,
                    content: v.content[0].text
                }
            }
        })
    }

    console.log(arg.modelInfo.parameters)
    let body = applyParameters({
        model: arg.modelInfo.internalID,
        messages: finalChat,
        system: systemPrompt.trim(),
        max_tokens: maxTokens,
        stream: useStreaming ?? false
    }, arg.modelInfo.parameters, {
        'thinking_tokens': 'thinking.budget_tokens'
    }, arg.mode)

    if(body?.thinking?.budget_tokens === 0){
        delete body.thinking
    }
    else if(body?.thinking?.budget_tokens && body?.thinking?.budget_tokens > 0){
        body.thinking.type = 'enabled'
    }
    else if(body?.thinking?.budget_tokens === null){
        delete body.thinking
    }

    if(systemPrompt === ''){
        delete body.system
    }

    const bedrock = arg.modelInfo.format === LLMFormat.AWSBedrockClaude

    if(bedrock && aiModel !== 'reverse_proxy'){
        function getCredentialParts(key:string) {
            const [accessKeyId, secretAccessKey, region] = key.split(":");
          
            if (!accessKeyId || !secretAccessKey || !region) {
              throw new Error("The key assigned to this request is invalid.");
            }
          
            return { accessKeyId, secretAccessKey, region };
        }
        const { accessKeyId, secretAccessKey, region } = getCredentialParts(apiKey);

        const AMZ_HOST = "bedrock-runtime.%REGION%.amazonaws.com";
        const host = AMZ_HOST.replace("%REGION%", region);
        const stream = false;   // todo?
        
        const awsModel = !arg.modelInfo.internalID.includes("claude-v2") ? "us." + arg.modelInfo.internalID : arg.modelInfo.internalID;
        const url = `https://${host}/model/${awsModel}/invoke${stream ? "-with-response-stream" : ""}`

        let params = {...body}
        params.anthropic_version = "bedrock-2023-05-31"
        delete params.model
        delete params.stream
        if (params.thinking?.type === "enabled"){
            params.temperature = 1.0
            delete params.top_k
            delete params.top_p
        }

        const rq = new HttpRequest({
            method: "POST",
            protocol: "https:",
            hostname: host,
            path: `/model/${awsModel}/invoke${stream ? "-with-response-stream" : ""}`,
            headers: {
              ["Host"]: host,
              ["Content-Type"]: "application/json",
              ["accept"]: "application/json",
            },
            body: JSON.stringify(params),
        });
        
        const signer = new SignatureV4({
            sha256: Sha256,
            credentials: { accessKeyId, secretAccessKey },
            region,
            service: "bedrock",
        });
        
        const signed = await signer.sign(rq);

        if(arg.previewBody){
            return {
                type: 'success',
                result: JSON.stringify({
                    url: url,
                    body: params,
                    headers: signed.headers
                })
            }

        }

        const res = await globalFetch(url, {
            method: "POST",
            body: params,
            headers: signed.headers,
            plainFetchForce: true,
            chatId: arg.chatId
        })

        if(!res.ok){
            return {
                type: 'fail',
                result: JSON.stringify(res.data)
            }
        }
        if(res.data.error){
            return {
                type: 'fail',
                result: JSON.stringify(res.data.error)
            }
        }
        const contents = res?.data?.content
        if(!contents || contents.length === 0){
            return {
                type: 'fail',
                result: JSON.stringify(res.data)
            }
        }
        let resText = ''
        let actualResponseText = ''
        let thinking = false
        let collectedSignatures: string[] = []
        let collectedRedacted: string[] = []

        for(const content of contents){
            if(content.type === 'text'){
                if(thinking){
                    resText += "</Thoughts>\n\n"
                    thinking = false
                }
                resText += content.text
                actualResponseText += content.text
            }
            if(content.type === 'thinking'){
                if(!thinking){
                    resText += "<Thoughts>\n"
                    thinking = true
                }
                resText += content.thinking ?? ''
                // Collect signature from thinking block
                if(content.signature){
                    collectedSignatures.push(content.signature)
                }
            }
            if(content.type === 'redacted_thinking'){
                if(!thinking){
                    resText += "<Thoughts>\n"
                    thinking = true
                }
                resText += '\n{{redacted_thinking}}\n'
                // Collect redacted thinking data
                if(content.data){
                    collectedRedacted.push(content.data)
                }
            }
        }

        // Build encrypted thinking data
        const hasEncryptedData = collectedSignatures.length > 0 || collectedRedacted.length > 0
        const outputTokens = res.data?.usage?.output_tokens ?? 0
        const actualResponseTokens = await tokenize(actualResponseText)
        const thinkingTokens = outputTokens - actualResponseTokens
        console.log('[Anthropic] Thinking tokens calculation:', {
            outputTokens,
            actualResponseTokens,
            thinkingTokens,
            hasEncryptedData
        })
        const encryptedThinking = (hasEncryptedData && thinkingTokens > 0) ? {
            provider: 'anthropic',
            data: {
                signatures: collectedSignatures.length > 0 ? collectedSignatures : undefined,
                redacted: collectedRedacted.length > 0 ? collectedRedacted : undefined
            },
            tokens: thinkingTokens
        } : undefined

        if(arg.extractJson && db.jsonSchemaEnabled){
            return {
                type: 'success',
                result: extractJSON(resText, db.jsonSchema),
                encryptedThinking
            }
        }
        return {
            type: 'success',
            result: resText,
            encryptedThinking
        }
    }


    let headers:{
        [key:string]:string
    } = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "accept": "application/json",
    }

    let betas:string[] = []

    if(body.max_tokens > 8192){
        betas.push('output-128k-2025-02-19')
    }


    if(db.claude1HourCaching){
        betas.push('extended-cache-ttl-2025-04-11')
    }

    if(betas.length > 0){
        headers['anthropic-beta'] = betas.join(',')
    }

    if(db.usePlainFetch){
        headers['anthropic-dangerous-direct-browser-access'] = 'true'
    }

    if(arg.tools && arg.tools.length > 0){
        body.tools = arg.tools.map((v) => {
            return {
                name: v.name,
                description: v.description,
                input_schema: simplifySchema(v.inputSchema)
            }
        })

    }

    if(arg.previewBody){
        return {
            type: 'success',
            result: JSON.stringify({
                url: replacerURL,
                body: body,
                headers: headers
            })
        }
    }

    if(db.claudeBatching){
        if(body.stream !== undefined){
            delete body.stream
        }
        const id = v4()
        const resp = await fetchNative(replacerURL + '/batches', {
            "body": JSON.stringify({
                "requests": [{
                    "custom_id": id,
                    "params": body,
                }]
            }),
            "method": "POST",
            signal: arg.abortSignal,
            headers: headers
        })

        if(resp.status !== 200){
            return {
                type: 'fail',
                result: await textifyReadableStream(resp.body)
            }
        }

        const r = (await resp.json())

        if(!r.id){
            return {
                type: 'fail',
                result: 'No results URL returned from Claude batch request'
            }
        }

        const resultsUrl = replacerURL + `/batches/${r.id}/results`
        const statusUrl = replacerURL + `/batches/${r.id}`

        let received = false
        while(!received){
            try {
                await sleep(3000)
                if(arg?.abortSignal?.aborted){
                    return {
                        type: 'fail',
                        result: 'Request aborted'
                    }
                }

                const statusRes = await fetchNative(statusUrl, {
                    "method": "GET",
                    "headers": {
                        "x-api-key": apiKey,
                        "anthropic-version": "2023-06-01",
                    },
                    "signal": arg.abortSignal,
                })

                if(statusRes.status !== 200){
                    return {
                        type: 'fail',
                        result: await textifyReadableStream(statusRes.body)
                    }
                }

                const statusData = await statusRes.json()

                if(statusData.processing_status !== 'ended'){
                    continue
                }

                const batchRes = await fetchNative(resultsUrl, {
                    "method": "GET",
                    "headers": {
                        "x-api-key": apiKey,
                        "anthropic-version": "2023-06-01",
                    },
                    "signal": arg.abortSignal,
                })

                if(batchRes.status !== 200){
                    return {
                        type: 'fail',
                        result: await textifyReadableStream(batchRes.body)
                    }
                }

                //since jsonl
                const batchTextData = (await batchRes.text()).split('\n').filter((v) => v.trim() !== ''). map((v) => {
                    try {
                        return JSON.parse(v)
                    } catch (error) {
                        return null
                    }
                }).filter((v) => v !== null)
                for(const batchData of batchTextData){
                    const type = batchData?.result?.type
                    console.log('Claude batch result type:', type)
                    if(batchData?.result?.type === 'succeeded'){
                        return {
                            type: 'success',
                            result: batchData.result.message.content?.[0]?.text ?? ''
                        }
                    }
                    if(batchData?.result?.type === 'errored'){
                        return {
                            type: 'fail',
                            result:  JSON.stringify(batchData.result.error),
                        }
                    }
                }   
            } catch (error) {
                console.error('Error while waiting for Claude batch results:', error)
            }
        }
    }
    
    
    if(db.claudeRetrivalCaching){
        registerClaudeObserver({
            url: replacerURL,
            body: body,
            headers: headers
        })
    }

    return requestClaudeHTTP(replacerURL, headers, body, arg)
}

async function requestClaudeHTTP(replacerURL:string, headers:{[key:string]:string}, body:any, arg:RequestDataArgumentExtended):Promise<requestDataResponse> {
    
    if(arg.useStreaming){
        
        const res = await fetchNative(replacerURL, {
            body: JSON.stringify(body),
            headers: headers,
            method: "POST",
            chatId: arg.chatId
        })

        if(res.status !== 200){
            return {
                type: 'fail',
                result: await textifyReadableStream(res.body)
            }
        }
        let breakError = ''
        let thinking = false

        // Collect signatures and redacted thinking during streaming
        let collectedSignatures: string[] = []
        let collectedRedacted: string[] = []
        let currentBlockType: string | null = null
        let outputTokens: number = 0
        let actualResponseText = ''

        const stream = new ReadableStream<StreamResponseChunk>({
            async start(controller){
                let text = ''
                let reader = res.body.getReader()
                let parserData = ''
                const decoder = new TextDecoder()
                const parseEvent = (async (e:string) => {
                    try {
                        const parsedData = JSON.parse(e)

                        // Track content block type from content_block_start
                        if(parsedData?.type === 'content_block_start'){
                            currentBlockType = parsedData?.content_block?.type || null
                        }

                        if(parsedData?.type === 'content_block_delta'){
                            if(parsedData?.delta?.type === 'text' || parsedData.delta?.type === 'text_delta'){
                                if(thinking){
                                    text += "</Thoughts>\n\n"
                                    thinking = false
                                }
                                text += parsedData.delta?.text ?? ''
                                actualResponseText += parsedData.delta?.text ?? ''
                            }

                            if(parsedData?.delta?.type === 'thinking' || parsedData.delta?.type === 'thinking_delta'){
                                if(!thinking){
                                    text += "<Thoughts>\n"
                                    thinking = true
                                }
                                text += parsedData.delta?.thinking ?? ''
                            }

                            if(parsedData?.delta?.type === 'redacted_thinking'){
                                if(!thinking){
                                    text += "<Thoughts>\n"
                                    thinking = true
                                }
                                text += '\n{{redacted_thinking}}\n'
                            }

                            // Collect signature from thinking delta (some API versions)
                            if(parsedData?.delta?.signature){
                                collectedSignatures.push(parsedData.delta.signature)
                            }
                        }

                        // Collect signatures from content_block_stop
                        if(parsedData?.type === 'content_block_stop'){
                            // signature might be in the content_block_stop event
                            if(parsedData?.content_block?.signature){
                                collectedSignatures.push(parsedData.content_block.signature)
                            }
                            // redacted_thinking data might be here too
                            if(parsedData?.content_block?.type === 'redacted_thinking' && parsedData?.content_block?.data){
                                collectedRedacted.push(parsedData.content_block.data)
                            }
                            currentBlockType = null
                        }

                        if(parsedData?.type === 'error'){
                            const errormsg:string = parsedData?.error?.message
                            if(errormsg && errormsg.toLocaleLowerCase().includes('overload') && db.antiServerOverloads){
                                // console.log('Overload detected, retrying...')
                                controller.enqueue({
                                    "0": "Overload detected, retrying..."
                                })

                                return 'overload'
                            }
                            text += "Error:" + parsedData?.error?.message

                        }

                        // Collect output_tokens from message_delta event
                        if(parsedData?.type === 'message_delta' && parsedData?.usage?.output_tokens){
                            outputTokens = parsedData.usage.output_tokens
                        }

                    }
                    catch (error) {
                    }



                })
                let breakWhile = false
                let i = 0;
                let prevText = ''
                while(true){
                    try {
                        if(arg?.abortSignal?.aborted || breakWhile){
                            break
                        }
                        const {done, value} = await reader.read()
                        if(done){
                            break
                        }
                        parserData += (decoder.decode(value))
                        let parts = parserData.split('\n')
                        for(;i<parts.length-1;i++){
                            prevText = text
                            if(parts?.[i]?.startsWith('data: ')){
                                const d = await parseEvent(parts[i].slice(6))
                                if(d === 'overload'){
                                    parserData = ''
                                    prevText = ''
                                    text = ''
                                    actualResponseText = ''
                                    collectedSignatures = []
                                    collectedRedacted = []
                                    reader.cancel()
                                    const res = await fetchNative(replacerURL, {
                                        body: JSON.stringify(body),
                                        headers: headers,
                                        method: "POST",
                                        chatId: arg.chatId
                                    })

                                    if(res.status !== 200){
                                        controller.enqueue({
                                            "0": await textifyReadableStream(res.body)
                                        })
                                        breakWhile = true
                                        break
                                    }

                                    reader = res.body.getReader()
                                    break
                                }
                            }
                        }
                        i--;
                        text = prevText

                        controller.enqueue({
                            "0": text
                        })

                    } catch (error) {
                        await sleep(1)
                    }
                }
                // Emit collected signatures and redacted data as special keys at stream end
                if(collectedSignatures.length > 0 || collectedRedacted.length > 0){
                    const actualResponseTokens = await tokenize(actualResponseText)
                    const thinkingTokens = outputTokens - actualResponseTokens
                    console.log('[Anthropic Streaming] Thinking tokens calculation:', {
                        outputTokens,
                        actualResponseTokens,
                        thinkingTokens
                    })

                    if(thinkingTokens > 0){
                        const finalChunk: StreamResponseChunk = {
                            "0": text
                        }
                        if(collectedSignatures.length > 0){
                            finalChunk['__anthropic_signatures'] = JSON.stringify(collectedSignatures)
                        }
                        if(collectedRedacted.length > 0){
                            finalChunk['__anthropic_redacted'] = JSON.stringify(collectedRedacted)
                        }
                        finalChunk['__anthropic_thinking_tokens'] = String(thinkingTokens)
                        controller.enqueue(finalChunk)
                    }
                }
                controller.close()
            },
            cancel(){
            }
        })

        return {
            type: 'streaming',
            result: stream
        }

    }

    const db = getDatabase()
    const res = await globalFetch(replacerURL, {
        body: body,
        headers: headers,
        method: "POST",
        chatId: arg.chatId
    })

    if(!res.ok){
        const stringlified = JSON.stringify(res.data)
        return {
            type: 'fail',
            result: stringlified,
            failByServerError: stringlified?.toLocaleLowerCase()?.includes('overload')
        }
    }
    if(res.data.error){
        const stringlified = JSON.stringify(res.data.error)
        return {
            type: 'fail',
            result: stringlified,
            failByServerError: stringlified?.toLocaleLowerCase()?.includes('overload')
        }
    }
    const contents = res?.data?.content
    if(!contents || contents.length === 0){
        return {
            type: 'fail',
            result: JSON.stringify(res.data)
        }
    }
    let resText = ''
    let thinking = false

    const hasToolUse = (contents as any[]).some((v) => v.type === 'tool_use')

    if(hasToolUse){

        const messages:Claude3ExtendedChat[] = body.messages
        const response:Claude3Chat = {
            role: 'user',
            content: []
        }
        
        for(const content of (contents as Claude3ContentBlock[])){
            if(messages[messages.length-1].role !== 'assistant'){
                messages.push({
                    role: 'assistant',
                    content: []
                })
            }
            if(typeof messages[messages.length-1].content === 'string'){
                messages[messages.length-1].content = [{
                    type: 'text',
                    text: messages[messages.length-1].content as string
                }]
            }

            if(content.type === 'tool_use'){
                const used = await callTool(content.name, content.input)
                const r:Claude3ToolResponseBlock = {
                    type: 'tool_result',
                    tool_use_id: content.id,
                    content: used.map((v) => {
                        switch(v.type){
                            case 'text':{
                                return {
                                    type: 'text',
                                    text: v.text,
                                }
                            }
                            case 'image':{
                                return {
                                    type: 'image',
                                    source: {
                                        type: 'base64',
                                        media_type: v.mimeType,
                                        data: v.data
                                    }
                                }
                            }
                            default:{
                                return {
                                    type: 'text',
                                    text: `Unsupported tool response type: ${v.type}`
                                }
                            }
                        }
                    })
                }
                response.content.push(r)
                if(arg.rememberToolUsage){
                    arg.additionalOutput ??= ''
                    arg.additionalOutput += await encodeToolCall({
                        call: {
                            id: content.id,
                            name: content.name,
                            arg: content.input
                        },
                        response: used
                    })
                }
            }

            (messages[messages.length-1] as Claude3Chat).content.push(content)
        }

        messages.push(response)

        body.messages = messages
        body.stream = false

        return requestClaudeHTTP(replacerURL, headers, body, arg)
    }
    let collectedSignatures: string[] = []
    let collectedRedacted: string[] = []
    let actualResponseText = ''

    for(const content of contents){
        if(content.type === 'text'){
            if(thinking){
                resText += "</Thoughts>\n\n"
                thinking = false
            }
            resText += content.text
            actualResponseText += content.text
        }
        if(content.type === 'thinking'){
            if(!thinking){
                resText += "<Thoughts>\n"
                thinking = true
            }
            resText += content.thinking ?? ''
            // Collect signature from thinking block
            if(content.signature){
                collectedSignatures.push(content.signature)
            }
        }
        if(content.type === 'redacted_thinking'){
            if(!thinking){
                resText += "<Thoughts>\n"
                thinking = true
            }
            resText += '\n{{redacted_thinking}}\n'
            // Collect redacted thinking data
            if(content.data){
                collectedRedacted.push(content.data)
            }
        }
        if(content.type === 'tool_use'){

        }
    }

    // Build encrypted thinking data
    const hasEncryptedData = collectedSignatures.length > 0 || collectedRedacted.length > 0
    const outputTokens = res.data?.usage?.output_tokens ?? 0
    const actualResponseTokens = await tokenize(actualResponseText)
    const thinkingTokens = outputTokens - actualResponseTokens
    console.log('[Anthropic] Thinking tokens calculation:', {
        outputTokens,
        actualResponseTokens,
        thinkingTokens,
        hasEncryptedData
    })
    const encryptedThinking = (hasEncryptedData && thinkingTokens > 0) ? {
        provider: 'anthropic',
        data: {
            signatures: collectedSignatures.length > 0 ? collectedSignatures : undefined,
            redacted: collectedRedacted.length > 0 ? collectedRedacted : undefined
        },
        tokens: thinkingTokens
    } : undefined

    arg.additionalOutput ??= ""
    if(arg.extractJson && db.jsonSchemaEnabled){
        return {
            type: 'success',
            result: arg.additionalOutput + extractJSON(resText, db.jsonSchema),
            encryptedThinking
        }
    }
    return {
        type: 'success',
        result: arg.additionalOutput + resText,
        encryptedThinking
    }
}
