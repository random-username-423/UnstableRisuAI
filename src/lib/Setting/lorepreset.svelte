<script>
    import { alertConfirm } from "../../ts/utils/alert.svelte"
    import { language } from "../../lang"

    import { DBState } from "src/ts/stores.svelte"
    import { EditIcon, PlusIcon, TrashIcon, XIcon } from "@lucide/svelte"
    import TextInput from "../UI/GUI/TextInput.svelte"
    let editMode = $state(false)
    /** @type {{close?: any}} */
    let { close = () => {} } = $props()
</script>

<div class="absolute z-40 flex h-full w-full items-center justify-center bg-black bg-opacity-50">
    <div class="break-any flex max-h-full w-96 max-w-3xl flex-col overflow-y-auto rounded-md bg-darkbg p-4">
        <div class="mb-4 flex items-center text-textcolor">
            <h2 class="mb-0 mt-0">{language.loreBook}</h2>
            <div class="flex flex-grow justify-end">
                <button class="mr-2 cursor-pointer items-center text-textcolor2 hover:text-green-500" onclick={close}>
                    <XIcon size={24} />
                </button>
            </div>
        </div>
        {#each DBState.db.loreBook as lore, ind}
            <button
                onclick={() => {
                    if (!editMode) {
                        DBState.db.loreBookPage = ind
                    }
                }}
                class="flex cursor-pointer items-center border-0 border-t-1 border-solid border-darkborderc p-2 text-textcolor"
                class:bg-selected={ind === DBState.db.loreBookPage}
            >
                {#if editMode}
                    <TextInput bind:value={DBState.db.loreBook[ind].name} placeholder="string" padding={false} />
                {:else}
                    <span>{lore.name}</span>
                {/if}
                <div class="flex flex-grow justify-end">
                    <div
                        class="cursor-pointer text-textcolor2 hover:text-green-500"
                        role="button"
                        tabindex="0"
                        onclick={async (e) => {
                            e.stopPropagation()
                            if (DBState.db.loreBook.length === 1) {
                                return
                            }
                            const d = await alertConfirm(`${language.removeConfirm}${lore.name}`)
                            if (d) {
                                DBState.db.loreBookPage = 0
                                let loreBook = DBState.db.loreBook
                                loreBook.splice(ind, 1)
                                DBState.db.loreBook = loreBook
                            }
                        }}
                        onkeydown={(e) => {
                            if (e.key === "Enter") {
                                e.currentTarget.click()
                            }
                        }}
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
                    let loreBooks = DBState.db.loreBook
                    let newLoreBook = {
                        name: `New LoreBook`,
                        data: [],
                    }
                    loreBooks.push(newLoreBook)

                    DBState.db.loreBook = loreBooks
                }}
            >
                <PlusIcon />
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
