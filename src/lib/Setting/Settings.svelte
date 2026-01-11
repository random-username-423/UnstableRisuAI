<script lang="ts">
    import { AccessibilityIcon, ActivityIcon, PackageIcon, BotIcon, BoxIcon, CodeIcon, ContactIcon, LanguagesIcon, MonitorIcon, Sailboat, UserIcon, CircleXIcon, KeyboardIcon } from "@lucide/svelte";
    import { language } from "src/lang";
    import DisplaySettings from "./Pages/DisplaySettings.svelte";
    import UserSettings from "./Pages/UserSettings.svelte";
    import BotSettings from "./Pages/BotSettings.svelte";
    import OtherBotSettings from "./Pages/OtherBotSettings.svelte";
    import PluginSettings from "./Pages/PluginSettings.svelte";
    import FilesSettings from "./Pages/FilesSettings.svelte";
    import AdvancedSettings from "./Pages/AdvancedSettings.svelte";
    import { additionalSettingsMenu, layoutState, settingsOpen, viewState } from "src/ts/stores.svelte";
    import { DBState } from "src/ts/stores.svelte";
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
  import { isLite } from "src/ts/lite";
    import HotkeySettings from "./Pages/HotkeySettings.svelte";
    import PluginDefinedIcon from "../Others/PluginDefinedIcon.svelte";

    let openLoreList = $state(false)
    if(window.innerWidth >= 900 && viewState.settingsMenu === -1 && !layoutState.betaMobile.enabled){
        viewState.settingsMenu = 1
    }

</script>
<div class="h-full w-full flex justify-center rs-setting-cont" class:bg-bgcolor={layoutState.betaMobile.enabled} class:setting-bg={!layoutState.betaMobile.enabled}>
    <div class="h-full max-w-(--breakpoint-lg) w-full flex relative rs-setting-cont-2">
        {#if (window.innerWidth >= 700 && !layoutState.betaMobile.enabled) || viewState.settingsMenu === -1}
            <div class="flex h-full flex-col p-4 pt-8 gap-2 overflow-y-auto relative rs-setting-cont-3 shrink-0"
                class:w-full={window.innerWidth < 700 || layoutState.betaMobile.enabled}
                class:bg-darkbg={!layoutState.betaMobile.enabled} class:bg-bgcolor={layoutState.betaMobile.enabled}
            >
                
                {#if !$isLite}
                    <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={viewState.settingsMenu === 1 || viewState.settingsMenu === 13}
                        class:text-textcolor2={viewState.settingsMenu !== 1 && viewState.settingsMenu !== 13}
                        onclick={() => {
                            viewState.settingsMenu = 1
                            
                    }}>
                        <BotIcon />
                        <span>{language.chatBot}</span>
                    </button>
                    <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={viewState.settingsMenu === 12}
                        class:text-textcolor2={viewState.settingsMenu !== 12}
                        onclick={() => {
                            viewState.settingsMenu = 12
                    }}>
                        <ContactIcon />
                        <span>{language.persona}</span>
                    </button>
                    <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={viewState.settingsMenu === 2}
                        class:text-textcolor2={viewState.settingsMenu !== 2}
                        onclick={() => {
                            viewState.settingsMenu = 2
                    }}>
                        <Sailboat />
                        <span>{language.otherBots}</span>
                    </button>
                    <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={viewState.settingsMenu === 3}
                        class:text-textcolor2={viewState.settingsMenu !== 3}
                        onclick={() => {
                            viewState.settingsMenu = 3
                    }}>
                        <MonitorIcon />
                        <span>{language.display}</span>
                    </button>
                {/if}
                <button class="flex gap-2 items-center hover:text-textcolor"
                    class:text-textcolor={viewState.settingsMenu === 10}
                    class:text-textcolor2={viewState.settingsMenu !== 10}
                    onclick={() => {
                        viewState.settingsMenu = 10
                }}>
                    <LanguagesIcon />
                    <span>{language.language}</span>
                </button>
                {#if !$isLite}
                    <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={viewState.settingsMenu === 11}
                        class:text-textcolor2={viewState.settingsMenu !== 11}
                        onclick={() => {
                            viewState.settingsMenu = 11
                    }}>
                        <AccessibilityIcon />
                        <span>{language.accessibility}</span>
                    </button>
                    <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={viewState.settingsMenu === 14}
                        class:text-textcolor2={viewState.settingsMenu !== 14}
                        onclick={() => {
                            viewState.settingsMenu = 14
                    }}>
                        <PackageIcon />
                        <span>{language.modules}</span>
                    </button>
                    <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={viewState.settingsMenu === 4}
                        class:text-textcolor2={viewState.settingsMenu !== 4}
                        onclick={() => {
                        viewState.settingsMenu = 4
                    }}>
                        <CodeIcon />
                        <span>{language.plugin}</span>
                    </button>
                {/if}
                <button class="flex gap-2 items-center hover:text-textcolor"
                    class:text-textcolor={viewState.settingsMenu === 0}
                    class:text-textcolor2={viewState.settingsMenu !== 0}
                    onclick={() => {
                        viewState.settingsMenu = 0
                }}>
                    <UserIcon />
                    <span>{language.account} & {language.files}</span>
                </button>
                <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={viewState.settingsMenu === 15}
                        class:text-textcolor2={viewState.settingsMenu !== 15}
                        onclick={() => {
                        viewState.settingsMenu = 15
                    }}>
                        <KeyboardIcon />
                        <span>{language.hotkey}</span>
                    </button>
                {#if !$isLite}
                    <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={viewState.settingsMenu === 6}
                        class:text-textcolor2={viewState.settingsMenu !== 6}
                        onclick={() => {
                        viewState.settingsMenu = 6
                    }}>
                        <ActivityIcon />
                        <span>{language.advancedSettings}</span>
                    </button>
                    <button class="flex gap-2 items-center hover:text-textcolor"
                        class:text-textcolor={viewState.settingsMenu === 77}
                        class:text-textcolor2={viewState.settingsMenu !== 77}
                        onclick={() => {
                        viewState.settingsMenu = 77
                    }}>
                        <BoxIcon />
                        <span>{language.supporterThanks}</span>
                    </button>
                    {#each additionalSettingsMenu as menu}
                        <button class="flex gap-2 items-center hover:text-textcolor text-textcolor2"
                            onclick={() => {
                                menu.callback()
                        }}>
                            <PluginDefinedIcon ico={menu} />
                            <span>{menu.name}</span>
                        </button>
                    {/each}
                {/if}
                {#if window.innerWidth < 700 && !layoutState.betaMobile.enabled}
                    <button class="absolute top-2 right-2 hover:text-green-500 text-textcolor" onclick={() => {
                        settingsOpen.set(false)
                    }}> <CircleXIcon size={DBState.db.settingsCloseButtonSize} /> </button>
                {/if}
            </div>
        {/if}
        {#if (window.innerWidth >= 700 && !layoutState.betaMobile.enabled) || viewState.settingsMenu !== -1}
            {#key viewState.settingsMenu}
                <div class="grow py-6 px-4 bg-bgcolor flex flex-col text-textcolor overflow-y-auto relative rs-setting-cont-4 min-w-0">
                    {#if viewState.settingsMenu === 0}
                        <UserSettings />
                    {:else if viewState.settingsMenu === 1}
                        <BotSettings goPromptTemplate={() => {
                            viewState.settingsMenu = 13
                        }} />
                    {:else if viewState.settingsMenu === 2}
                        <OtherBotSettings />
                    {:else if viewState.settingsMenu === 3}
                        <DisplaySettings />
                    {:else if viewState.settingsMenu === 4}
                        <PluginSettings />
                    {:else if viewState.settingsMenu === 5}
                        <FilesSettings />
                    {:else if viewState.settingsMenu === 6}
                        <AdvancedSettings />
                    {:else if viewState.settingsMenu === 7}
                        <Communities />
                    {:else if viewState.settingsMenu === 8}
                        <GlobalLoreBookSettings bind:openLoreList />
                    {:else if viewState.settingsMenu === 9}
                        <GlobalRegex/>
                    {:else if viewState.settingsMenu === 10}
                        <LanguageSettings/>
                    {:else if viewState.settingsMenu === 11}
                        <AccessibilitySettings/>
                    {:else if viewState.settingsMenu === 12}
                        <PersonaSettings/>
                    {:else if viewState.settingsMenu === 14}
                        <ModuleSettings/>
                    {:else if viewState.settingsMenu === 13}
                        <PromptSettings onGoBack={() => {
                            viewState.settingsMenu = 1
                        }}/>
                    {:else if viewState.settingsMenu === 15 && window.innerWidth >= 768}
                        <HotkeySettings/>
                    {:else if viewState.settingsMenu === 77}
                        <ThanksPage/>
                    {/if}
            </div>
            {/key}
            {#if !layoutState.betaMobile.enabled}
                <button class="absolute top-2 right-2 hover:text-green-500 text-textcolor" onclick={() => {
                    if(window.innerWidth >= 700){
                        settingsOpen.set(false)
                    }
                    else{
                        viewState.settingsMenu = -1
                    }
                }}>
                    <CircleXIcon size={DBState.db.settingsCloseButtonSize} />
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