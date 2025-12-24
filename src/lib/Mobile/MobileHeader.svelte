<script lang="ts">
    import { ArrowLeft, MenuIcon } from "lucide-svelte"
    import { language } from "src/lang"

    import { DBState, MobileState, ChatState, SettingsState } from "src/ts/stores.svelte"
</script>

<div class="flex h-16 w-full items-center justify-start gap-2 border-b border-b-darkborderc bg-darkbg px-4">
    {#if ChatState.selectedCharId !== -1 && MobileState.sideBarMenu > 0}
        <button
            onclick={() => {
                MobileState.sideBarMenu = 0
            }}
        >
            <ArrowLeft />
        </button>
        <span class="w-2/3 truncate text-lg font-bold">{language.menu}</span>
    {:else if ChatState.selectedCharId !== -1}
        <button
            onclick={() => {
                ChatState.selectedCharId = -1
            }}
        >
            <ArrowLeft />
        </button>
        <span class="w-2/3 truncate text-lg font-bold">{DBState.db.characters[ChatState.selectedCharId].name}</span>
        <div class="flex flex-1 justify-end">
            <button
                onclick={() => {
                    MobileState.sideBarMenu = 1
                }}
            >
                <MenuIcon />
            </button>
        </div>
    {:else if MobileState.currentStack === 2 && SettingsState.menuIndex > -1}
        <button
            onclick={() => {
                SettingsState.menuIndex = -1
            }}
        >
            <ArrowLeft />
        </button>
        <span class="text-lg font-bold">UnstableRisuAI</span>
    {:else if MobileState.currentStack === 1}
        <div class="flex w-2xl max-w-full items-stretch">
            <input
                placeholder={language.search + "..."}
                bind:value={MobileState.search}
                class="input-text peer mx-4 min-w-0 max-w-full flex-grow resize-none overflow-x-hidden overflow-y-hidden rounded-md border border-darkborderc bg-transparent p-2 text-xl text-textcolor outline-none transition-colors focus:border-textcolor"
            />
        </div>
    {:else}
        <span class="text-lg font-bold">UnstableRisuAI</span>
    {/if}
</div>
