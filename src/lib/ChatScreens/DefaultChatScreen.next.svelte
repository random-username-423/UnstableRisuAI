<script lang="ts">
    import Suggestion from "./Suggestion.svelte"
    import AdvancedChatEditor from "./AdvancedChatEditor.svelte"
    import {
        CameraIcon,
        DatabaseIcon,
        DicesIcon,
        GlobeIcon,
        ImagePlusIcon,
        LanguagesIcon,
        Laugh,
        MenuIcon,
        MicOffIcon,
        PackageIcon,
        Plus,
        RefreshCcwIcon,
        ReplyIcon,
        Send,
        StepForwardIcon,
        XIcon,
        BrainIcon,
    } from "lucide-svelte"
    import { ChatState, createSimpleCharacter, ModalState, AppState } from "../../ts/stores.svelte"
    import Chat from "./Chat.svelte"
    import type { Message, character, groupChat } from "../../ts/data/storage/types"
    import { DBState } from "src/ts/stores.svelte"
    import { getCharImage } from "../../ts/character/characters.svelte"
    import { ChatProcessStageState, DoingChatState, sendChat } from "../../ts/process/index.svelte"
    import { findCharacterbyId, sleep } from "../../ts/utils/util"
    import { language } from "../../lang"
    import { isExpTranslator, translate } from "../../ts/translator/translator"
    import { alertError, alertNormal, alertWait, showHypaV2Alert } from "../../ts/utils/alert.svelte"
    import sendSound from "../../etc/send.mp3"
    import { processScript } from "src/ts/process/scripting/scripts"
    import CreatorQuote from "./CreatorQuote.svelte"
    import { stopTTS } from "src/ts/process/postprocess/tts"
    import MainMenu from "../UI/MainMenu.svelte"
    import AssetInput from "./AssetInput.svelte"
    import { downloadFile } from "src/ts/utils/fileIO"
    import { runTrigger } from "src/ts/process/scripting/triggers"
    import { v4 } from "uuid"
    import { PreUnreroll, Prereroll } from "src/ts/process/chat/prereroll"
    import { processMultiCommand } from "src/ts/process/scripting/command"
    import { postChatFile } from "src/ts/process/files/multisend"
    import { getInlayAsset } from "src/ts/process/files/inlays"
    import PlaygroundMenu from "../Playground/PlaygroundMenu.svelte"
    import { MultiuserState } from "src/ts/data/sync/multiuser.svelte"
    import { coldStorageHeader, preLoadChat } from "src/ts/process/utils/coldstorage.svelte"
    import LazyPortal from "../UI/GUI/LazyPortal.svelte"

    let messageInput: string = $state("")
    let messageInputTranslate: string = $state("")
    let openMenu = $state(false)
    let autoMode = $state(false)
    let rerolls: Message[][] = []
    let rerollid = -1
    let lastCharId = -1
    let doingChatInputTranslate = false
    let currentCharacter: character | groupChat = $derived(DBState.db.characters[ChatState.selectedCharId])
    let toggleStickers: boolean = $state(false)
    let fileInput: string[] = $state([])
    let blocks = $state(new Uint8Array(500)) //hacky hacky
    let blockEle: HTMLElement[] = []
    let root: HTMLElement = $state(null)

    for (let i = 0; i < 500; i++) {
        blockEle.push(null)
    }

    $effect.pre(() => {
        if (ChatState.selectedCharId < 0) return
        while (
            blocks.length - 10 <
            DBState.db.characters[ChatState.selectedCharId].chats[
                DBState.db.characters[ChatState.selectedCharId].chatPage
            ].message.length
        ) {
            blocks = new Uint8Array(blocks.length + 500)
            for (let i = 0; i < 500; i++) {
                blockEle.push(null)
            }
        }
    })

    async function send() {
        return sendMain(false)
    }
    async function sendContinue() {
        return sendMain(true)
    }

    async function sendMain(continueResponse: boolean) {
        let selectedChar = ChatState.selectedCharId
        if (DoingChatState.value) {
            return
        }
        if (lastCharId !== ChatState.selectedCharId) {
            rerolls = []
            rerollid = -1
        }

        let cha = DBState.db.characters[selectedChar].chats[DBState.db.characters[selectedChar].chatPage].message

        if (messageInput.startsWith("/")) {
            const commandProcessed = await processMultiCommand(messageInput)
            if (commandProcessed !== false) {
                messageInput = ""
                return
            }
        }

        if (fileInput.length > 0) {
            for (const file of fileInput) {
                messageInput += `{{inlayed::${file}}}`
            }
            fileInput = []
        }

        if (messageInput === "") {
            if (DBState.db.characters[selectedChar].type !== "group") {
                if (cha.length === 0 || cha[cha.length - 1].role !== "user") {
                    if (DBState.db.useSayNothing) {
                        cha.push({
                            role: "user",
                            data: "*says nothing*",
                            name: MultiuserState.isOpen ? DBState.db.username : null,
                        })
                    }
                }
            }
        } else {
            const char = DBState.db.characters[selectedChar]
            if (char.type === "character") {
                let triggerResult = await runTrigger(char, "input", { chat: char.chats[char.chatPage] })
                if (triggerResult) {
                    cha = triggerResult.chat.message
                }

                cha.push({
                    role: "user",
                    data: await processScript(char, messageInput, "editinput"),
                    time: Date.now(),
                    name: MultiuserState.isOpen ? DBState.db.username : null,
                })
            } else {
                cha.push({
                    role: "user",
                    data: messageInput,
                    time: Date.now(),
                    name: MultiuserState.isOpen ? DBState.db.username : null,
                })
            }
        }
        messageInput = ""
        messageInputTranslate = ""
        DBState.db.characters[selectedChar].chats[DBState.db.characters[selectedChar].chatPage].message = cha
        rerolls = []
        await sleep(10)
        updateInputSizeAll()
        await sendChatMain(continueResponse)
    }

    async function reroll() {
        if (DoingChatState.value) {
            return
        }
        if (lastCharId !== ChatState.selectedCharId) {
            rerolls = []
            rerollid = -1
        }
        const genId =
            DBState.db.characters[ChatState.selectedCharId].chats[
                DBState.db.characters[ChatState.selectedCharId].chatPage
            ].message.at(-1)?.generationInfo?.generationId
        if (genId) {
            const r = Prereroll(genId)
            if (r) {
                DBState.db.characters[ChatState.selectedCharId].chats[
                    DBState.db.characters[ChatState.selectedCharId].chatPage
                ].message[
                    DBState.db.characters[ChatState.selectedCharId].chats[
                        DBState.db.characters[ChatState.selectedCharId].chatPage
                    ].message.length - 1
                ].data = r
                return
            }
        }
        if (rerollid < rerolls.length - 1) {
            if (Array.isArray(rerolls[rerollid + 1])) {
                rerollid += 1
                let rerollData = safeStructuredClone(rerolls[rerollid])
                let msgs =
                    DBState.db.characters[ChatState.selectedCharId].chats[
                        DBState.db.characters[ChatState.selectedCharId].chatPage
                    ].message
                for (let i = 0; i < rerollData.length; i++) {
                    msgs[msgs.length - rerollData.length + i] = rerollData[i]
                }
                DBState.db.characters[ChatState.selectedCharId].chats[
                    DBState.db.characters[ChatState.selectedCharId].chatPage
                ].message = msgs
            }
            return
        }
        if (rerolls.length === 0) {
            rerolls.push(
                safeStructuredClone([
                    DBState.db.characters[ChatState.selectedCharId].chats[
                        DBState.db.characters[ChatState.selectedCharId].chatPage
                    ].message.at(-1),
                ])
            )
            rerollid = rerolls.length - 1
        }
        let cha = safeStructuredClone(
            DBState.db.characters[ChatState.selectedCharId].chats[
                DBState.db.characters[ChatState.selectedCharId].chatPage
            ].message
        )
        if (cha.length === 0) {
            return
        }
        openMenu = false
        const saying = cha[cha.length - 1].saying
        let sayingQu = 2
        while (cha[cha.length - 1].role !== "user") {
            if (cha[cha.length - 1].saying === saying) {
                sayingQu -= 1
                if (sayingQu === 0) {
                    break
                }
            }
            let msg = cha.pop()
            if (!msg) {
                return
            }
        }
        DBState.db.characters[ChatState.selectedCharId].chats[
            DBState.db.characters[ChatState.selectedCharId].chatPage
        ].message = cha
        await sendChatMain()
    }

    async function unReroll() {
        if (DoingChatState.value) {
            return
        }
        if (lastCharId !== ChatState.selectedCharId) {
            rerolls = []
            rerollid = -1
        }
        const genId =
            DBState.db.characters[ChatState.selectedCharId].chats[
                DBState.db.characters[ChatState.selectedCharId].chatPage
            ].message.at(-1)?.generationInfo?.generationId
        if (genId) {
            const r = PreUnreroll(genId)
            if (r) {
                DBState.db.characters[ChatState.selectedCharId].chats[
                    DBState.db.characters[ChatState.selectedCharId].chatPage
                ].message[
                    DBState.db.characters[ChatState.selectedCharId].chats[
                        DBState.db.characters[ChatState.selectedCharId].chatPage
                    ].message.length - 1
                ].data = r
                return
            }
        }
        if (rerollid <= 0) {
            return
        }
        if (Array.isArray(rerolls[rerollid - 1])) {
            rerollid -= 1
            let rerollData = safeStructuredClone(rerolls[rerollid])
            let msgs =
                DBState.db.characters[ChatState.selectedCharId].chats[
                    DBState.db.characters[ChatState.selectedCharId].chatPage
                ].message
            for (let i = 0; i < rerollData.length; i++) {
                msgs[msgs.length - rerollData.length + i] = rerollData[i]
            }
            DBState.db.characters[ChatState.selectedCharId].chats[
                DBState.db.characters[ChatState.selectedCharId].chatPage
            ].message = msgs
        }
    }

    let abortController: null | AbortController = null

    async function sendChatMain(continued: boolean = false) {
        let previousLength =
            DBState.db.characters[ChatState.selectedCharId].chats[
                DBState.db.characters[ChatState.selectedCharId].chatPage
            ].message.length
        messageInput = ""
        abortController = new AbortController()
        try {
            await sendChat(-1, {
                signal: abortController.signal,
                continue: continued,
            })
            if (
                previousLength <
                DBState.db.characters[ChatState.selectedCharId].chats[
                    DBState.db.characters[ChatState.selectedCharId].chatPage
                ].message.length
            ) {
                rerolls.push(
                    safeStructuredClone(
                        DBState.db.characters[ChatState.selectedCharId].chats[
                            DBState.db.characters[ChatState.selectedCharId].chatPage
                        ].message
                    ).slice(previousLength)
                )
                rerollid = rerolls.length - 1
            }
        } catch (error) {
            console.error(error)
            alertError(`${error}`)
        }
        lastCharId = ChatState.selectedCharId
        DoingChatState.value = false
        if (DBState.db.playMessage) {
            const audio = new Audio(sendSound)
            audio.play()
        }
    }

    function abortChat() {
        if (abortController) {
            abortController.abort()
        }
    }

    async function runAutoMode() {
        if (autoMode) {
            autoMode = false
            return
        }
        const selectedChar = ChatState.selectedCharId
        autoMode = true
        while (autoMode) {
            await sendChatMain()
            if (selectedChar !== ChatState.selectedCharId) {
                autoMode = false
            }
        }
    }

    interface Props {
        openModuleList?: boolean
        openChatList?: boolean
        customStyle?: string
    }

    let userIconProtrait = $state(false)
    let currentUsername = $state(DBState.db.username)
    let userIcon = $state(DBState.db.userIcon)

    $effect.pre(() => {
        const bindedPersona =
            DBState?.db?.characters?.[ChatState.selectedCharId]?.chats?.[
                DBState?.db?.characters?.[ChatState.selectedCharId]?.chatPage
            ]?.bindedPersona

        if (bindedPersona) {
            const persona = DBState.db.personas.find((p) => p.id === bindedPersona)
            if (persona) {
                currentUsername = persona.name
                userIconProtrait = persona.largePortrait
                userIcon = persona.icon
                return
            }
        }

        currentUsername = DBState.db.username
        userIconProtrait = DBState.db.personas[DBState.db.selectedPersona].largePortrait
        userIcon = DBState.db.personas[DBState.db.selectedPersona].icon
    })

    let { openModuleList = $bindable(false), openChatList = $bindable(false), customStyle = "" }: Props = $props()
    let inputHeight = $state("44px")
    let inputEle: HTMLTextAreaElement = $state()
    let inputTranslateHeight = $state("44px")
    let inputTranslateEle: HTMLTextAreaElement = $state()

    function updateInputSizeAll() {
        updateInputSize()
        updateInputTranslateSize()
    }

    function updateInputTranslateSize() {
        if (inputTranslateEle) {
            inputTranslateEle.style.height = "0"
            inputTranslateHeight = inputTranslateEle.scrollHeight + "px"
            inputTranslateEle.style.height = inputTranslateHeight
        }
    }
    function updateInputSize() {
        if (inputEle) {
            inputEle.style.height = "0"
            inputHeight = inputEle.scrollHeight + "px"
            inputEle.style.height = inputHeight
        }
    }

    $effect.pre(() => {
        updateInputSizeAll()
    })

    async function updateInputTransateMessage(reverse: boolean) {
        if (!DBState.db.useAutoTranslateInput) {
            return
        }
        if (isExpTranslator()) {
            if (!reverse) {
                messageInputTranslate = ""
                return
            }
            if (messageInputTranslate === "") {
                messageInput = ""
                return
            }
            const lastMessageInputTranslate = messageInputTranslate
            await sleep(1500)
            if (lastMessageInputTranslate === messageInputTranslate) {
                translate(reverse ? messageInputTranslate : messageInput, reverse).then((translatedMessage) => {
                    if (translatedMessage) {
                        if (reverse) messageInput = translatedMessage
                        else messageInputTranslate = translatedMessage
                    }
                })
            }
            return
        }
        if (reverse && messageInputTranslate === "") {
            messageInput = ""
            return
        }
        if (!reverse && messageInput === "") {
            messageInputTranslate = ""
            return
        }
        translate(reverse ? messageInputTranslate : messageInput, reverse).then((translatedMessage) => {
            if (translatedMessage) {
                if (reverse) messageInput = translatedMessage
                else messageInputTranslate = translatedMessage
            }
        })
    }

    async function screenShot() {
        try {
            const html2canvas = await import("html-to-image")
            const chats = document.querySelectorAll(".default-chat-screen .risu-chat")
            alertWait("Taking screenShot...")
            let canvases: HTMLCanvasElement[] = []

            for (const chat of chats) {
                const cnv = await html2canvas.toCanvas(chat as HTMLElement)
                alertWait("Taking screenShot... " + canvases.length + "/" + chats.length)
                canvases.push(cnv)
            }

            canvases.reverse()

            alertWait("Merging images...")

            let mergedCanvas = document.createElement("canvas")
            mergedCanvas.width = 0
            mergedCanvas.height = 0
            let mergedCtx = mergedCanvas.getContext("2d")

            let totalHeight = 0
            let maxWidth = 0
            for (let i = 0; i < canvases.length; i++) {
                let canvas = canvases[i]
                totalHeight += canvas.height
                maxWidth = Math.max(maxWidth, canvas.width)

                mergedCanvas.width = maxWidth
                mergedCanvas.height = totalHeight
            }

            mergedCtx.fillStyle = "var(--risu-theme-bgcolor)"
            mergedCtx.fillRect(0, 0, maxWidth, totalHeight)
            let indh = 0
            for (let i = 0; i < canvases.length; i++) {
                let canvas = canvases[i]
                indh += canvas.height
                mergedCtx.drawImage(canvas, 0, indh - canvas.height)
                canvases[i].remove()
            }

            if (mergedCanvas) {
                await downloadFile(
                    `chat-${v4()}.png`,
                    Buffer.from(mergedCanvas.toDataURL("png").split(",").at(-1), "base64")
                )
                mergedCanvas.remove()
            }
            alertNormal(language.screenshotSaved)
        } catch (error) {
            console.error(error)
            alertError("Error while taking screenshot")
        }
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="h-full w-full"
    style={customStyle}
    onclick={() => {
        openMenu = false
    }}
>
    {#if ChatState.selectedCharId < 0}
        {#if AppState.playground === 0}
            <MainMenu />
        {:else}
            <PlaygroundMenu />
        {/if}
    {:else}
        <div class="default-chat-screen relative flex h-full w-full flex-col-reverse overflow-y-auto" bind:this={root}>
            <div
                class="{DBState.db.fixedChatTextarea
                    ? 'sticky bottom-0 right-0 bg-bgcolor pb-2 pt-2'
                    : 'mb-2 mt-2'} flex w-full items-stretch"
                style={DBState.db.fixedChatTextarea ? "z-index:29;" : ""}
            >
                {#if DBState.db.useChatSticker && currentCharacter.type !== "group"}
                    <div
                        onclick={() => {
                            toggleStickers = !toggleStickers
                        }}
                        class={"ml-4 flex h-12 w-12 items-center  justify-center rounded-md bg-textcolor2 transition-colors hover:bg-green-500 " +
                            (toggleStickers ? "text-green-500" : "text-textcolor")}
                    >
                        <Laugh />
                    </div>
                {/if}

                {#if !DBState.db.useAdvancedEditor}
                    <textarea
                        class="text-input-area input-text peer ml-4 min-w-0 max-w-full flex-grow resize-none overflow-x-hidden overflow-y-hidden rounded-md rounded-r-none border border-r-0 border-darkborderc bg-transparent p-2 text-xl text-textcolor outline-none transition-colors focus:border-textcolor"
                        bind:value={messageInput}
                        bind:this={inputEle}
                        onkeydown={(e) => {
                            if (e.key.toLocaleLowerCase() === "enter" && !e.isComposing) {
                                if (DBState.db.sendWithEnter && !e.shiftKey) {
                                    send()
                                    e.preventDefault()
                                } else if (!DBState.db.sendWithEnter && e.shiftKey) {
                                    send()
                                    e.preventDefault()
                                }
                            }
                            if (e.key.toLocaleLowerCase() === "m" && e.ctrlKey) {
                                reroll()
                                e.preventDefault()
                            }
                        }}
                        onpaste={(e) => {
                            const items = e.clipboardData?.items
                            if (!items) {
                                return
                            }
                            let canceled = false

                            for (const item of items) {
                                if (item.kind === "file" && item.type.startsWith("image")) {
                                    if (!canceled) {
                                        e.preventDefault()
                                        canceled = true
                                    }
                                    const file = item.getAsFile()
                                    if (file) {
                                        const reader = new FileReader()
                                        reader.onload = async (e) => {
                                            const buf = e.target?.result as ArrayBuffer
                                            const uint8 = new Uint8Array(buf)
                                            const res = await postChatFile({
                                                name: file.name,
                                                data: uint8,
                                            })
                                            if (res?.type === "asset") {
                                                fileInput.push(res.data)
                                                updateInputSizeAll()
                                            }
                                            if (res?.type === "text") {
                                                messageInput += `{{file::${res.name}::${res.data}}}`
                                                updateInputSizeAll()
                                            }
                                        }
                                        reader.readAsArrayBuffer(file)
                                    }
                                }
                            }
                        }}
                        oninput={() => {
                            updateInputSizeAll()
                            updateInputTransateMessage(false)
                        }}
                        style:height={inputHeight}
                    ></textarea>
                {:else}
                    <AdvancedChatEditor bind:value={messageInput} bind:translate={messageInputTranslate} />
                {/if}

                {#if DoingChatState.value || doingChatInputTranslate}
                    <button
                        aria-labelledby="cancel"
                        class="flex items-center justify-center border-y border-darkborderc p-3 text-gray-100 transition-colors hover:bg-blue-500 peer-focus:border-textcolor"
                        onclick={abortChat}
                        style:height={inputHeight}
                    >
                        <div
                            class="loadmove chat-process-stage-{ChatProcessStageState.value}"
                            class:autoload={autoMode}
                        ></div>
                    </button>
                {:else}
                    <button
                        onclick={send}
                        class="button-icon-send flex items-center justify-center border-y border-darkborderc p-3 text-gray-100 transition-colors hover:bg-blue-500 peer-focus:border-textcolor"
                        style:height={inputHeight}
                    >
                        <Send />
                    </button>
                {/if}
                {#if DBState.db.characters[ChatState.selectedCharId]?.chaId !== "§playground"}
                    <button
                        onclick={(e) => {
                            openMenu = !openMenu
                            e.stopPropagation()
                        }}
                        class="mr-2 flex items-center justify-center rounded-r-md border-y border-r border-darkborderc p-3 text-gray-100 transition-colors hover:bg-blue-500 peer-focus:border-textcolor"
                        style:height={inputHeight}
                    >
                        <MenuIcon />
                    </button>
                {:else}
                    <div
                        onclick={(e) => {
                            DBState.db.characters[ChatState.selectedCharId].chats[
                                DBState.db.characters[ChatState.selectedCharId].chatPage
                            ].message.push({
                                role: "char",
                                data: "",
                            })
                            DBState.db.characters[ChatState.selectedCharId].chats[
                                DBState.db.characters[ChatState.selectedCharId].chatPage
                            ] =
                                DBState.db.characters[ChatState.selectedCharId].chats[
                                    DBState.db.characters[ChatState.selectedCharId].chatPage
                                ]
                        }}
                        class="mr-2 flex items-center justify-center rounded-r-md border-y border-r border-darkborderc p-3 text-gray-100 transition-colors hover:bg-blue-500 peer-focus:border-textcolor"
                        style:height={inputHeight}
                    >
                        <Plus />
                    </div>
                {/if}
            </div>
            {#if DBState.db.useAutoTranslateInput && !DBState.db.useAdvancedEditor && DBState.db.characters[ChatState.selectedCharId]?.chaId !== "§playground"}
                <div class="mb-2 mt-2 flex items-center">
                    <label for="messageInputTranslate" class="ml-4 text-textcolor">
                        <LanguagesIcon />
                    </label>
                    <textarea
                        id="messageInputTranslate"
                        class="input-text ml-4 mr-2 min-w-0 max-w-full flex-grow resize-none overflow-x-hidden overflow-y-hidden rounded-md border-darkbutton bg-transparent p-2 text-xl text-textcolor focus:bg-selected"
                        bind:value={messageInputTranslate}
                        bind:this={inputTranslateEle}
                        onkeydown={(e) => {
                            if (e.key.toLocaleLowerCase() === "enter" && !e.shiftKey) {
                                if (DBState.db.sendWithEnter) {
                                    send()
                                    e.preventDefault()
                                }
                            }
                            if (e.key.toLocaleLowerCase() === "m" && e.ctrlKey) {
                                reroll()
                                e.preventDefault()
                            }
                        }}
                        oninput={() => {
                            updateInputSizeAll()
                            updateInputTransateMessage(true)
                        }}
                        placeholder={language.enterMessageForTranslateToEnglish}
                        style:height={inputTranslateHeight}
                    ></textarea>
                </div>
            {/if}

            {#if fileInput.length > 0}
                <div class="m-2 ml-4 flex flex-wrap items-center rounded-md border border-darkborderc p-2">
                    {#each fileInput as file, i}
                        {#await getInlayAsset(file) then inlayAsset}
                            <div class="relative">
                                {#if inlayAsset.type === "image"}
                                    <img
                                        src={inlayAsset.data}
                                        alt="Inlay"
                                        class="max-h-48 max-w-48 border border-darkborderc"
                                    />
                                {:else if inlayAsset.type === "video"}
                                    <video controls class="max-h-48 max-w-48 border border-darkborderc">
                                        <source src={inlayAsset.data} type="video/mp4" />
                                        <track kind="captions" />
                                        Your browser does not support the video tag.
                                    </video>
                                {:else if inlayAsset.type === "audio"}
                                    <audio controls class="max-h-24 max-w-48 border border-darkborderc">
                                        <source src={inlayAsset.data} type="audio/mpeg" />
                                        Your browser does not support the audio tag.
                                    </audio>
                                {:else}
                                    <div class="max-h-24 max-w-24">{file}</div>
                                {/if}
                                <button
                                    class="absolute -right-1 -top-1 rounded-md bg-darkbg p-1 text-textcolor transition-colors hover:text-draculared focus:text-draculared"
                                    onclick={() => {
                                        fileInput.splice(i, 1)
                                        updateInputSizeAll()
                                    }}
                                >
                                    <XIcon size={18} />
                                </button>
                            </div>
                        {/await}
                    {/each}
                </div>
            {/if}

            {#if toggleStickers}
                <div class="ml-4 flex flex-wrap">
                    <AssetInput
                        {currentCharacter}
                        onSelect={(additionalAsset) => {
                            let fileType = "img"
                            if (additionalAsset.length > 2 && additionalAsset[2]) {
                                const fileExtension = additionalAsset[2]
                                if (fileExtension === "mp4" || fileExtension === "webm") fileType = "video"
                                else if (fileExtension === "mp3" || fileExtension === "wav") fileType = "audio"
                            }
                            messageInput += `<span class='notranslate' translate='no'>{{${fileType}::${additionalAsset[0]}}}</span> *${additionalAsset[0]} added*`
                            updateInputSizeAll()
                        }}
                    />
                </div>
            {/if}

            {#if DBState.db.useAutoSuggestions}
                <Suggestion
                    messageInput={(msg) =>
                        (messageInput =
                            (DBState.db.subModel === "textgen_webui" ||
                                DBState.db.subModel === "mancer" ||
                                DBState.db.subModel.startsWith("local_")) &&
                            DBState.db.autoSuggestClean
                                ? msg.replace(/ +\(.+?\) *$| - [^"'*]*?$/, "")
                                : msg)}
                    {send}
                />
            {/if}

            {#each blocks as block, i}
                <div
                    class="lazy-portal w-full max-w-full"
                    id={"x-lazy-portal-" + (blocks.length - i - 1)}
                    bind:this={blockEle[blocks.length - i - 1]}
                ></div>
            {/each}

            {#if DBState.db.characters[ChatState.selectedCharId].chats[DBState.db.characters[ChatState.selectedCharId].chatPage].message?.[0]?.data?.startsWith(coldStorageHeader)}
                {#await preLoadChat(ChatState.selectedCharId, DBState.db.characters[ChatState.selectedCharId].chatPage)}
                    <div class="mb-12 flex w-full justify-center italic text-textcolor2">
                        {language.loadingChatData}
                    </div>
                {:then a}
                    <div></div>
                {/await}
            {:else}
                {#each DBState.db.characters[ChatState.selectedCharId].chats[DBState.db.characters[ChatState.selectedCharId].chatPage].message as chat, i}
                    <LazyPortal {root} idx={i} target={blockEle[i + 1]}>
                        {#if chat.role === "char"}
                            {#if DBState.db.characters[ChatState.selectedCharId].type !== "group"}
                                <Chat
                                    idx={i}
                                    name={DBState.db.characters[ChatState.selectedCharId].name}
                                    message={chat.data}
                                    img={getCharImage(DBState.db.characters[ChatState.selectedCharId].image, "css")}
                                    rerollIcon={i ===
                                        DBState.db.characters[ChatState.selectedCharId].chats[
                                            DBState.db.characters[ChatState.selectedCharId].chatPage
                                        ].message.length -
                                            1}
                                    onReroll={reroll}
                                    {unReroll}
                                    isLastMemory={DBState.db.characters[ChatState.selectedCharId].chats[
                                        DBState.db.characters[ChatState.selectedCharId].chatPage
                                    ].lastMemory === (chat.chatId ?? "none") && DBState.db.showMemoryLimit}
                                    character={createSimpleCharacter(DBState.db.characters[ChatState.selectedCharId])}
                                    largePortrait={DBState.db.characters[ChatState.selectedCharId].largePortrait}
                                    messageGenerationInfo={chat.generationInfo}
                                />
                            {:else}
                                <Chat
                                    idx={i}
                                    name={findCharacterbyId(chat.saying).name}
                                    rerollIcon={i ===
                                        DBState.db.characters[ChatState.selectedCharId].chats[
                                            DBState.db.characters[ChatState.selectedCharId].chatPage
                                        ].message.length -
                                            1}
                                    message={chat.data}
                                    onReroll={reroll}
                                    {unReroll}
                                    img={getCharImage(findCharacterbyId(chat.saying).image, "css")}
                                    isLastMemory={DBState.db.characters[ChatState.selectedCharId].chats[
                                        DBState.db.characters[ChatState.selectedCharId].chatPage
                                    ].lastMemory === (chat.chatId ?? "none") && DBState.db.showMemoryLimit}
                                    character={chat.saying}
                                    largePortrait={findCharacterbyId(chat.saying).largePortrait}
                                    messageGenerationInfo={chat.generationInfo}
                                />
                            {/if}
                        {:else}
                            <Chat
                                character={createSimpleCharacter(DBState.db.characters[ChatState.selectedCharId])}
                                idx={i}
                                name={chat.name ?? currentUsername}
                                message={chat.data}
                                img={MultiuserState.isOpen ? "" : getCharImage(userIcon, "css")}
                                isLastMemory={DBState.db.characters[ChatState.selectedCharId].chats[
                                    DBState.db.characters[ChatState.selectedCharId].chatPage
                                ].lastMemory === (chat.chatId ?? "none") && DBState.db.showMemoryLimit}
                                largePortrait={userIconProtrait}
                                messageGenerationInfo={chat.generationInfo}
                            />
                        {/if}
                    </LazyPortal>
                {/each}

                <LazyPortal {root} target={blockEle[0]}>
                    {#if DBState.db.characters[ChatState.selectedCharId].type !== "group"}
                        {#if !DBState.db.characters[ChatState.selectedCharId].removedQuotes && DBState.db.characters[ChatState.selectedCharId].creatorNotes.length >= 2}
                            <CreatorQuote
                                quote={DBState.db.characters[ChatState.selectedCharId].creatorNotes}
                                onRemove={() => {
                                    const cha = DBState.db.characters[ChatState.selectedCharId]
                                    if (cha.type !== "group") {
                                        cha.removedQuotes = true
                                    }
                                    DBState.db.characters[ChatState.selectedCharId] = cha
                                }}
                            />
                        {/if}
                        <Chat
                            character={createSimpleCharacter(DBState.db.characters[ChatState.selectedCharId])}
                            name={DBState.db.characters[ChatState.selectedCharId].name}
                            message={DBState.db.characters[ChatState.selectedCharId].chats[
                                DBState.db.characters[ChatState.selectedCharId].chatPage
                            ].fmIndex === -1
                                ? DBState.db.characters[ChatState.selectedCharId].firstMessage
                                : DBState.db.characters[ChatState.selectedCharId].alternateGreetings[
                                      DBState.db.characters[ChatState.selectedCharId].chats[
                                          DBState.db.characters[ChatState.selectedCharId].chatPage
                                      ].fmIndex
                                  ]}
                            img={getCharImage(DBState.db.characters[ChatState.selectedCharId].image, "css")}
                            idx={-1}
                            altGreeting={DBState.db.characters[ChatState.selectedCharId].alternateGreetings.length > 0}
                            largePortrait={DBState.db.characters[ChatState.selectedCharId].largePortrait}
                            firstMessage={true}
                            onReroll={() => {
                                const cha = DBState.db.characters[ChatState.selectedCharId]
                                const chat =
                                    DBState.db.characters[ChatState.selectedCharId].chats[
                                        DBState.db.characters[ChatState.selectedCharId].chatPage
                                    ]
                                if (cha.type !== "group") {
                                    if (chat.fmIndex >= cha.alternateGreetings.length - 1) {
                                        chat.fmIndex = -1
                                    } else {
                                        chat.fmIndex += 1
                                    }
                                }
                                DBState.db.characters[ChatState.selectedCharId].chats[
                                    DBState.db.characters[ChatState.selectedCharId].chatPage
                                ] = chat
                            }}
                            unReroll={() => {
                                const cha = DBState.db.characters[ChatState.selectedCharId]
                                const chat =
                                    DBState.db.characters[ChatState.selectedCharId].chats[
                                        DBState.db.characters[ChatState.selectedCharId].chatPage
                                    ]
                                if (cha.type !== "group") {
                                    if (chat.fmIndex === -1) {
                                        chat.fmIndex = cha.alternateGreetings.length - 1
                                    } else {
                                        chat.fmIndex -= 1
                                    }
                                }
                                DBState.db.characters[ChatState.selectedCharId].chats[
                                    DBState.db.characters[ChatState.selectedCharId].chatPage
                                ] = chat
                            }}
                            isLastMemory={false}
                        />
                    {/if}
                </LazyPortal>
            {/if}

            {#if openMenu}
                <div
                    class="{DBState.db.fixedChatTextarea
                        ? 'fixed'
                        : 'absolute'} bottom-16 right-2 flex flex-col gap-3 rounded-md bg-darkbg p-5 text-textcolor"
                    onclick={(e) => {
                        e.stopPropagation()
                    }}
                >
                    {#if DBState.db.characters[ChatState.selectedCharId].type === "group"}
                        <div
                            class="flex cursor-pointer items-center transition-colors hover:text-green-500"
                            onclick={runAutoMode}
                        >
                            <DicesIcon />
                            <span class="ml-2">{language.autoMode}</span>
                        </div>
                    {/if}

                    {#if DBState.db.characters[ChatState.selectedCharId].ttsMode === "webspeech" || DBState.db.characters[ChatState.selectedCharId].ttsMode === "elevenlab"}
                        <div
                            class="flex cursor-pointer items-center transition-colors hover:text-green-500"
                            onclick={() => {
                                stopTTS()
                            }}
                        >
                            <MicOffIcon />
                            <span class="ml-2">{language.ttsStop}</span>
                        </div>
                    {/if}

                    <div
                        class="flex cursor-pointer items-center transition-colors hover:text-green-500"
                        class:text-textcolor2={DBState.db.characters[ChatState.selectedCharId].chats[
                            DBState.db.characters[ChatState.selectedCharId].chatPage
                        ].message.length < 2 ||
                            DBState.db.characters[ChatState.selectedCharId].chats[
                                DBState.db.characters[ChatState.selectedCharId].chatPage
                            ].message[
                                DBState.db.characters[ChatState.selectedCharId].chats[
                                    DBState.db.characters[ChatState.selectedCharId].chatPage
                                ].message.length - 1
                            ].role !== "char"}
                        onclick={() => {
                            if (
                                DBState.db.characters[ChatState.selectedCharId].chats[
                                    DBState.db.characters[ChatState.selectedCharId].chatPage
                                ].message.length < 2 ||
                                DBState.db.characters[ChatState.selectedCharId].chats[
                                    DBState.db.characters[ChatState.selectedCharId].chatPage
                                ].message[
                                    DBState.db.characters[ChatState.selectedCharId].chats[
                                        DBState.db.characters[ChatState.selectedCharId].chatPage
                                    ].message.length - 1
                                ].role !== "char"
                            ) {
                                return
                            }
                            sendContinue()
                        }}
                    >
                        <StepForwardIcon />
                        <span class="ml-2">{language.continueResponse}</span>
                    </div>

                    {#if DBState.db.showMenuChatList}
                        <div
                            class="flex cursor-pointer items-center transition-colors hover:text-green-500"
                            onclick={() => {
                                openChatList = true
                                openMenu = false
                            }}
                        >
                            <DatabaseIcon />
                            <span class="ml-2">{language.chatList}</span>
                        </div>
                    {/if}

                    {#if DBState.db.showMenuHypaMemoryModal}
                        {#if (DBState.db.supaModelType !== "none" && DBState.db.hypav2) || DBState.db.hypaV3}
                            <div
                                class="flex cursor-pointer items-center transition-colors hover:text-green-500"
                                onclick={() => {
                                    if (DBState.db.hypav2) {
                                        DBState.db.characters[ChatState.selectedCharId].chats[
                                            DBState.db.characters[ChatState.selectedCharId].chatPage
                                        ].hypaV2Data ??= {
                                            lastMainChunkID: 0,
                                            mainChunks: [],
                                            chunks: [],
                                        }
                                        showHypaV2Alert()
                                    } else if (DBState.db.hypaV3) {
                                        ModalState.hypaV3.modalOpen = true
                                    }

                                    openMenu = false
                                }}
                            >
                                <BrainIcon />
                                <span class="ml-2">
                                    {DBState.db.hypav2 ? language.hypaMemoryV2Modal : language.hypaMemoryV3Modal}
                                </span>
                            </div>
                        {/if}
                    {/if}

                    {#if DBState.db.translator !== ""}
                        <div
                            class={"flex cursor-pointer items-center " +
                                (DBState.db.useAutoTranslateInput ? "text-green-500" : "lg:hover:text-green-500")}
                            onclick={() => {
                                DBState.db.useAutoTranslateInput = !DBState.db.useAutoTranslateInput
                            }}
                        >
                            <GlobeIcon />
                            <span class="ml-2">{language.autoTranslateInput}</span>
                        </div>
                    {/if}

                    <div
                        class="flex cursor-pointer items-center transition-colors hover:text-green-500"
                        onclick={() => {
                            screenShot()
                        }}
                    >
                        <CameraIcon />
                        <span class="ml-2">{language.screenshot}</span>
                    </div>

                    <div
                        class="flex cursor-pointer items-center transition-colors hover:text-green-500"
                        onclick={async () => {
                            const res = await postChatFile(messageInput)
                            if (res?.type === "asset") {
                                fileInput.push(res.data)
                                updateInputSizeAll()
                            }
                            if (res?.type === "text") {
                                messageInput += `{{file::${res.name}::${res.data}}}`
                                updateInputSizeAll()
                            }
                        }}
                    >
                        <ImagePlusIcon />
                        <span class="ml-2">{language.postFile}</span>
                    </div>

                    <div
                        class={"flex cursor-pointer items-center " +
                            (DBState.db.useAutoSuggestions ? "text-green-500" : "lg:hover:text-green-500")}
                        onclick={async () => {
                            DBState.db.useAutoSuggestions = !DBState.db.useAutoSuggestions
                        }}
                    >
                        <ReplyIcon />
                        <span class="ml-2">{language.autoSuggest}</span>
                    </div>

                    <div
                        class="flex cursor-pointer items-center transition-colors hover:text-green-500"
                        onclick={() => {
                            DBState.db.characters[ChatState.selectedCharId].chats[
                                DBState.db.characters[ChatState.selectedCharId].chatPage
                            ].modules ??= []
                            openModuleList = true
                            openMenu = false
                        }}
                    >
                        <PackageIcon />
                        <span class="ml-2">{language.modules}</span>
                    </div>

                    {#if DBState.db.sideMenuRerollButton}
                        <div
                            class="flex cursor-pointer items-center transition-colors hover:text-green-500"
                            onclick={reroll}
                        >
                            <RefreshCcwIcon />
                            <span class="ml-2">{language.reroll}</span>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .chat-process-stage-1 {
        border-top: 0.4rem solid #60a5fa;
        border-left: 0.4rem solid #60a5fa;
    }

    .chat-process-stage-2 {
        border-top: 0.4rem solid #db2777;
        border-left: 0.4rem solid #db2777;
    }

    .chat-process-stage-3 {
        border-top: 0.4rem solid #34d399;
        border-left: 0.4rem solid #34d399;
    }

    .chat-process-stage-4 {
        border-top: 0.4rem solid #8b5cf6;
        border-left: 0.4rem solid #8b5cf6;
    }

    .autoload {
        border-top: 0.4rem solid #10b981;
        border-left: 0.4rem solid #10b981;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }
</style>
