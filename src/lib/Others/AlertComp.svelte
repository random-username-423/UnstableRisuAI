<script lang="ts">
    import { AlertGenerationInfoState } from "../../ts/utils/alert.svelte"

    import { DBState } from "src/ts/stores.svelte"
    import { getCharImage } from "../../ts/character/characters.svelte"
    import { ParseMarkdown } from "../../ts/utils/parser.svelte"
    import BarIcon from "../SideBars/BarIcon.svelte"
    import { ChevronRightIcon, User } from "@lucide/svelte"
    import { hubURL, isCharacterHasAssets } from "src/ts/character/characterCards.svelte"
    import TextInput from "../UI/GUI/TextInput.svelte"
    import { openURL } from "src/ts/utils/util"
    import Button from "../UI/GUI/Button.svelte"
    import { XIcon } from "@lucide/svelte"
    import SelectInput from "../UI/GUI/SelectInput.svelte"
    import OptionInput from "../UI/GUI/OptionInput.svelte"
    import { language } from "src/lang"
    import { getFetchData } from "src/ts/utils/fetch"
    import { ModalState, ChatState } from "src/ts/stores.svelte"
    import { tokenize } from "src/ts/utils/tokenizer"
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte"
    import ModuleChatMenu from "../Setting/Pages/Module/ModuleChatMenu.svelte"
    import { ColorSchemeTypeState } from "src/ts/gui/colorscheme.svelte"
    import Help from "./Help.svelte"
    import { getChatBranches } from "src/ts/gui/branches"
    import { getCurrentCharacter } from "src/ts/data/storage/database.svelte"

    let showDetails = $state(false)

    let btn
    let input = $state("")
    let cardExportType = $state("realm")
    let cardExportType2 = $state("")
    let cardLicense = $state("")
    let generationInfoMenuIndex = $state(0)
    let branchHover: null | {
        x: number
        y: number
        content: string
    } = $state(null)
    $effect.pre(() => {
        showDetails = false
        if (btn) {
            btn.focus()
        }
        if (ModalState.alert.type !== "input") {
            input = ""
        }
        if (ModalState.alert.type !== "branches") {
            branchHover = null
        }
        if (ModalState.alert.type !== "cardexport") {
            cardExportType = "realm"
            cardExportType2 = ""
            cardLicense = ""
        }
    })

    const beautifyJSON = (data: string) => {
        try {
            return JSON.stringify(JSON.parse(data), null, 2)
        } catch (error) {
            return data
        }
    }
</script>

<svelte:window
    onmessage={async (e) => {
        if (
            e.origin.startsWith("https://sv.risuai.xyz") ||
            e.origin.startsWith("https://nightly.sv.risuai.xyz") ||
            e.origin.startsWith("http://127.0.0.1") ||
            e.origin === window.location.origin
        ) {
            if (e.data.msg?.data?.vaild && ModalState.alert.type === "login") {
                ModalState.alert = {
                    type: "none",
                    msg: JSON.stringify(e.data.msg),
                }
            }
        }
    }}
/>

{#if ModalState.alert.type !== "none" && ModalState.alert.type !== "toast" && ModalState.alert.type !== "cardexport" && ModalState.alert.type !== "branches" && ModalState.alert.type !== "selectModule" && ModalState.alert.type !== "pukmakkurit"}
    <div
        class="absolute z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50"
        class:vis={ModalState.alert.type === "wait2"}
    >
        <div class="break-any flex max-h-full max-w-3xl flex-col overflow-y-auto rounded-md bg-darkbg p-4">
            {#if ModalState.alert.type === "error"}
                <h2 class="mb-2 mt-0 w-40 max-w-full text-red-700">Error</h2>
            {:else if ModalState.alert.type === "ask"}
                <h2 class="mb-2 mt-0 w-40 max-w-full text-green-700">Confirm</h2>
            {:else if ModalState.alert.type === "pluginconfirm"}
                <h2 class="mb-2 mt-0 w-40 max-w-full text-green-700">Plugin Import</h2>
            {:else if ModalState.alert.type === "selectChar"}
                <h2 class="mb-2 mt-0 w-40 max-w-full text-green-700">Select</h2>
            {:else if ModalState.alert.type === "input"}
                <h2 class="mb-2 mt-0 w-40 max-w-full text-green-700">Input</h2>
            {/if}
            {#if ModalState.alert.type === "markdown"}
                <div class="overflow-y-auto">
                    <span class="chattext chattext2 prose text-gray-300" class:prose-invert={ColorSchemeTypeState.type}>
                        {#await ParseMarkdown(ModalState.alert.msg) then msg}
                            {@html msg}
                        {/await}
                    </span>
                </div>
            {:else if ModalState.alert.type === "tos"}
                <!-- svelte-ignore a11y_missing_attribute -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div class="text-textcolor">
                    You should accept <a
                        role="button"
                        tabindex="0"
                        class="cursor-pointer text-green-600 transition-colors duration-200 hover:text-green-500"
                        onclick={() => {
                            openURL("https://sv.risuai.xyz/hub/tos")
                        }}>Terms of Service</a
                    > to continue
                </div>
            {:else if ModalState.alert.type === "pluginconfirm"}
                {@const parts = ModalState.alert.msg.split("\n\n")}
                {@const mainPart = parts[0]}
                {@const confirmMessage = parts[1]}
                {@const mainParts = mainPart.split("\n")}
                {@const pluginName = mainParts[0]}
                {@const warnings = mainParts.slice(1)}
                <div class="plugin-confirm-content">
                    <p class="plugin-name">{pluginName}</p>
                    {#if warnings.length > 0}
                        <ul class="warnings-list">
                            {#each warnings as warning}
                                <li class="warning-item">{warning}</li>
                            {/each}
                        </ul>
                    {/if}
                    <p class="confirm-message">{confirmMessage}</p>
                </div>
            {:else if ModalState.alert.type !== "select" && ModalState.alert.type !== "requestdata" && ModalState.alert.type !== "addchar" && ModalState.alert.type !== "hypaV2" && ModalState.alert.type !== "chatOptions"}
                <span class="whitespace-pre-wrap text-gray-300">{ModalState.alert.msg}</span>
                {#if ModalState.alert.submsg && ModalState.alert.type !== "progress"}
                    <span class="text-sm text-gray-500">{ModalState.alert.submsg}</span>
                {/if}

                {#if ModalState.alert.type === "error" && ModalState.alert.stackTrace}
                    <div class="mt-4">
                        <Button styled="outlined" size="sm" onclick={() => (showDetails = !showDetails)}>
                            {showDetails ? language.hideErrorDetails : language.showErrorDetails}
                            {#if showDetails}
                                <XIcon class="ml-2 inline" />
                            {:else}
                                <ChevronRightIcon class="ml-2 inline" />
                            {/if}
                        </Button>
                        {#if showDetails}
                            <pre class="stack-trace">{@html ModalState.alert.stackTrace}</pre>
                        {/if}
                    </div>
                {/if}
            {/if}
            {#if ModalState.alert.type === "progress"}
                <div class="mt-6 h-2 w-full min-w-64 rounded-md border border-darkborderc bg-darkbg md:min-w-138">
                    <div
                        class="saving-animation h-full bg-gradient-to-r from-blue-500 to-purple-800 transition-[width]"
                        style:width={ModalState.alert.submsg + "%"}
                    ></div>
                </div>
                <div class="mt-6 flex w-full justify-center">
                    <span class="text-sm text-gray-500">{ModalState.alert.submsg + "%"}</span>
                </div>
            {/if}

            {#if ModalState.alert.type === "ask" || ModalState.alert.type === "pluginconfirm"}
                <div class="flex w-full gap-2">
                    <Button
                        className="mt-4 flex-grow"
                        onclick={() => {
                            ModalState.alert = {
                                type: "none",
                                msg: "yes",
                            }
                        }}>YES</Button
                    >
                    <Button
                        className="mt-4 flex-grow"
                        onclick={() => {
                            ModalState.alert = {
                                type: "none",
                                msg: "no",
                            }
                        }}>NO</Button
                    >
                </div>
            {:else if ModalState.alert.type === "tos"}
                <div class="flex w-full gap-2">
                    <Button
                        className="mt-4 flex-grow"
                        onclick={() => {
                            ModalState.alert = {
                                type: "none",
                                msg: "yes",
                            }
                        }}>Accept</Button
                    >
                    <Button
                        styled="outlined"
                        className="mt-4 flex-grow"
                        onclick={() => {
                            ModalState.alert = {
                                type: "none",
                                msg: "no",
                            }
                        }}>Do not Accept</Button
                    >
                </div>
            {:else if ModalState.alert.type === "select"}
                {@const hasDisplay = ModalState.alert.msg.startsWith("__DISPLAY__")}
                {#if hasDisplay}
                    {@const parts = ModalState.alert.msg.substring(11).split("||")}
                    <div class="mb-4 text-textcolor">{parts[0]}</div>
                    {#each parts.slice(1) as n, i}
                        <Button
                            className="mt-4"
                            onclick={() => {
                                ModalState.alert = {
                                    type: "none",
                                    msg: i.toString(),
                                }
                            }}>{n}</Button
                        >
                    {/each}
                {:else}
                    {@const parts = ModalState.alert.msg.split("||")}
                    {#each parts as n, i}
                        <Button
                            className="mt-4"
                            onclick={() => {
                                ModalState.alert = {
                                    type: "none",
                                    msg: i.toString(),
                                }
                            }}>{n}</Button
                        >
                    {/each}
                {/if}
            {:else if ModalState.alert.type === "error" || ModalState.alert.type === "normal" || ModalState.alert.type === "markdown"}
                <Button
                    className="mt-4"
                    onclick={() => {
                        ModalState.alert = {
                            type: "none",
                            msg: "",
                        }
                    }}>OK</Button
                >
            {:else if ModalState.alert.type === "input"}
                <TextInput value="" id="alert-input" autocomplete="off" marginTop list="alert-input-list" />
                <Button
                    className="mt-4"
                    onclick={() => {
                        ModalState.alert = {
                            type: "none",
                            msg: document.querySelector<HTMLInputElement>("#alert-input")?.value ?? "",
                        }
                    }}>OK</Button
                >
                {#if ModalState.alert.datalist}
                    <datalist id="alert-input-list">
                        {#each ModalState.alert.datalist as item}
                            <option value={item[0]} label={item[1] ? item[1] : item[0]}
                                >{item[1] ? item[1] : item[0]}</option
                            >
                        {/each}
                    </datalist>
                {/if}
            {:else if ModalState.alert.type === "login"}
                <div class="fixed left-0 top-0 flex h-full w-full items-center justify-center bg-black bg-opacity-50">
                    <iframe src={hubURL + "/hub/login"} title="login" class="h-full w-full"> </iframe>
                </div>
            {:else if ModalState.alert.type === "selectChar"}
                <div class="flex w-full flex-wrap items-start justify-start gap-2">
                    {#each DBState.db.characters as char, i}
                        {#if char.type !== "group"}
                            {#if char.image}
                                {#await getCharImage(DBState.db.characters[i].image, "css")}
                                    <BarIcon
                                        onClick={() => {
                                            ModalState.alert = { type: "none", msg: char.chaId }
                                        }}
                                    >
                                        <User />
                                    </BarIcon>
                                {:then im}
                                    <BarIcon
                                        onClick={() => {
                                            ModalState.alert = { type: "none", msg: char.chaId }
                                        }}
                                        additionalStyle={im}
                                    />
                                {/await}
                            {:else}
                                <BarIcon
                                    onClick={() => {
                                        //@ts-ignore
                                        ModalState.alert = { type: "none", msg: char.chaId }
                                    }}
                                >
                                    <User />
                                </BarIcon>
                            {/if}
                        {/if}
                    {/each}
                </div>
            {:else if ModalState.alert.type === "requestdata"}
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
                        onclick={() => {
                            ModalState.alert = {
                                type: "none",
                                msg: "",
                            }
                        }}>✖</button
                    >
                </div>
                {#if generationInfoMenuIndex === 0}
                    <div class="mt-4 flex w-full justify-center">
                        <div
                            class="h-32 w-32 rounded-lg border-4 border-darkborderc"
                            style:background={`linear-gradient(0deg,
                            rgb(59,130,246) 0%,
                            rgb(59,130,246) ${(AlertGenerationInfoState.data.genInfo.inputTokens / AlertGenerationInfoState.data.genInfo.maxContext) * 100}%,
                            rgb(34 197 94) ${(AlertGenerationInfoState.data.genInfo.inputTokens / AlertGenerationInfoState.data.genInfo.maxContext) * 100}%,
                            rgb(34 197 94) ${((AlertGenerationInfoState.data.genInfo.outputTokens + AlertGenerationInfoState.data.genInfo.inputTokens) / AlertGenerationInfoState.data.genInfo.maxContext) * 100}%,
                            rgb(156 163 175) ${((AlertGenerationInfoState.data.genInfo.outputTokens + AlertGenerationInfoState.data.genInfo.inputTokens) / AlertGenerationInfoState.data.genInfo.maxContext) * 100}%,
                            rgb(156 163 175) 100%)`}
                        ></div>
                    </div>
                    <div class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                        <span class="text-blue-500">{language.inputTokens}</span>
                        <span class="justify-self-end text-blue-500"
                            >{AlertGenerationInfoState.data.genInfo.inputTokens ?? "?"} {language.tokens}</span
                        >
                        <span class="text-green-500">{language.outputTokens}</span>
                        <span class="justify-self-end text-green-500"
                            >{AlertGenerationInfoState.data.genInfo.outputTokens ?? "?"} {language.tokens}</span
                        >
                        <span class="text-gray-400">{language.maxContextSize}</span>
                        <span class="justify-self-end text-gray-400"
                            >{AlertGenerationInfoState.data.genInfo.maxContext ?? "?"} {language.tokens}</span
                        >
                    </div>
                    <span class="text-sm text-textcolor2">{language.tokenWarning}</span>
                {/if}
                {#if generationInfoMenuIndex === 1}
                    <div class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                        <span class="text-blue-500">Index</span>
                        <span class="justify-self-end text-blue-500">{AlertGenerationInfoState.data.idx}</span>
                        <span class="text-amber-500">Model</span>
                        <span class="justify-self-end text-amber-500"
                            >{AlertGenerationInfoState.data.genInfo.model}</span
                        >
                        <span class="text-green-500">ID</span>
                        <span class="justify-self-end text-green-500"
                            >{DBState.db.characters[ChatState.selectedCharId].chats[
                                DBState.db.characters[ChatState.selectedCharId].chatPage
                            ].message[AlertGenerationInfoState.data.idx].chatId ?? "None"}</span
                        >
                        <span class="text-red-500">GenID</span>
                        <span class="justify-self-end text-red-500"
                            >{AlertGenerationInfoState.data.genInfo.generationId}</span
                        >
                        <span class="text-cyan-500">Saying</span>
                        <span class="justify-self-end text-cyan-500"
                            >{DBState.db.characters[ChatState.selectedCharId].chats[
                                DBState.db.characters[ChatState.selectedCharId].chatPage
                            ].message[AlertGenerationInfoState.data.idx].saying}</span
                        >
                        <span class="text-purple-500">Size</span>
                        <span class="justify-self-end text-purple-500"
                            >{JSON.stringify(
                                DBState.db.characters[ChatState.selectedCharId].chats[
                                    DBState.db.characters[ChatState.selectedCharId].chatPage
                                ].message[AlertGenerationInfoState.data.idx]
                            ).length} Bytes</span
                        >
                        <span class="text-yellow-500">Time</span>
                        <span class="justify-self-end text-yellow-500"
                            >{new Date(
                                DBState.db.characters[ChatState.selectedCharId].chats[
                                    DBState.db.characters[ChatState.selectedCharId].chatPage
                                ].message[AlertGenerationInfoState.data.idx].time ?? 0
                            ).toLocaleString()}</span
                        >
                        {#if AlertGenerationInfoState.data.genInfo.stageTiming}
                            {@const stage1 = parseFloat(
                                ((AlertGenerationInfoState.data.genInfo.stageTiming.stage1 ?? 0) / 1000).toFixed(1)
                            )}
                            {@const stage2 = parseFloat(
                                ((AlertGenerationInfoState.data.genInfo.stageTiming.stage2 ?? 0) / 1000).toFixed(1)
                            )}
                            {@const stage3 = parseFloat(
                                ((AlertGenerationInfoState.data.genInfo.stageTiming.stage3 ?? 0) / 1000).toFixed(1)
                            )}
                            {@const stage4 = parseFloat(
                                ((AlertGenerationInfoState.data.genInfo.stageTiming.stage4 ?? 0) / 1000).toFixed(1)
                            )}
                            {@const totalRounded = (stage1 + stage2 + stage3 + stage4).toFixed(1)}
                            <span class="text-gray-400">Timing</span>
                            <span class="justify-self-end text-gray-400">
                                <span style="color: #60a5fa;">{stage1}</span> +
                                <span style="color: #db2777;">{stage2}</span> +
                                <span style="color: #34d399;">{stage3}</span> +
                                <span style="color: #8b5cf6;">{stage4}</span> =
                                <span class="font-bold text-white">{totalRounded}s</span>
                            </span>
                        {/if}

                        <span class="text-green-500">Tokens</span>
                        {#await tokenize(DBState.db.characters[ChatState.selectedCharId].chats[DBState.db.characters[ChatState.selectedCharId].chatPage].message[AlertGenerationInfoState.data.idx].data)}
                            <span class="justify-self-end text-green-500">Loading</span>
                        {:then tokens}
                            <span class="justify-self-end text-green-500">{tokens}</span>
                        {/await}
                    </div>
                {/if}
                {#if generationInfoMenuIndex === 2}
                    {#await getFetchData(ModalState.alert.msg) then data}
                        {#if !data}
                            <span class="mt-2 text-lg text-gray-300">{language.errors.requestLogRemoved}</span>
                            <span class="text-gray-500">{language.errors.requestLogRemovedDesc}</span>
                        {:else}
                            <h1 class="my-4 text-2xl font-bold">URL</h1>
                            <code class="whitespace-pre-wrap rounded-md border border-darkborderc p-2 text-gray-300"
                                >{data.url}</code
                            >
                            <h1 class="my-4 text-2xl font-bold">Request Body</h1>
                            <code class="whitespace-pre-wrap rounded-md border border-darkborderc p-2 text-gray-300"
                                >{beautifyJSON(data.body)}</code
                            >
                            <h1 class="my-4 text-2xl font-bold">Response</h1>
                            <code class="whitespace-pre-wrap rounded-md border border-darkborderc p-2 text-gray-300"
                                >{beautifyJSON(data.response)}</code
                            >
                        {/if}
                    {/await}
                {/if}
                {#if generationInfoMenuIndex === 3}
                    {#if Object.keys(DBState.db.characters[ChatState.selectedCharId].chats[DBState.db.characters[ChatState.selectedCharId].chatPage].message[AlertGenerationInfoState.data.idx].promptInfo || {}).length === 0}
                        <div class="mt-2 text-lg text-gray-300">{language.promptInfoEmptyMessage}</div>
                    {:else}
                        <div class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                            <span class="text-blue-500">Preset Name</span>
                            <span class="justify-self-end text-blue-500"
                                >{DBState.db.characters[ChatState.selectedCharId].chats[
                                    DBState.db.characters[ChatState.selectedCharId].chatPage
                                ].message[AlertGenerationInfoState.data.idx].promptInfo.promptName}</span
                            >
                            <span class="text-purple-500">Toggles</span>
                            <div
                                class="col-span-2 max-h-32 overflow-y-auto rounded border border-stone-500 bg-gray-900 p-2"
                            >
                                {#if DBState.db.characters[ChatState.selectedCharId].chats[DBState.db.characters[ChatState.selectedCharId].chatPage].message[AlertGenerationInfoState.data.idx].promptInfo.promptToggles.length === 0}
                                    <div class="py-4 text-center italic text-gray-500">
                                        {language.promptInfoEmptyToggle}
                                    </div>
                                {:else}
                                    <div class="grid grid-cols-2 gap-x-4 gap-y-2">
                                        {#each DBState.db.characters[ChatState.selectedCharId].chats[DBState.db.characters[ChatState.selectedCharId].chatPage].message[AlertGenerationInfoState.data.idx].promptInfo.promptToggles as toggle}
                                            <span class="truncate text-gray-200">{toggle.key}</span>
                                            <span class="justify-self-end truncate text-gray-200">{toggle.value}</span>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                            <span class="text-red-500">Prompt Text</span>
                            <div
                                class="col-span-2 max-h-80 overflow-y-auto rounded border border-stone-500 bg-gray-900 p-4"
                            >
                                {#if !DBState.db.characters[ChatState.selectedCharId].chats[DBState.db.characters[ChatState.selectedCharId].chatPage].message[AlertGenerationInfoState.data.idx].promptInfo.promptText}
                                    <div class="py-4 text-center italic text-gray-500">
                                        {language.promptInfoEmptyText}
                                    </div>
                                {:else}
                                    {#each DBState.db.characters[ChatState.selectedCharId].chats[DBState.db.characters[ChatState.selectedCharId].chatPage].message[AlertGenerationInfoState.data.idx].promptInfo.promptText as block}
                                        <div class="mb-2">
                                            <div class="font-bold text-gray-600">{block.role}</div>
                                            <pre
                                                class="whitespace-pre-wrap rounded border border-stone-500 bg-stone-900 p-2 text-sm">{block.content}</pre>
                                        </div>
                                    {/each}
                                {/if}
                            </div>
                        </div>
                    {/if}
                {/if}
            {:else if ModalState.alert.type === "hypaV2"}
                <div class="mb-4 flex w-124 max-w-full flex-wrap gap-2">
                    <Button
                        selected={generationInfoMenuIndex === 0}
                        size="sm"
                        onclick={() => {
                            generationInfoMenuIndex = 0
                        }}
                    >
                        Chunks
                    </Button>
                    <Button
                        selected={generationInfoMenuIndex === 1}
                        size="sm"
                        onclick={() => {
                            generationInfoMenuIndex = 1
                        }}
                    >
                        Summarized
                    </Button>
                    <button
                        class="ml-auto"
                        onclick={() => {
                            ModalState.alert = {
                                type: "none",
                                msg: "",
                            }
                        }}>✖</button
                    >
                </div>
                {#if generationInfoMenuIndex === 0}
                    <div class="flex w-full flex-col gap-2">
                        {#each DBState.db.characters[ChatState.selectedCharId].chats[DBState.db.characters[ChatState.selectedCharId].chatPage].hypaV2Data.chunks as chunk, i}
                            <TextAreaInput bind:value={chunk.text} />
                        {/each}

                        <!-- Adding non-bound chunk is not okay, change the user flow to edit existing ones. -->
                    </div>
                {:else}
                    {#each DBState.db.characters[ChatState.selectedCharId].chats[DBState.db.characters[ChatState.selectedCharId].chatPage].hypaV2Data.mainChunks as chunk, i}
                        <!-- Summarized should be mainChunks, afaik. Be aware of that chunks are created with mainChunks, however this editing would not change related chunks. -->
                        <div class="flex flex-col rounded-md border border-darkborderc p-2">
                            {#if i === 0}
                                <span class="text-green-500">Active</span>
                            {:else}
                                <span>Inactive</span>
                            {/if}
                            <TextAreaInput bind:value={chunk.text} />
                        </div>
                    {/each}
                {/if}
            {:else if ModalState.alert.type === "addchar"}
                <div class="flex w-2xl max-w-full flex-col">
                    <button
                        class="flex items-center justify-center rounded-md border border-darkborderc px-8 py-12 hover:ring-2"
                        onclick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            ModalState.alert = {
                                type: "none",
                                msg: "importFromRealm",
                            }
                        }}
                    >
                        <div class="flex flex-col items-start justify-start">
                            <span class="text-2xl font-bold">{language.importFromRealm}</span>
                            <span class="text-textcolor2">{language.importFromRealmDesc}</span>
                        </div>
                        <div class="float-right ml-9 flex flex-1 justify-end">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    <button
                        class="mt-2 flex items-center rounded-md border border-darkborderc px-8 py-2 hover:ring-2"
                        onclick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            ModalState.alert = {
                                type: "none",
                                msg: "importCharacter",
                            }
                        }}
                    >
                        <div class="flex flex-col items-start justify-start">
                            <span>{language.importCharacter}</span>
                        </div>
                        <div class="float-right ml-9 flex flex-1 justify-end">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    <button
                        class="mt-2 flex items-center rounded-md border border-darkborderc px-8 py-2 hover:ring-2"
                        onclick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            ModalState.alert = {
                                type: "none",
                                msg: "createfromScratch",
                            }
                        }}
                    >
                        <div class="flex flex-col items-start justify-start">
                            <span>{language.createfromScratch}</span>
                        </div>
                        <div class="float-right ml-9 flex flex-1 justify-end">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    <button
                        class="mt-2 flex items-center rounded-md border border-darkborderc px-8 py-2 hover:ring-2"
                        onclick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            ModalState.alert = {
                                type: "none",
                                msg: "createGroup",
                            }
                        }}
                    >
                        <div class="flex flex-col items-start justify-start">
                            <span>{language.createGroup}</span>
                        </div>
                        <div class="float-right ml-9 flex flex-1 justify-end">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    <button
                        class="mt-2 flex items-center rounded-md border border-darkborderc px-8 py-2 hover:ring-2"
                        onclick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            ModalState.alert = {
                                type: "none",
                                msg: "cancel",
                            }
                        }}
                    >
                        <div class="flex flex-col items-start justify-start">
                            <span>{language.cancel}</span>
                        </div>
                    </button>
                </div>
            {:else if ModalState.alert.type === "chatOptions"}
                <div class="flex w-2xl max-w-full flex-col">
                    <h1 class="mb-4 text-xl font-bold">
                        {language.chatOptions}
                    </h1>
                    <button
                        class="mt-2 flex items-center rounded-md border border-darkborderc px-8 py-2 hover:ring-2"
                        onclick={() => {
                            ModalState.alert = {
                                type: "none",
                                msg: "0",
                            }
                        }}
                    >
                        <div class="flex flex-col items-start justify-start">
                            <span>{language.createCopy}</span>
                        </div>
                        <div class="float-right ml-9 flex flex-1 justify-end">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    <button
                        class="mt-2 flex items-center rounded-md border border-darkborderc px-8 py-2 hover:ring-2"
                        onclick={() => {
                            ModalState.alert = {
                                type: "none",
                                msg: "1",
                            }
                        }}
                    >
                        <div class="flex flex-col items-start justify-start">
                            <span>{language.bindPersona}</span>
                        </div>
                        <div class="float-right ml-9 flex flex-1 justify-end">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    {#if DBState.db.useExperimental}
                        <button
                            class="mt-2 flex items-center rounded-md border border-darkborderc px-8 py-2 hover:ring-2"
                            onclick={() => {
                                ModalState.alert = {
                                    type: "none",
                                    msg: "2",
                                }
                            }}
                        >
                            <div class="flex flex-col items-start justify-start">
                                <span>{language.createMultiuserRoom} <Help key="experimental" /></span>
                            </div>
                            <div class="float-right ml-9 flex flex-1 justify-end">
                                <ChevronRightIcon />
                            </div>
                        </button>
                    {/if}
                    <button
                        class="mt-2 flex items-center rounded-md border border-darkborderc px-8 py-2 hover:ring-2"
                        onclick={() => {
                            ModalState.alert = {
                                type: "none",
                                msg: "cancel",
                            }
                        }}
                    >
                        <div class="flex flex-col items-start justify-start">
                            <span>{language.cancel}</span>
                        </div>
                    </button>
                </div>
            {/if}
        </div>
    </div>
{:else if ModalState.alert.type === "cardexport"}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="fixed left-0 top-0 z-50 flex h-full w-full flex-col items-center justify-center bg-black bg-opacity-50"
        role="button"
        tabindex="0"
        onclick={close}
    >
        <div
            class="flex w-2xl max-w-full flex-col rounded-md bg-darkbg p-4"
            role="button"
            tabindex="0"
            onclick={(e) => {
                e.stopPropagation()
            }}
        >
            <h1 class="w-full text-2xl font-bold">
                <span>
                    {language.shareExport}
                </span>
                <button
                    class="float-right text-textcolor2 hover:text-green-500"
                    onclick={() => {
                        ModalState.alert = {
                            type: "none",
                            msg: JSON.stringify({
                                type: "cancel",
                                type2: cardExportType2,
                            }),
                        }
                    }}
                >
                    <XIcon />
                </button>
            </h1>
            <span class="mt-4 text-textcolor">{language.type}</span>
            {#if cardExportType === ""}
                {#if ModalState.alert.submsg === "module"}
                    <span class="text-sm text-textcolor2">{language.risuMDesc}</span>
                {:else if ModalState.alert.submsg === "preset"}
                    <span class="text-sm text-textcolor2">{language.risupresetDesc}</span>
                    {#if cardExportType2 === "preset" && (DBState.db.botPresets[DBState.db.botPresetsId].image || DBState.db.botPresets[DBState.db.botPresetsId].regex?.length > 0)}
                        <span class="text-sm text-red-500"
                            >Use RisuRealm to share the preset. Preset with image or regexes cannot be exported for now.</span
                        >
                    {/if}
                {:else}
                    <span class="text-sm text-textcolor2">{language.ccv3Desc}</span>
                    {#if cardExportType2 !== "charx" && cardExportType2 !== "charxJpeg" && isCharacterHasAssets(DBState.db.characters[ChatState.selectedCharId])}
                        <span class="text-sm text-red-500">{language.notCharxWarn}</span>
                    {/if}
                {/if}
            {:else if cardExportType === "json"}
                <span class="text-sm text-textcolor2">{language.jsonDesc}</span>
            {:else if cardExportType === "ccv2"}
                <span class="text-sm text-textcolor2">{language.ccv2Desc}</span>
                <span class="text-sm text-red-500">{language.v2Warning}</span>
            {:else}
                <span class="text-sm text-textcolor2">{language.realmDesc}</span>
            {/if}
            <div class="mt-2 flex flex-wrap items-center">
                {#if ModalState.alert.submsg === "preset"}
                    <button
                        class="flex-1 rounded-lg bg-bgcolor px-2 py-4"
                        class:ring-1={cardExportType === "realm"}
                        onclick={() => {
                            cardExportType = "realm"
                        }}>RisuRealm</button
                    >
                    <button
                        class="ml-2 flex-1 rounded-lg bg-bgcolor px-2 py-4"
                        class:ring-1={cardExportType === ""}
                        onclick={() => {
                            cardExportType = ""
                        }}>Risupreset</button
                    >
                {:else if ModalState.alert.submsg === "module"}
                    <button
                        class="ml-2 flex-1 rounded-lg bg-bgcolor px-2 py-4"
                        class:ring-1={cardExportType === "realm"}
                        onclick={() => {
                            cardExportType = "realm"
                        }}>RisuRealm</button
                    >
                    <button
                        class="flex-1 rounded-lg bg-bgcolor px-2 py-4"
                        class:ring-1={cardExportType === ""}
                        onclick={() => {
                            cardExportType = ""
                        }}>RisuM</button
                    >
                {:else}
                    <button
                        class="flex-1 rounded-lg bg-bgcolor px-2 py-4"
                        class:ring-1={cardExportType === "realm"}
                        onclick={() => {
                            cardExportType = "realm"
                        }}>RisuRealm</button
                    >
                    <button
                        class="ml-2 flex-1 rounded-lg bg-bgcolor px-2 py-4"
                        class:ring-1={cardExportType === ""}
                        onclick={() => {
                            cardExportType = ""
                            cardExportType2 = "charxJpeg"
                        }}>Character Card V3</button
                    >
                    <button
                        class="ml-2 flex-1 rounded-lg bg-bgcolor px-2 py-4"
                        class:ring-1={cardExportType === "ccv2"}
                        onclick={() => {
                            cardExportType = "ccv2"
                        }}>Character Card V2</button
                    >
                {/if}
            </div>
            {#if ModalState.alert.submsg === "" && cardExportType === ""}
                <span class="mt-4 text-textcolor">{language.format}</span>
                <SelectInput bind:value={cardExportType2} className="mt-2">
                    <OptionInput value="charx">CHARX</OptionInput>
                    <OptionInput value="charxJpeg">CHARX-JPEG</OptionInput>
                    <OptionInput value="">PNG</OptionInput>
                    <OptionInput value="json">JSON</OptionInput>
                </SelectInput>
            {/if}
            <Button
                className="mt-4"
                onclick={() => {
                    ModalState.alert = {
                        type: "none",
                        msg: JSON.stringify({
                            type: cardExportType,
                            type2: cardExportType2,
                        }),
                    }
                }}>{cardExportType === "realm" ? language.shareCloud : language.export}</Button
            >
        </div>
    </div>
{:else if ModalState.alert.type === "toast"}
    <div
        class="toast-anime break-any max-h-11/12 absolute bottom-0 right-0 z-50 flex max-w-3xl flex-col overflow-y-auto rounded-md bg-darkbg p-4 text-textcolor"
        onanimationend={() => {
            ModalState.alert = {
                type: "none",
                msg: "",
            }
        }}
    >
        {ModalState.alert.msg}
    </div>
{:else if ModalState.alert.type === "selectModule"}
    <ModuleChatMenu
        alertMode
        close={(d) => {
            ModalState.alert = {
                type: "none",
                msg: d,
            }
        }}
    />
{:else if ModalState.alert.type === "pukmakkurit"}
    <!-- Log Generator by dootaang, GPL3 -->
    <!-- Svelte, Typescript version by Kwaroran -->

    <div class="absolute z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50">
        <div class="break-any flex max-h-full max-w-3xl flex-col overflow-y-auto rounded-md bg-darkbg p-4">
            <h2 class="mb-2 mt-0 w-40 max-w-full text-green-700">{language.preview}</h2>
        </div>
    </div>
{:else if ModalState.alert.type === "branches"}
    <div
        class="absolute z-50 flex h-full w-full items-center justify-center overflow-x-auto overflow-y-auto bg-black bg-opacity-80"
    >
        {#if branchHover !== null}
            <div
                class="absolute z-30 whitespace-pre-wrap rounded-md border border-darkborderc bg-darkbg p-4 text-textcolor text-white"
                style="top: {branchHover.y * 80 + 24}px; left: {(branchHover.x + 1) * 80 + 24}px"
            >
                {branchHover.content}
            </div>
        {/if}

        <div class="x-50 absolute right-2 top-2">
            <button
                class="rounded-md border border-darkborderc bg-darkbg p-2"
                onclick={() => {
                    ModalState.alert = {
                        type: "none",
                        msg: "",
                    }
                }}
            >
                <XIcon />
            </button>
        </div>

        {#each getChatBranches() as obj}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <div
                role="table"
                class="peer absolute z-20 flex h-12 w-12 items-center justify-center overflow-y-auto rounded-full border border-darkborderc bg-bgcolor"
                style="top: {obj.y * 80 + 24}px; left: {obj.x * 80 + 24}px"
                onmouseenter={() => {
                    if (branchHover === null) {
                        const char = getCurrentCharacter()
                        branchHover = {
                            x: obj.x,
                            y: obj.y,
                            content: char.chats[obj.chatId].message[obj.y - 1].data,
                        }
                    }
                }}
                onclick={() => {
                    if (branchHover === null) {
                        const char = getCurrentCharacter()
                        branchHover = {
                            x: obj.x,
                            y: obj.y,
                            content: char.chats[obj.chatId].message[obj.y - 1].data,
                        }
                    }
                }}
                onmouseleave={() => {
                    branchHover = null
                }}
            ></div>
            {#if obj.connectX === obj.x}
                {#if obj.multiChild}
                    <div
                        class="absolute h-20 w-0 border-x border-x-red-500"
                        style="top: {(obj.y - 1) * 80 + 24}px; left: {obj.x * 80 + 45}px"
                    ></div>
                {:else}
                    <div
                        class="absolute h-20 w-0 border-x border-x-blue-500"
                        style="top: {(obj.y - 1) * 80 + 24}px; left: {obj.x * 80 + 45}px"
                    ></div>
                {/if}
            {:else if obj.connectX !== -1}
                <div
                    class="absolute h-10 w-0 border-x border-x-red-500"
                    style="top: {obj.y * 80}px; left: {obj.x * 80 + 45}px"
                ></div>
                <div
                    class="absolute h-0 border-y border-y-red-500"
                    style="top: {obj.y * 80}px; left: {obj.connectX * 80 + 46}px"
                    style:width={Math.abs((obj.x - obj.connectX) * 80) + "px"}
                ></div>
            {/if}
        {/each}
    </div>
{/if}

<style>
    .plugin-confirm-content .plugin-name {
        font-size: 1.25rem;
        font-weight: bold;
        color: white;
    }
    .plugin-confirm-content .warnings-list {
        list-style-type: disc;
        list-style-position: inside;
        margin-top: 0.5rem;
        margin-bottom: 0.5rem;
        padding-left: 1rem;
        color: #f87171; /* red-400 */
    }
    .plugin-confirm-content .warning-item {
        margin-bottom: 0.25rem;
    }
    .plugin-confirm-content .confirm-message {
        margin-top: 1rem;
        color: #d1d5db; /* gray-300 */
    }
    .break-any {
        word-break: normal;
        overflow-wrap: anywhere;
    }
    @keyframes toastAnime {
        0% {
            opacity: 0;
        }
        50% {
            opacity: 1;
        }
        100% {
            opacity: 0;
        }
    }

    .toast-anime {
        animation: toastAnime 1s ease-out;
    }

    .vis {
        opacity: 1 !important;
        --tw-bg-opacity: 1 !important;
    }

    .stack-trace {
        background-color: var(--risu-theme-bgcolor);
        color: var(--risu-theme-textcolor2);
        border: 1px solid var(--risu-theme-darkborderc);
        border-radius: 0.25rem;
        padding: 0.5rem;
        margin-top: 0.5rem;
        font-family: monospace;
        font-size: 0.75rem;
        white-space: pre-wrap;
        word-break: break-all;
        max-height: 200px;
        overflow-y: auto;
    }
</style>
