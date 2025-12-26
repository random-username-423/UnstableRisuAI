<script lang="ts">
    import { PlusIcon, TrashIcon, LinkIcon } from "@lucide/svelte"
    import { language } from "src/lang"
    import { alertConfirm } from "src/ts/utils/alert.svelte"

    import { DBState } from "src/ts/stores.svelte"
    import { importPlugin } from "src/ts/plugins/plugins.svelte"
    import TextInput from "src/lib/UI/GUI/TextInput.svelte"
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte"
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte"
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte"
</script>

<h2 class="mb-2 mt-2 text-2xl font-bold">{language.plugin}</h2>

<span class="mb-4 text-xs text-draculared">{language.pluginWarn}</span>

<div class="flex flex-col border-1 border-solid border-darkborderc p-2">
    {#if !DBState.db.plugins || DBState.db.plugins?.length === 0}
        <span class="text-textcolor2">{language.noPlugins}</span>
    {/if}
    {#each DBState.db.plugins as plugin, i}
        <div class="seperator mb-2 mt-2 w-full border-b-1 border-solid border-darkborderc"></div>
        <div class="flex">
            <span class="flex-grow font-bold">{plugin.displayName ?? plugin.name}</span>
            <!--Button line Started-->
            <!--URL from plugin metadata-->
            {#if plugin.customLink}
                {#each plugin.customLink as link}
                    <!--We'll gonna open that link in a new tab-->
                    {#if typeof link.link === "string" && (link.link.startsWith("http://") || link.link.startsWith("https://"))}
                        <a
                            href={link.link}
                            target="_blank"
                            rel="nofollow noopener noreferrer"
                            class="cursor-pointer text-textcolor2 hover:text-textcolor"
                            title={link.hoverText}
                        >
                            <LinkIcon></LinkIcon>
                        </a>
                    {/if}
                {/each}
            {/if}

            <!--Also, remove button.-->
            <button
                class="textcolor2 hover:gray-200 cursor-pointer"
                onclick={async () => {
                    const v = await alertConfirm(language.removeConfirm + (plugin.displayName ?? plugin.name))
                    if (v) {
                        if (DBState.db.currentPluginProvider === plugin.name) {
                            DBState.db.currentPluginProvider = ""
                        }
                        let plugins = DBState.db.plugins ?? []
                        plugins.splice(i, 1)
                        DBState.db.plugins = plugins
                    }
                }}
            >
                <TrashIcon />
            </button>
        </div>
        {#if plugin.version !== 2}
            <span class="text-xs text-draculared">
                {language.pluginVersionWarn
                    .replace("{{plugin_version}}", "API V1")
                    .replace("{{required_version}}", "API V2")}
            </span>
            <!--List up args-->
        {:else if Object.keys(plugin.arguments).filter((i) => !i.startsWith("hidden_")).length > 0}
            <div class="bg-dark-900 mt-2 flex flex-col bg-opacity-50 p-3">
                {#each Object.keys(plugin.arguments) as arg}
                    {#if !arg.startsWith("hidden_")}
                        <span>{arg}</span>
                        {#if Array.isArray(plugin.arguments[arg])}
                            <SelectInput
                                className="mt-2 mb-4"
                                bind:value={DBState.db.plugins[i].realArg[arg] as string}
                            >
                                {#each plugin.arguments[arg] as a}
                                    <OptionInput value={a}>a</OptionInput>
                                {/each}
                            </SelectInput>
                        {:else if plugin.arguments[arg] === "string"}
                            <TextInput bind:value={DBState.db.plugins[i].realArg[arg] as string} />
                        {:else if plugin.arguments[arg] === "int"}
                            <NumberInput bind:value={DBState.db.plugins[i].realArg[arg] as number} />
                        {/if}
                    {/if}
                {/each}
            </div>
        {/if}
    {/each}
</div>
<div class="mt-2 flex text-textcolor2">
    <button
        onclick={() => {
            importPlugin()
        }}
        class="cursor-pointer hover:text-textcolor"
    >
        <PlusIcon />
    </button>
</div>
