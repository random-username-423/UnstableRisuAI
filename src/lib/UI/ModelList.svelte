<script lang="ts">
    import { DBState } from "src/ts/stores.svelte"
    import Arcodion from "./Arcodion.svelte"
    import { language } from "src/lang"
    import CheckInput from "./GUI/CheckInput.svelte"
    import { getModelInfo, getModelList, ProviderSeparatorAfter } from "src/ts/model/modellist"
    import { ArrowLeft } from "lucide-svelte"

    interface Props {
        value?: string
        onChange?: (v: string) => void
        onclick?: (
            event: MouseEvent & {
                currentTarget: EventTarget & HTMLDivElement
            }
        ) => any
        blankable?: boolean
    }

    let { value = $bindable(""), onChange = (v) => {}, onclick, blankable }: Props = $props()
    let openOptions = $state(false)

    function changeModel(name: string) {
        value = name
        openOptions = false
        onChange(name)
    }
    let showUnrec = $state(false)
    let providers = $derived(
        getModelList({
            recommendedOnly: !showUnrec,
            groupedByProvider: true,
        })
    )
</script>

{#if openOptions}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50"
        role="button"
        tabindex="0"
        onclick={() => {
            openOptions = false
        }}
    >
        <div
            class="flex max-h-full w-96 max-w-full flex-col overflow-y-auto overflow-x-hidden bg-bgcolor p-4"
            role="button"
            tabindex="0"
            onclick={(e) => {
                e.stopPropagation()
                onclick?.(e)
            }}
        >
            <div class="mb-4 flex items-center gap-3">
                <button
                    class="flex flex-shrink-0 items-center justify-center rounded-lg p-2 transition-colors hover:bg-selected"
                    onclick={() => {
                        openOptions = false
                    }}
                    title="Back"
                >
                    <ArrowLeft size={20} />
                </button>
                <h1 class="flex-1 text-xl font-bold">{language.model}</h1>
            </div>
            <div class="mb-2 border-t-1 border-y-selected"></div>

            {#each providers as provider}
                {#if provider.providerName === "@as-is"}
                    {#each provider.models as model}
                        <button
                            class="px-6 py-2 text-lg hover:bg-selected"
                            onclick={() => {
                                changeModel(model.id)
                            }}>{model.name}</button
                        >
                        {#if ProviderSeparatorAfter.has(model.name)}
                            <div class="my-2 border-b border-darkborderc"></div>
                        {/if}
                    {/each}
                {:else}
                    <Arcodion name={provider.providerName}>
                        {#each provider.models as model}
                            <button
                                class="px-6 py-2 text-lg hover:bg-selected"
                                onclick={() => {
                                    changeModel(model.id)
                                }}>{model.name}</button
                            >
                        {/each}
                    </Arcodion>
                    {#if ProviderSeparatorAfter.has(provider.providerName)}
                        <div class="my-2 border-b border-darkborderc"></div>
                    {/if}
                {/if}
            {/each}
            {#if DBState?.db.customModels?.length > 0}
                <Arcodion name={language.customModels}>
                    {#each DBState.db.customModels as model}
                        <button
                            class="px-6 py-2 text-lg hover:bg-selected"
                            onclick={() => {
                                changeModel(model.id)
                            }}>{model.name ?? "Unnamed"}</button
                        >
                    {/each}
                </Arcodion>
            {/if}

            {#if blankable}
                <button
                    class="px-6 py-2 text-lg hover:bg-selected"
                    onclick={() => {
                        changeModel("")
                    }}>{language.none}</button
                >
            {/if}
            <div class="text-xs text-textcolor2">
                <CheckInput name={language.showUnrecommended} grayText bind:check={showUnrec} />
            </div>
        </div>
    </div>
{/if}

<button
    onclick={() => {
        openOptions = true
    }}
    class="mb-4 ml-2 mr-2 mt-4 flex items-center justify-center rounded-lg border border-darkborderc bg-darkbutton p-3 drop-shadow-lg"
>
    {getModelInfo(value)?.fullName || language.none}
</button>
