<script lang="ts">
    import { ArrowUpIcon, GlobeIcon, PlusIcon } from "lucide-svelte"

    interface Props {
        onExit: () => void
    }

    let { onExit }: Props = $props()
    let page = $state(0)
</script>

<div class="relative flex h-screen min-h-screen w-full bg-[#212121] text-black">
    <div class="mx-auto flex w-full max-w-3xl items-center justify-center px-4 py-8">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="flex w-full flex-col items-center text-[#bbbbbb]">
            {#if page === 0}
                <h1 class="mb-6 text-3xl font-bold text-white">What can I help you?</h1>
                <div
                    class="relative mb-6 h-[110px] w-full resize-none rounded-3xl bg-[#303030] text-[#bbbbbb]"
                    placeholder="Ask me"
                    onkeydown={(e) => {
                        if (e.key === "Enter") {
                            page = 1
                        }
                    }}
                >
                    <textarea
                        class="absolute left-0 top-0 h-full w-full resize-none rounded-3xl bg-transparent p-4 placeholder-[#bbbbbb]"
                        placeholder="Ask me"
                    ></textarea>
                    <div class="absolute bottom-2 left-4 flex gap-1.5">
                        <button class="rounded-full border border-[#bbbbbb30] p-2">
                            <PlusIcon size={18} color="#bbbbbb" />
                        </button>
                        <button class="rounded-full border border-[#bbbbbb30] p-2">
                            <GlobeIcon size={18} color="#bbbbbb" />
                        </button>
                    </div>
                    <div class="absolute bottom-2 right-4 flex">
                        <button class="rounded-full bg-[#bbbbbb] p-2">
                            <ArrowUpIcon size={18} color="#00000080" />
                        </button>
                    </div>
                </div>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    class="flex gap-1.5"
                    onclick={() => {
                        page = 1
                    }}
                >
                    <button class="rounded-full border border-[#bbbbbb15] px-4 py-2">
                        <span class="text-[#bbbbbb]">🔍</span>
                        Search
                    </button>
                    <button class="rounded-full border border-[#bbbbbb15] px-4 py-2">
                        <span class="text-[#bbbbbb]">🎮</span>
                        Games
                    </button>
                    <button class="rounded-full border border-[#bbbbbb15] px-4 py-2">
                        <span class="text-[#bbbbbb]">🎨</span>
                        Roleplay
                    </button>
                    <button class="rounded-full border border-[#bbbbbb15] px-4 py-2"> More </button>
                </div>
            {:else}
                <h1 class="mb-6 text-3xl font-bold text-white">We do not have search results.</h1>
                <p class="mb-6 text-[#bbbbbb]">
                    <!-- svelte-ignore a11y_missing_attribute -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    Go to
                    <a
                        class="cursor-pointer text-blue-500"
                        onclick={() => {
                            onExit()
                        }}
                    >
                        Risuai
                    </a>
                </p>
            {/if}
        </div>
    </div>
    <span class="text-md absolute left-4 top-4 font-bold text-[#bbbbbb] md:text-lg">RisyGTP-9</span>
</div>
