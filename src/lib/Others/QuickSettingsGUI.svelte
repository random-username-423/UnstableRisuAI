<script lang="ts">
    import { BotIcon, PackageIcon, Sailboat } from "lucide-svelte"
    import { QuickSettings } from "src/ts/stores.svelte"
    import BotSettings from "../Setting/Pages/BotSettings.svelte"
    import OtherBotSettings from "../Setting/Pages/OtherBotSettings.svelte"
    import ModuleSettings from "../Setting/Pages/Module/ModuleSettings.svelte"
</script>

<div class="mb-2 flex gap-2">
    <button
        class={QuickSettings.index === 0 ? "text-textcolor " : "text-textcolor2"}
        onclick={() => {
            QuickSettings.index = 0
        }}
    >
        <BotIcon />
    </button>
    <button
        class={QuickSettings.index === 1 ? "text-textcolor " : "text-textcolor2"}
        onclick={() => {
            QuickSettings.index = 1
        }}
    >
        <Sailboat />
    </button>
    <button
        class={QuickSettings.index === 2 ? "text-textcolor " : "text-textcolor2"}
        onclick={() => {
            QuickSettings.index = 2
        }}
    >
        <PackageIcon />
    </button>
</div>

<div class="rs-setting-cont-5 relative flex flex-col overflow-y-auto px-4 py-6 text-textcolor">
    {#if QuickSettings.index === 0}
        <BotSettings />
    {:else if QuickSettings.index === 1}
        <OtherBotSettings />
    {:else if QuickSettings.index === 2}
        <ModuleSettings />
    {/if}
</div>
