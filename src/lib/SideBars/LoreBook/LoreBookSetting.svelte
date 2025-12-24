<script lang="ts">
    import { DBState, ChatState } from "src/ts/stores.svelte"
    import { language } from "../../../lang"
    import { DownloadIcon, HardDriveUploadIcon, PlusIcon, SunIcon, LinkIcon, FolderPlusIcon } from "lucide-svelte"
    import {
        addLorebook,
        addLorebookFolder,
        exportLoreBook,
        importLoreBook,
    } from "src/ts/process/prompt/lorebook.svelte"
    import Check from "../../UI/GUI/CheckInput.svelte"
    import NumberInput from "../../UI/GUI/NumberInput.svelte"
    import LoreBookList from "./LoreBookList.svelte"
    import Help from "src/lib/Others/Help.svelte"

    let submenu = $state(0)
    interface Props {
        globalMode?: boolean
    }

    let { globalMode = $bindable(false) }: Props = $props()

    function isAllCharacterLoreAlwaysActive() {
        const globalLore = DBState.db.characters[ChatState.selectedCharId].globalLore
        return globalLore && globalLore.every((book) => book.alwaysActive)
    }

    function isAllChatLoreAlwaysActive() {
        const localLore =
            DBState.db.characters[ChatState.selectedCharId].chats[
                DBState.db.characters[ChatState.selectedCharId].chatPage
            ].localLore
        return localLore && localLore.every((book) => book.alwaysActive)
    }

    function toggleCharacterLoreAlwaysActive() {
        const globalLore = DBState.db.characters[ChatState.selectedCharId].globalLore

        if (!globalLore) return

        const allActive = globalLore.every((book) => book.alwaysActive)

        globalLore.forEach((book) => {
            book.alwaysActive = !allActive
        })
    }

    function toggleChatLoreAlwaysActive() {
        const localLore =
            DBState.db.characters[ChatState.selectedCharId].chats[
                DBState.db.characters[ChatState.selectedCharId].chatPage
            ].localLore

        if (!localLore) return

        const allActive = localLore.every((book) => book.alwaysActive)

        localLore.forEach((book) => {
            book.alwaysActive = !allActive
        })
    }
</script>

{#if !globalMode}
    <div class="flex w-full rounded-md border border-selected">
        <button
            onclick={() => {
                submenu = 0
            }}
            class="flex-1 p-2"
            class:bg-selected={submenu === 0}
        >
            <span
                >{DBState.db.characters[ChatState.selectedCharId].type === "group"
                    ? language.group
                    : language.character}</span
            >
        </button>
        <button
            onclick={() => {
                submenu = 1
            }}
            class="p2 flex-1 border-l border-r border-selected"
            class:bg-selected={submenu === 1}
        >
            <span>{language.Chat}</span>
        </button>
        <button
            onclick={() => {
                submenu = 2
            }}
            class="flex-1 p-2"
            class:bg-selected={submenu === 2}
        >
            <span>{language.settings}</span>
        </button>
    </div>
{/if}
{#if submenu !== 2}
    {#if !globalMode}
        <div class="mb-4 mt-4 text-sm text-textcolor2">
            {submenu === 0
                ? DBState.db.characters[ChatState.selectedCharId].type === "group"
                    ? language.groupLoreInfo
                    : language.globalLoreInfo
                : language.localLoreInfo}
        </div>
    {/if}
    <LoreBookList
        {globalMode}
        {submenu}
        lorePlus={!globalMode && DBState.db.characters[ChatState.selectedCharId]?.lorePlus}
    />
{:else}
    {#if DBState.db.characters[ChatState.selectedCharId].loreSettings}
        <div class="mt-4 flex items-center">
            <Check
                check={false}
                onChange={() => {
                    DBState.db.characters[ChatState.selectedCharId].loreSettings = undefined
                }}
                name={language.useGlobalSettings}
            />
        </div>
        <div class="mt-4 flex items-center">
            <Check
                bind:check={DBState.db.characters[ChatState.selectedCharId].loreSettings.recursiveScanning}
                name={language.recursiveScanning}
            />
        </div>
        <div class="mt-4 flex items-center">
            <Check
                bind:check={DBState.db.characters[ChatState.selectedCharId].loreSettings.fullWordMatching}
                name={language.fullWordMatching}
            />
        </div>
        <span class="mb-2 mt-4 text-textcolor">{language.loreBookDepth}</span>
        <NumberInput
            size="sm"
            min={0}
            max={20}
            bind:value={DBState.db.characters[ChatState.selectedCharId].loreSettings.scanDepth}
        />
        <span class="text-textcolor">{language.loreBookToken}</span>
        <NumberInput
            size="sm"
            min={0}
            max={4096}
            bind:value={DBState.db.characters[ChatState.selectedCharId].loreSettings.tokenBudget}
        />
    {:else}
        <div class="mt-4 flex items-center">
            <Check
                check={true}
                onChange={() => {
                    DBState.db.characters[ChatState.selectedCharId].loreSettings = {
                        tokenBudget: DBState.db.loreBookToken,
                        scanDepth: DBState.db.loreBookDepth,
                        recursiveScanning: false,
                    }
                }}
                name={language.useGlobalSettings}
            />
        </div>
    {/if}
    <div class="mt-4 flex items-center">
        {#if DBState.db.useExperimental}
            <Check bind:check={DBState.db.characters[ChatState.selectedCharId].lorePlus} name={language.lorePlus}
                ><Help key="lorePlus"></Help><Help key="experimental"></Help></Check
            >
        {/if}
    </div>
{/if}
{#if submenu !== 2}
    <div class="mt-2 flex text-textcolor2">
        <button
            onclick={() => {
                addLorebook(globalMode ? -1 : submenu)
            }}
            class="cursor-pointer hover:text-textcolor"
        >
            <PlusIcon />
        </button>
        <button
            onclick={() => {
                exportLoreBook(globalMode ? "sglobal" : submenu === 0 ? "global" : "local")
            }}
            class="ml-1 cursor-pointer hover:text-textcolor"
        >
            <DownloadIcon />
        </button>
        <button
            onclick={() => {
                addLorebookFolder(globalMode ? -1 : submenu)
            }}
            class="ml-2 cursor-pointer hover:text-textcolor"
        >
            <FolderPlusIcon />
        </button>
        <button
            onclick={() => {
                importLoreBook(globalMode ? "sglobal" : submenu === 0 ? "global" : "local")
            }}
            class="ml-2 cursor-pointer hover:text-textcolor"
        >
            <HardDriveUploadIcon />
        </button>
        {#if DBState.db.bulkEnabling}
            <button
                onclick={() => {
                    toggleCharacterLoreAlwaysActive()
                }}
                class="ml-2 flex cursor-pointer items-center gap-1 hover:text-textcolor"
            >
                {#if isAllCharacterLoreAlwaysActive()}
                    <SunIcon />
                {:else}
                    <LinkIcon />
                {/if}
                <span class="text-xs">CHAR</span>
            </button>
            <button
                onclick={() => {
                    toggleChatLoreAlwaysActive()
                }}
                class="ml-2 flex cursor-pointer items-center gap-1 hover:text-textcolor"
            >
                {#if isAllChatLoreAlwaysActive()}
                    <SunIcon />
                {:else}
                    <LinkIcon />
                {/if}
                <span class="text-xs">CHAT</span>
            </button>
        {/if}
    </div>
{/if}
