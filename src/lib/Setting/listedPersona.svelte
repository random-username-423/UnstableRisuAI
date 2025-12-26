<script lang="ts">
    import { XIcon } from "@lucide/svelte"
    import { language } from "../../lang"

    import { DBState } from "src/ts/stores.svelte"
    import { changeUserPersona } from "src/ts/character/persona"

    interface Props {
        close?: any
    }

    let { close = () => {} }: Props = $props()
</script>

<div class="absolute z-40 flex h-full w-full items-center justify-center bg-black bg-opacity-50">
    <div class="break-any flex max-h-full w-96 max-w-3xl flex-col overflow-y-auto rounded-md bg-darkbg p-4">
        <div class="mb-4 flex items-center text-textcolor">
            <h2 class="mb-0 mt-0 font-bold">{language.persona}</h2>
            <div class="flex flex-grow justify-end">
                <button class="mr-2 cursor-pointer items-center text-textcolor2 hover:text-green-500" onclick={close}>
                    <XIcon size={24} />
                </button>
            </div>
        </div>
        {#each DBState.db.personas as persona, i}
            <button
                onclick={() => {
                    changeUserPersona(i)
                    close()
                }}
                class="flex cursor-pointer items-center border-0 border-t-1 border-solid border-darkborderc p-2 text-textcolor"
                class:bg-selected={i === DBState.db.selectedPersona}
            >
                <span class="w-full overflow-x-auto whitespace-nowrap text-left">
                    <span class="font-medium">{persona.name}</span>
                    {#if persona.note}
                        <span class="opacity-75"> / {persona.note}</span>
                    {/if}
                </span>
            </button>
        {/each}
    </div>
</div>

<style>
    .break-any {
        word-break: normal;
        overflow-wrap: anywhere;
    }
</style>
