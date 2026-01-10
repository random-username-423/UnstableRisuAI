<script lang="ts">
    import { layoutState, selectedCharID } from "src/ts/stores.svelte";
    import Settings from "../Setting/Settings.svelte";
    import RealmMain from "../UI/Realm/RealmMain.svelte";
    import MobileCharacters from "./MobileCharacters.svelte";
    import ChatScreen from "../ChatScreens/ChatScreen.svelte";
    import CharConfig from "../SideBars/CharConfig.svelte";
    import { WrenchIcon } from "@lucide/svelte";
    import { language } from "src/lang";
    import SideChatList from "../SideBars/SideChatList.svelte";
    import DevTool from "../SideBars/DevTool.svelte";
    import { isLite } from "src/ts/lite";
    
    import { DBState } from 'src/ts/stores.svelte';
    
    let { search } = $props();
</script>

{#if layoutState.betaMobile.sideBar > 0 && !$isLite}
<div class="w-full px-2 py-1 text-textcolor2 border-b border-b-darkborderc bg-darkbg flex justify-start items-center gap-2">
    <button class="flex-1 border-r border-r-darkborderc" class:text-textcolor={layoutState.betaMobile.sideBar === 1} onclick={() => {
        layoutState.betaMobile.sideBar = 1
    }}>
        {language.Chat}
    </button>
    <button class="flex-1 border-r border-r-darkborderc" class:text-textcolor={layoutState.betaMobile.sideBar === 2} onclick={() => {
        layoutState.betaMobile.sideBar = 2
    }}>
        {language.character}
    </button>
    <button class:text-textcolor={layoutState.betaMobile.sideBar === 3} onclick={() => {
        layoutState.betaMobile.sideBar = 3
    }}>
        <WrenchIcon size={18} />
    </button>
</div>
{/if}
<div class="w-full flex-1 overflow-y-auto bg-bgcolor relative">
    {#if layoutState.betaMobile.sideBar > 0}
        <div class="w-full flex flex-col p-2 mt-2 h-full">
            {#if layoutState.betaMobile.sideBar === 1}
                <SideChatList bind:chara={DBState.currentChar} />
            {:else if layoutState.betaMobile.sideBar === 2}
                <CharConfig />
            {:else if layoutState.betaMobile.sideBar === 3}
                <DevTool />
            {/if}
        </div>
    {:else if $selectedCharID !== -1}
        <ChatScreen />
    {:else if layoutState.betaMobile.stack === 0}
        <RealmMain />
    {:else if layoutState.betaMobile.stack === 1}
        <MobileCharacters search={search}/>
    {:else if layoutState.betaMobile.stack === 2}
        <Settings />
    {/if}
</div>