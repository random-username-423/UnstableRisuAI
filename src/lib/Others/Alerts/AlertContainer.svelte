<script lang="ts">
    import type { Snippet } from "svelte"

    type Props = {
        children: Snippet
        title?: string
        titleColor?: "red" | "green"
        variant?: "default" | "opaque"
    }

    let { children, title, titleColor = "red", variant = "default" }: Props = $props()
</script>

<div class="absolute w-full h-full z-50 bg-black/50 flex justify-center items-center" class:vis={variant === "opaque"}>
    <div class="bg-darkbg p-4 break-any rounded-md flex flex-col max-w-3xl max-h-full overflow-y-auto">
        {#if title}
            <h2 class="mt-0 mb-2 w-40 max-w-full" class:text-red-700={titleColor === "red"} class:text-green-700={titleColor === "green"}>
                {title}
            </h2>
        {/if}

        {@render children()}
    </div>
</div>

<style>
    .vis {
        opacity: 1 !important;
        --tw-bg-opacity: 1 !important;
    }
</style>
