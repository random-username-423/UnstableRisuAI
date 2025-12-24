<script lang="ts">
    import { defaultCBSRegisterArg, registerCBS } from "src/ts/character/cbs"
    import TextInput from "../UI/GUI/TextInput.svelte"
    import { parseMarkdownSafe } from "src/ts/utils/parser.svelte"

    let doc: {
        name: string
        description: string
        alias: string[]
    }[] = $state([])
    let searchTerm = $state("")

    registerCBS({
        ...defaultCBSRegisterArg,
        registerFunction: (arg) => {
            if (arg.internalOnly) {
                return
            }
            doc.push({
                name: arg.name,
                description: arg.description,
                alias: arg.alias || [],
            })
        },
    })

    let searchedDoc = $derived(
        doc.filter((item) => {
            return (
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.alias.some((alias) => alias.toLowerCase().includes(searchTerm.toLowerCase()))
            )
        })
    )
</script>

<h2 class="relative my-6 text-4xl font-black text-textcolor">CBS Docs Beta</h2>
<div class="w-full max-w-4xl p-6">
    <div class="mb-8 w-full">
        <TextInput placeholder="Search documentation..." className="w-full" fullwidth bind:value={searchTerm} />
    </div>

    <div class="grid gap-6">
        {#each searchedDoc as item, index}
            <div class="rounded-lg border border-darkborderc p-6">
                <div class="mb-4 flex items-start justify-between">
                    <h3 class="text-xl font-semibold text-textcolor">{item.name}</h3>
                </div>

                <div class="mb-4 leading-relaxed text-textcolor2">
                    {@html parseMarkdownSafe(item.description, {
                        forbidTags: ["mark"],
                    })}
                </div>

                {#if item.alias.length > 0}
                    <div class="flex flex-wrap gap-2">
                        <span class="mr-2 text-sm text-textcolor2">Aliases:</span>
                        {#each item.alias as alias}
                            <span class="rounded-full bg-darkbg px-2 py-1 text-xs text-textcolor2">{alias}</span>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
    </div>

    {#if !doc || doc.length === 0}
        <div class="py-12 text-center">
            <div class="mb-4 text-6xl text-gray-400">📚</div>
            <h3 class="mb-2 text-xl text-gray-600">No documentation found</h3>
            <p class="text-gray-500">Documentation will appear here when available.</p>
        </div>
    {/if}
</div>
