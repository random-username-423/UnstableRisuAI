<script>
    import { alertConfirm, alertError } from "../../ts/utils/alert"
    import { language } from "../../lang"
    import { v4 as uuidv4 } from "uuid"

    import { DBState } from "src/ts/stores.svelte"
    import { ReloadGUIPointer, selectedCharID } from "../../ts/stores.svelte"
    import { DownloadIcon, EditIcon, HardDriveUploadIcon, PlusIcon, TrashIcon, XIcon } from "lucide-svelte"
    import { exportChat, importChat } from "../../ts/character/characters"
    import { findCharacterbyId } from "../../ts/utils/util"
    import TextInput from "../UI/GUI/TextInput.svelte"
    import { forageStorage } from "./autoStorage"
    import { loadChat } from "src/ts/data/storage/chatStorage"
    import { deleteFromWorker } from "../../ts/data/storage/opfsWorkerClient.svelte"

    let editMode = $state(false)
    /** @type {{close?: any}} */
    let { close = () => {} } = $props()
</script>

<div class="absolute w-full h-full z-40 bg-black bg-opacity-50 flex justify-center items-center">
    <div class="bg-darkbg p-4 break-any rounded-md flex flex-col max-w-3xl w-72 max-h-full overflow-y-auto">
        <div class="flex items-center text-textcolor mb-4">
            <h2 class="mt-0 mb-0">{language.chatList}</h2>
            <div class="flex-grow flex justify-end">
                <button class="text-textcolor2 hover:text-green-500 mr-2 cursor-pointer items-center" onclick={close}>
                    <XIcon size={24} />
                </button>
            </div>
        </div>
        {#each DBState.db.characters[$selectedCharID].chats as chat, i}
            <button
                onclick={async () => {
                    if (!editMode) {
                        const char = DBState.db.characters[$selectedCharID]
                        const targetChat = char.chats[i]
                        // Load chat data before switching
                        if (targetChat && targetChat.message === undefined) {
                            await loadChat(char.chaId, targetChat.id)
                        }
                        DBState.db.characters[$selectedCharID].chatPage = i
                        close()
                    }
                }}
                class="flex items-center text-textcolor border-t-1 border-solid border-0 border-darkborderc p-2 cursor-pointer"
                class:bg-selected={i === DBState.db.characters[$selectedCharID].chatPage}
            >
                {#if editMode}
                    <TextInput bind:value={DBState.db.characters[$selectedCharID].chats[i].name} padding={false} />
                {:else}
                    <span>{chat.name}</span>
                {/if}
                <div class="flex-grow flex justify-end">
                    <div
                        class="text-textcolor2 hover:text-green-500 mr-2 cursor-pointer"
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
                        class="text-textcolor2 hover:text-green-500 cursor-pointer"
                        role="button"
                        tabindex="0"
                        onclick={async (e) => {
                            e.stopPropagation()
                            if (DBState.db.characters[$selectedCharID].chats.length === 1) {
                                alertError(language.errors.onlyOneChat)
                                return
                            }
                            const d = await alertConfirm(`${language.removeConfirm}${chat.name}`)
                            if (d) {
                                // Get chat info before deletion for file cleanup
                                const chaId = DBState.db.characters[$selectedCharID].chaId
                                const chatId = chat.id

                                DBState.db.characters[$selectedCharID].chatPage = 0
                                let chats = DBState.db.characters[$selectedCharID].chats
                                chats.splice(i, 1)
                                DBState.db.characters[$selectedCharID].chats = chats

                                // Delete the separate chat file if it exists (non-account mode)
                                if (!forageStorage.isAccount && chaId && chatId) {
                                    try {
                                        await deleteFromWorker(`database/chats/${chaId}_${chatId}.bin`)
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
        <div class="flex mt-2 items-center">
            <button
                class="text-textcolor2 hover:text-green-500 cursor-pointer mr-1"
                onclick={() => {
                    const cha = DBState.db.characters[$selectedCharID]
                    const len = DBState.db.characters[$selectedCharID].chats.length
                    let chats = DBState.db.characters[$selectedCharID].chats
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
                    DBState.db.characters[$selectedCharID].chats = chats
                    $ReloadGUIPointer += 1
                    DBState.db.characters[$selectedCharID].chatPage = len
                    close()
                }}
            >
                <PlusIcon />
            </button>
            <button
                class="text-textcolor2 hover:text-green-500 mr-2 cursor-pointer"
                onclick={() => {
                    importChat()
                }}
            >
                <HardDriveUploadIcon size={18} />
            </button>
            <button
                class="text-textcolor2 hover:text-green-500 cursor-pointer"
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
