<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { v4 } from "uuid"
    import Sortable from "sortablejs/modular/sortable.core.esm.js"
    import {
        DownloadIcon,
        PencilIcon,
        HardDriveUploadIcon,
        MenuIcon,
        TrashIcon,
        SplitIcon,
        FolderPlusIcon,
    } from "@lucide/svelte"

    import type { Chat, ChatFolder, character, groupChat } from "src/ts/data/storage/types"
    import { DBState, RenderState, ChatState } from "src/ts/stores.svelte"

    import CheckInput from "../UI/GUI/CheckInput.svelte"
    import Button from "../UI/GUI/Button.svelte"
    import TextInput from "../UI/GUI/TextInput.svelte"

    import { exportChat, importChat, exportAllChats } from "src/ts/character/characters.svelte"
    import {
        alertChatOptions,
        alertConfirm,
        alertError,
        alertNormal,
        alertSelect,
        alertStore,
    } from "src/ts/utils/alert.svelte"
    import { findCharacterbyId, sleep, sortableOptions } from "src/ts/utils/util"
    import { loadChat } from "src/ts/data/storage/chatStorage"
    import { createMultiuserRoom } from "src/ts/data/sync/multiuser.svelte"
    import { language } from "src/lang"
    import Toggles from "./Toggles.svelte"

    interface Props {
        chara: character | groupChat
    }

    let { chara = $bindable() }: Props = $props()
    let editMode = $state(false)

    let chatsStb: Sortable[] = []
    let folderStb: Sortable = null

    let folderEles: HTMLDivElement = $state()
    let listEle: HTMLDivElement = $state()
    let sorted = $state(0)
    let opened = 0

    // Lazy loading state - only render first N items, load more on scroll
    const INITIAL_LOAD = 60
    const LOAD_MORE = 20
    let loadedCount = $state(INITIAL_LOAD)

    // Get chats without folder
    let chatsWithoutFolder = $derived(chara.chats.filter((chat) => chat.folderId == null))
    let visibleChats = $derived(chatsWithoutFolder.slice(0, loadedCount))

    function handleScroll(e: Event) {
        const target = e.target as HTMLDivElement
        // Load more when near bottom
        if (target.scrollHeight - target.scrollTop - target.clientHeight < 100) {
            if (loadedCount < chatsWithoutFolder.length) {
                loadedCount = Math.min(loadedCount + LOAD_MORE, chatsWithoutFolder.length)
            }
        }
    }

    // Reset loaded count when chara changes
    $effect(() => {
        chara
        loadedCount = INITIAL_LOAD
    })

    // Load current chat when chatPage changes (lazy loading)
    $effect(() => {
        const currentChat = chara.chats?.[chara.chatPage]
        if (currentChat && currentChat.message === undefined) {
            // Chat not loaded yet, load it from file
            loadChat(chara.chaId, currentChat.id)
        }
    })

    const createStb = () => {
        for (let chat of listEle.querySelectorAll(".risu-chat")) {
            chatsStb.push(
                new Sortable(chat, {
                    group: "chats",
                    onEnd: async (event) => {
                        const currentChatPage = chara.chatPage
                        const newChats: Chat[] = []

                        // const chats: HTMLElement = event.to
                        // chats.querySelectorAll()

                        listEle.querySelectorAll("[data-risu-chat-folder-idx]").forEach((folder) => {
                            const folderIdx = parseInt(folder.getAttribute("data-risu-chat-folder-idx"))
                            folder.querySelectorAll("[data-risu-chat-idx]").forEach((chatInFolder) => {
                                const chatIdx = parseInt(chatInFolder.getAttribute("data-risu-chat-idx"))
                                const newChat = chara.chats[chatIdx]
                                newChat.folderId = chara.chatFolders[folderIdx].id
                                newChats.push(newChat)
                            })
                        })

                        listEle.querySelectorAll("[data-risu-chat-idx]").forEach((chatEle) => {
                            const idx = parseInt(chatEle.getAttribute("data-risu-chat-idx"))
                            const newChat = chara.chats[idx]
                            if (newChats.includes(newChat) == false) {
                                if (newChat.folderId != null) newChat.folderId = null
                                newChats.push(newChat)
                            }
                        })

                        chara.chatPage = newChats.indexOf(chara.chats[currentChatPage])
                        chara.chats = newChats

                        try {
                            this.destroy()
                        } catch (e) {}
                        sorted += 1
                        await sleep(1)
                        createStb()
                    },
                    ...sortableOptions,
                })
            )
        }
        folderStb = Sortable.create(folderEles, {
            group: "folders",
            onEnd: async (event) => {
                const newFolders: ChatFolder[] = []
                const newChats: Chat[] = []
                const folders: HTMLElement[] = Array.from<HTMLElement>(event.to.children)

                const currentChatPage = chara.chatPage

                folders.forEach((folder) => {
                    const folderIdx = parseInt(folder.getAttribute("data-risu-chat-folder-idx"))
                    newFolders.push(chara.chatFolders[folderIdx])

                    folder.querySelectorAll("[data-risu-chat-idx]").forEach((chatEle) => {
                        const idx = parseInt(chatEle.getAttribute("data-risu-chat-idx"))
                        newChats.push(chara.chats[idx])
                    })
                })

                listEle.querySelectorAll("[data-risu-chat-idx]").forEach((chatEle) => {
                    const idx = parseInt(chatEle.getAttribute("data-risu-chat-idx"))
                    if (newChats.includes(chara.chats[idx]) == false) {
                        newChats.push(chara.chats[idx])
                    }
                })

                chara.chatFolders = newFolders
                chara.chatPage = newChats.indexOf(chara.chats[currentChatPage])
                chara.chats = newChats
                try {
                    folderStb.destroy()
                } catch (e) {}
                sorted += 1
                await sleep(1)
                createStb()
            },
            ...sortableOptions,
        })
    }

    onMount(createStb)

    onDestroy(() => {
        if (folderStb) {
            try {
                folderStb.destroy()
            } catch (error) {}
        }
        chatsStb.map((stb) => {
            try {
                stb.destroy()
            } catch (error) {}
        })
    })
</script>

<div class="flex h-full w-full flex-col">
    <!-- 상단 고정 영역: 새 채팅 버튼 -->
    <div class="w-full flex-shrink-0">
        <Button
            className="w-full"
            onclick={() => {
                const cha = chara
                const len = chara.chats.length
                let chats = chara.chats
                chats.unshift({
                    message: [],
                    note: "",
                    name: `New Chat ${len + 1}`,
                    localLore: [],
                    fmIndex: -1,
                    id: v4(),
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
                chara.chats = chats
                chara.chatPage = 0
                RenderState.guiReloadPointer += 1
            }}>{language.newChat}</Button
        >
    </div>

    <!-- 중간 가변 영역: 채팅 목록 (스크롤) -->
    {#key sorted}
        <div class="mt-2 flex min-h-0 flex-grow flex-col overflow-y-auto" bind:this={listEle} onscroll={handleScroll}>
            <!-- folder div -->
            <div class="flex flex-col" bind:this={folderEles}>
                <!-- chat folder -->
                {#each chara.chatFolders as folder, i}
                    <div
                        data-risu-chat-folder-idx={i}
                        class="mb-2 flex cursor-pointer flex-col rounded-md border-1 border-solid border-darkborderc"
                    >
                        <!-- folder header -->
                        <button
                            onclick={() => {
                                if (!editMode) {
                                    chara.chatFolders[i].folded = !folder.folded
                                    RenderState.guiReloadPointer += 1
                                }
                            }}
                            class="flex cursor-pointer items-center rounded-md border-0 border-solid border-darkborderc p-2 text-textcolor"
                            class:bg-red-900={folder.color === "red"}
                            class:bg-yellow-900={folder.color === "yellow"}
                            class:bg-green-900={folder.color === "green"}
                            class:bg-blue-900={folder.color === "blue"}
                            class:bg-indigo-900={folder.color === "indigo"}
                            class:bg-purple-900={folder.color === "purple"}
                            class:bg-pink-900={folder.color === "pink"}
                        >
                            {#if editMode}
                                <TextInput
                                    bind:value={chara.chatFolders[i].name}
                                    className="flex-grow min-w-0"
                                    padding={false}
                                />
                            {:else}
                                <span>{folder.name}</span>
                            {/if}
                            <div class="flex flex-grow justify-end">
                                <div
                                    role="button"
                                    tabindex="0"
                                    onkeydown={(e) => {
                                        if (e.key === "Enter") {
                                            e.currentTarget.click()
                                        }
                                    }}
                                    class="mr-1 cursor-pointer text-textcolor2 hover:text-green-500"
                                    onclick={async (e) => {
                                        e.stopPropagation()
                                        const sel = parseInt(
                                            await alertSelect([language.changeFolderColor, language.cancel])
                                        )
                                        switch (sel) {
                                            case 0: {
                                                const colors = [
                                                    "red",
                                                    "green",
                                                    "blue",
                                                    "yellow",
                                                    "indigo",
                                                    "purple",
                                                    "pink",
                                                    "default",
                                                ]
                                                const sel = parseInt(await alertSelect(colors))
                                                folder.color = colors[sel]
                                                break
                                            }
                                        }
                                    }}
                                >
                                    <MenuIcon size={18} />
                                </div>
                                <div
                                    role="button"
                                    tabindex="0"
                                    onkeydown={(e) => {
                                        if (e.key === "Enter") {
                                            e.currentTarget.click()
                                        }
                                    }}
                                    class="mr-1 cursor-pointer text-textcolor2 hover:text-green-500"
                                    onclick={() => {
                                        editMode = !editMode
                                    }}
                                >
                                    <PencilIcon size={18} />
                                </div>
                                <div
                                    role="button"
                                    tabindex="0"
                                    onkeydown={(e) => {
                                        if (e.key === "Enter") {
                                            e.currentTarget.click()
                                        }
                                    }}
                                    class="cursor-pointer text-textcolor2 hover:text-green-500"
                                    onclick={async (e) => {
                                        e.stopPropagation()
                                        const d = await alertConfirm(`${language.removeConfirm}${folder.name}`)
                                        if (d) {
                                            RenderState.guiReloadPointer += 1
                                            const folders = chara.chatFolders
                                            folders.splice(i, 1)
                                            chara.chats.forEach((chat) => {
                                                if (chat.folderId == folder.id) {
                                                    chat.folderId = null
                                                }
                                            })
                                            chara.chatFolders = folders
                                        }
                                    }}
                                >
                                    <TrashIcon size={18} />
                                </div>
                            </div>
                        </button>
                        <!-- chats in folder -->
                        <div
                            class="risu-chat flex w-full cursor-pointer flex-col rounded-md border-0 border-solid border-darkborderc p-2 text-textcolor {folder.folded
                                ? 'hidden'
                                : ''}"
                        >
                            {#if chara.chats.filter((chat) => chat.folderId == chara.chatFolders[i].id).length == 0}
                                <span class="no-sort flex justify-center text-textcolor2">Empty</span>
                                <div></div>
                            {:else}
                                {#each chara.chats.filter((chat) => chat.folderId == chara.chatFolders[i].id) as chat}
                                    <button
                                        data-risu-chat-idx={chara.chats.indexOf(chat)}
                                        onclick={async () => {
                                            if (!editMode) {
                                                const chatIndex = chara.chats.indexOf(chat)
                                                const targetChat = chara.chats[chatIndex]
                                                // Load chat data before switching
                                                if (targetChat && targetChat.message === undefined) {
                                                    await loadChat(chara.chaId, targetChat.id)
                                                }
                                                chara.chatPage = chatIndex
                                                RenderState.guiReloadPointer += 1
                                            }
                                        }}
                                        class="risu-chats flex cursor-pointer items-center rounded-md border-0 border-solid border-darkborderc p-2 text-textcolor"
                                        class:bg-selected={chara.chats.indexOf(chat) === chara.chatPage}
                                    >
                                        {#if editMode}
                                            <TextInput
                                                bind:value={chat.name}
                                                className="flex-grow min-w-0"
                                                padding={false}
                                            />
                                        {:else}
                                            <span>{chat.name}</span>
                                        {/if}
                                        <div class="flex flex-grow justify-end">
                                            <div
                                                role="button"
                                                tabindex="0"
                                                onkeydown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.currentTarget.click()
                                                    }
                                                }}
                                                class="mr-1 cursor-pointer text-textcolor2 hover:text-green-500"
                                                onclick={async () => {
                                                    const option = await alertChatOptions()
                                                    switch (option) {
                                                        case 0: {
                                                            const newChat = $state.snapshot(
                                                                chara.chats[chara.chats.indexOf(chat)]
                                                            )
                                                            newChat.name = `Copy of ${newChat.name}`
                                                            newChat.id = v4()
                                                            chara.chats.unshift(newChat)
                                                            chara.chatPage = 0
                                                            chara.chats = chara.chats
                                                            break
                                                        }
                                                        case 1: {
                                                            if (chat.bindedPersona) {
                                                                const confirm = await alertConfirm(
                                                                    language.doYouWantToUnbindCurrentPersona
                                                                )
                                                                if (confirm) {
                                                                    chat.bindedPersona = ""
                                                                    alertNormal(language.personaUnbindedSuccess)
                                                                }
                                                            } else {
                                                                const confirm = await alertConfirm(
                                                                    language.doYouWantToBindCurrentPersona
                                                                )
                                                                if (confirm) {
                                                                    if (
                                                                        !DBState.db.personas[DBState.db.selectedPersona]
                                                                            .id
                                                                    ) {
                                                                        DBState.db.personas[
                                                                            DBState.db.selectedPersona
                                                                        ].id = v4()
                                                                    }
                                                                    chat.bindedPersona =
                                                                        DBState.db.personas[
                                                                            DBState.db.selectedPersona
                                                                        ].id
                                                                    console.log(
                                                                        DBState.db.personas[DBState.db.selectedPersona]
                                                                    )
                                                                    alertNormal(language.personaBindedSuccess)
                                                                }
                                                            }
                                                            break
                                                        }
                                                        case 2: {
                                                            chara.chatPage = chara.chats.indexOf(chat)
                                                            createMultiuserRoom()
                                                        }
                                                    }
                                                }}
                                            >
                                                <MenuIcon size={18} />
                                            </div>
                                            <div
                                                role="button"
                                                tabindex="0"
                                                onkeydown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.currentTarget.click()
                                                    }
                                                }}
                                                class="mr-1 cursor-pointer text-textcolor2 hover:text-green-500"
                                                onclick={() => {
                                                    editMode = !editMode
                                                }}
                                            >
                                                <PencilIcon size={18} />
                                            </div>
                                            <div
                                                role="button"
                                                tabindex="0"
                                                onkeydown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.currentTarget.click()
                                                    }
                                                }}
                                                class="mr-1 cursor-pointer text-textcolor2 hover:text-green-500"
                                                onclick={async (e) => {
                                                    e.stopPropagation()
                                                    exportChat(chara.chats.indexOf(chat))
                                                }}
                                            >
                                                <DownloadIcon size={18} />
                                            </div>
                                            <div
                                                role="button"
                                                tabindex="0"
                                                onkeydown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.currentTarget.click()
                                                    }
                                                }}
                                                class="cursor-pointer text-textcolor2 hover:text-green-500"
                                                onclick={async (e) => {
                                                    e.stopPropagation()
                                                    if (chara.chats.length === 1) {
                                                        alertError(language.errors.onlyOneChat)
                                                        return
                                                    }
                                                    const d = await alertConfirm(
                                                        `${language.removeConfirm}${chat.name}`
                                                    )
                                                    if (d) {
                                                        chara.chatPage = 0
                                                        RenderState.guiReloadPointer += 1
                                                        let chats = chara.chats
                                                        chats.splice(chara.chats.indexOf(chat), 1)
                                                        chara.chats = chats
                                                    }
                                                }}
                                            >
                                                <TrashIcon size={18} />
                                            </div>
                                        </div>
                                    </button>
                                {/each}
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
            <!-- chat without folder div - Lazy Loading -->
            <div class="risu-chat flex flex-col">
                {#each visibleChats as chat, idx}
                    {@const originalIndex = chara.chats.indexOf(chat)}
                    <button
                        data-risu-chat-idx={originalIndex}
                        onclick={async () => {
                            if (!editMode) {
                                const targetChat = chara.chats[originalIndex]
                                // Load chat data before switching
                                if (targetChat && targetChat.message === undefined) {
                                    await loadChat(chara.chaId, targetChat.id)
                                }
                                chara.chatPage = originalIndex
                                RenderState.guiReloadPointer += 1
                            }
                        }}
                        class="flex cursor-pointer items-center rounded-md border-0 border-solid border-darkborderc p-2 text-textcolor"
                        class:bg-selected={originalIndex === chara.chatPage}
                    >
                        {#if editMode}
                            <TextInput
                                bind:value={chara.chats[originalIndex].name}
                                className="flex-grow min-w-0"
                                padding={false}
                            />
                        {:else}
                            <span class="line-clamp-2 flex-grow">{chat.name}</span>
                        {/if}
                        <div class="flex flex-shrink-0 justify-end">
                            <div
                                role="button"
                                tabindex="0"
                                onkeydown={(e) => {
                                    if (e.key === "Enter") {
                                        e.currentTarget.click()
                                    }
                                }}
                                class="mr-1 cursor-pointer text-textcolor2 hover:text-green-500"
                                onclick={async () => {
                                    const option = await alertChatOptions()
                                    switch (option) {
                                        case 0: {
                                            const newChat = $state.snapshot(chara.chats[originalIndex])
                                            newChat.name = `Copy of ${newChat.name}`
                                            newChat.id = v4()
                                            chara.chats.unshift(newChat)
                                            chara.chatPage = 0
                                            chara.chats = chara.chats
                                            break
                                        }
                                        case 1: {
                                            const chat = chara.chats[originalIndex]
                                            if (chat.bindedPersona) {
                                                const confirm = await alertConfirm(
                                                    language.doYouWantToUnbindCurrentPersona
                                                )
                                                if (confirm) {
                                                    chat.bindedPersona = ""
                                                    alertNormal(language.personaUnbindedSuccess)
                                                }
                                            } else {
                                                const confirm = await alertConfirm(
                                                    language.doYouWantToBindCurrentPersona
                                                )
                                                if (confirm) {
                                                    if (!DBState.db.personas[DBState.db.selectedPersona].id) {
                                                        DBState.db.personas[DBState.db.selectedPersona].id = v4()
                                                    }
                                                    chat.bindedPersona =
                                                        DBState.db.personas[DBState.db.selectedPersona].id
                                                    console.log(DBState.db.personas[DBState.db.selectedPersona])
                                                    alertNormal(language.personaBindedSuccess)
                                                }
                                            }
                                            break
                                        }
                                        case 2: {
                                            chara.chatPage = originalIndex
                                            createMultiuserRoom()
                                        }
                                    }
                                }}
                            >
                                <MenuIcon size={18} />
                            </div>
                            <div
                                role="button"
                                tabindex="0"
                                onkeydown={(e) => {
                                    if (e.key === "Enter") {
                                        e.currentTarget.click()
                                    }
                                }}
                                class="mr-1 cursor-pointer text-textcolor2 hover:text-green-500"
                                onclick={() => {
                                    editMode = !editMode
                                }}
                            >
                                <PencilIcon size={18} />
                            </div>
                            <div
                                role="button"
                                tabindex="0"
                                onkeydown={(e) => {
                                    if (e.key === "Enter") {
                                        e.currentTarget.click()
                                    }
                                }}
                                class="mr-1 cursor-pointer text-textcolor2 hover:text-green-500"
                                onclick={async (e) => {
                                    e.stopPropagation()
                                    exportChat(originalIndex)
                                }}
                            >
                                <DownloadIcon size={18} />
                            </div>
                            <div
                                role="button"
                                tabindex="0"
                                onkeydown={(e) => {
                                    if (e.key === "Enter") {
                                        e.currentTarget.click()
                                    }
                                }}
                                class="cursor-pointer text-textcolor2 hover:text-green-500"
                                onclick={async (e) => {
                                    e.stopPropagation()
                                    if (chara.chats.length === 1) {
                                        alertError(language.errors.onlyOneChat)
                                        return
                                    }
                                    const d = await alertConfirm(`${language.removeConfirm}${chat.name}`)
                                    if (d) {
                                        chara.chatPage = 0
                                        RenderState.guiReloadPointer += 1
                                        let chats = chara.chats
                                        chats.splice(originalIndex, 1)
                                        chara.chats = chats
                                    }
                                }}
                            >
                                <TrashIcon size={18} />
                            </div>
                        </div>
                    </button>
                {/each}
            </div>
        </div>
    {/key}

    <!-- 하단 고정 영역: 버튼들 + 토글 -->
    <div class="mt-2 flex-shrink-0 border-t border-selected">
        <div class="ml-2 mt-2 flex items-center">
            <button
                class="mr-2 cursor-pointer text-textcolor2 hover:text-green-500"
                onclick={() => {
                    exportAllChats()
                }}
            >
                <DownloadIcon size={18} />
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
                class="mr-2 cursor-pointer text-textcolor2 hover:text-green-500"
                onclick={() => {
                    editMode = !editMode
                }}
            >
                <PencilIcon size={18} />
            </button>
            <button
                class="cursor-pointer text-textcolor2 hover:text-green-500"
                onclick={() => {
                    alertStore.set({
                        type: "branches",
                        msg: "",
                    })
                }}
            >
                <SplitIcon size={18} />
            </button>
            <button
                class="ml-auto mr-2 cursor-pointer text-textcolor2 hover:text-green-500"
                onclick={() => {
                    if (!chara.chatFolders) {
                        chara.chatFolders = []
                    }
                    const folders = chara.chatFolders
                    const length = chara.chatFolders.length
                    folders.unshift({
                        id: v4(),
                        name: `New Folder ${length + 1}`,
                        folded: false,
                    })
                    chara.chatFolders = folders
                    RenderState.guiReloadPointer += 1
                }}
            >
                <FolderPlusIcon size={18} />
            </button>
        </div>

        {#if DBState.db.characters[ChatState.selectedCharId]?.chaId !== "§playground"}
            <Toggles bind:chara />
        {/if}
        {#if chara.type === "group"}
            <div class="mt-2 flex items-center">
                <CheckInput bind:check={chara.orderByOrder} name={language.orderByOrder} />
            </div>
        {/if}
    </div>
</div>
