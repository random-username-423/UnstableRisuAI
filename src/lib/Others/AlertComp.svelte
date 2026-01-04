<script lang="ts">
    // ============================================================
    // IMPORTS
    // ============================================================
    import { DBState } from "src/ts/stores.svelte"
    import { getCharImage } from "../../ts/characters.svelte"
    import BarIcon from "../SideBars/BarIcon.svelte"
    import { ChevronRightIcon, User } from "@lucide/svelte"
    import { hubURL } from "src/ts/characterCards.svelte"
    import Button from "../UI/GUI/Button.svelte"
    import { language } from "src/lang"
    import { alertStore, selectedCharID } from "src/ts/stores.svelte"

    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte"
    import ModuleChatMenu from "../Setting/Pages/Module/ModuleChatMenu.svelte"
    import Help from "./Help.svelte"

    import AlertRequestLogs from "./Alerts/AlertRequestLogs.svelte"
    import AlertRequestData from "./Alerts/AlertRequestData.svelte"
    import AlertError from "./Alerts/AlertError.svelte"
    import AlertSimple from "./Alerts/AlertSimple.svelte"
    import AlertBranches from "./Alerts/AlertBranches.svelte"
    import AlertCardExport from "./Alerts/AlertCardExport.svelte"
    import { alertClear } from "src/ts/alert"

    // ============================================================
    // STATE VARIABLES
    // ============================================================
    let btn
    let input = $state("")
    let generationInfoMenuIndex = $state(0)

    // ============================================================
    // EFFECTS - State Reset on Alert Type Change
    // ============================================================
    $effect.pre(() => {
        if (btn) {
            btn.focus()
        }
        if ($alertStore.type !== "input") {
            input = ""
        }
    })
</script>

<!-- ============================================================ -->
<!-- WINDOW MESSAGE LISTENER - Login Handler -->
<!-- ============================================================ -->
<svelte:window
    onmessage={async (e) => {
        if (
            e.origin.startsWith("https://sv.risuai.xyz") ||
            e.origin.startsWith("https://nightly.sv.risuai.xyz") ||
            e.origin.startsWith("http://127.0.0.1") ||
            e.origin === window.location.origin
        ) {
            if (e.data.msg?.data?.vaild && $alertStore.type === "login") {
                $alertStore = {
                    type: "none",
                    msg: JSON.stringify(e.data.msg),
                }
            }
        }
    }}
/>

<!-- ============================================================ -->
<!-- ALERT ROUTING -->
<!-- ============================================================ -->

<!-- Error Alert (with stack trace) -->
{#if $alertStore.type === "error"}
    <AlertError
        msg={$alertStore.msg}
        submsg={$alertStore.submsg}
        stackTrace={$alertStore.stackTrace}
        onClose={() => alertClear()}
    />

<!-- Simple Alerts (using AlertSimple component) -->
{:else if $alertStore.type === "normal"}
    <AlertSimple
        msg={$alertStore.msg}
        buttons="ok"
    />

{:else if $alertStore.type === "markdown"}
    <AlertSimple
        msg={$alertStore.msg}
        msgType="markdown"
        buttons="ok"
    />

{:else if $alertStore.type === "ask"}
    <AlertSimple
        title="Confirm"
        msg={$alertStore.msg}
        buttons="yesno"
    />

{:else if $alertStore.type === "input"}
    <AlertSimple
        title="Input"
        msg={$alertStore.msg}
        buttons={{ type: "input", inputDatalist: $alertStore.datalist }}
    />

{:else if $alertStore.type === "tos"}
    <AlertSimple
        msg="You should accept [Terms of Service](https://sv.risuai.xyz/hub/tos) to continue"
        msgType="markdown"
        buttons="accept"
    />

<!-- Complex Alerts (inline implementation) -->
{:else if $alertStore.type === "select" || $alertStore.type === "pluginconfirm" || $alertStore.type === "selectChar" || $alertStore.type === "progress" || $alertStore.type === "wait" || $alertStore.type === "wait2" || $alertStore.type === "login" || $alertStore.type === "requestdata" || $alertStore.type === "addchar" || $alertStore.type === "hypaV2" || $alertStore.type === "chatOptions"}
    <div class="absolute w-full h-full z-50 bg-black/50 flex justify-center items-center" class:vis={$alertStore.type === "wait2"}>
        <div class="bg-darkbg p-4 break-any rounded-md flex flex-col max-w-3xl max-h-full overflow-y-auto">
            <!-- ================================================ -->
            <!-- SECTION 1: TITLES -->
            <!-- ================================================ -->
            {#if $alertStore.type === "pluginconfirm"}
                <h2 class="text-green-700 mt-0 mb-2 w-40 max-w-full">Plugin Import</h2>
            {:else if $alertStore.type === "selectChar"}
                <h2 class="text-green-700 mt-0 mb-2 w-40 max-w-full">Select</h2>
            {/if}

            <!-- ================================================ -->
            <!-- SECTION 2: CONTENT/BODY -->
            <!-- ================================================ -->
            {#if $alertStore.type === "pluginconfirm"}
                {@const parts = $alertStore.msg.split("\n\n")}
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
            {:else if $alertStore.type !== "select" && $alertStore.type !== "requestdata" && $alertStore.type !== "addchar" && $alertStore.type !== "hypaV2" && $alertStore.type !== "chatOptions"}
                <!-- DEFAULT MESSAGE DISPLAY -->
                <!-- Shared by: progress, wait, selectChar, etc. -->
                <span class="text-gray-300 whitespace-pre-wrap">{$alertStore.msg}</span>
                {#if $alertStore.submsg && $alertStore.type !== "progress"}
                    <span class="text-gray-500 text-sm">{$alertStore.submsg}</span>
                {/if}
            {/if}
            {#if $alertStore.type === "progress"}
                <div class="w-full min-w-64 md:min-w-138 h-2 bg-darkbg border border-darkborderc rounded-md mt-6">
                    <div
                        class="h-full bg-linear-to-r from-blue-500 to-purple-800 saving-animation transition-[width]"
                        style:width={$alertStore.submsg + "%"}
                    ></div>
                </div>
                <div class="w-full flex justify-center mt-6">
                    <span class="text-gray-500 text-sm">{$alertStore.submsg + "%"}</span>
                </div>
            {/if}

            <!-- ================================================ -->
            <!-- SECTION 3: BUTTONS -->
            <!-- ================================================ -->
            {#if $alertStore.type === "pluginconfirm"}
                <div class="flex gap-2 w-full">
                    <Button
                        className="mt-4 grow"
                        onclick={() => {
                            alertStore.set({
                                type: "none",
                                msg: "yes",
                            })
                        }}>YES</Button
                    >
                    <Button
                        className="mt-4 grow"
                        onclick={() => {
                            alertStore.set({
                                type: "none",
                                msg: "no",
                            })
                        }}>NO</Button
                    >
                </div>
            {:else if $alertStore.type === "select"}
                {@const hasDisplay = $alertStore.msg.startsWith("__DISPLAY__")}
                {#if hasDisplay}
                    {@const parts = $alertStore.msg.substring(11).split("||")}
                    <div class="mb-4 text-textcolor">{parts[0]}</div>
                    {#each parts.slice(1) as n, i}
                        <Button
                            className="mt-4"
                            onclick={() => {
                                alertStore.set({
                                    type: "none",
                                    msg: i.toString(),
                                })
                            }}>{n}</Button
                        >
                    {/each}
                {:else}
                    {@const parts = $alertStore.msg.split("||")}
                    {#each parts as n, i}
                        <Button
                            className="mt-4"
                            onclick={() => {
                                alertStore.set({
                                    type: "none",
                                    msg: i.toString(),
                                })
                            }}>{n}</Button
                        >
                    {/each}
                {/if}
            {:else if $alertStore.type === "login"}
                <div class="fixed top-0 left-0 bg-black/50 w-full h-full flex justify-center items-center">
                    <iframe src={hubURL + "/hub/login"} title="login" class="w-full h-full"> </iframe>
                </div>
            {:else if $alertStore.type === "selectChar"}
                <div class="flex w-full items-start flex-wrap gap-2 justify-start">
                    {#each DBState.db.characters as char, i}
                        {#if char.type !== "group"}
                            {#if char.image}
                                {#await getCharImage(DBState.db.characters[i].image, "css")}
                                    <BarIcon
                                        onClick={() => {
                                            alertStore.set({ type: "none", msg: char.chaId })
                                        }}
                                    >
                                        <User />
                                    </BarIcon>
                                {:then im}
                                    <BarIcon
                                        onClick={() => {
                                            alertStore.set({ type: "none", msg: char.chaId })
                                        }}
                                        additionalStyle={im}
                                    />
                                {/await}
                            {:else}
                                <BarIcon
                                    onClick={() => {
                                        alertStore.set({ type: "none", msg: char.chaId })
                                    }}
                                >
                                    <User />
                                </BarIcon>
                            {/if}
                        {/if}
                    {/each}
                </div>
            {:else if $alertStore.type === "requestdata"}
                <AlertRequestData />
            {:else if $alertStore.type === "hypaV2"}
                <div class="flex flex-wrap gap-2 mb-4 max-w-full w-124">
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
                            alertStore.set({
                                type: "none",
                                msg: "",
                            })
                        }}>✖</button
                    >
                </div>
                {#if generationInfoMenuIndex === 0}
                    <div class="flex flex-col gap-2 w-full">
                        {#each DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].hypaV2Data.chunks as chunk, i}
                            <TextAreaInput bind:value={chunk.text} />
                        {/each}

                        <!-- Adding non-bound chunk is not okay, change the user flow to edit existing ones. -->
                    </div>
                {:else}
                    {#each DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].hypaV2Data.mainChunks as chunk, i}
                        <!-- Summarized should be mainChunks, afaik. Be aware of that chunks are created with mainChunks, however this editing would not change related chunks. -->
                        <div class="flex flex-col p-2 rounded-md border-darkborderc border">
                            {#if i === 0}
                                <span class="text-green-500">Active</span>
                            {:else}
                                <span>Inactive</span>
                            {/if}
                            <TextAreaInput bind:value={chunk.text} />
                        </div>
                    {/each}
                {/if}
            {:else if $alertStore.type === "addchar"}
                <div class="w-2xl flex flex-col max-w-full">
                    <button
                        class="border-darkborderc border py-12 px-8 flex rounded-md hover:ring-2 justify-center items-center"
                        onclick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            alertStore.set({
                                type: "none",
                                msg: "importFromRealm",
                            })
                        }}
                    >
                        <div class="flex flex-col justify-start items-start">
                            <span class="text-2xl font-bold">{language.importFromRealm}</span>
                            <span class="text-textcolor2">{language.importFromRealmDesc}</span>
                        </div>
                        <div class="ml-9 float-right flex-1 flex justify-end">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    <button
                        class="border-darkborderc border py-2 px-8 flex rounded-md hover:ring-2 items-center mt-2"
                        onclick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            alertStore.set({
                                type: "none",
                                msg: "importCharacter",
                            })
                        }}
                    >
                        <div class="flex flex-col justify-start items-start">
                            <span>{language.importCharacter}</span>
                        </div>
                        <div class="ml-9 float-right flex-1 flex justify-end">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    <button
                        class="border-darkborderc border py-2 px-8 flex rounded-md hover:ring-2 items-center mt-2"
                        onclick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            alertStore.set({
                                type: "none",
                                msg: "createfromScratch",
                            })
                        }}
                    >
                        <div class="flex flex-col justify-start items-start">
                            <span>{language.createfromScratch}</span>
                        </div>
                        <div class="ml-9 float-right flex-1 flex justify-end">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    <button
                        class="border-darkborderc border py-2 px-8 flex rounded-md hover:ring-2 items-center mt-2"
                        onclick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            alertStore.set({
                                type: "none",
                                msg: "createGroup",
                            })
                        }}
                    >
                        <div class="flex flex-col justify-start items-start">
                            <span>{language.createGroup}</span>
                        </div>
                        <div class="ml-9 float-right flex-1 flex justify-end">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    <button
                        class="border-darkborderc border py-2 px-8 flex rounded-md hover:ring-2 items-center mt-2"
                        onclick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            alertStore.set({
                                type: "none",
                                msg: "cancel",
                            })
                        }}
                    >
                        <div class="flex flex-col justify-start items-start">
                            <span>{language.cancel}</span>
                        </div>
                    </button>
                </div>
            {:else if $alertStore.type === "chatOptions"}
                <div class="w-2xl flex flex-col max-w-full">
                    <h1 class="text-xl mb-4 font-bold">
                        {language.chatOptions}
                    </h1>
                    <button
                        class="border-darkborderc border py-2 px-8 flex rounded-md hover:ring-2 items-center mt-2"
                        onclick={() => {
                            alertStore.set({
                                type: "none",
                                msg: "0",
                            })
                        }}
                    >
                        <div class="flex flex-col justify-start items-start">
                            <span>{language.createCopy}</span>
                        </div>
                        <div class="ml-9 float-right flex-1 flex justify-end">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    <button
                        class="border-darkborderc border py-2 px-8 flex rounded-md hover:ring-2 items-center mt-2"
                        onclick={() => {
                            alertStore.set({
                                type: "none",
                                msg: "1",
                            })
                        }}
                    >
                        <div class="flex flex-col justify-start items-start">
                            <span>{language.bindPersona}</span>
                        </div>
                        <div class="ml-9 float-right flex-1 flex justify-end">
                            <ChevronRightIcon />
                        </div>
                    </button>
                    {#if DBState.db.useExperimental}
                        <button
                            class="border-darkborderc border py-2 px-8 flex rounded-md hover:ring-2 items-center mt-2"
                            onclick={() => {
                                alertStore.set({
                                    type: "none",
                                    msg: "2",
                                })
                            }}
                        >
                            <div class="flex flex-col justify-start items-start">
                                <span>{language.createMultiuserRoom} <Help key="experimental" /></span>
                            </div>
                            <div class="ml-9 float-right flex-1 flex justify-end">
                                <ChevronRightIcon />
                            </div>
                        </button>
                    {/if}
                    <button
                        class="border-darkborderc border py-2 px-8 flex rounded-md hover:ring-2 items-center mt-2"
                        onclick={() => {
                            alertStore.set({
                                type: "none",
                                msg: "cancel",
                            })
                        }}
                    >
                        <div class="flex flex-col justify-start items-start">
                            <span>{language.cancel}</span>
                        </div>
                    </button>
                </div>
            {/if}
        </div>
    </div>

<!-- ============================================================ -->
<!-- CARD EXPORT - Uses external component -->
<!-- ============================================================ -->
{:else if $alertStore.type === "cardexport"}
    <AlertCardExport />

<!-- ============================================================ -->
<!-- SELECT MODULE - Uses external component -->
<!-- ============================================================ -->
{:else if $alertStore.type === "selectModule"}
    <ModuleChatMenu
        alertMode
        close={(d) => {
            alertStore.set({
                type: "none",
                msg: d,
            })
        }}
    />

<!-- ============================================================ -->
<!-- BRANCHES - Chat branch visualization -->
<!-- ============================================================ -->
{:else if $alertStore.type === "branches"}
    <AlertBranches />

<!-- ============================================================ -->
<!-- REQUEST LOGS - Uses external component -->
<!-- ============================================================ -->
{:else if $alertStore.type === "requestlogs"}
    <AlertRequestLogs />
{/if}

<!-- ============================================================ -->
<!-- STYLES -->
<!-- ============================================================ -->
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

    .vis {
        opacity: 1 !important;
        --tw-bg-opacity: 1 !important;
    }
</style>
