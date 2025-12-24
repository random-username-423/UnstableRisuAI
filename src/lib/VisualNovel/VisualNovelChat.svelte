<script lang="ts">
    import { DBState, ChatState } from "src/ts/stores.svelte"
    import { getFileSrc } from "src/ts/utils/fileIO"
    import { sleep } from "src/ts/utils/util"
    import { onDestroy, onMount } from "svelte"

    const style: number = 1
    interface Props {
        text?: string
    }

    let {
        text = "Hello World, this is a test, so I can see if this works. I hope it does, because I don't want to have to rewrite this. I hope this is long enough to test the text wrapping. Lonnnnnng String ",
    }: Props = $props()
    let renderedText = $state("")
    let alive = true

    const forceRender = () => {
        renderedText = text
    }

    onMount(async () => {
        while (alive) {
            if (renderedText.length >= text.length) {
                if (renderedText !== text) {
                    renderedText = ""
                } else {
                    renderedText = text
                }
            }
            if (renderedText.length < text.length) {
                renderedText += text[renderedText.length]
            }
            await sleep(10)
        }
    })

    onDestroy(() => {
        renderedText = ""
        alive = false
    })
</script>

{#if DBState.db.characters[ChatState.selectedCharId].type === "character" && DBState.db.characters[ChatState.selectedCharId].emotionImages[0]}
    {#await getFileSrc(DBState.db.characters[ChatState.selectedCharId].emotionImages[0][1]) then imglink}
        <div class="absolute bottom-0 top-0 flex h-full w-full justify-center">
            <img src={imglink} alt="character" />
        </div>
    {/await}
{/if}
{#if style === 0}
    <div class="absolute bottom-5 flex w-full justify-center">
        <div class="flex w-3xl max-w-full flex-col">
            <div
                class="mb-2 flex h-12 w-40 items-center justify-center rounded-lg border-1 border-slate-500 bg-slate-700 bg-opacity-90 text-center"
            >
                <span class="p-2 font-bold">{DBState.db.characters[ChatState.selectedCharId].name}</span>
            </div>
            <div class="h-40 w-full rounded-lg border-1 border-slate-500 bg-slate-700 bg-opacity-90 p-4 text-justify">
                Test
            </div>
        </div>
    </div>
{:else}
    <div class="absolute bottom-5 flex w-full justify-center">
        <div class="flex w-3xl max-w-full flex-col text-black">
            <div
                class="relative left-4 top-6 mb-2 h-12 w-48 rounded-lg border-1 border-pink-900 bg-neutral-200 text-center text-lg"
            >
                <div class="h-full rounded-lg border-4 border-pink-300">
                    <div
                        class="flex h-full items-center justify-center rounded-lg border-1 border-pink-900 text-justify"
                    >
                        <span class="p-2 font-bold">{DBState.db.characters[ChatState.selectedCharId].name}</span>
                    </div>
                </div>
            </div>
            <div class="h-40 w-full rounded-lg border-1 border-pink-900 bg-neutral-200">
                <div class="h-full rounded-lg border-4 border-pink-300">
                    <div class="h-full text-clip rounded-lg border-1 border-pink-900 px-4 pb-4 pt-6 tracking-normal">
                        {renderedText}
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
