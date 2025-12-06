<script lang="ts">
    import { ArrowUpIcon, GlobeIcon, PlusIcon } from 'lucide-svelte';

    interface Props {
        onExit: () => void
    }

    let { onExit }: Props = $props()
    let page = $state(0)
</script>

<div class="bg-[#212121] w-full h-screen min-h-screen text-black flex relative">
    <div class="w-full max-w-3xl mx-auto py-8 px-4 flex justify-center items-center">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="flex flex-col w-full items-center text-[#bbbbbb]">
            {#if page === 0}
                <h1 class="text-3xl text-white font-bold mb-6">What can I help you?</h1>
                <div class="resize-none relative w-full bg-[#303030] rounded-3xl h-[110px] mb-6 text-[#bbbbbb]" placeholder="Ask me" onkeydown={(e) => {
                    if(e.key === 'Enter'){
                        page = 1
                    }
                }}>
                    <textarea class="absolute top-0 left-0 w-full placeholder-[#bbbbbb] rounded-3xl h-full p-4 bg-transparent resize-none" placeholder="Ask me"></textarea>
                    <div class="absolute bottom-2 left-4 flex gap-1.5">
                        <button class="p-2 rounded-full border border-[#bbbbbb30]">
                            <PlusIcon size={18} color="#bbbbbb" />
                        </button>
                        <button class="p-2 rounded-full border border-[#bbbbbb30]">
                            <GlobeIcon size={18} color="#bbbbbb" />
                        </button>

                    </div>
                    <div class="absolute bottom-2 right-4 flex">
                        <button class="p-2 rounded-full bg-[#bbbbbb]">
                            <ArrowUpIcon size={18} color="#00000080" />
                        </button>
                    </div>
                </div>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div class="flex gap-1.5" onclick={() => {
                    page = 1
                }}>
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
                    <button class="rounded-full border border-[#bbbbbb15] px-4 py-2">
                        More
                    </button>
                </div>
            {:else}
            <h1 class="text-3xl text-white font-bold mb-6">
                We do not have search results.
            </h1>
            <p class="text-[#bbbbbb] mb-6">
                <!-- svelte-ignore a11y_missing_attribute -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                Go to <a class="text-blue-500 cursor-pointer" onclick={() => {
                    onExit()
                }}>
                    Risuai
                </a>
            </p>

            {/if}
        </div>
    </div>
    <span class="absolute top-4 left-4 font-bold text-[#bbbbbb] text-md md:text-lg">RisyGTP-9</span>
</div>
