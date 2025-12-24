<script lang="ts">
    import { ColorSchemeTypeState } from "src/ts/gui/colorscheme.svelte"
    import { ParseMarkdown } from "src/ts/utils/parser.svelte"
    import { parseMultilangString, toLangName } from "src/ts/utils/util"

    interface Props {
        value: string
        markdown?: boolean
    }

    let { value, markdown = false }: Props = $props()
    const parsedValue = parseMultilangString(value)
    let valueObject = $derived(parseMultilangString(value))
    let selectedLang = $state("en")
    if (parsedValue["en"] === undefined) {
        selectedLang = "xx"
    }
</script>

<div class="flex flex-col">
    <div class="flex max-w-fit flex-wrap gap-2 p-1">
        {#each Object.keys(valueObject) as lang}
            {#if lang !== "xx" || Object.keys(valueObject).length === 1}
                <button
                    class="rounded-lg bg-bgcolor px-4 py-2"
                    class:ring-1={selectedLang === lang}
                    onclick={(e) => {
                        e.stopPropagation()
                        selectedLang = lang
                    }}>{toLangName(lang)}</button
                >
            {/if}
        {/each}
    </div>
    {#if markdown}
        <div
            class="text chat chattext prose ml-2 max-w-full break-words"
            class:prose-invert={ColorSchemeTypeState.type}
        >
            {#await ParseMarkdown(valueObject[selectedLang]) then md}
                {@html md}
            {/await}
        </div>
    {:else}
        <div
            class="text chat chattext prose ml-2 max-w-full break-words"
            class:prose-invert={ColorSchemeTypeState.type}
        >
            {valueObject[selectedLang]}
        </div>
    {/if}
</div>
