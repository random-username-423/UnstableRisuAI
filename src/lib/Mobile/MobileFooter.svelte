<script lang="ts">

  import { SettingsIcon, GlobeIcon, HouseIcon, Volume2Icon, Braces, ActivityIcon, BookIcon, SmileIcon, UserIcon } from "@lucide/svelte";
  import { language } from "src/lang";
  import { layoutState, selectedCharID, viewState } from "src/ts/stores.svelte";

</script>
{#if $selectedCharID === -1}

    <div class="w-full p-4 text-lg border-t border-t-darkborderc bg-darkbg flex items-center justify-center text-textcolor2">
        <button class="flex justify-center items-center flex-col gap-2 w-20" class:text-textcolor={layoutState.betaMobile.stack === 0} onclick={() => {
            layoutState.betaMobile.stack = 0
        }}>
            <GlobeIcon size={24} />
            <span class="text-xs">RisuRealm</span>
        </button>
        <button class="flex justify-center items-center flex-col gap-2 w-20" class:text-textcolor={layoutState.betaMobile.stack === 1} onclick={() => {
            layoutState.betaMobile.stack = 1
        }}>
            <HouseIcon size={24} />
            <span class="text-xs">{language.character}</span>
        </button>
        <button class="flex justify-center items-center flex-col gap-2 w-20" class:text-textcolor={layoutState.betaMobile.stack === 2} onclick={() => {
            layoutState.betaMobile.stack = 2
        }}>
            <SettingsIcon size={24} />
            <span class="text-xs">{language.settings}</span>
        </button>
    </div>

{/if}

{#if $selectedCharID !== -1 && layoutState.betaMobile.sideBar === 2}
    <div class="w-full p-4 text-lg border-t border-t-darkborderc bg-darkbg flex items-center justify-center text-textcolor2 truncate">
        <button class="flex justify-center items-center flex-col gap-2 w-16 max-w-16" class:text-textcolor={viewState.charConfigSubMenu === 0} onclick={() => {
            viewState.charConfigSubMenu= 0
        }}>
            <UserIcon size={24} />
            <span class="text-xs truncate max-w-16">{language.basicInfo}</span>
        </button>
        <button class="flex justify-center items-center flex-col gap-2 w-16 max-w-16" class:text-textcolor={viewState.charConfigSubMenu === 1} onclick={() => {
            viewState.charConfigSubMenu= 1
        }}>
            <SmileIcon size={24} />
            <span class="text-xs truncate max-w-16">{language.characterDisplay}</span>
        </button>
        <button class="flex justify-center items-center flex-col gap-2 w-16 max-w-16" class:text-textcolor={viewState.charConfigSubMenu === 3} onclick={() => {
            viewState.charConfigSubMenu= 3
        }}>
            <BookIcon size={24} />
            <span class="text-xs truncate max-w-16">{language.loreBook}</span>
        </button>
        <button class="flex justify-center items-center flex-col gap-2 w-16 max-w-16" class:text-textcolor={viewState.charConfigSubMenu === 5} onclick={() => {
            viewState.charConfigSubMenu= 5
        }}>
            <Volume2Icon size={24} />
            <span class="text-xs truncate max-w-16">TTS</span>
        </button>
        <button class="flex justify-center items-center flex-col gap-2 w-16 max-w-16" class:text-textcolor={viewState.charConfigSubMenu === 4} onclick={() => {
            viewState.charConfigSubMenu= 4
        }}>
            <Braces size={24} />
            <span class="text-xs truncate max-w-16">{language.scripts}</span>
        </button>
        <button class="flex justify-center items-center flex-col gap-2 w-16 max-w-16" class:text-textcolor={viewState.charConfigSubMenu === 2} onclick={() => {
            viewState.charConfigSubMenu= 2
        }}>
            <ActivityIcon size={24} />
            <span class="text-xs truncate max-w-16">{language.advanced}</span>
        </button>
    </div>
{/if}