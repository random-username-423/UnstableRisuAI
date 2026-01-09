<script lang="ts" module>
import { type MessageGenerationInfo } from "src/ts/storage/types/chat"

type RequestDataProps = {
    genInfo: MessageGenerationInfo
    idx: number
}

const requestDataState = $state({
    open: false,
    data: null as RequestDataProps | null,
    generationId: ""
})

export function openRequestData(info: RequestDataProps) {
    requestDataState.data = info
    requestDataState.generationId = info.genInfo.generationId ?? "none"
    requestDataState.open = true
}

export function closeRequestData() {
    requestDataState.open = false
    requestDataState.data = null
    requestDataState.generationId = ""
}
</script>

<script lang="ts">
import { language } from "src/lang"
import Button from "src/lib/UI/GUI/Button.svelte"
import { aiLawApplies } from "src/ts/globalApi.svelte"
import { DBState, selectedCharID } from "src/ts/stores.svelte"
import { tokenize } from "src/ts/tokenizer"
import { getFetchData } from "src/ts/fetch"

let generationInfoMenuIndex = $state(0)

const beautifyJSON = (data: string) => {
    try {
        return JSON.stringify(JSON.parse(data), null, 2)
    } catch (error) {
        return data
    }
}

$effect.pre(() => {
    return () => {
        generationInfoMenuIndex = 0
    }
})
</script>

{#if requestDataState.open && requestDataState.data}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="fixed top-0 left-0 h-full w-full bg-black/50 flex flex-col z-50 items-center justify-center"
    role="button"
    tabindex="0"
    onclick={closeRequestData}
>
    <div
        class="bg-darkbg rounded-md p-4 flex flex-col max-w-3xl max-h-full overflow-y-auto"
        role="button"
        tabindex="0"
        onclick={(e) => e.stopPropagation()}
    >
        {#if aiLawApplies()}
            <div>
                {language.generatedByAIDisclaimer}
            </div>
        {/if}
        <div class="flex flex-wrap gap-2">
            <Button
                selected={generationInfoMenuIndex === 0}
                size="sm"
                onclick={() => {
                    generationInfoMenuIndex = 0
                }}
            >
                {language.tokens}
            </Button>
            <Button
                selected={generationInfoMenuIndex === 1}
                size="sm"
                onclick={() => {
                    generationInfoMenuIndex = 1
                }}
            >
                {language.metaData}
            </Button>
            <Button
                selected={generationInfoMenuIndex === 2}
                size="sm"
                onclick={() => {
                    generationInfoMenuIndex = 2
                }}
            >
                {language.log}
            </Button>
            <Button
                selected={generationInfoMenuIndex === 3}
                size="sm"
                onclick={() => {
                    generationInfoMenuIndex = 3
                }}
            >
                {language.prompt}
            </Button>
            <button
                class="ml-auto"
                onclick={closeRequestData}
            >✖</button>
        </div>
        {#if generationInfoMenuIndex === 0}
            <div class="mt-4 flex justify-center w-full">
                <div
                    class="w-32 h-32 border-darkborderc border-4 rounded-lg"
                    style:background={`linear-gradient(0deg,
                        rgb(59,130,246) 0%,
                        rgb(59,130,246) ${(requestDataState.data.genInfo.inputTokens / requestDataState.data.genInfo.maxContext) * 100}%,
                        rgb(34 197 94) ${(requestDataState.data.genInfo.inputTokens / requestDataState.data.genInfo.maxContext) * 100}%,
                        rgb(34 197 94) ${((requestDataState.data.genInfo.outputTokens + requestDataState.data.genInfo.inputTokens) / requestDataState.data.genInfo.maxContext) * 100}%,
                        rgb(156 163 175) ${((requestDataState.data.genInfo.outputTokens + requestDataState.data.genInfo.inputTokens) / requestDataState.data.genInfo.maxContext) * 100}%,
                        rgb(156 163 175) 100%)`}
                ></div>
            </div>
            <div class="grid grid-cols-2 gap-y-2 gap-x-4 mt-4">
                <span class="text-blue-500">{language.inputTokens}</span>
                <span class="text-blue-500 justify-self-end">{requestDataState.data.genInfo.inputTokens ?? "?"} {language.tokens}</span>
                <span class="text-green-500">{language.outputTokens}</span>
                <span class="text-green-500 justify-self-end">{requestDataState.data.genInfo.outputTokens ?? "?"} {language.tokens}</span>
                <span class="text-gray-400">{language.maxContextSize}</span>
                <span class="text-gray-400 justify-self-end">{requestDataState.data.genInfo.maxContext ?? "?"} {language.tokens}</span>
            </div>
            <span class="text-textcolor2 text-sm">{language.tokenWarning}</span>
        {/if}
        {#if generationInfoMenuIndex === 1}
            <div class="grid grid-cols-2 gap-y-2 gap-x-4 mt-4">
                <span class="text-blue-500">Index</span>
                <span class="text-blue-500 justify-self-end">{requestDataState.data.idx}</span>
                <span class="text-amber-500">Model</span>
                <span class="text-amber-500 justify-self-end">{requestDataState.data.genInfo.model}</span>
                <span class="text-green-500">ID</span>
                <span class="text-green-500 justify-self-end"
                    >{DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[requestDataState.data.idx]
                        .chatId ?? "None"}</span
                >
                <span class="text-red-500">GenID</span>
                <span class="text-red-500 justify-self-end">{requestDataState.data.genInfo.generationId}</span>
                <span class="text-cyan-500">Saying</span>
                <span class="text-cyan-500 justify-self-end"
                    >{DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[requestDataState.data.idx]
                        .saying}</span
                >
                <span class="text-purple-500">Size</span>
                <span class="text-purple-500 justify-self-end"
                    >{JSON.stringify(
                        DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[requestDataState.data.idx]
                    ).length} Bytes</span
                >
                <span class="text-yellow-500">Time</span>
                <span class="text-yellow-500 justify-self-end"
                    >{new Date(
                        DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[requestDataState.data.idx]
                            .time ?? 0
                    ).toLocaleString()}</span
                >
                {#if requestDataState.data.genInfo.stageTiming}
                    {@const stage1 = parseFloat(((requestDataState.data.genInfo.stageTiming.stage1 ?? 0) / 1000).toFixed(1))}
                    {@const stage2 = parseFloat(((requestDataState.data.genInfo.stageTiming.stage2 ?? 0) / 1000).toFixed(1))}
                    {@const stage3 = parseFloat(((requestDataState.data.genInfo.stageTiming.stage3 ?? 0) / 1000).toFixed(1))}
                    {@const stage4 = parseFloat(((requestDataState.data.genInfo.stageTiming.stage4 ?? 0) / 1000).toFixed(1))}
                    {@const totalRounded = (stage1 + stage2 + stage3 + stage4).toFixed(1)}
                    <span class="text-gray-400">Timing</span>
                    <span class="text-gray-400 justify-self-end">
                        <span style="color: #60a5fa;">{stage1}</span> +
                        <span style="color: #db2777;">{stage2}</span> +
                        <span style="color: #34d399;">{stage3}</span> +
                        <span style="color: #8b5cf6;">{stage4}</span> =
                        <span class="text-white font-bold">{totalRounded}s</span>
                    </span>
                {/if}

                <span class="text-green-500">Tokens</span>
                {#await tokenize(DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[requestDataState.data.idx].data)}
                    <span class="text-green-500 justify-self-end">Loading</span>
                {:then tokens}
                    <span class="text-green-500 justify-self-end">{tokens}</span>
                {/await}
            </div>
        {/if}
        {#if generationInfoMenuIndex === 2}
            {#await getFetchData(requestDataState.generationId) then data}
                {#if !data}
                    <span class="text-gray-300 text-lg mt-2">{language.errors.requestLogRemoved}</span>
                    <span class="text-gray-500">{language.errors.requestLogRemovedDesc}</span>
                {:else}
                    <h1 class="text-2xl font-bold my-4">URL</h1>
                    <code class="text-gray-300 border border-darkborderc p-2 rounded-md whitespace-pre-wrap">{data.url}</code>
                    <h1 class="text-2xl font-bold my-4">Request Body</h1>
                    <code class="text-gray-300 border border-darkborderc p-2 rounded-md whitespace-pre-wrap">{beautifyJSON(data.body)}</code>
                    <h1 class="text-2xl font-bold my-4">Response</h1>
                    <code class="text-gray-300 border border-darkborderc p-2 rounded-md whitespace-pre-wrap">{beautifyJSON(data.response)}</code>
                {/if}
            {/await}
        {/if}
        {#if generationInfoMenuIndex === 3}
            {#if Object.keys(DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[requestDataState.data.idx].promptInfo || {}).length === 0}
                <div class="text-gray-300 text-lg mt-2">{language.promptInfoEmptyMessage}</div>
            {:else}
                <div class="grid grid-cols-2 gap-y-2 gap-x-4 mt-4">
                    <span class="text-blue-500">Preset Name</span>
                    <span class="text-blue-500 justify-self-end"
                        >{DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[requestDataState.data.idx]
                            .promptInfo.promptName}</span
                    >
                    <span class="text-purple-500">Toggles</span>
                    <div class="col-span-2 max-h-32 overflow-y-auto border border-stone-500 rounded-sm p-2 bg-gray-900">
                        {#if DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[requestDataState.data.idx].promptInfo.promptToggles.length === 0}
                            <div class="text-gray-500 italic text-center py-4">{language.promptInfoEmptyToggle}</div>
                        {:else}
                            <div class="grid grid-cols-2 gap-y-2 gap-x-4">
                                {#each DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[requestDataState.data.idx].promptInfo.promptToggles as toggle}
                                    <span class="text-gray-200 truncate">{toggle.key}</span>
                                    <span class="text-gray-200 justify-self-end truncate">{toggle.value}</span>
                                {/each}
                            </div>
                        {/if}
                    </div>
                    <span class="text-red-500">Prompt Text</span>
                    <div class="col-span-2 max-h-80 overflow-y-auto border border-stone-500 rounded-sm p-4 bg-gray-900">
                        {#if !DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[requestDataState.data.idx].promptInfo.promptText}
                            <div class="text-gray-500 italic text-center py-4">{language.promptInfoEmptyText}</div>
                        {:else}
                            {#each DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[requestDataState.data.idx].promptInfo.promptText as block}
                                <div class="mb-2">
                                    <div class="font-bold text-gray-600">{block.role}</div>
                                    <pre class="whitespace-pre-wrap text-sm bg-stone-900 p-2 rounded-sm border border-stone-500">{block.content}</pre>
                                </div>
                            {/each}
                        {/if}
                    </div>
                </div>
            {/if}
        {/if}
    </div>
</div>
{/if}
