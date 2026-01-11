<script lang="ts">
    import { requestChatData } from "src/ts/process/request/request"
    import { chatGenState } from "src/ts/process/index.svelte"
    import { type OpenAIChat } from "../../ts/process/types"
    import { setDatabase } from "../../ts/storage/database.svelte"
    import type { Database } from "../../ts/storage/types/database"
    import type { Message } from "../../ts/storage/types/chat"
    import type { character, groupChat } from "../../ts/storage/types/character"
    import { DBState } from "src/ts/stores.svelte"
    import { selectedCharID } from "../../ts/stores.svelte"
    import { translate } from "src/ts/translator/translator.svelte"
    import { CopyIcon, LanguagesIcon, RefreshCcwIcon } from "@lucide/svelte"
    import { alertConfirm } from "src/ts/alert.svelte"
    import { language } from "src/lang"
    import { getUserName } from "src/ts/persona"
    import { onDestroy, untrack } from "svelte"
    import { ParseMarkdown, risuChatParser } from "src/ts/parser.svelte"
    import { defaultAutoSuggestPrompt } from "../../ts/storage/defaultPrompts.js"

    interface Props {
        send: () => any
        messageInput: (string: string) => any
    }

    let { send, messageInput }: Props = $props()
    let suggestMessages: string[] = $state(DBState.currentChar?.chats[DBState.currentChar.chatPage]?.suggestMessages)
    let suggestMessagesTranslated: string[] = $state()
    let toggleTranslate: boolean = $state(DBState.db.autoTranslate)
    let progress: boolean = $state()
    let progressChatPage = -1
    let abortController: AbortController
    let chatPage: number = $state()

    const updateSuggestions = () => {
        if ($selectedCharID > -1 && !chatGenState.generating) {
            if (progressChatPage > 0 && progressChatPage != chatPage) {
                progress = false
                abortController?.abort()
            }
            let currentChar = DBState.currentChar
            suggestMessages = currentChar?.chats[currentChar.chatPage].suggestMessages
        }
    }

    $effect(() => {
        void chatGenState.generating
        untrack(() => {
            if (chatGenState.generating) {
                progress = false
                abortController?.abort()
                suggestMessages = []
            }
            if (!chatGenState.generating && $selectedCharID > -1 && (!suggestMessages || suggestMessages.length === 0) && !progress) {
                let currentChar: character | groupChat = DBState.currentChar
                let messages: Message[] = []

                messages = [...messages, ...currentChar.chats[currentChar.chatPage].message]
                let lastMessages: Message[] = messages.slice(Math.max(messages.length - 10, 0))
                if (lastMessages.length === 0) return
                const prompt =
                    DBState.db.autoSuggestPrompt && DBState.db.autoSuggestPrompt.length > 0 ? DBState.db.autoSuggestPrompt : defaultAutoSuggestPrompt
                let promptbody: OpenAIChat[] = [
                    {
                        role: "system",
                        content: risuChatParser(prompt, { chara: currentChar, rmVar: true }),
                    },
                    {
                        role: "user",
                        content: lastMessages
                            .map((b) => (b.role === "char" ? currentChar.name : getUserName()) + ":" + b.data)
                            .reduce((a, b) => a + "," + b),
                    },
                ]

                if (DBState.db.subModel === "textgen_webui" || DBState.db.subModel === "mancer" || DBState.db.subModel.startsWith("local_")) {
                    promptbody = [
                        {
                            role: "system",
                            content: risuChatParser(DBState.db.autoSuggestPrompt, { chara: currentChar, rmVar: true }),
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
                        db.characters[$selectedCharID].chats[currentChar.chatPage].suggestMessages = suggestMessagesNew
                        setDatabase(db)
                        suggestMessages = suggestMessagesNew
                    }
                    progress = false
                })
            }
        })
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
        $selectedCharID
        //FIXME add selectedChatPage for optimize render
        chatPage = DBState.currentChar.chatPage
        updateSuggestions()
    })
    $effect.pre(() => {
        translateSuggest(toggleTranslate, suggestMessages)
    })
</script>

<div class="ml-4 flex flex-wrap">
    {#if progress}
        <div class="flex bg-textcolor2 p-2 rounded-lg items-center">
            <div class="loadmove mx-2"></div>
            <div>{language.creatingSuggestions}</div>
        </div>
    {:else if !chatGenState.generating}
        {#if DBState.db.translator !== ""}
            <div class="flex mr-2 mb-2">
                <button
                    class={"bg-textcolor2 hover:bg-darkbutton font-bold py-2 px-4 rounded-sm " +
                        (toggleTranslate ? "text-green-500" : "text-textcolor")}
                    onclick={() => {
                        toggleTranslate = !toggleTranslate
                    }}
                >
                    <LanguagesIcon />
                </button>
            </div>
        {/if}

        <div class="flex mr-2 mb-2">
            <button
                class="bg-textcolor2 hover:bg-darkbutton font-bold py-2 px-4 rounded-sm text-textcolor"
                onclick={() => {
                    alertConfirm(language.askReRollAutoSuggestions).then((result) => {
                        if (result) {
                            suggestMessages = []
                            chatGenState.generating = true
                            chatGenState.generating = false
                        }
                    })
                }}
            >
                <RefreshCcwIcon />
            </button>
        </div>
        {#each suggestMessages ?? [] as suggest, i}
            <div class="flex mr-2 mb-2">
                <button
                    class="bg-textcolor2 hover:bg-darkbutton text-textcolor font-bold py-2 px-4 rounded-sm"
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
                    class="bg-textcolor2 hover:bg-darkbutton text-textcolor font-bold py-2 px-4 rounded-sm ml-1"
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
