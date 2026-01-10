<script lang="ts">
    import { ArrowLeft, MenuIcon } from "@lucide/svelte";
    import { language } from "src/lang";
    
    import { DBState } from 'src/ts/stores.svelte';
    import { layoutState, selectedCharID, SettingsMenuIndex } from "src/ts/stores.svelte";

    let { search = $bindable('') } = $props();
</script>
<div class="w-full px-4 h-16 border-b border-b-darkborderc bg-darkbg flex justify-start items-center gap-2">
    {#if $selectedCharID !== -1 && layoutState.betaMobile.sideBar > 0}
        <button onclick={() => {
            layoutState.betaMobile.sideBar = 0
        }}>
            <ArrowLeft />
        </button>
        <span class="font-bold text-lg w-2/3 truncate">{language.menu}</span>
    {:else if $selectedCharID !== -1}
        <button onclick={() => {
            selectedCharID.set(-1)
        }}>
            <ArrowLeft />
        </button>
        <span class="font-bold text-lg w-2/3 truncate">{DBState.currentChar.name}</span>
        <div class="flex-1 flex justify-end">
            <button onclick={() => {
                layoutState.betaMobile.sideBar = 1
            }}>
                <MenuIcon />
            </button>
        </div>
    {:else if layoutState.betaMobile.stack === 2 && $SettingsMenuIndex > -1}
        <button onclick={() => {
            SettingsMenuIndex.set(-1)
        }}>
            <ArrowLeft />
        </button>
        <span class="font-bold text-lg">Risuai</span>
    {:else if layoutState.betaMobile.stack === 1}
        <div class="flex items-stretch w-2xl max-w-full">
            <input placeholder={language.search + '...'} bind:value={search} class="peer focus:border-textcolor transition-colors outline-hidden text-textcolor p-2 min-w-0 border bg-transparent rounded-md input-text text-xl grow mx-4 border-darkborderc resize-none overflow-y-hidden overflow-x-hidden max-w-full">
        </div>
    {:else}
        <span class="font-bold text-lg">Risuai</span>

    {/if}
</div>