<script lang="ts">
    import {
        SettingsIcon,
        GlobeIcon,
        HomeIcon,
        Volume2Icon,
        CurlyBraces,
        ActivityIcon,
        BookIcon,
        SmileIcon,
        UserIcon,
    } from "@lucide/svelte"
    import { language } from "src/lang"
    import { ChatState, MobileState } from "src/ts/stores.svelte"
</script>

{#if ChatState.selectedCharId === -1}
    <div
        class="flex w-full items-center justify-center border-t border-t-darkborderc bg-darkbg p-4 text-lg text-textcolor2"
    >
        <button
            class="flex w-20 flex-col items-center justify-center gap-2"
            class:text-textcolor={MobileState.currentStack === 0}
            onclick={() => {
                MobileState.currentStack = 0
            }}
        >
            <GlobeIcon size={24} />
            <span class="text-xs">RisuRealm</span>
        </button>
        <button
            class="flex w-20 flex-col items-center justify-center gap-2"
            class:text-textcolor={MobileState.currentStack === 1}
            onclick={() => {
                MobileState.currentStack = 1
            }}
        >
            <HomeIcon size={24} />
            <span class="text-xs">{language.character}</span>
        </button>
        <button
            class="flex w-20 flex-col items-center justify-center gap-2"
            class:text-textcolor={MobileState.currentStack === 2}
            onclick={() => {
                MobileState.currentStack = 2
            }}
        >
            <SettingsIcon size={24} />
            <span class="text-xs">{language.settings}</span>
        </button>
    </div>
{/if}

{#if ChatState.selectedCharId !== -1 && MobileState.sideBarMenu === 2}
    <div
        class="flex w-full items-center justify-center truncate border-t border-t-darkborderc bg-darkbg p-4 text-lg text-textcolor2"
    >
        <button
            class="flex w-16 max-w-16 flex-col items-center justify-center gap-2"
            class:text-textcolor={ChatState.configSubMenu === 0}
            onclick={() => {
                ChatState.configSubMenu = 0
            }}
        >
            <UserIcon size={24} />
            <span class="max-w-16 truncate text-xs">{language.basicInfo}</span>
        </button>
        <button
            class="flex w-16 max-w-16 flex-col items-center justify-center gap-2"
            class:text-textcolor={ChatState.configSubMenu === 1}
            onclick={() => {
                ChatState.configSubMenu = 1
            }}
        >
            <SmileIcon size={24} />
            <span class="max-w-16 truncate text-xs">{language.characterDisplay}</span>
        </button>
        <button
            class="flex w-16 max-w-16 flex-col items-center justify-center gap-2"
            class:text-textcolor={ChatState.configSubMenu === 3}
            onclick={() => {
                ChatState.configSubMenu = 3
            }}
        >
            <BookIcon size={24} />
            <span class="max-w-16 truncate text-xs">{language.loreBook}</span>
        </button>
        <button
            class="flex w-16 max-w-16 flex-col items-center justify-center gap-2"
            class:text-textcolor={ChatState.configSubMenu === 5}
            onclick={() => {
                ChatState.configSubMenu = 5
            }}
        >
            <Volume2Icon size={24} />
            <span class="max-w-16 truncate text-xs">TTS</span>
        </button>
        <button
            class="flex w-16 max-w-16 flex-col items-center justify-center gap-2"
            class:text-textcolor={ChatState.configSubMenu === 4}
            onclick={() => {
                ChatState.configSubMenu = 4
            }}
        >
            <CurlyBraces size={24} />
            <span class="max-w-16 truncate text-xs">{language.scripts}</span>
        </button>
        <button
            class="flex w-16 max-w-16 flex-col items-center justify-center gap-2"
            class:text-textcolor={ChatState.configSubMenu === 2}
            onclick={() => {
                ChatState.configSubMenu = 2
            }}
        >
            <ActivityIcon size={24} />
            <span class="max-w-16 truncate text-xs">{language.advanced}</span>
        </button>
    </div>
{/if}
