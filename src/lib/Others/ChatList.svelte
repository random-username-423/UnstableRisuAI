<script>
    import { alertConfirm, alertError } from "../../ts/utils/alert.svelte"
    import { language } from "../../lang"
    import { v4 as uuidv4 } from "uuid"

    import { DBState, RenderState, ChatState } from "src/ts/stores.svelte"
    import { DownloadIcon, EditIcon, HardDriveUploadIcon, PlusIcon, TrashIcon, XIcon } from "lucide-svelte"
    import { exportChat, importChat } from "../../ts/character/characters.svelte"
    import { findCharacterbyId } from "../../ts/utils/util"
    import TextInput from "../UI/GUI/TextInput.svelte"
    import { forageStorage } from "src/ts/data/storage/autoStorage"
    import { loadChat } from "src/ts/data/storage/chatStorage"
    import { deleteFromWorker } from "../../ts/data/storage/opfsWorkerClient.svelte"

    let editMode = $state(false)
    /** @type {{close?: any}} */
    let { close = () => {} } = $props()
</script>

<div class="absolute z-40 flex h-full w-full items-center justify-center bg-black bg-opacity-50">
    <div class="break-any flex max-h-full w-72 max-w-3xl flex-col overflow-y-auto rounded-md bg-darkbg p-4">
        <div class="mb-4 flex items-center text-textcolor">
            <h2 class="mb-0 mt-0">{language.chatList}</h2>
            <div class="flex flex-grow justify-end">
                <button class="mr-2 cursor-pointer items-center text-textcolor2 hover:text-green-500" onclick={close}>
                    <XIcon size={24} />
                </button>
            </div>
        </div>
        {#each DBState.db.characters[ChatState.selectedCharId].chats as chat, i}
            <button
                onclick={async () => {
                    if (!editMode) {
                        const char = DBState.db.characters[ChatState.selectedCharId]
                        const targetChat = char.chats[i]
                        // Load chat data before switching
                        if (targetChat && targetChat.message === undefined) {
                            await loadChat(char.chaId, targetChat.id)
                        }
                        DBState.db.characters[ChatState.selectedCharId].chatPage = i
                        close()
                    }
                }}
                class="flex cursor-pointer items-center border-0 border-t-1 border-solid border-darkborderc p-2 text-textcolor"
                class:bg-selected={i === DBState.db.characters[ChatState.selectedCharId].chatPage}
            >
                {#if editMode}
                    <TextInput
                        bind:value={DBState.db.characters[ChatState.selectedCharId].chats[i].name}
                        padding={false}
                    />
                {:else}
                    <span>{chat.name}</span>
                {/if}
                <div class="flex flex-grow justify-end">
                    <div
                        class="mr-2 cursor-pointer text-textcolor2 hover:text-green-500"
                        role="button"
                        tabindex="0"
                        onclick={async (e) => {
                            e.stopPropagation()
                            exportChat(i)
                        }}
                        onkeydown={() => {}}
                    >
                        <DownloadIcon size={18} />
                    </div>
                    <div
                        class="cursor-pointer text-textcolor2 hover:text-green-500"
                        role="button"
                        tabindex="0"
                        onclick={async (e) => {
                            e.stopPropagation()
                            if (DBState.db.characters[ChatState.selectedCharId].chats.length === 1) {
                                alertError(language.errors.onlyOneChat)
                                return
                            }
                            const d = await alertConfirm(`${language.removeConfirm}${chat.name}`)
                            if (d) {
                                // Get chat info before deletion for file cleanup
                                const chaId = DBState.db.characters[ChatState.selectedCharId].chaId
                                const chatId = chat.id

                                DBState.db.characters[ChatState.selectedCharId].chatPage = 0
                                let chats = DBState.db.characters[ChatState.selectedCharId].chats
                                chats.splice(i, 1)
                                DBState.db.characters[ChatState.selectedCharId].chats = chats

                                // Delete the separate chat file if it exists (non-account mode)
                                if (!forageStorage.isAccount && chaId && chatId) {
                                    try {
                                        await deleteFromWorker(`database/chats/${chaId}/${chatId}.bin`)
                                    } catch (e) {
                                        // File may not exist for old data, ignore error
                                    }
                                }
                            }
                        }}
                        onkeydown={() => {}}
                    >
                        <TrashIcon size={18} />
                    </div>
                </div>
            </button>
        {/each}
        <div class="mt-2 flex items-center">
            <button
                class="mr-1 cursor-pointer text-textcolor2 hover:text-green-500"
                onclick={() => {
                    const cha = DBState.db.characters[ChatState.selectedCharId]
                    const len = DBState.db.characters[ChatState.selectedCharId].chats.length
                    let chats = DBState.db.characters[ChatState.selectedCharId].chats
                    chats.unshift({
                        message: [],
                        note: "",
                        name: `New Chat ${len + 1}`,
                        localLore: [],
                        fmIndex: -1,
                        id: uuidv4(),
                    })
                    if (cha.type === "group") {
                        cha.characters.map((c) => {
                            chats[len].message.push({
                                saying: c,
                                role: "char",
                                data: findCharacterbyId(c).firstMessage,
                            })
                        })
                    }
                    DBState.db.characters[ChatState.selectedCharId].chats = chats
                    RenderState.guiReloadPointer += 1
                    DBState.db.characters[ChatState.selectedCharId].chatPage = len
                    close()
                }}
            >
                <PlusIcon />
            </button>
            <button
                class="mr-2 cursor-pointer text-textcolor2 hover:text-green-500"
                onclick={() => {
                    importChat()
                }}
            >
                <HardDriveUploadIcon size={18} />
            </button>
            <button
                class="cursor-pointer text-textcolor2 hover:text-green-500"
                onclick={() => {
                    editMode = !editMode
                }}
            >
                <EditIcon size={18} />
            </button>
        </div>
    </div>
</div>

<style>
    .break-any {
        word-break: normal;
        overflow-wrap: anywhere;
    }
</style>
