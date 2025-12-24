<script lang="ts">
    import { ModalState } from "src/ts/stores.svelte"

    let isExpanded = $state(false)

    const toggleExpand = () => {
        isExpanded = !isExpanded
    }
</script>

{#if isExpanded}
    <div class="pointer-events-none absolute z-40 flex h-full w-full items-center justify-center">
        <button
            class="break-any pointer-events-auto flex max-h-full max-w-3xl flex-col overflow-y-auto rounded-md bg-darkbg p-4 transition-opacity duration-300"
            type="button"
            onclick={toggleExpand}
        >
            <span class="mb-6 text-left text-sm text-gray-500">{ModalState.hypaV3.progress.msg || ""}</span>
            <div class="h-2 w-full min-w-64 rounded-md border border-darkborderc bg-darkbg md:min-w-138">
                <div
                    class="saving-animation h-full bg-gradient-to-r from-blue-500 to-purple-800 transition-[width]"
                ></div>
            </div>
            <span class="mt-6 w-full text-center text-sm text-gray-500">{ModalState.hypaV3.progress.subMsg || ""}</span>
        </button>
    </div>
{:else}
    <button
        class="fixed right-4 top-4 z-40 flex items-center justify-center rounded-full bg-darkbg p-2 shadow-lg transition-all duration-300"
        type="button"
        style="opacity: 0.8;"
        onclick={toggleExpand}
        onmouseenter={(e) => (e.currentTarget.style.opacity = "1")}
        onmouseleave={(e) => (e.currentTarget.style.opacity = "0.8")}
    >
        <div class="relative h-8 w-8">
            <div class="absolute inset-0 animate-spin rounded-full border-t-2 border-red-500"></div>
            <div class="absolute inset-1 flex items-center justify-center text-xs text-gray-300">
                {ModalState.hypaV3.progress.miniMsg || ""}
            </div>
        </div>
    </button>
{/if}
