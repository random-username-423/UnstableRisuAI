<script lang="ts">
    import { MobileState, ChatState } from "src/ts/stores.svelte";
    import Settings from "../Setting/Settings.svelte";
    import RealmMain from "../UI/Realm/RealmMain.svelte";
    import MobileCharacters from "./MobileCharacters.svelte";
    import ChatScreen from "../ChatScreens/ChatScreen.svelte";
    import CharConfig from "../SideBars/CharConfig.svelte";
    import { WrenchIcon } from "lucide-svelte";
    import { language } from "src/lang";
    import SideChatList from "../SideBars/SideChatList.svelte";
    import DevTool from "../SideBars/DevTool.svelte";

    import { DBState } from 'src/ts/stores.svelte';
</script>

{#if MobileState.sideBarMenu > 0}
<div class="w-full px-2 py-1 text-textcolor2 border-b border-b-darkborderc bg-darkbg flex justify-start items-center gap-2">
    <button class="flex-1 border-r border-r-darkborderc" class:text-textcolor={MobileState.sideBarMenu === 1} onclick={() => {
        MobileState.sideBarMenu = 1
    }}>
        {language.Chat}
    </button>
    <button class="flex-1 border-r border-r-darkborderc" class:text-textcolor={MobileState.sideBarMenu === 2} onclick={() => {
        MobileState.sideBarMenu = 2
    }}>
        {language.character}
    </button>
    <button class:text-textcolor={MobileState.sideBarMenu === 3} onclick={() => {
        MobileState.sideBarMenu = 3
    }}>
        <WrenchIcon size={18} />
    </button>
</div>
{/if}
<div class="w-full flex-1 overflow-y-auto bg-bgcolor relative">
    {#if MobileState.sideBarMenu > 0}
        <div class="w-full flex flex-col p-2 mt-2 h-full">
            {#if MobileState.sideBarMenu === 1}
                <SideChatList bind:chara={DBState.db.characters[ChatState.selectedCharId]} />
            {:else if MobileState.sideBarMenu === 2}
                <CharConfig />
            {:else if MobileState.sideBarMenu === 3}
                <DevTool />
            {/if}
        </div>
    {:else if ChatState.selectedCharId !== -1}
        <ChatScreen />
    {:else if MobileState.currentStack === 0}
        <RealmMain />
    {:else if MobileState.currentStack === 1}
        <MobileCharacters />
    {:else if MobileState.currentStack === 2}
        <Settings />
    {/if}
</div>