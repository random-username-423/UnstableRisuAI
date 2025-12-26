<script lang="ts">
    import { CheckCircle2Icon, Waypoints, XIcon } from "@lucide/svelte"
    import { language } from "src/lang"
    import Button from "src/lib/UI/GUI/Button.svelte"
    import TextInput from "src/lib/UI/GUI/TextInput.svelte"
    import type { RisuModule } from "src/ts/process/scripting/modules"

    import { DBState, RenderState, ChatState } from "src/ts/stores.svelte"
    import { SettingsState } from "src/ts/stores.svelte"

    interface Props {
        close?: any
        alertMode?: boolean
    }

    let { close = (i: string) => {}, alertMode = false }: Props = $props()
    let moduleSearch = $state("")

    function sortModules(modules: RisuModule[], search: string) {
        const db = DBState.db
        return modules
            .filter((v) => {
                if (search === "") return true
                return v.name.toLowerCase().includes(search.toLowerCase())
            })
            .sort((a, b) => {
                let score = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
                return score
            })
    }
</script>

<div class="absolute z-40 flex h-full w-full items-center justify-center bg-black bg-opacity-50">
    <div class="break-any flex max-h-full w-full max-w-3xl flex-col overflow-y-auto rounded-md bg-darkbg p-4">
        <div class="flex items-center text-textcolor">
            <h2 class="mb-0 mt-0 text-lg">{language.modules}</h2>
            <div class="flex flex-grow justify-end">
                <button
                    class="mr-2 cursor-pointer items-center text-textcolor2 hover:text-green-500"
                    onclick={() => {
                        close("")
                    }}
                >
                    <XIcon size={24} />
                </button>
            </div>
        </div>

        <span class="text-sm text-textcolor2">{language.chatModulesInfo}</span>

        <TextInput className="mt-4" placeholder={language.search} bind:value={moduleSearch} />

        <div class="contain mt-4 flex w-full max-w-full flex-col rounded-md border-1 border-selected">
            {#if DBState.db.modules.length === 0}
                <div class="p-3 text-textcolor2">{language.noModules}</div>
            {:else}
                {#each sortModules(DBState.db.modules, moduleSearch) as rmodule, i}
                    {#if i !== 0}
                        <div class="border-t-1 border-selected"></div>
                    {/if}
                    <div class="flex items-center py-3 pl-3 text-left">
                        {#if rmodule.mcp}
                            <Waypoints size={18} class="mr-2" />
                        {/if}
                        {#if !alertMode && DBState.db.enabledModules.includes(rmodule.id)}
                            <span class="text-textcolor2">{rmodule.name}</span>
                        {:else}
                            <span class="">{rmodule.name}</span>
                        {/if}
                        <div class="flex flex-grow justify-end">
                            {#if alertMode}
                                <button
                                    class="mr-2 cursor-pointer text-textcolor2 transition-colors hover:text-blue-500"
                                    onclick={async (e) => {
                                        e.stopPropagation()

                                        close(rmodule.id)
                                    }}
                                >
                                    <CheckCircle2Icon size={18} />
                                </button>
                            {:else if DBState.db.enabledModules.includes(rmodule.id)}
                                <button class="mr-2 cursor-not-allowed text-textcolor2" aria-labelledby="disabled">
                                </button>
                            {:else}
                                <button
                                    class={DBState.db.characters[ChatState.selectedCharId].chats[
                                        DBState.db.characters[ChatState.selectedCharId].chatPage
                                    ].modules.includes(rmodule.id)
                                        ? "mr-2 cursor-pointer text-blue-500"
                                        : DBState.db.characters[ChatState.selectedCharId]?.modules?.includes(rmodule.id)
                                          ? "mr-2 cursor-pointer text-violet-500"
                                          : "mr-2 cursor-pointer text-textcolor2 hover:text-blue-400"}
                                    onclick={async (e) => {
                                        e.stopPropagation()
                                        if (
                                            DBState.db.characters[ChatState.selectedCharId].chats[
                                                DBState.db.characters[ChatState.selectedCharId].chatPage
                                            ].modules.includes(rmodule.id)
                                        ) {
                                            DBState.db.characters[ChatState.selectedCharId].chats[
                                                DBState.db.characters[ChatState.selectedCharId].chatPage
                                            ].modules.splice(
                                                DBState.db.characters[ChatState.selectedCharId].chats[
                                                    DBState.db.characters[ChatState.selectedCharId].chatPage
                                                ].modules.indexOf(rmodule.id),
                                                1
                                            )
                                        } else {
                                            DBState.db.characters[ChatState.selectedCharId].chats[
                                                DBState.db.characters[ChatState.selectedCharId].chatPage
                                            ].modules.push(rmodule.id)
                                        }
                                        DBState.db.characters[ChatState.selectedCharId].chats[
                                            DBState.db.characters[ChatState.selectedCharId].chatPage
                                        ].modules =
                                            DBState.db.characters[ChatState.selectedCharId].chats[
                                                DBState.db.characters[ChatState.selectedCharId].chatPage
                                            ].modules
                                        RenderState.guiReloadPointer += 1
                                    }}
                                    oncontextmenu={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        if (!DBState.db.characters[ChatState.selectedCharId].modules) {
                                            DBState.db.characters[ChatState.selectedCharId].modules = []
                                        }
                                        if (
                                            DBState.db.characters[ChatState.selectedCharId].modules.includes(rmodule.id)
                                        ) {
                                            DBState.db.characters[ChatState.selectedCharId].modules.splice(
                                                DBState.db.characters[ChatState.selectedCharId].modules.indexOf(
                                                    rmodule.id
                                                ),
                                                1
                                            )
                                        } else {
                                            DBState.db.characters[ChatState.selectedCharId].modules.push(rmodule.id)
                                        }
                                        RenderState.guiReloadPointer += 1
                                    }}
                                >
                                    <CheckCircle2Icon size={18} />
                                </button>
                            {/if}
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
        <div>
            <Button
                className="mt-4 flex-grow-0"
                size="sm"
                onclick={() => {
                    SettingsState.menuIndex = 14
                    SettingsState.isOpen = true
                    close("")
                }}>{language.edit}</Button
            >
        </div>
    </div>
</div>

<style>
    .break-any {
        word-break: normal;
        overflow-wrap: anywhere;
    }
</style>
