<script lang="ts">
    import { ArrowLeft, ArrowRight } from "@lucide/svelte"
    import { LayoutState, MobileState } from "src/ts/stores.svelte"
</script>

{#if !MobileState.enabled}
    {#if LayoutState.sidebar.isOpen && !LayoutState.isDynamicMode}
        <button
            onclick={() => {
                LayoutState.sidebar.isClosing = true
            }}
            class="absolute left-0 top-3 z-20 flex h-12 w-12 items-center justify-center rounded-r-md border-b border-r border-t border-transparent bg-darkbg text-textcolor transition-colors hover:border-neutral-200"
        >
            <ArrowLeft />
        </button>
    {:else}
        <button
            onclick={() => {
                LayoutState.sidebar.isClosing = false
                LayoutState.sidebar.isOpen = true
            }}
            class="absolute left-0 top-3 z-20 flex h-12 w-12 items-center justify-center rounded-r-md border-b border-r border-t border-borderc bg-darkbg text-textcolor opacity-50 transition-colors hover:border-neutral-200 hover:opacity-90"
        >
            <ArrowRight />
        </button>
    {/if}
{/if}
