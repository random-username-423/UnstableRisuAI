<script lang="ts">

  import { SettingsIcon, GlobeIcon, HomeIcon, Volume2Icon, CurlyBraces, ActivityIcon, BookIcon, SmileIcon, UserIcon } from "lucide-svelte";
  import { language } from "src/lang";
  import { ChatState, MobileState } from "src/ts/stores.svelte";

</script>
{#if ChatState.selectedCharId === -1}

    <div class="w-full p-4 text-lg border-t border-t-darkborderc bg-darkbg flex items-center justify-center text-textcolor2">
        <button class="flex justify-center items-center flex-col gap-2 w-20" class:text-textcolor={MobileState.currentStack === 0} onclick={() => {
            MobileState.currentStack = 0
        }}>
            <GlobeIcon size={24} />
            <span class="text-xs">RisuRealm</span>
        </button>
        <button class="flex justify-center items-center flex-col gap-2 w-20" class:text-textcolor={MobileState.currentStack === 1} onclick={() => {
            MobileState.currentStack = 1
        }}>
            <HomeIcon size={24} />
            <span class="text-xs">{language.character}</span>
        </button>
        <button class="flex justify-center items-center flex-col gap-2 w-20" class:text-textcolor={MobileState.currentStack === 2} onclick={() => {
            MobileState.currentStack = 2
        }}>
            <SettingsIcon size={24} />
            <span class="text-xs">{language.settings}</span>
        </button>
    </div>

{/if}

{#if ChatState.selectedCharId !== -1 && MobileState.sideBarMenu === 2}
    <div class="w-full p-4 text-lg border-t border-t-darkborderc bg-darkbg flex items-center justify-center text-textcolor2 truncate">
        <button class="flex justify-center items-center flex-col gap-2 w-16 max-w-16" class:text-textcolor={ChatState.configSubMenu === 0} onclick={() => {
            ChatState.configSubMenu = 0
        }}>
            <UserIcon size={24} />
            <span class="text-xs truncate max-w-16">{language.basicInfo}</span>
        </button>
        <button class="flex justify-center items-center flex-col gap-2 w-16 max-w-16" class:text-textcolor={ChatState.configSubMenu === 1} onclick={() => {
            ChatState.configSubMenu = 1
        }}>
            <SmileIcon size={24} />
            <span class="text-xs truncate max-w-16">{language.characterDisplay}</span>
        </button>
        <button class="flex justify-center items-center flex-col gap-2 w-16 max-w-16" class:text-textcolor={ChatState.configSubMenu === 3} onclick={() => {
            ChatState.configSubMenu = 3
        }}>
            <BookIcon size={24} />
            <span class="text-xs truncate max-w-16">{language.loreBook}</span>
        </button>
        <button class="flex justify-center items-center flex-col gap-2 w-16 max-w-16" class:text-textcolor={ChatState.configSubMenu === 5} onclick={() => {
            ChatState.configSubMenu = 5
        }}>
            <Volume2Icon size={24} />
            <span class="text-xs truncate max-w-16">TTS</span>
        </button>
        <button class="flex justify-center items-center flex-col gap-2 w-16 max-w-16" class:text-textcolor={ChatState.configSubMenu === 4} onclick={() => {
            ChatState.configSubMenu = 4
        }}>
            <CurlyBraces size={24} />
            <span class="text-xs truncate max-w-16">{language.scripts}</span>
        </button>
        <button class="flex justify-center items-center flex-col gap-2 w-16 max-w-16" class:text-textcolor={ChatState.configSubMenu === 2} onclick={() => {
            ChatState.configSubMenu = 2
        }}>
            <ActivityIcon size={24} />
            <span class="text-xs truncate max-w-16">{language.advanced}</span>
        </button>
    </div>
{/if}