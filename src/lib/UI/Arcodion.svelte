<script lang="ts">
    import type { language } from "src/lang"
    import Help from "../Others/Help.svelte"

    let open = $state(false)
    interface Props {
        name?: string
        styled?: boolean
        help?: keyof typeof language.help | ""
        disabled?: boolean
        children?: import("svelte").Snippet
        className?: string
    }

    let { name = "", styled = false, help = "", disabled = false, children, className = "" }: Props = $props()
</script>

{#if disabled}
    {@render children?.()}
{:else if styled}
    <div class="mt-2 flex flex-col">
        <button
            class="rounded-t-md border border-selected px-6 py-2 text-lg hover:bg-selected"
            class:bg-selected={open}
            class:rounded-b-md={!open}
            onclick={() => {
                open = !open
            }}
        >
            <span class="mr-2">{name}</span>
            {#if help}
                <Help key={help} />
            {/if}</button
        >
        {#if open}
            <div class={"flex flex-col rounded-b-md border border-selected p-2 " + className}>
                {@render children?.()}
            </div>
        {/if}
    </div>
{:else}
    <div class="flex flex-col">
        <button
            class="px-6 py-2 text-lg hover:bg-selected"
            class:bg-selected={open}
            onclick={() => {
                open = !open
            }}>{name}</button
        >
        {#if open}
            <div class="flex flex-col bg-darkbg">
                {@render children?.()}
            </div>
        {/if}
    </div>
{/if}
