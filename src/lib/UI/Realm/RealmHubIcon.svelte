<script lang="ts">
    import { BookIcon, ImageIcon, SmileIcon } from "lucide-svelte"
    import { alertNormal } from "src/ts/utils/alert.svelte"
    import { hubURL, type hubType } from "src/ts/character/characterCards.svelte"
    import { parseMultilangString } from "src/ts/utils/util"

    interface Props {
        onClick?: any
        chara: hubType
    }

    let { onClick = () => {}, chara }: Props = $props()
</script>

<button
    class="relative flex w-full flex-col items-start rounded-lg bg-darkbg p-4 transition-colors hover:bg-selected lg:w-96"
    onclick={onClick}
>
    <div class="flex w-full gap-2">
        <img
            class="h-20 w-20 min-w-20 rounded-md object-cover object-top sm:h-28 sm:w-28"
            alt={chara.name}
            src={`${hubURL}/resource/` + chara.img}
        />
        <div class="flex min-w-0 flex-grow flex-col">
            <span
                class="min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-start text-lg text-textcolor"
                >{chara.name}</span
            >
            <span
                class="max-h-8 min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap break-words text-start text-xs text-textcolor2"
                >{parseMultilangString(chara.desc).en ?? parseMultilangString(chara.desc).xx}</span
            >
            <div class="flex flex-wrap">
                {#each chara.tags as tag, i}
                    {#if i < 4}
                        <div class="p-1 text-xs text-blue-400">{tag}</div>
                    {:else if i === 4}
                        <div class="p-1 text-xs text-blue-400">...</div>
                    {/if}
                {/each}
            </div>
            <div class="flex-grow"></div>
            <div class="flex w-full flex-row-reverse flex-wrap gap-1">
                {#if chara.hasEmotion}
                    <div
                        class="text-textcolor2 transition-colors hover:text-green-500"
                        role="button"
                        tabindex="0"
                        onclick={(e) => {
                            e.stopPropagation()
                            alertNormal("This character includes emotion images")
                        }}
                        onkeydown={(e) => {}}
                    >
                        <SmileIcon />
                    </div>
                {/if}
                {#if chara.hasAsset}
                    <div
                        class="text-textcolor2 transition-colors hover:text-green-500"
                        role="button"
                        tabindex="0"
                        onclick={(e) => {
                            e.stopPropagation()
                            alertNormal("This character includes additional assets")
                        }}
                        onkeydown={(e) => {}}
                    >
                        <ImageIcon />
                    </div>
                {/if}
                {#if chara.hasLore}
                    <div
                        class="text-textcolor2 transition-colors hover:text-green-500"
                        role="button"
                        tabindex="0"
                        onclick={(e) => {
                            e.stopPropagation()
                            alertNormal("This character includes lorebook")
                        }}
                        onkeydown={(e) => {}}
                    >
                        <BookIcon />
                    </div>
                {/if}
            </div>
        </div>
    </div></button
>
