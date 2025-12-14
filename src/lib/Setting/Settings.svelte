<script lang="ts">
    import { AccessibilityIcon, ActivityIcon, AlignLeft, BookIcon, PackageIcon, BotIcon, BoxIcon, CodeIcon, ContactIcon, DiamondIcon, FolderIcon, LanguagesIcon, MonitorIcon, Sailboat, ScrollTextIcon, UserIcon, XCircleIcon, KeyboardIcon, HardDriveIcon } from "lucide-svelte";
    import { language } from "src/lang";
    import DisplaySettings from "./Pages/DisplaySettings.svelte";
    import UserSettings from "./Pages/UserSettings.svelte";
    import BotSettings from "./Pages/BotSettings.svelte";
    import OtherBotSettings from "./Pages/OtherBotSettings.svelte";
    import PluginSettings from "./Pages/PluginSettings.svelte";
    import FilesSettings from "./Pages/FilesSettings.svelte";
    import AdvancedSettings from "./Pages/AdvancedSettings.svelte";
    import { SettingsState } from "src/ts/stores.svelte";
    import { MobileState } from 'src/ts/stores.svelte';
    import Botpreset from "./botpreset.svelte";
    import Communities from "./Pages/Communities.svelte";
    import GlobalLoreBookSettings from "./Pages/GlobalLoreBookSettings.svelte";
    import Lorepreset from "./lorepreset.svelte";
    import GlobalRegex from "./Pages/GlobalRegex.svelte";
    import LanguageSettings from "./Pages/LanguageSettings.svelte";
    import AccessibilitySettings from "./Pages/AccessibilitySettings.svelte";
    import PersonaSettings from "./Pages/PersonaSettings.svelte";
    import PromptSettings from "./Pages/PromptSettings.svelte";
    import ThanksPage from "./Pages/ThanksPage.svelte";
    import ModuleSettings from "./Pages/Module/ModuleSettings.svelte";
    import HotkeySettings from "./Pages/HotkeySettings.svelte";
    import StorageSettings from "./Pages/StorageSettings.svelte";

    let openLoreList = $state(false)
    if(window.innerWidth >= 900 && SettingsState.menuIndex === -1 && !MobileState.enabled){
        SettingsState.menuIndex = 1
    }

</script>
<div class="h-full w-full flex justify-center rs-setting-cont" class:bg-bgcolor={MobileState.enabled} class:setting-bg={!MobileState.enabled}>
    <div class="h-full max-w-screen-lg w-full flex relative rs-setting-cont-2">
        {#if (window.innerWidth >= 700 && !MobileState.enabled) || SettingsState.menuIndex === -1}
            <div class="flex h-full flex-col p-4 pt-8 gap-2 overflow-y-auto relative rs-setting-cont-3"
                class:w-full={window.innerWidth < 700 || MobileState.enabled}
                class:bg-darkbg={!MobileState.enabled} class:bg-bgcolor={MobileState.enabled}
            >
                <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={SettingsState.menuIndex === 1 || SettingsState.menuIndex === 13}
                        class:text-textcolor2={SettingsState.menuIndex !== 1 && SettingsState.menuIndex !== 13}
                        onclick={() => {
                            SettingsState.menuIndex = 1
                            
                    }}>
                        <BotIcon />
                        <span>{language.chatBot}</span>
                    </button>
                    <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={SettingsState.menuIndex === 12}
                        class:text-textcolor2={SettingsState.menuIndex !== 12}
                        onclick={() => {
                            SettingsState.menuIndex = 12
                    }}>
                        <ContactIcon />
                        <span>{language.persona}</span>
                    </button>
                    <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={SettingsState.menuIndex === 2}
                        class:text-textcolor2={SettingsState.menuIndex !== 2}
                        onclick={() => {
                            SettingsState.menuIndex = 2
                    }}>
                        <Sailboat />
                        <span>{language.otherBots}</span>
                    </button>
                    <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={SettingsState.menuIndex === 3}
                        class:text-textcolor2={SettingsState.menuIndex !== 3}
                        onclick={() => {
                            SettingsState.menuIndex = 3
                    }}>
                        <MonitorIcon />
                        <span>{language.display}</span>
                    </button>
                <button class="flex gap-2 items-center hover:text-textcolor"
                    class:text-textcolor={SettingsState.menuIndex === 10}
                    class:text-textcolor2={SettingsState.menuIndex !== 10}
                    onclick={() => {
                        SettingsState.menuIndex = 10
                }}>
                    <LanguagesIcon />
                    <span>{language.language}</span>
                </button>
                <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={SettingsState.menuIndex === 11}
                        class:text-textcolor2={SettingsState.menuIndex !== 11}
                        onclick={() => {
                            SettingsState.menuIndex = 11
                    }}>
                        <AccessibilityIcon />
                        <span>{language.accessibility}</span>
                    </button>
                    <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={SettingsState.menuIndex === 14}
                        class:text-textcolor2={SettingsState.menuIndex !== 14}
                        onclick={() => {
                            SettingsState.menuIndex = 14
                    }}>
                        <PackageIcon />
                        <span>{language.modules}</span>
                    </button>
                    <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={SettingsState.menuIndex === 4}
                        class:text-textcolor2={SettingsState.menuIndex !== 4}
                        onclick={() => {
                        SettingsState.menuIndex = 4
                    }}>
                        <CodeIcon />
                        <span>{language.plugin}</span>
                    </button>
                <button class="flex gap-2 items-center hover:text-textcolor"
                    class:text-textcolor={SettingsState.menuIndex === 0}
                    class:text-textcolor2={SettingsState.menuIndex !== 0}
                    onclick={() => {
                        SettingsState.menuIndex = 0
                }}>
                    <UserIcon />
                    <span>{language.account} & {language.files}</span>
                </button>
                <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={SettingsState.menuIndex === 15}
                        class:text-textcolor2={SettingsState.menuIndex !== 15}
                        onclick={() => {
                        SettingsState.menuIndex = 15
                    }}>
                        <KeyboardIcon />
                        <span>{language.hotkey}</span>
                    </button>
                <button class="flex gap-2 items-center hover:text-textcolor"
                    class:text-textcolor={SettingsState.menuIndex === 16}
                    class:text-textcolor2={SettingsState.menuIndex !== 16}
                    onclick={() => {
                    SettingsState.menuIndex = 16
                }}>
                    <HardDriveIcon />
                    <span>{language.storage}</span>
                </button>
                <button class="flex gap-2 items-center hover:text-textcolor"
                    class:text-textcolor={SettingsState.menuIndex === 6}
                    class:text-textcolor2={SettingsState.menuIndex !== 6}
                    onclick={() => {
                    SettingsState.menuIndex = 6
                }}>
                    <ActivityIcon />
                    <span>{language.advancedSettings}</span>
                </button>
                <button class="flex gap-2 items-center hover:text-textcolor"
                    class:text-textcolor={SettingsState.menuIndex === 77}
                    class:text-textcolor2={SettingsState.menuIndex !== 77}
                    onclick={() => {
                    SettingsState.menuIndex = 77
                }}>
                    <BoxIcon />
                    <span>{language.supporterThanks}</span>
                </button>
                {#if window.innerWidth < 700 && !MobileState.enabled}
                    <button class="absolute top-2 right-2 hover:text-green-500 text-textcolor" onclick={() => {
                        SettingsState.isOpen = false
                    }}> <XCircleIcon /> </button>
                {/if}
            </div>
        {/if}
        {#if (window.innerWidth >= 700 && !MobileState.enabled) || SettingsState.menuIndex !== -1}
            {#key SettingsState.menuIndex}
                <div class="flex-grow py-6 px-4 bg-bgcolor flex flex-col text-textcolor overflow-y-auto relative rs-setting-cont-4">
                    {#if SettingsState.menuIndex === 0}
                        <UserSettings />
                    {:else if SettingsState.menuIndex === 1}
                        <BotSettings goPromptTemplate={() => {
                            SettingsState.menuIndex = 13
                        }} />
                    {:else if SettingsState.menuIndex === 2}
                        <OtherBotSettings />
                    {:else if SettingsState.menuIndex === 3}
                        <DisplaySettings />
                    {:else if SettingsState.menuIndex === 4}
                        <PluginSettings />
                    {:else if SettingsState.menuIndex === 5}
                        <FilesSettings />
                    {:else if SettingsState.menuIndex === 6}
                        <AdvancedSettings />
                    {:else if SettingsState.menuIndex === 7}
                        <Communities />
                    {:else if SettingsState.menuIndex === 8}
                        <GlobalLoreBookSettings bind:openLoreList />
                    {:else if SettingsState.menuIndex === 9}
                        <GlobalRegex/>
                    {:else if SettingsState.menuIndex === 10}
                        <LanguageSettings/>
                    {:else if SettingsState.menuIndex === 11}
                        <AccessibilitySettings/>
                    {:else if SettingsState.menuIndex === 12}
                        <PersonaSettings/>
                    {:else if SettingsState.menuIndex === 14}
                        <ModuleSettings/>
                    {:else if SettingsState.menuIndex === 13}
                        <PromptSettings onGoBack={() => {
                            SettingsState.menuIndex = 1
                        }}/>
                    {:else if SettingsState.menuIndex === 15 && window.innerWidth >= 768}
                        <HotkeySettings/>
                    {:else if SettingsState.menuIndex === 16}
                        <StorageSettings/>
                    {:else if SettingsState.menuIndex === 77}
                        <ThanksPage/>
                    {/if}
            </div>
            {/key}
            {#if !MobileState.enabled}
                <button class="absolute top-2 right-2 hover:text-green-500 text-textcolor" onclick={() => {
                    if(window.innerWidth >= 700){
                        SettingsState.isOpen = false
                    }
                    else{
                        SettingsState.menuIndex = -1
                    }
                }}>
                    <XCircleIcon />
                </button>
            {/if}
        {/if}
    </div>
</div>
{#if openLoreList}
    <Lorepreset close={() => {openLoreList = false}} />
{/if}
<style>
    .setting-bg{
        background: linear-gradient(to right, var(--risu-theme-darkbg) 50%, var(--risu-theme-bgcolor) 50%);

    }
</style>