<script lang="ts">
    import { requestChatData } from "src/ts/process/request/request"
    import { DoingChatState, type OpenAIChat } from "../../ts/process/index.svelte"
    import { setDatabase } from "../../ts/data/storage/database.svelte"
    import type { character, Message, groupChat, Database } from "../../ts/data/storage/types"
    import { DBState, ChatState } from "src/ts/stores.svelte"
    import { translate } from "src/ts/translator/translator"
    import { CopyIcon, LanguagesIcon, RefreshCcwIcon } from "@lucide/svelte"
    import { alertConfirm } from "src/ts/utils/alert.svelte"
    import { language } from "src/lang"
    import { getUserName, replacePlaceholders } from "../../ts/utils/util"
    import { ParseMarkdown } from "src/ts/utils/parser.svelte"

    interface Props {
        send: () => any
        messageInput: (string: string) => any
    }

    let { send, messageInput }: Props = $props()
    let suggestMessages: string[] = $state(
        DBState.db.characters[ChatState.selectedCharId]?.chats[DBState.db.characters[ChatState.selectedCharId].chatPage]
            ?.suggestMessages
    )
    let suggestMessagesTranslated: string[] = $state()
    let toggleTranslate: boolean = $state(DBState.db.autoTranslate)
    let progress: boolean = $state()
    let progressChatPage = -1
    let abortController: AbortController
    let chatPage: number = $state()

    const updateSuggestions = () => {
        if (ChatState.selectedCharId > -1 && !DoingChatState.value) {
            if (progressChatPage > 0 && progressChatPage != chatPage) {
                progress = false
                abortController?.abort()
            }
            let currentChar = DBState.db.characters[ChatState.selectedCharId]
            suggestMessages = currentChar?.chats[currentChar.chatPage].suggestMessages
        }
    }

    // Watch DoingChatState changes
    $effect(() => {
        const v = DoingChatState.value
        if (v) {
            progress = false
            abortController?.abort()
            suggestMessages = []
        }
        if (!v && ChatState.selectedCharId > -1 && (!suggestMessages || suggestMessages.length === 0) && !progress) {
            let currentChar: character | groupChat = DBState.db.characters[ChatState.selectedCharId]
            let messages: Message[] = []

            messages = [...messages, ...currentChar.chats[currentChar.chatPage].message]
            let lastMessages: Message[] = messages.slice(Math.max(messages.length - 10, 0))
            if (lastMessages.length === 0) return
            let promptbody: OpenAIChat[] = [
                {
                    role: "system",
                    content: replacePlaceholders(DBState.db.autoSuggestPrompt, currentChar.name),
                },
                {
                    role: "user",
                    content: lastMessages
                        .map((b) => (b.role === "char" ? currentChar.name : getUserName()) + ":" + b.data)
                        .reduce((a, b) => a + "," + b),
                },
            ]

            if (
                DBState.db.subModel === "textgen_webui" ||
                DBState.db.subModel === "mancer" ||
                DBState.db.subModel.startsWith("local_")
            ) {
                promptbody = [
                    {
                        role: "system",
                        content: replacePlaceholders(DBState.db.autoSuggestPrompt, currentChar.name),
                    },
                    ...lastMessages.map(({ role, data }) => ({
                        role: role === "user" ? ("user" as const) : ("assistant" as const),
                        content: data,
                    })),
                ]
            }

            progress = true
            progressChatPage = chatPage
            abortController = new AbortController()
            requestChatData(
                {
                    formated: promptbody,
                    bias: {},
                    currentChar: currentChar as character,
                },
                "submodel",
                abortController.signal
            ).then((rq2) => {
                if (rq2.type !== "fail" && rq2.type !== "streaming" && rq2.type !== "multiline" && progress) {
                    var suggestMessagesNew = rq2.result
                        .split("\n")
                        .filter((msg) => msg.startsWith("-"))
                        .map((msg) => msg.replace("-", "").trim())
                    const db: Database = DBState.db
                    db.characters[ChatState.selectedCharId].chats[currentChar.chatPage].suggestMessages =
                        suggestMessagesNew
                    setDatabase(db)
                    suggestMessages = suggestMessagesNew
                }
                progress = false
            })
        }
    })

    const translateSuggest = async (toggle, messages) => {
        if (toggle && messages && messages.length > 0) {
            suggestMessagesTranslated = []
            for (let i = 0; i < suggestMessages.length; i++) {
                let msg = suggestMessages[i]
                let translated = await translate(msg, false)
                suggestMessagesTranslated[i] = translated
            }
        }
    }

    $effect.pre(() => {
        ChatState.selectedCharId
        //FIXME add selectedChatPage for optimize render
        chatPage = DBState.db.characters[ChatState.selectedCharId].chatPage
        updateSuggestions()
    })
    $effect.pre(() => {
        translateSuggest(toggleTranslate, suggestMessages)
    })
</script>

<div class="ml-4 flex flex-wrap">
    {#if progress}
        <div class="flex items-center rounded-lg bg-textcolor2 p-2">
            <div class="loadmove mx-2"></div>
            <div>{language.creatingSuggestions}</div>
        </div>
    {:else if !DoingChatState.value}
        {#if DBState.db.translator !== ""}
            <div class="mb-2 mr-2 flex">
                <button
                    class={"rounded bg-textcolor2 px-4 py-2 font-bold hover:bg-darkbutton " +
                        (toggleTranslate ? "text-green-500" : "text-textcolor")}
                    onclick={() => {
                        toggleTranslate = !toggleTranslate
                    }}
                >
                    <LanguagesIcon />
                </button>
            </div>
        {/if}

        <div class="mb-2 mr-2 flex">
            <button
                class="rounded bg-textcolor2 px-4 py-2 font-bold text-textcolor hover:bg-darkbutton"
                onclick={() => {
                    alertConfirm(language.askReRollAutoSuggestions).then((result) => {
                        if (result) {
                            suggestMessages = []
                            DoingChatState.value = true
                            DoingChatState.value = false
                        }
                    })
                }}
            >
                <RefreshCcwIcon />
            </button>
        </div>
        {#each suggestMessages ?? [] as suggest, i}
            <div class="mb-2 mr-2 flex">
                <button
                    class="rounded bg-textcolor2 px-4 py-2 font-bold text-textcolor hover:bg-darkbutton"
                    onclick={() => {
                        suggestMessages = []
                        messageInput(suggest)
                        send()
                    }}
                >
                    {#await ParseMarkdown(DBState.db.translator !== "" && toggleTranslate && suggestMessagesTranslated && suggestMessagesTranslated.length > 0 ? (suggestMessagesTranslated[i] ?? suggest) : suggest) then md}
                        {@html md}
                    {/await}
                </button>
                <button
                    class="ml-1 rounded bg-textcolor2 px-4 py-2 font-bold text-textcolor hover:bg-darkbutton"
                    onclick={() => {
                        messageInput(suggest)
                    }}
                >
                    <CopyIcon />
                </button>
            </div>
        {/each}
    {/if}
</div>

<style>
    .loadmove {
        animation: spin 1s linear infinite;
        border-radius: 50%;
        border: 0.4rem solid rgba(0, 0, 0, 0);
        width: 1rem;
        height: 1rem;
        border-top: 0.4rem solid var(--risu-theme-textcolor);
        border-left: 0.4rem solid var(--risu-theme-textcolor);
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
