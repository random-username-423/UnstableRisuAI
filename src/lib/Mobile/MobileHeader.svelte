<script lang="ts">
    import { ArrowLeft, MenuIcon } from "lucide-svelte";
    import { language } from "src/lang";
    
    import { DBState, MobileState, ChatState, SettingsState } from 'src/ts/stores.svelte';

</script>
<div class="w-full px-4 h-16 border-b border-b-darkborderc bg-darkbg flex justify-start items-center gap-2">
    {#if ChatState.selectedCharId !== -1 && MobileState.sideBarMenu > 0}
        <button onclick={() => {
            MobileState.sideBarMenu = 0
        }}>
            <ArrowLeft />
        </button>
        <span class="font-bold text-lg w-2/3 truncate">{language.menu}</span>
    {:else if ChatState.selectedCharId !== -1}
        <button onclick={() => {
            ChatState.selectedCharId = -1
        }}>
            <ArrowLeft />
        </button>
        <span class="font-bold text-lg w-2/3 truncate">{DBState.db.characters[ChatState.selectedCharId].name}</span>
        <div class="flex-1 flex justify-end">
            <button onclick={() => {
                MobileState.sideBarMenu = 1
            }}>
                <MenuIcon />
            </button>
        </div>
    {:else if MobileState.currentStack === 2 && SettingsState.menuIndex > -1}
        <button onclick={() => {
            SettingsState.menuIndex = -1
        }}>
            <ArrowLeft />
        </button>
        <span class="font-bold text-lg">UnstableRisuAI</span>
    {:else if MobileState.currentStack === 1}
        <div class="flex items-stretch w-2xl max-w-full">
            <input placeholder={language.search + '...'} bind:value={MobileState.search} class="peer focus:border-textcolor transition-colors outline-none text-textcolor p-2 min-w-0 border bg-transparent rounded-md input-text text-xl flex-grow mx-4 border-darkborderc resize-none overflow-y-hidden overflow-x-hidden max-w-full">
        </div>
    {:else}
        <span class="font-bold text-lg">UnstableRisuAI</span>

    {/if}
</div>