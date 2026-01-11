<script lang="ts">
    // ============================================================
    // IMPORTS SECTION
    // External libraries, components, stores, and utilities
    // ============================================================

    // Child components for chat UI
    import Chat from "./Chat.svelte"
    import CreatorQuote from "./CreatorQuote.svelte"
    import MainMenu from "../UI/MainMenu.svelte"
    import AssetInput from "./AssetInput.svelte"
    import PlaygroundMenu from "../Playground/PlaygroundMenu.svelte"
    import Chats from "./Chats.svelte"
    import Button from "../UI/GUI/Button.svelte"
    import ActionMenuItem from "../UI/GUI/ActionMenuItem.svelte"
    import PluginDefinedIcon from "../Others/PluginDefinedIcon.svelte"

    // Lucide icons for UI elements
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
        Send,
        StepForwardIcon,
        XIcon,
        BrainIcon,
        ArrowDown,
    } from "@lucide/svelte"

    // Global state stores
    import {
        selectedCharID,
        createSimpleCharacter,
        hypaV3State,
        ScrollToMessageStore,
        additionalChatMenu,
        additionalFloatingActionButtons,
        viewState,
    } from "../../ts/stores.svelte"
    import { DBState } from "src/ts/stores.svelte"

    // Svelte utilities
    import { tick, onDestroy } from "svelte"

    // Chat runtime controller
    import { chatRuntime } from "../../ts/chat/chatRuntimeController.svelte"

    // Character and chat processing utilities
    import { getCharImage } from "../../ts/characters.svelte"
    import { chatGenState } from "../../ts/process/index.svelte"

    // File handling utilities
    import { postChatFile } from "src/ts/process/files/multisend.svelte"
    import { getInlayAsset } from "src/ts/process/files/inlays"
    import { coldStorageHeader, preLoadChat } from "src/ts/process/coldstorage.svelte"

    // General utilities
    import { debounce, sleep } from "../../ts/utils/util"
    import { language } from "../../lang"
    import { isAPIBasedTranslator, translate } from "../../ts/translator/translator.svelte"
    import { alertError, alertNormal, alertWait, showHypaV2Alert } from "../../ts/alert.svelte"
    import { stopTTS } from "src/ts/process/tts"
    import { aiLawApplies, chatFoldedState, chatFoldedStateMessageIndex, downloadFile } from "src/ts/globalApi.svelte"
    import { v4 } from "uuid"

    // ============================================================
    // COMPONENT PROPS INTERFACE
    // Defines the external properties this component accepts
    // ============================================================
    interface Props {
        openModuleList?: boolean // Controls visibility of module list panel
        openChatList?: boolean // Controls visibility of chat list panel
        customStyle?: string // Custom CSS styles to apply to the container
    }

    // ============================================================
    // LOCAL STATE VARIABLES (UI State only)
    // Runtime state (messageInput, fileInput, etc.) is in chatRuntime
    // ============================================================

    // UI toggle states
    let openMenu = $state(false) // Controls visibility of the chat action menu
    let toggleStickers: boolean = $state(false) // Controls visibility of sticker/asset picker
    let showNewMessageButton = $state(false) // Shows "new message" button when scrolled up
    let isScrollingToMessage = $state(false) // Loading overlay when scrolling to specific message

    // Pagination and loading
    let loadPages = $state(30) // Number of messages to render (for virtual scrolling)

    // Component instance reference
    let chatsInstance: any = $state() // Reference to Chats component for scroll control

    // Bind props with defaults
    let { openModuleList = $bindable(false), openChatList = $bindable(false), customStyle = "" }: Props = $props()

    // ============================================================
    // DERIVED STATE
    // Computed values that update automatically when dependencies change
    // ============================================================
    let currentCharacter = $derived(DBState.currentChar)
    let currentChat = $derived(currentCharacter?.chats[currentCharacter.chatPage]?.message ?? [])

    // ============================================================
    // SCROLL CONTROL FUNCTIONS
    // Handles scrolling behavior for chat navigation
    // ============================================================

    /**
     * Scrolls to the latest (bottom-most) message in the chat
     */
    function scrollToBottom() {
        chatsInstance?.scrollToLatestMessage()
    }

    // Watch for external scroll requests (e.g., from search results)
    $effect(() => {
        if (ScrollToMessageStore.value !== -1) {
            const index = ScrollToMessageStore.value
            ScrollToMessageStore.value = -1
            scrollToMessage(index)
        }
    })

    /**
     * Scrolls to a specific message by index
     * - Loads more messages if target is outside rendered range
     * - Waits for images to load to prevent layout shift
     * - Highlights the target message with a blue ring
     */
    async function scrollToMessage(index: number) {
        isScrollingToMessage = true
        try {
            // Calculate how many messages need to be loaded to include the target
            const totalMessages = currentChat.length
            const neededLoadPages = totalMessages - index + 5

            // Expand rendered range if necessary
            if (loadPages < neededLoadPages) {
                loadPages = neededLoadPages
                await tick()
            }

            // Poll for element existence (max 5 seconds)
            let element: Element | null = null
            for (let i = 0; i < 50; i++) {
                element = document.querySelector(`[data-chat-index="${index}"]`)
                if (element) break
                await sleep(100)
            }

            // First scroll to a few messages before target for context
            const preIndex = Math.max(0, index - 3)
            const preElement = document.querySelector(`[data-chat-index="${preIndex}"]`)
            if (preElement) {
                preElement.scrollIntoView({ behavior: "instant", block: "start" })
            } else {
                element?.scrollIntoView({ behavior: "instant", block: "start" })
            }
            await sleep(50)

            if (element) {
                // Wait for images to load to prevent layout shift
                const chatContainer = document.querySelector(".default-chat-screen")
                if (chatContainer) {
                    const images = Array.from(chatContainer.querySelectorAll("img"))
                    const promises = images.map((img) => {
                        if (img.complete) return Promise.resolve()
                        return new Promise((resolve) => {
                            img.onload = () => resolve(null)
                            img.onerror = () => resolve(null)
                        })
                    })
                    // Wait for all images or timeout after 4 seconds
                    await Promise.race([Promise.all(promises), sleep(4000)])
                }

                // Final scroll to exact target position
                element.scrollIntoView({ behavior: "instant", block: "start" })

                // Small delay and scroll again to ensure position is correct after layout adjustments
                await sleep(50)
                element.scrollIntoView({ behavior: "instant", block: "start" })

                // Highlight the target message temporarily
                element.classList.add("ring-2", "ring-blue-500")
                setTimeout(() => {
                    element.classList.remove("ring-2", "ring-blue-500")
                }, 2000)
            }
        } finally {
            isScrollingToMessage = false
        }
    }

    // ============================================================
    // CHAT RUNTIME HOOKS
    // Register callbacks for chatRuntime events
    // ============================================================

    // Register hook for menu close event (from reroll)
    const unsubscribeMenuClose = chatRuntime.registerOnMenuClose(() => {
        openMenu = false
    })

    // Cleanup hooks on component destroy
    onDestroy(() => {
        unsubscribeMenuClose()
        debouncedTranslate.api.cancel()
        debouncedTranslate.standard.cancel()
    })

    // Watch for character changes to reset runtime state
    $effect(() => {
        chatRuntime.checkCharChange($selectedCharID)
    })

    // ============================================================
    // USER PERSONA DERIVED STATE
    // Determines which user persona (name, icon) to display
    // Priority: Chat-bound persona > Selected persona > Default
    // ============================================================
    let { userIconPortrait, currentUsername, userIcon } = $derived.by(() => {
        // Check if this chat has a persona bound to it
        const bindedPersona = DBState?.db?.characters?.[$selectedCharID]?.chats?.[DBState?.db?.characters?.[$selectedCharID]?.chatPage]?.bindedPersona

        if (bindedPersona) {
            const persona = DBState.db.personas.find((p) => p.id === bindedPersona)
            if (persona) {
                return {
                    currentUsername: persona.name,
                    userIconPortrait: persona.largePortrait,
                    userIcon: persona.icon,
                }
            }
        }

        // Fall back to globally selected persona
        const selectedPersonaIndex = DBState.db.selectedPersona
        return {
            currentUsername: DBState.db.username,
            userIconPortrait: DBState.db.personas[selectedPersonaIndex].largePortrait,
            userIcon: DBState.db.personas[selectedPersonaIndex].icon,
        }
    })

    // ============================================================
    // TEXTAREA AUTO-RESIZE
    // Dynamically adjusts textarea height based on content
    // ============================================================

    // Height state for textareas
    const DEFAULT_TEXTAREA_HEIGHT = "44px"
    let inputHeight = $state(DEFAULT_TEXTAREA_HEIGHT)
    let inputEle: HTMLTextAreaElement = $state()
    let inputTranslateHeight = $state(DEFAULT_TEXTAREA_HEIGHT)
    let inputTranslateEle: HTMLTextAreaElement = $state()

    /**
     * Auto-resize textarea based on content
     */
    function updateTextareaSize(ele: HTMLTextAreaElement | undefined, defaultHeight = DEFAULT_TEXTAREA_HEIGHT): string {
        if (ele) {
            ele.style.height = "0"
            const newHeight = ele.scrollHeight + "px"
            ele.style.height = newHeight
            return newHeight
        }
        return defaultHeight
    }

    $effect.pre(() => {
        chatRuntime.messageInput
        inputHeight = updateTextareaSize(inputEle)
    })

    $effect.pre(() => {
        chatRuntime.messageInputTranslate
        inputTranslateHeight = updateTextareaSize(inputTranslateEle)
    })

    // ============================================================
    // AUTO-TRANSLATION
    // Automatically translates user input between languages
    // ============================================================

    const DEBOUNCE_API = 1500
    const DEBOUNCE_STANDARD = 400

    const debouncedTranslate = {
        api: debounce(translateToMainInput, DEBOUNCE_API),
        standard: debounce(translateToMainInput, DEBOUNCE_STANDARD),
    }

    async function translateToMainInput(text: string) {
        const result = await translate(text, true)
        if (result && chatRuntime.messageInputTranslate === text) {
            chatRuntime.messageInput = result
        }
    }

    /**
     * Syncs translation between main input and translate input.
     * - Typing in main input clears translate input
     * - Typing in translate input triggers translation to main input
     */
    function syncTranslatedInput(fromTranslateInput: boolean) {
        if (!DBState.db.useAutoTranslateInput) {
            return
        }

        if (!fromTranslateInput) {
            chatRuntime.messageInputTranslate = ""
            return
        }

        if (chatRuntime.messageInputTranslate.trim() === "") {
            return
        }

        const debounced = isAPIBasedTranslator() ? debouncedTranslate.api : debouncedTranslate.standard
        debounced(chatRuntime.messageInputTranslate)
    }

    // ============================================================
    // SCREENSHOT FUNCTION
    // Captures entire chat history as a single image
    // ============================================================

    /**
     * Takes a screenshot of the entire chat
     * - Loads all messages first (sets loadPages to Infinity)
     * - Converts each chat message to canvas
     * - Merges all canvases into one tall image
     * - Downloads the final image as PNG
     */
    async function screenShot() {
        try {
            // Load all messages for complete screenshot
            loadPages = Infinity
            const html2canvas = await import("html-to-image")
            const chats = document.querySelectorAll(".default-chat-screen .risu-chat")
            alertWait("Taking screenShot...")
            let canvases: HTMLCanvasElement[] = []

            // Convert each chat element to canvas
            for (const chat of chats) {
                const cnv = await html2canvas.toCanvas(chat as HTMLElement)
                alertWait("Taking screenShot... " + canvases.length + "/" + chats.length)
                canvases.push(cnv)
            }

            // Reverse order (chat is displayed bottom-to-top)
            canvases.reverse()

            alertWait("Merging images...")

            // Create merged canvas with combined dimensions
            let mergedCanvas = document.createElement("canvas")
            mergedCanvas.width = 0
            mergedCanvas.height = 0
            let mergedCtx = mergedCanvas.getContext("2d")

            // Calculate total dimensions
            let totalHeight = 0
            let maxWidth = 0
            for (let i = 0; i < canvases.length; i++) {
                let canvas = canvases[i]
                totalHeight += canvas.height
                maxWidth = Math.max(maxWidth, canvas.width)

                mergedCanvas.width = maxWidth
                mergedCanvas.height = totalHeight
            }

            // Fill background and draw all chat canvases
            mergedCtx.fillStyle = "var(--risu-theme-bgcolor)"
            mergedCtx.fillRect(0, 0, maxWidth, totalHeight)
            let indh = 0
            for (let i = 0; i < canvases.length; i++) {
                let canvas = canvases[i]
                indh += canvas.height
                mergedCtx.drawImage(canvas, 0, indh - canvas.height)
                canvases[i].remove()
            }

            // Download the merged image
            if (mergedCanvas) {
                await downloadFile(`chat-${v4()}.png`, Buffer.from(mergedCanvas.toDataURL("png").split(",").at(-1), "base64"))
                mergedCanvas.remove()
            }
            alertNormal(language.screenshotSaved)
            loadPages = 10
        } catch (error) {
            console.error(error)
            alertError("Error while taking screenshot")
        }
    }
</script>

<!-- ============================================================ -->
<!-- TEMPLATE SECTION                                            -->
<!-- Main chat screen UI layout                                  -->
<!-- ============================================================ -->

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="w-full h-full relative"
    style={customStyle}
    onclick={() => {
        openMenu = false
    }}
>
    <!-- ======================================================== -->
    <!-- NEW MESSAGE BUTTON                                       -->
    <!-- Floating button to scroll to latest message              -->
    <!-- Multiple style options based on user preference          -->
    <!-- ======================================================== -->
    {#if showNewMessageButton}
        {#if DBState.db.newMessageButtonStyle === "bottom-center" || !DBState.db.newMessageButtonStyle}
            <button
                class="absolute bottom-16 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 hover:bg-blue-600 transition-colors"
                onclick={scrollToBottom}
            >
                <ArrowDown size={16} />
                <span>{language.newMessage}</span>
            </button>
        {/if}

        {#if DBState.db.newMessageButtonStyle === "bottom-right"}
            <button
                class="absolute bottom-20 right-4 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 hover:bg-blue-600 transition-colors"
                onclick={scrollToBottom}
            >
                <ArrowDown size={16} />
                <span>{language.newMessage}</span>
            </button>
        {/if}

        {#if DBState.db.newMessageButtonStyle === "bottom-left"}
            <button
                class="absolute bottom-20 left-4 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 hover:bg-blue-600 transition-colors"
                onclick={scrollToBottom}
            >
                <ArrowDown size={16} />
                <span>{language.newMessage}</span>
            </button>
        {/if}

        {#if DBState.db.newMessageButtonStyle === "floating-circle"}
            <button
                class="absolute bottom-36 right-4 bg-blue-500 text-white w-12 h-12 rounded-full shadow-lg z-50 flex items-center justify-center hover:bg-blue-600 transition-colors"
                onclick={scrollToBottom}
                title="4. 원형 (우하단)"
            >
                <ArrowDown size={20} />
            </button>
        {/if}

        {#if DBState.db.newMessageButtonStyle === "right-center"}
            <button
                class="absolute top-1/2 right-2 -translate-y-1/2 bg-blue-500 text-white px-2 py-3 rounded-l-lg shadow-lg z-50 flex flex-col items-center gap-1 hover:bg-blue-600 transition-colors"
                onclick={scrollToBottom}
            >
                <ArrowDown size={14} />
                <span class="text-xs writing-mode-vertical">{language.newMessage}</span>
            </button>
        {/if}

        {#if DBState.db.newMessageButtonStyle === "top-bar"}
            <button
                class="absolute top-2 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-6 py-1.5 rounded-full shadow-lg z-50 flex items-center gap-2 hover:bg-blue-600 transition-colors text-sm"
                onclick={scrollToBottom}
            >
                <ArrowDown size={14} />
                <span>{language.newMessage}</span>
            </button>
        {/if}
    {/if}

    <!-- Loading overlay when scrolling to specific message -->
    {#if isScrollingToMessage}
        <div class="absolute inset-0 z-50 flex items-center justify-center bg-black/50 text-white text-xl font-bold backdrop-blur-sm">Loading...</div>
    {/if}

    <!-- ======================================================== -->
    <!-- MAIN CONTENT AREA                                        -->
    <!-- Shows either Main Menu or Chat Screen based on selection -->
    <!-- ======================================================== -->
    {#if $selectedCharID < 0}
        <!-- Show MainMenu or PlaygroundMenu when no character selected -->
        {#if viewState.playground === 0}
            <MainMenu />
        {:else}
            <PlaygroundMenu />
        {/if}
    {:else}
        <!-- ======================================================== -->
        <!-- CHAT CONTAINER                                           -->
        <!-- Main scrollable area containing all chat messages        -->
        <!-- Uses flex-col-reverse for bottom-to-top message display  -->
        <!-- ======================================================== -->
        <div
            class="h-full w-full flex flex-col-reverse overflow-y-auto relative default-chat-screen"
            onscroll={(e) => {
                // Infinite scroll: load more messages when near top
                //@ts-expect-error scrollHeight/clientHeight/scrollTop don't exist on EventTarget, but target is HTMLElement here
                const scrolled = e.target.scrollHeight - e.target.clientHeight + e.target.scrollTop
                if (scrolled < 100 && DBState.currentChat.message.length > loadPages) {
                    loadPages += 15
                }

                // Hide "new message" button when scrolled to bottom
                const chatTarget = e.target as HTMLElement
                const chatsContainer = DBState.db.fixedChatTextarea && chatTarget.children[1] ? chatTarget.children[1] : chatTarget.children[0]
                const lastEl = chatsContainer?.firstElementChild
                const isAtBottom = lastEl ? lastEl.getBoundingClientRect().top <= chatTarget.getBoundingClientRect().bottom + 100 : true
                if (isAtBottom) {
                    showNewMessageButton = false
                }
            }}
        >
            <!-- ======================================================== -->
            <!-- MESSAGE INPUT AREA                                       -->
            <!-- Contains textarea, send button, and menu button          -->
            <!-- Can be sticky (fixed at bottom) or inline                -->
            <!-- ======================================================== -->
            <div
                class="{DBState.db.fixedChatTextarea ? 'sticky pt-2 pb-2 right-0 bottom-0 bg-bgcolor' : 'mt-2 mb-2'} flex items-stretch w-full"
                style={DBState.db.fixedChatTextarea ? "z-index:29;" : ""}
            >
                <!-- Sticker toggle button (for non-group chats) -->
                {#if DBState.db.useChatSticker && currentCharacter.type !== "group"}
                    <div
                        onclick={() => {
                            toggleStickers = !toggleStickers
                        }}
                        class={"ml-4 bg-textcolor2 flex justify-center items-center  w-12 h-12 rounded-md hover:bg-green-500 transition-colors " +
                            (toggleStickers ? "text-green-500" : "text-textcolor")}
                    >
                        <Laugh />
                    </div>
                {/if}

                <!-- Main message input textarea -->
                <!-- Supports: Enter to send, Ctrl+M to reroll, paste images -->
                <textarea
                    class="peer text-input-area focus:border-textcolor transition-colors outline-hidden text-textcolor p-2 min-w-0 border border-r-0 bg-transparent rounded-md rounded-r-none input-text text-xl grow ml-4 border-darkborderc resize-none overflow-y-hidden overflow-x-hidden max-w-full placeholder:text-sm"
                    bind:value={chatRuntime.messageInput}
                    bind:this={inputEle}
                    onkeydown={(e) => {
                        // Send message on Enter (configurable)
                        if (e.key.toLocaleLowerCase() === "enter" && !e.isComposing) {
                            if (DBState.db.sendWithEnter && !e.shiftKey) {
                                chatRuntime.send()
                                e.preventDefault()
                            } else if (!DBState.db.sendWithEnter && e.shiftKey) {
                                chatRuntime.send()
                                e.preventDefault()
                            }
                        }
                        // Ctrl+M shortcut for reroll
                        if (e.key.toLocaleLowerCase() === "m" && e.ctrlKey) {
                            chatRuntime.reroll()
                            e.preventDefault()
                        }
                    }}
                    onpaste={(e) => {
                        // Handle pasted images - convert to file attachments
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
                                        const results = await postChatFile({
                                            name: file.name,
                                            data: uint8,
                                        })
                                        if (!results) return
                                        for (const res of results) {
                                            if (res?.type === "asset") {
                                                chatRuntime.fileInput.push(res.data)
                                            }
                                            if (res?.type === "text") {
                                                chatRuntime.messageInput += `{{file::${res.name}::${res.data}}}`
                                            }
                                        }
                                    }
                                    reader.readAsArrayBuffer(file)
                                }
                            }
                        }
                    }}
                    oninput={() => {
                        syncTranslatedInput(false)
                    }}
                    style:height={inputHeight}
                ></textarea>

                <!-- Send/Cancel button - shows spinner when generating -->
                {#if chatGenState.generating}
                    <button
                        aria-labelledby="cancel"
                        class="peer-focus:border-textcolor flex justify-center border-y border-darkborderc items-center text-gray-100 p-3 hover:bg-blue-500 transition-colors"
                        onclick={chatRuntime.abortChat}
                        style:height={inputHeight}
                    >
                        <!-- Animated loading spinner with stage-based colors -->
                        <div class="loadmove chat-process-stage-{chatGenState.stage}" class:autoload={chatRuntime.autoMode}></div>
                    </button>
                {:else}
                    <button
                        onclick={chatRuntime.send}
                        class="flex justify-center border-y border-darkborderc items-center text-gray-100 p-3 peer-focus:border-textcolor hover:bg-blue-500 transition-colors button-icon-send"
                        style:height={inputHeight}
                    >
                        <Send />
                    </button>
                {/if}

                <!-- Menu/Plus button - opens action menu or adds message (playground) -->
                {#if DBState.currentChar?.chaId !== "§playground"}
                    <button
                        onclick={(e) => {
                            openMenu = !openMenu
                            e.stopPropagation()
                        }}
                        class="peer-focus:border-textcolor mr-2 flex border-y border-r border-darkborderc justify-center items-center text-gray-100 p-3 rounded-r-md hover:bg-blue-500 transition-colors"
                        style:height={inputHeight}
                    >
                        <MenuIcon />
                    </button>
                {:else}
                    <!-- Playground mode: add new empty char message -->
                    <div
                        onclick={(e) => {
                            DBState.currentChat.message.push({
                                role: "char",
                                data: "",
                            })
                        }}
                        class="peer-focus:border-textcolor mr-2 flex border-y border-r border-darkborderc justify-center items-center text-gray-100 p-3 rounded-r-md hover:bg-blue-500 transition-colors"
                        style:height={inputHeight}
                    >
                        <Plus />
                    </div>
                {/if}
            </div>
            <!-- ======================================================== -->
            <!-- AUTO-TRANSLATE INPUT                                     -->
            <!-- Secondary textarea for typing in native language         -->
            <!-- ======================================================== -->
            {#if DBState.db.useAutoTranslateInput && DBState.currentChar?.chaId !== "§playground"}
                <div class="flex items-center mt-2 mb-2">
                    <label for="messageInputTranslate" class="text-textcolor ml-4">
                        <LanguagesIcon />
                    </label>
                    <textarea
                        id="messageInputTranslate"
                        class="text-textcolor rounded-md p-2 min-w-0 bg-transparent input-text text-xl grow ml-4 mr-2 border-darkbutton resize-none focus:bg-selected overflow-y-hidden overflow-x-hidden max-w-full"
                        bind:value={chatRuntime.messageInputTranslate}
                        bind:this={inputTranslateEle}
                        onkeydown={(e) => {
                            if (e.key.toLocaleLowerCase() === "enter" && !e.shiftKey) {
                                if (DBState.db.sendWithEnter) {
                                    chatRuntime.send()
                                    e.preventDefault()
                                }
                            }
                            if (e.key.toLocaleLowerCase() === "m" && e.ctrlKey) {
                                chatRuntime.reroll()
                                e.preventDefault()
                            }
                        }}
                        oninput={() => {
                            syncTranslatedInput(true)
                        }}
                        placeholder={language.enterMessageForTranslateToEnglish}
                        style:height={inputTranslateHeight}
                    ></textarea>
                </div>
            {/if}

            <!-- ======================================================== -->
            <!-- FILE ATTACHMENT PREVIEW                                  -->
            <!-- Shows thumbnails of attached images/videos/audio         -->
            <!-- ======================================================== -->
            {#if chatRuntime.fileInput.length > 0}
                <div class="flex items-center ml-4 flex-wrap p-2 m-2 border-darkborderc border rounded-md">
                    {#each chatRuntime.fileInput as file, i}
                        {#await getInlayAsset(file) then inlayAsset}
                            <div class="relative">
                                <!-- Render preview based on file type -->
                                {#if inlayAsset.type === "image"}
                                    <img src={inlayAsset.data} alt="Inlay" class="max-w-48 max-h-48 border border-darkborderc" />
                                {:else if inlayAsset.type === "video"}
                                    <video controls class="max-w-48 max-h-48 border border-darkborderc">
                                        <source src={inlayAsset.data} type="video/mp4" />
                                        <track kind="captions" />
                                        Your browser does not support the video tag.
                                    </video>
                                {:else if inlayAsset.type === "audio"}
                                    <audio controls class="max-w-48 max-h-24 border border-darkborderc">
                                        <source src={inlayAsset.data} type="audio/mpeg" />
                                        Your browser does not support the audio tag.
                                    </audio>
                                {:else}
                                    <div class="max-w-24 max-h-24">{file}</div>
                                {/if}
                                <!-- Remove attachment button -->
                                <button
                                    class="absolute -right-1 -top-1 p-1 bg-darkbg text-textcolor rounded-md transition-colors hover:text-draculared focus:text-draculared"
                                    onclick={() => {
                                        chatRuntime.fileInput.splice(i, 1)
                                    }}
                                >
                                    <XIcon size={18} />
                                </button>
                            </div>
                        {/await}
                    {/each}
                </div>
            {/if}

            <!-- ======================================================== -->
            <!-- STICKER/ASSET PICKER                                     -->
            <!-- Shows available character stickers/assets                -->
            <!-- ======================================================== -->
            {#if toggleStickers}
                <div class="ml-4 flex flex-wrap">
                    <AssetInput
                        {currentCharacter}
                        onSelect={(additionalAsset) => {
                            // Determine file type from extension
                            let fileType = "img"
                            if (additionalAsset.length > 2 && additionalAsset[2]) {
                                const fileExtension = additionalAsset[2]
                                if (fileExtension === "mp4" || fileExtension === "webm") fileType = "video"
                                else if (fileExtension === "mp3" || fileExtension === "wav") fileType = "audio"
                            }
                            // Insert sticker tag into message
                            chatRuntime.messageInput += `<span class='notranslate' translate='no'>{{${fileType}::${additionalAsset[0]}}}</span> *${additionalAsset[0]} added*`
                        }}
                    />
                </div>
            {/if}

            <!-- ======================================================== -->
            <!-- CHAT MESSAGES SECTION                                    -->
            <!-- Displays all chat messages and handles cold storage      -->
            <!-- ======================================================== -->

            <!-- Handle cold storage (archived chats that need loading) -->
            {#if DBState.currentChat.message?.[0]?.data?.startsWith(coldStorageHeader)}
                {#await preLoadChat($selectedCharID, DBState.currentChar.chatPage)}
                    <div class="w-full flex justify-center text-textcolor2 italic mb-12">
                        {language.loadingChatData}
                    </div>
                {:then a}
                    <div></div>
                {/await}
            {:else}
                <!-- Load more button for folded/hidden older messages -->
                {#if chatFoldedStateMessageIndex.index !== -1}
                    <button class="w-full flex justify-center max-w-full p-4">
                        <Button
                            className="max-w-xl w-full"
                            onclick={() => {
                                loadPages += chatFoldedStateMessageIndex.index + 1
                                chatFoldedState.data = null
                            }}
                        >
                            {language.loadMore}
                        </Button>
                    </button>
                {/if}

                <!-- Main chat messages list component -->
                <Chats
                    bind:this={chatsInstance}
                    messages={currentChat}
                    {loadPages}
                    onReroll={chatRuntime.reroll}
                    unReroll={chatRuntime.unReroll}
                    {currentCharacter}
                    {currentUsername}
                    {userIcon}
                    {userIconPortrait}
                    bind:hasNewUnreadMessage={showNewMessageButton}
                />

                <!-- ======================================================== -->
                <!-- FIRST MESSAGE / GREETING                                 -->
                <!-- Shows character's initial greeting (not stored in chat)  -->
                <!-- Supports alternate greetings with reroll navigation      -->
                <!-- ======================================================== -->
                {#if DBState.currentChat.message.length <= loadPages}
                    {#if DBState.currentChar.type !== "group"}
                        <Chat
                            character={createSimpleCharacter(DBState.currentChar)}
                            name={DBState.currentChar.name}
                            message={DBState.currentChat.fmIndex === -1
                                ? DBState.currentChar.firstMessage
                                : DBState.currentChar.alternateGreetings[DBState.currentChat.fmIndex]}
                            role="char"
                            img={getCharImage(DBState.currentChar.image, "css")}
                            idx={-1}
                            altGreeting={DBState.currentChar.alternateGreetings.length > 0}
                            largePortrait={DBState.currentChar.largePortrait}
                            firstMessage={true}
                            onReroll={() => {
                                // Cycle forward through alternate greetings
                                const cha = DBState.currentChar
                                const chat = DBState.currentChat
                                if (cha.type !== "group") {
                                    if (chat.fmIndex >= cha.alternateGreetings.length - 1) {
                                        chat.fmIndex = -1
                                    } else {
                                        chat.fmIndex += 1
                                    }
                                }
                            }}
                            unReroll={() => {
                                // Cycle backward through alternate greetings
                                const cha = DBState.currentChar
                                const chat = DBState.currentChat
                                if (cha.type !== "group") {
                                    if (chat.fmIndex === -1) {
                                        chat.fmIndex = cha.alternateGreetings.length - 1
                                    } else {
                                        chat.fmIndex -= 1
                                    }
                                }
                            }}
                            isLastMemory={false}
                            currentPage={(DBState.currentChat.fmIndex ?? -1) + 2}
                            totalPages={DBState.currentChar.alternateGreetings.length + 1}
                        />
                        <!-- AI generation warning for applicable regions -->
                        {#if aiLawApplies() && DBState.currentChat.message.length === 0}
                            <div class="ml-auto mr-auto mt-4 text-textcolor2 italic max-w-2/3 wrap-break-word text-center">
                                {language.aiGenerationWarning}
                            </div>
                        {/if}
                        <!-- Creator notes/quote display -->
                        {#if !DBState.currentChar.removedQuotes && DBState.currentChar.creatorNotes.length >= 2}
                            <CreatorQuote
                                quote={DBState.currentChar.creatorNotes}
                                onRemove={() => {
                                    const cha = DBState.currentChar
                                    if (cha.type !== "group") {
                                        cha.removedQuotes = true
                                    }
                                }}
                            />
                        {/if}
                    {/if}
                {/if}
            {/if}

            <!-- ======================================================== -->
            <!-- ACTION MENU (Popup)                                      -->
            <!-- Quick access to various chat actions and settings        -->
            <!-- ======================================================== -->
            {#if openMenu}
                <div
                    class="{DBState.db.fixedChatTextarea
                        ? 'fixed'
                        : 'absolute'} right-2 bottom-16 p-5 bg-darkbg flex flex-col gap-3 text-textcolor rounded-md"
                    onclick={(e) => {
                        e.stopPropagation()
                    }}
                >
                    <!-- Auto Mode (Group chats only) -->
                    {#if DBState.currentChar.type === "group"}
                        <ActionMenuItem label={language.autoMode} onclick={chatRuntime.runAutoMode}>
                            {#snippet icon()}<DicesIcon />{/snippet}
                        </ActionMenuItem>
                    {/if}

                    <!-- Stop TTS button (when TTS is enabled) -->
                    {#if DBState.currentChar.ttsMode === "webspeech" || DBState.currentChar.ttsMode === "elevenlab"}
                        <ActionMenuItem label={language.ttsStop} onclick={() => stopTTS()}>
                            {#snippet icon()}<MicOffIcon />{/snippet}
                        </ActionMenuItem>
                    {/if}

                    <!-- Continue Response (ask AI to continue last message) -->
                    <ActionMenuItem
                        label={language.continueResponse}
                        onclick={chatRuntime.sendContinue}
                        disabled={DBState.currentChat.message.length < 2 ||
                            DBState.currentChat.message[DBState.currentChat.message.length - 1].role !== "char"}
                    >
                        {#snippet icon()}<StepForwardIcon />{/snippet}
                    </ActionMenuItem>

                    <!-- Chat List button -->
                    {#if DBState.db.showMenuChatList}
                        <ActionMenuItem
                            label={language.chatList}
                            onclick={() => {
                                openChatList = true
                                openMenu = false
                            }}
                        >
                            {#snippet icon()}<DatabaseIcon />{/snippet}
                        </ActionMenuItem>
                    {/if}

                    <!-- Plugin-defined additional menu items -->
                    {#each additionalChatMenu as menu}
                        <div class="mt-2"></div>
                        <ActionMenuItem
                            label={menu.name}
                            onclick={() => {
                                menu.callback()
                                openMenu = false
                            }}
                        >
                            {#snippet icon()}<PluginDefinedIcon ico={menu} />{/snippet}
                        </ActionMenuItem>
                    {/each}

                    <!-- Hypa Memory modal (V2/V3) -->
                    {#if DBState.db.showMenuHypaMemoryModal}
                        {#if (DBState.db.supaModelType !== "none" && DBState.db.hypav2) || DBState.db.hypaV3}
                            <ActionMenuItem
                                label={DBState.db.hypav2 ? language.hypaMemoryV2Modal : language.hypaMemoryV3Modal}
                                onclick={() => {
                                    if (DBState.db.hypav2) {
                                        DBState.currentChat.hypaV2Data ??= {
                                            lastMainChunkID: 0,
                                            mainChunks: [],
                                            chunks: [],
                                        }
                                        showHypaV2Alert()
                                    } else if (DBState.db.hypaV3) {
                                        hypaV3State.open = true
                                    }
                                    openMenu = false
                                }}
                            >
                                {#snippet icon()}<BrainIcon />{/snippet}
                            </ActionMenuItem>
                        {/if}
                    {/if}

                    <!-- Auto-translate toggle -->
                    {#if DBState.db.translator !== ""}
                        <ActionMenuItem
                            label={language.autoTranslateInput}
                            onclick={() => {
                                DBState.db.useAutoTranslateInput = !DBState.db.useAutoTranslateInput
                            }}
                            isActive={DBState.db.useAutoTranslateInput}
                        >
                            {#snippet icon()}<GlobeIcon />{/snippet}
                        </ActionMenuItem>
                    {/if}

                    <!-- Screenshot button -->
                    <ActionMenuItem label={language.screenshot} onclick={() => screenShot()}>
                        {#snippet icon()}<CameraIcon />{/snippet}
                    </ActionMenuItem>

                    <!-- Post/Attach file button -->
                    <ActionMenuItem
                        label={language.postFile}
                        onclick={async () => {
                            const results = await postChatFile(chatRuntime.messageInput)
                            if (!results) return
                            for (const res of results) {
                                if (res?.type === "asset") {
                                    chatRuntime.fileInput.push(res.data)
                                }
                                if (res?.type === "text") {
                                    chatRuntime.messageInput += `{{file::${res.name}::${res.data}}}`
                                }
                            }
                        }}
                    >
                        {#snippet icon()}<ImagePlusIcon />{/snippet}
                    </ActionMenuItem>

                    <!-- Modules button -->
                    <ActionMenuItem
                        label={language.modules}
                        onclick={() => {
                            DBState.currentChat.modules ??= []
                            openModuleList = true
                            openMenu = false
                        }}
                    >
                        {#snippet icon()}<PackageIcon />{/snippet}
                    </ActionMenuItem>

                    <!-- Reroll button (optional) -->
                    {#if DBState.db.sideMenuRerollButton}
                        <ActionMenuItem label={language.reroll} onclick={chatRuntime.reroll}>
                            {#snippet icon()}<RefreshCcwIcon />{/snippet}
                        </ActionMenuItem>
                    {/if}
                </div>
            {/if}
        </div>
        <!-- End of chat container -->
    {/if}
    <!-- End of main content area -->
</div>

<!-- ============================================================ -->
<!-- FLOATING ACTION BUTTONS                                      -->
<!-- Plugin-defined floating buttons (top-right corner)           -->
<!-- ============================================================ -->
{#if additionalFloatingActionButtons.length > 0}
    <div class="fixed top-4 right-4 flex flex-col gap-3 z-50">
        {#each additionalFloatingActionButtons as button}
            <button
                class="bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 hover:bg-blue-600 transition-colors"
                onclick={() => {
                    button.callback()
                }}
            >
                <PluginDefinedIcon ico={button} />
            </button>
        {/each}
    </div>
{/if}

<!-- ============================================================ -->
<!-- COMPONENT STYLES                                             -->
<!-- CSS for loading spinner animation and process stage colors   -->
<!-- ============================================================ -->
<style>
    /*
     * Loading Spinner Stage Colors
     * Different colors indicate different stages of AI processing:
     * Stage 1 (Blue): Initial request / Sending to API
     * Stage 2 (Pink): Processing / Generating response
     * Stage 3 (Green): Receiving / Streaming response
     * Stage 4 (Purple): Post-processing / Finalizing
     * Autoload (Emerald): Auto mode active
     */

    .chat-process-stage-1 {
        border-top: 0.4rem solid #60a5fa; /* Blue */
        border-left: 0.4rem solid #60a5fa;
    }

    .chat-process-stage-2 {
        border-top: 0.4rem solid #db2777; /* Pink */
        border-left: 0.4rem solid #db2777;
    }

    .chat-process-stage-3 {
        border-top: 0.4rem solid #34d399; /* Green */
        border-left: 0.4rem solid #34d399;
    }

    .chat-process-stage-4 {
        border-top: 0.4rem solid #8b5cf6; /* Purple */
        border-left: 0.4rem solid #8b5cf6;
    }

    .autoload {
        border-top: 0.4rem solid #10b981; /* Emerald (auto mode) */
        border-left: 0.4rem solid #10b981;
    }

    /* Spin animation for loading indicator */
    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }
</style>
