<script lang="ts">
    import {
        ArrowLeft,
        ArrowLeftRightIcon,
        ArrowRight,
        BotIcon,
        CopyIcon,
        LanguagesIcon,
        PencilIcon,
        RefreshCcwIcon,
        TrashIcon,
        UserIcon,
        Volume2Icon,
    } from "lucide-svelte"
    import { getFileSrc } from "src/ts/utils/fileIO"
    import { ColorSchemeTypeState } from "src/ts/gui/colorscheme.svelte"
    import { longpress } from "src/ts/gui/longtouch"
    import { getModelInfo } from "src/ts/model/modellist"
    import { runLuaButtonTrigger } from "src/ts/process/scripting/scriptings"
    import { risuChatParser } from "src/ts/process/scripting/scripts"
    import { runTrigger } from "src/ts/process/scripting/triggers"
    import { sayTTS } from "src/ts/process/postprocess/tts"
    import { DBState, RenderState, ChatState } from "src/ts/stores.svelte"
    import { MultiuserState } from "src/ts/data/sync/multiuser.svelte"
    import { capitalize, getUserIcon, getUserName } from "src/ts/utils/util"
    import { language } from "../../lang"
    import { alertClear, alertConfirm, alertNormal, alertRequestData, alertWait } from "../../ts/utils/alert.svelte"
    import { ParseMarkdown, type CbsConditions, type simpleCharacterArgument } from "../../ts/utils/parser.svelte"
    import { getCurrentCharacter, getCurrentChat, setCurrentChat } from "../../ts/data/storage/database.svelte"
    import type { MessageGenerationInfo } from "../../ts/data/storage/types"
    import AutoresizeArea from "../UI/GUI/TextAreaResizable.svelte"
    import ChatBody from "./ChatBody.svelte"

    let translating = $state(false)
    let editMode = $state(false)
    let statusMessage: string = $state("")
    let retranslate = $state(false)
    let bodyRoot: HTMLElement | null = $state(null)
    interface Props {
        message?: string
        name?: string
        largePortrait?: boolean
        isLastMemory: boolean
        img?: string | Promise<string>
        idx?: number
        messageGenerationInfo?: MessageGenerationInfo | null
        rerollIcon?: boolean | "dynamic"
        role?: string
        totalLength?: number
        onReroll?: () => void
        unReroll?: () => void
        character?: simpleCharacterArgument | string | null
        firstMessage?: boolean
        altGreeting?: boolean
        currentPage?: number
        totalPages?: number
    }

    let {
        message = $bindable(""),
        name = "",
        largePortrait = false,
        isLastMemory,
        img = "",
        idx = -1,
        rerollIcon = false,
        messageGenerationInfo = null,
        role = null,
        totalLength = 0,
        onReroll = () => {},
        unReroll = () => {},
        character = null,
        firstMessage = false,
        altGreeting = false,
        currentPage = 1,
        totalPages = 1,
    }: Props = $props()

    let msgDisplay = $state("")
    let translated = $state(false)

    async function rm(e: MouseEvent, rec?: boolean) {
        if (e.shiftKey) {
            let msg =
                DBState.db.characters[ChatState.selectedCharId].chats[
                    DBState.db.characters[ChatState.selectedCharId].chatPage
                ].message
            msg = msg.slice(0, idx)
            DBState.db.characters[ChatState.selectedCharId].chats[
                DBState.db.characters[ChatState.selectedCharId].chatPage
            ].message = msg
            return
        }

        const rm = DBState.db.askRemoval ? await alertConfirm(language.removeChat) : true
        if (rm) {
            if (DBState.db.instantRemove || rec) {
                const r = await alertConfirm(language.instantRemoveConfirm)
                let msg =
                    DBState.db.characters[ChatState.selectedCharId].chats[
                        DBState.db.characters[ChatState.selectedCharId].chatPage
                    ].message
                if (!r) {
                    msg = msg.slice(0, idx)
                } else {
                    msg.splice(idx, 1)
                }
                DBState.db.characters[ChatState.selectedCharId].chats[
                    DBState.db.characters[ChatState.selectedCharId].chatPage
                ].message = msg
            } else {
                let msg =
                    DBState.db.characters[ChatState.selectedCharId].chats[
                        DBState.db.characters[ChatState.selectedCharId].chatPage
                    ].message
                msg.splice(idx, 1)
                DBState.db.characters[ChatState.selectedCharId].chats[
                    DBState.db.characters[ChatState.selectedCharId].chatPage
                ].message = msg
            }
        }
    }

    async function edit() {
        DBState.db.characters[ChatState.selectedCharId].chats[
            DBState.db.characters[ChatState.selectedCharId].chatPage
        ].message[idx].data = message
    }

    function getCbsCondition() {
        try {
            const cbsConditions: CbsConditions = {
                firstmsg: firstMessage ?? false,
                chatRole:
                    DBState.db.characters[ChatState.selectedCharId].chats[
                        DBState.db.characters[ChatState.selectedCharId].chatPage
                    ]?.message?.[idx]?.role ?? null,
            }
            return cbsConditions
        } catch (e) {
            return {
                firstmsg: firstMessage ?? false,
                chatRole: null,
            }
        }
    }

    function displaya(message: string) {
        msgDisplay = risuChatParser(message, {
            chara: name,
            chatID: idx,
            rmVar: true,
            visualize: true,
            cbsConditions: getCbsCondition(),
        })
    }

    const setStatusMessage = (message: string, timeout: number = 0) => {
        statusMessage = message
        if (timeout === 0) return
        setTimeout(() => {
            statusMessage = ""
        }, timeout)
    }

    let blankMessage = $derived((message === "{{none}}" || message === "{{blank}}" || message === "") && idx === -1)

    $effect.pre(() => {
        displaya(message)
    })

    $effect(() => {
        RenderState.guiReloadPointer
        displaya(message)
    })

    function RenderGUIHtml(html: string) {
        try {
            const parser = new DOMParser()
            const doc = parser.parseFromString(
                risuChatParser(html ?? "", { cbsConditions: getCbsCondition() }),
                "text/html"
            )
            return doc.body
        } catch (error) {
            const placeholder = document.createElement("div")
            return placeholder
        }
    }

    async function handleButtonTriggerWithin(event: UIEvent) {
        const currentChar = getCurrentCharacter()
        if (!currentChar || currentChar.type === "group") {
            return
        }

        const target = event.target as HTMLElement
        const origin = target.closest("[risu-trigger], [risu-btn]")
        if (!origin) {
            return
        }

        const triggerName = origin.getAttribute("risu-trigger")
        const triggerId = origin.getAttribute("risu-id")
        const btnEvent = origin.getAttribute("risu-btn")

        const triggerResult = triggerName
            ? await runTrigger(currentChar, "manual", {
                  chat: getCurrentChat(),
                  manualName: triggerName,
                  triggerId: triggerId || undefined,
              })
            : btnEvent
              ? await runLuaButtonTrigger(currentChar, btnEvent)
              : null

        if (triggerResult) {
            setCurrentChat(triggerResult.chat)
            RenderState.chatReloadPointer[idx] = (RenderState.chatReloadPointer[idx] ?? 0) + 1
        }

        if (triggerName && triggerId) {
            setTimeout(() => {
                ChatState.currentTriggerId = null
            }, 100) // Small delay to allow display mode to complete
        }
    }
</script>

{#snippet genInfo()}
    <div class="flex flex-col items-end">
        {#if messageGenerationInfo && DBState.db.requestInfoInsideChat}
            <button
                class="float-end my-1 mr-2 flex items-center justify-center rounded-md
                            border-darkborderc p-1 text-sm text-textcolor2 transition-all hover:text-textcolor hover:ring hover:ring-darkbutton"
                onclick={() => {
                    const currentGenerationInfo =
                        idx >= 0
                            ? DBState.db.characters[ChatState.selectedCharId].chats[
                                  DBState.db.characters[ChatState.selectedCharId].chatPage
                              ].message[idx].generationInfo
                            : messageGenerationInfo

                    alertRequestData({
                        genInfo: currentGenerationInfo,
                        idx: idx,
                    })
                }}
            >
                <BotIcon size={20} />
                <span class="ml-1">
                    {capitalize(getModelInfo(messageGenerationInfo.model).shortName)}
                </span>
            </button>
        {/if}
        {#if DBState.db.translatorType === "llm" && translated}
            <button
                class="float-end my-1 mr-2 flex items-center justify-center rounded-md
                            border-darkborderc p-1 text-sm text-textcolor2 transition-all hover:text-textcolor hover:ring hover:ring-darkbutton"
                onclick={() => {
                    retranslate = true
                }}
            >
                <RefreshCcwIcon size={20} />
                <span class="ml-1">
                    {language.retranslate}
                </span>
            </button>
        {/if}
    </div>
{/snippet}

{#snippet textBox()}
    {#if editMode}
        <AutoresizeArea
            bind:value={message}
            handleLongPress={() => {
                editMode = false
            }}
        />
    {:else if blankMessage}
        <div class="mb-12 flex w-full justify-center italic text-textcolor2">
            {language.noMessage}
        </div>
    {:else}
        {@const chatReloadPointer = RenderState.guiReloadPointer + (RenderState.chatReloadPointer[idx] ?? 0)}
        {@const totalLengthPointer = idx > totalLength - 6 ? totalLength : 0}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span
            class="text chat-width chattext minw-0 prose"
            class:prose-invert={ColorSchemeTypeState.type}
            bind:this={bodyRoot}
            onclick={() => {
                if (DBState.db.clickToEdit && idx > -1) {
                    editMode = true
                }
            }}
            style:font-size="{0.875 * (DBState.db.zoomsize / 100)}rem"
            style:line-height="{(DBState.db.lineHeight ?? 1.25) * (DBState.db.zoomsize / 100)}rem"
        >
            {#key `${totalLengthPointer}|${chatReloadPointer}`}
                <ChatBody
                    {character}
                    {firstMessage}
                    {idx}
                    {msgDisplay}
                    {name}
                    {bodyRoot}
                    role={role ?? null}
                    bind:translated
                    bind:translating
                    bind:retranslate
                />
            {/key}
        </span>
    {/if}
{/snippet}

{#snippet icons(options: { applyTextColors?: boolean } = {})}
    <div class="flex flex-grow items-center justify-end" class:text-textcolor2={options?.applyTextColors !== false}>
        <span class="text-xs">{statusMessage}</span>
        {#if DBState.db.useChatCopy && !blankMessage}
            <button
                class="button-icon-copy ml-2 transition-colors hover:text-blue-500"
                onclick={async () => {
                    if (window.navigator.clipboard.write) {
                        try {
                            alertWait(language.loading)
                            const root = document.querySelector(":root") as HTMLElement

                            const parser = new DOMParser()
                            const doc = parser.parseFromString(
                                await ParseMarkdown(
                                    msgDisplay,
                                    getCurrentCharacter(),
                                    "normal",
                                    idx,
                                    getCbsCondition()
                                ),
                                "text/html"
                            )

                            doc.querySelectorAll("mark").forEach((el) => {
                                const d = el.getAttribute("risu-mark")
                                if (d === "quote1" || d === "quote2") {
                                    const newEle = document.createElement("div")
                                    newEle.textContent = el.textContent
                                    newEle.setAttribute(
                                        "style",
                                        `background: transparent; color: ${root.style.getPropertyValue("--FontColorQuote" + d.slice(-1))};`
                                    )
                                    el.replaceWith(newEle)
                                    return
                                }
                            })
                            doc.querySelectorAll("p").forEach((el) => {
                                el.setAttribute(
                                    "style",
                                    `color: ${root.style.getPropertyValue("--FontColorStandard")};`
                                )
                            })
                            doc.querySelectorAll("em").forEach((el) => {
                                el.setAttribute(
                                    "style",
                                    `font-style: italic; color: ${root.style.getPropertyValue("--FontColorItalic")};`
                                )
                            })
                            doc.querySelectorAll("strong").forEach((el) => {
                                el.setAttribute(
                                    "style",
                                    `font-weight: bold; color: ${root.style.getPropertyValue("--FontColorBold")};`
                                )
                            })
                            doc.querySelectorAll("em strong").forEach((el) => {
                                el.setAttribute(
                                    "style",
                                    `font-weight: bold; font-style: italic; color: ${root.style.getPropertyValue("--FontColorItalicBold")};`
                                )
                            })
                            doc.querySelectorAll("strong em").forEach((el) => {
                                el.setAttribute(
                                    "style",
                                    `font-weight: bold; font-style: italic; color: ${root.style.getPropertyValue("--FontColorItalicBold")};`
                                )
                            })

                            const imgs = doc.querySelectorAll("img")
                            for (const img of imgs) {
                                img.setAttribute("alt", "from RisuAI")
                                const url = img.getAttribute("src")

                                img.setAttribute(
                                    "style",
                                    `
                                max-width: 100%;
                                margin: 10px 0;
                                border-radius: 8px;
                                box-shadow: rgba(0,0,0,0.1) 0px 2px 8px;
                                display: block;
                                margin-left: auto;
                                margin-right: auto;
                            `
                                )

                                if (
                                    url &&
                                    (url.startsWith("http://asset.localhost") ||
                                        url.startsWith("https://asset.localhost") ||
                                        url.startsWith("https://sv.risuai") ||
                                        url.startsWith("data:") ||
                                        url.startsWith("http") ||
                                        url.startsWith("/"))
                                ) {
                                    try {
                                        let fetchUrl = url
                                        if (url.startsWith("/")) {
                                            fetchUrl = window.location.origin + url
                                        }

                                        const data = await fetch(fetchUrl)
                                        if (data.ok) {
                                            const canvas = document.createElement("canvas")
                                            const ctx = canvas.getContext("2d")
                                            const imgElement = new Image()
                                            imgElement.crossOrigin = "anonymous"
                                            imgElement.src = await data.blob().then(
                                                (b) =>
                                                    new Promise((resolve, reject) => {
                                                        const reader = new FileReader()
                                                        reader.onload = () => resolve(reader.result as string)
                                                        reader.onerror = reject
                                                        reader.readAsDataURL(b)
                                                    })
                                            )
                                            await new Promise((resolve) => {
                                                imgElement.onload = resolve
                                            })
                                            canvas.width = imgElement.width
                                            canvas.height = imgElement.height
                                            ctx.drawImage(imgElement, 0, 0)
                                            const dataURL = canvas.toDataURL("image/jpeg", 0.6)
                                            img.setAttribute("src", dataURL)
                                        }
                                    } catch (error) {
                                        console.error("Image error:", error)
                                    }
                                }
                            }

                            let iconDataUrl = ""
                            let hasValidImage = false

                            try {
                                const iconImage =
                                    (await getFileSrc(DBState.db.characters[ChatState.selectedCharId].image ?? "")) ??
                                    ""

                                if (
                                    iconImage &&
                                    (iconImage.startsWith("http://asset.localhost") ||
                                        iconImage.startsWith("https://asset.localhost") ||
                                        iconImage.startsWith("https://sv.risuai") ||
                                        iconImage.startsWith("data:") ||
                                        iconImage.startsWith("http") ||
                                        iconImage.startsWith("/"))
                                ) {
                                    if (iconImage.startsWith("data:")) {
                                        iconDataUrl = iconImage
                                        hasValidImage = true
                                    } else {
                                        const data = await fetch(iconImage)
                                        if (data.ok) {
                                            const canvas = document.createElement("canvas")
                                            const ctx = canvas.getContext("2d")
                                            const img = new Image()
                                            img.crossOrigin = "anonymous"
                                            img.src = await data.blob().then(
                                                (b) =>
                                                    new Promise((resolve, reject) => {
                                                        const reader = new FileReader()
                                                        reader.onload = () => resolve(reader.result as string)
                                                        reader.onerror = reject
                                                        reader.readAsDataURL(b)
                                                    })
                                            )
                                            await new Promise((resolve, reject) => {
                                                img.onload = () => {
                                                    canvas.width = img.width
                                                    canvas.height = img.height
                                                    ctx.drawImage(img, 0, 0)
                                                    iconDataUrl = canvas.toDataURL("image/jpeg", 0.9)
                                                    hasValidImage = true
                                                    resolve(true)
                                                }
                                                img.onerror = () => {
                                                    hasValidImage = false
                                                    resolve(false)
                                                }
                                            })
                                        }
                                    }
                                }
                            } catch (error) {
                                console.error("Icon error:", error)
                                hasValidImage = false
                            }

                            const isUserMessage = role === "user"
                            const displayName = isUserMessage ? getUserName() : name
                            const modelInfo = messageGenerationInfo
                                ? capitalize(getModelInfo(messageGenerationInfo.model).shortName)
                                : isUserMessage
                                  ? "User"
                                  : "AI"

                            let finalIconDataUrl = iconDataUrl
                            let finalHasValidImage = hasValidImage

                            if (isUserMessage) {
                                finalHasValidImage = false
                                const userIcon = getUserIcon()
                                if (userIcon) {
                                    try {
                                        const userIconSrc = await getFileSrc(userIcon)
                                        if (
                                            userIconSrc &&
                                            (userIconSrc.startsWith("http://asset.localhost") ||
                                                userIconSrc.startsWith("https://asset.localhost") ||
                                                userIconSrc.startsWith("https://sv.risuai") ||
                                                userIconSrc.startsWith("data:") ||
                                                userIconSrc.startsWith("http") ||
                                                userIconSrc.startsWith("/"))
                                        ) {
                                            if (userIconSrc.startsWith("data:")) {
                                                finalIconDataUrl = userIconSrc
                                                finalHasValidImage = true
                                            } else {
                                                const data = await fetch(userIconSrc)
                                                if (data.ok) {
                                                    const canvas = document.createElement("canvas")
                                                    const ctx = canvas.getContext("2d")
                                                    const img = new Image()
                                                    img.crossOrigin = "anonymous"
                                                    img.src = await data.blob().then(
                                                        (b) =>
                                                            new Promise((resolve, reject) => {
                                                                const reader = new FileReader()
                                                                reader.onload = () => resolve(reader.result as string)
                                                                reader.onerror = reject
                                                                reader.readAsDataURL(b)
                                                            })
                                                    )
                                                    await new Promise((resolve, reject) => {
                                                        img.onload = () => {
                                                            canvas.width = img.width
                                                            canvas.height = img.height
                                                            ctx.drawImage(img, 0, 0)
                                                            finalIconDataUrl = canvas.toDataURL("image/jpeg", 0.9)
                                                            finalHasValidImage = true
                                                            resolve(true)
                                                        }
                                                        img.onerror = () => {
                                                            finalHasValidImage = false
                                                            resolve(false)
                                                        }
                                                    })
                                                }
                                            }
                                        }
                                    } catch (error) {
                                        console.error("User icon error:", error)
                                        finalHasValidImage = false
                                    }
                                }
                            }

                            const html = `<div style="font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: ${root.style.getPropertyValue("--risu-theme-textcolor")}; line-height: 1.6; max-width: 600px; margin: 1rem auto; background: ${root.style.getPropertyValue("--risu-theme-bgcolor")}; border-radius: 12px; box-shadow: 0px 4px 12px rgba(0,0,0,0.15); overflow: hidden;">
    <div style="padding: 20px;">
        <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 1rem; text-align: center;">
            ${finalHasValidImage ? `<img style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid ${root.style.getPropertyValue("--risu-theme-darkborderc")}; margin-bottom: 0.75rem; object-fit: cover;" src="${finalIconDataUrl}" alt="profile">` : ""}
            <h3 style="color: ${root.style.getPropertyValue("--risu-theme-textcolor")}; font-weight: 600; font-size: 1.5rem; margin: 0 0 0.5rem 0;">${displayName}</h3>
            ${!isUserMessage ? `<span style="display: inline-block; border-radius: 16px; font-size: 0.8rem; padding: 0.25rem 0.75rem; background: ${root.style.getPropertyValue("--risu-theme-darkbg")}; color: ${root.style.getPropertyValue("--risu-theme-textcolor")}; border: 1px solid ${root.style.getPropertyValue("--risu-theme-darkborderc")};">${modelInfo}</span>` : ""}
        </div>
        <div style="border-top: 1px solid ${root.style.getPropertyValue("--risu-theme-darkborderc")}; padding-top: 1rem;">
            ${doc.body.innerHTML}
        </div>
        <div style="text-align: center; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid ${root.style.getPropertyValue("--risu-theme-darkborderc")};">
            <span style="font-size: 0.75rem; color: ${root.style.getPropertyValue("--risu-theme-textcolor2")}; opacity: 0.7;">From RisuAI</span>
        </div>
    </div>
</div>`

                            await window.navigator.clipboard.write([
                                new ClipboardItem({
                                    "text/plain": new Blob([msgDisplay], { type: "text/plain" }),
                                    "text/html": new Blob([html], { type: "text/html" }),
                                }),
                            ])
                            alertNormal(language.copied)
                            return
                        } catch (e) {
                            alertClear()
                            window.navigator.clipboard.writeText(msgDisplay).then(() => {
                                setStatusMessage(language.copied)
                            })
                        }
                    }
                    window.navigator.clipboard.writeText(msgDisplay).then(() => {
                        setStatusMessage(language.copied)
                    })
                }}
            >
                <CopyIcon size={20} />
            </button>
        {/if}
        {#if idx > -1}
            {#if DBState.db.characters[ChatState.selectedCharId].type !== "group" && DBState.db.characters[ChatState.selectedCharId].ttsMode !== "none" && DBState.db.characters[ChatState.selectedCharId].ttsMode}
                <button
                    class="button-icon-tts ml-2 transition-colors hover:text-blue-500"
                    onclick={() => {
                        return sayTTS(null, message)
                    }}
                >
                    <Volume2Icon size={20} />
                </button>
            {/if}

            {#if !MultiuserState.isOpen}
                <button
                    class={"button-icon-edit ml-2 transition-colors hover:text-blue-500 " +
                        (editMode ? "text-blue-400" : "")}
                    onclick={() => {
                        if (!editMode) {
                            editMode = true
                        } else {
                            editMode = false
                            edit()
                        }
                    }}
                >
                    <PencilIcon size={20} />
                </button>
                <!-- 이 버튼이 수정 버튼. edit() 함수를 주목할 것-->
                <button
                    class="button-icon-remove ml-2 transition-colors hover:text-blue-500"
                    onclick={(e) => rm(e, false)}
                    use:longpress={(e) => rm(e, true)}
                >
                    <TrashIcon size={20} />
                </button>
            {/if}
        {/if}
        {#if DBState.db.translator !== "" && !blankMessage}
            <button
                class={"button-icon-translate ml-2 cursor-pointer transition-colors hover:text-blue-500 " +
                    (translated ? "text-blue-400" : "")}
                class:translating
                onclick={async () => {
                    translated = !translated
                }}
            >
                <LanguagesIcon />
            </button>
        {/if}
        {#if rerollIcon || altGreeting}
            {#if DBState.db.swipe || altGreeting}
                <button
                    class="button-icon-unreroll ml-2 transition-colors hover:text-blue-500"
                    class:dyna-icon={rerollIcon === "dynamic"}
                    onclick={unReroll}
                >
                    <ArrowLeft size={22} />
                </button>
                {#if firstMessage && DBState.db.swipe && DBState.db.showFirstMessagePages}
                    <span class="ml-2 text-xs text-textcolor2">{currentPage}/{totalPages}</span>
                {/if}
                <button
                    class="button-icon-reroll ml-2 transition-colors hover:text-blue-500"
                    class:dyna-icon={rerollIcon === "dynamic"}
                    onclick={onReroll}
                >
                    <ArrowRight size={22} />
                </button>
            {:else}
                <button
                    class="button-icon-reroll ml-2 transition-colors hover:text-blue-500"
                    class:dyna-icon={rerollIcon === "dynamic"}
                    onclick={onReroll}
                >
                    <RefreshCcwIcon size={20} />
                </button>
            {/if}
        {/if}
    </div>
{/snippet}

{#snippet icon(options: { rounded?: boolean; styleFix?: string } = {})}
    {#if !blankMessage && !RenderState.hideIcon}
        {#if DBState.db.characters[ChatState.selectedCharId]?.chaId === "§playground"}
            <div
                class="flex items-center justify-center border border-textcolor2 text-textcolor2 shadow-lg"
                style={options?.styleFix ??
                    `height:${(DBState.db.iconsize * 3.5) / 100}rem;width:${(DBState.db.iconsize * 3.5) / 100}rem;min-width:${(DBState.db.iconsize * 3.5) / 100}rem`}
                class:rounded-md={options?.rounded}
                class:rounded-full={options?.rounded}
            >
                {#if name === "assistant"}
                    <BotIcon />
                {:else}
                    <UserIcon />
                {/if}
            </div>
        {:else}
            {#await img}
                <div
                    class="bg-textcolor2 shadow-lg"
                    style={options?.styleFix ??
                        `height:${(DBState.db.iconsize * 3.5) / 100}rem;width:${(DBState.db.iconsize * 3.5) / 100}rem;min-width:${(DBState.db.iconsize * 3.5) / 100}rem`}
                    class:rounded-md={!options?.rounded}
                    class:rounded-full={options?.rounded}
                ></div>
            {:then m}
                {#if largePortrait && !options?.rounded}
                    <div
                        class="bg-textcolor2 shadow-lg"
                        style={m +
                            (options?.styleFix ??
                                `height:${(DBState.db.iconsize * 3.5) / 100 / 0.75}rem;width:${(DBState.db.iconsize * 3.5) / 100}rem;min-width:${(DBState.db.iconsize * 3.5) / 100}rem`)}
                        class:rounded-md={!options?.rounded}
                        class:rounded-full={options?.rounded}
                    ></div>
                {:else}
                    <div
                        class="bg-textcolor2 shadow-lg"
                        style={m +
                            (options?.styleFix ??
                                `height:${(DBState.db.iconsize * 3.5) / 100}rem;width:${(DBState.db.iconsize * 3.5) / 100}rem;min-width:${(DBState.db.iconsize * 3.5) / 100}rem`)}
                        class:rounded-md={!options?.rounded}
                        class:rounded-full={options?.rounded}
                    ></div>
                {/if}
            {/await}
        {/if}
    {/if}
{/snippet}

{#snippet renderGuiHtmlPart(dom: HTMLElement)}
    {#if dom.tagName === "IMG"}
        <img class={dom.getAttribute("class") ?? ""} alt="" style={dom.getAttribute("style") ?? ""} />
    {:else if dom.tagName === "A"}
        <a
            target="_blank"
            rel="noreferrer"
            href={dom.getAttribute("href") && dom.getAttribute("href").startsWith("https")
                ? dom.getAttribute("href")
                : ""}
            class={dom.getAttribute("class") ?? ""}
            style={dom.getAttribute("style") ?? ""}
        >
            {@render renderChilds(dom)}
        </a>
    {:else if dom.tagName === "SPAN"}
        <span class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </span>
    {:else if dom.tagName === "DIV"}
        <div class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </div>
    {:else if dom.tagName === "P"}
        <p class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </p>
    {:else if dom.tagName === "H1"}
        <h1 class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </h1>
    {:else if dom.tagName === "H2"}
        <h2 class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </h2>
    {:else if dom.tagName === "H3"}
        <h3 class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </h3>
    {:else if dom.tagName === "H4"}
        <h4 class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </h4>
    {:else if dom.tagName === "H5"}
        <h5 class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </h5>
    {:else if dom.tagName === "H6"}
        <h6 class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </h6>
    {:else if dom.tagName === "UL"}
        <ul class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </ul>
    {:else if dom.tagName === "OL"}
        <ol class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </ol>
    {:else if dom.tagName === "LI"}
        <li class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </li>
    {:else if dom.tagName === "TABLE"}
        <table class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </table>
    {:else if dom.tagName === "TR"}
        <tr class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </tr>
    {:else if dom.tagName === "TD"}
        <td class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </td>
    {:else if dom.tagName === "TH"}
        <th class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </th>
    {:else if dom.tagName === "HR"}
        <hr class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""} />
    {:else if dom.tagName === "BR"}
        <br class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""} />
    {:else if dom.tagName === "CODE"}
        <code class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </code>
    {:else if dom.tagName === "PRE"}
        <pre class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </pre>
    {:else if dom.tagName === "BLOCKQUOTE"}
        <blockquote class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </blockquote>
    {:else if dom.tagName === "EM"}
        <em class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </em>
    {:else if dom.tagName === "STRONG"}
        <strong class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </strong>
    {:else if dom.tagName === "U"}
        <u class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </u>
    {:else if dom.tagName === "DEL"}
        <del class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </del>
    {:else if dom.tagName === "BUTTON"}
        <button class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </button>
    {:else if dom.tagName === "RISUTEXTBOX"}
        {@render textBox()}
    {:else if dom.tagName === "RISUICON"}
        {@render icon()}
    {:else if dom.tagName === "RISUBUTTONS"}
        {@render icons()}
    {:else if dom.tagName === "RISUGENINFO"}
        {@render genInfo()}
        <!-- TODO: Custom HTML에 Style 태그가 적용되어야하는가? -->
    {:else if dom.tagName === "STYLE"}
        <svelte:element this={"style"}>
            {dom.innerHTML}
        </svelte:element>
    {:else}
        <div class={dom.getAttribute("class") ?? ""} style={dom.getAttribute("style") ?? ""}>
            {@render renderChilds(dom)}
        </div>
    {/if}
{/snippet}

{#snippet renderChilds(dom: HTMLElement)}
    {#each dom.childNodes as node}
        {#if node.nodeType === Node.TEXT_NODE}
            {node.textContent}
        {:else if node.nodeType === Node.ELEMENT_NODE}
            {@render renderGuiHtmlPart(node as HTMLElement)}
        {/if}
    {/each}
{/snippet}

<div
    class="risu-chat flex max-w-full justify-center"
    data-chat-index={idx}
    data-chat-id={DBState.db.characters?.[ChatState.selectedCharId]?.chats?.[
        DBState.db.characters?.[ChatState.selectedCharId]?.chatPage
    ]?.message?.[idx]?.chatId ?? ""}
    style={isLastMemory ? `border-top:${DBState.db.memoryLimitThickness}px solid rgba(98, 114, 164, 0.7);` : ""}
    onclickcapture={handleButtonTriggerWithin}
>
    <div
        class="flexium mb-1 ml-4 mr-4 mt-1 max-w-full flex-grow items-start border-transparent border-t-gray-900 border-opacity-30 bg-transparent p-2 text-textcolor"
    >
        {#if DBState.db.theme === "mobilechat" && !blankMessage}
            <div class={role === "user" ? "flex w-full items-start justify-end" : "flex items-start"}>
                {#if role !== "user"}
                    {@render icon({ rounded: true })}
                {/if}
                <div
                    class="mx-2 max-w-[70%] rounded-lg bg-gray-100 p-3"
                    class:rounded-tl-none={role !== "user"}
                    class:rounded-tr-none={role === "user"}
                >
                    <p class="text-gray-800">{@render textBox()}</p>
                    {#if DBState.db.characters?.[ChatState.selectedCharId]?.chats?.[DBState.db.characters?.[ChatState.selectedCharId]?.chatPage]?.message?.[idx]?.time}
                        <span class="mt-1 block text-xs text-textcolor2">
                            {new Intl.DateTimeFormat(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                month: "2-digit",
                                day: "2-digit",
                                hour12: false,
                            }).format(
                                DBState.db.characters[ChatState.selectedCharId].chats[
                                    DBState.db.characters[ChatState.selectedCharId].chatPage
                                ].message[idx].time
                            )}
                        </span>
                    {/if}
                </div>
                {#if role === "user"}
                    {@render icon({ rounded: true })}
                {/if}
            </div>
        {:else if DBState.db.theme === "cardboard" && !blankMessage}
            <div class="relative flex w-full flex-col px-0 py-4 sm:px-4">
                <div
                    class="flex flex-col rounded-lg border border-gray-400 bg-gradient-to-b from-gray-100 to-gray-200 p-4 shadow-lg"
                >
                    <div class="mt-2 flex flex-col gap-4 sm:flex-row">
                        <div class="flex flex-col items-center">
                            <div class="h-64 w-48 sm:h-96 sm:w-72 sm:min-w-72">
                                {@render icon({ rounded: false, styleFix: "height:100%;width:100%;" })}
                            </div>
                            <h2 class="mt-2 max-w-full text-ellipsis text-center text-base font-bold text-gray-500">
                                {name}
                            </h2>
                        </div>
                        {#if editMode}
                            <textarea
                                class="message-edit-area mb-2 h-138 flex-grow resize-none overflow-y-auto bg-transparent p-2 text-black sm:h-96"
                                bind:value={message}
                            ></textarea>
                        {:else}
                            <div class="mb-2 h-138 flex-grow overflow-y-auto p-2 sm:mb-0 sm:h-96">
                                {@render textBox()}
                            </div>
                        {/if}
                    </div>
                </div>
                <div
                    class="absolute bottom-0 right-0 rounded-md border border-gray-400 bg-gradient-to-b from-gray-200 to-gray-300 p-2 text-gray-400"
                >
                    {@render icons({ applyTextColors: false })}
                </div>
            </div>
        {:else if DBState.db.theme === "customHTML" && !blankMessage}
            {@render renderGuiHtmlPart(RenderGUIHtml(DBState.db.guiHTML))}
        {:else}
            {@render icon({ rounded: DBState.db.roundIcons })}
            <span class="ml-4 flex w-full min-w-0 max-w-full flex-col text-black">
                <div class="flexium chat-width items-center">
                    {#if DBState.db.characters[ChatState.selectedCharId]?.chaId === "§playground" && !blankMessage}
                        <span class="chat-width flex items-center border-darkborderc text-xl text-textcolor">
                            <span
                                >{DBState.db.characters[ChatState.selectedCharId].chats[
                                    DBState.db.characters[ChatState.selectedCharId].chatPage
                                ].message[idx].role === "char"
                                    ? "Assistant"
                                    : "User"}</span
                            >
                            <button
                                class="ml-2 text-textcolor2 hover:text-textcolor"
                                onclick={() => {
                                    DBState.db.characters[ChatState.selectedCharId].chats[
                                        DBState.db.characters[ChatState.selectedCharId].chatPage
                                    ].message[idx].role =
                                        DBState.db.characters[ChatState.selectedCharId].chats[
                                            DBState.db.characters[ChatState.selectedCharId].chatPage
                                        ].message[idx].role === "char"
                                            ? "user"
                                            : "char"
                                }}><ArrowLeftRightIcon size="18" /></button
                            >
                        </span>
                    {:else if !blankMessage && !RenderState.hideIcon}
                        <span class="chat-width unmargin text-xl text-textcolor">{name}</span>
                    {/if}
                    {@render icons()}
                </div>
                {@render genInfo()}
                {@render textBox()}
            </span>
        {/if}
    </div>
</div>
