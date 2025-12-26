<script lang="ts">
    import type { character, groupChat } from "src/ts/data/storage/types"
    import { DBState } from "src/ts/stores.svelte"
    import BarIcon from "../SideBars/BarIcon.svelte"
    import { addCharacter, changeChar, getCharImage } from "src/ts/character/characters.svelte"
    import { MobileState } from "src/ts/stores.svelte"
    import { MessageSquareIcon, PlusIcon } from "@lucide/svelte"

    const agoFormatter = new Intl.RelativeTimeFormat(navigator.languages, { style: "short" })

    let { gridMode = false, endGrid = () => {} } = $props()

    function makeAgoText(time: number) {
        if (time === 0) {
            return "Unknown"
        }
        const diff = Date.now() - time
        if (diff < 3600000) {
            const min = Math.floor(diff / 60000)
            return agoFormatter.format(-min, "minute")
        }
        if (diff < 86400000) {
            const hour = Math.floor(diff / 3600000)
            return agoFormatter.format(-hour, "hour")
        }
        if (diff < 604800000) {
            const day = Math.floor(diff / 86400000)
            return agoFormatter.format(-day, "day")
        }
        if (diff < 2592000000) {
            const week = Math.floor(diff / 604800000)
            return agoFormatter.format(-week, "week")
        }
        if (diff < 31536000000) {
            const month = Math.floor(diff / 2592000000)
            return agoFormatter.format(-month, "month")
        }
        const year = Math.floor(diff / 31536000000)
        return agoFormatter.format(-year, "year")
    }

    function sortChar(char: (character | groupChat)[]) {
        return char
            .map((c, i) => {
                return {
                    name: c.name || "Unnamed",
                    image: c.image,
                    chats: c.chats.length,
                    i: i,
                    interaction: c.lastInteraction || 0,
                    agoText: makeAgoText(c.lastInteraction || 0),
                }
            })
            .sort((a, b) => {
                if (a.interaction === b.interaction) {
                    return a.name.localeCompare(b.name)
                }
                return b.interaction - a.interaction
            })
    }
</script>

<div class="flex h-full w-full flex-col items-center overflow-y-auto">
    {#each sortChar(DBState.db.characters) as char, i}
        {#if char.name.toLocaleLowerCase().includes(MobileState.search.toLocaleLowerCase())}
            <button
                class="flex w-full gap-2 border-t-darkborderc p-2"
                class:border-t={i !== 0}
                onclick={() => {
                    changeChar(char.i)
                    endGrid()
                }}
            >
                <BarIcon additionalStyle={getCharImage(char.image, "css")}></BarIcon>
                <div class="flex w-full flex-1 flex-col items-start justify-start text-start">
                    <span>{char.name}</span>
                    <div class="flex w-full flex-wrap items-center text-sm text-textcolor2">
                        <span class="mr-1">{char.chats}</span>
                        <MessageSquareIcon size={14} />
                        <span class="ml-1 mr-1">|</span>
                        <span>{char.agoText}</span>
                    </div>
                </div>
            </button>
        {/if}
    {/each}
</div>

{#if gridMode}
    <button
        class="absolute bottom-2 right-2 rounded-full bg-borderc p-4"
        onclick={() => {
            addCharacter()
        }}
    >
        <PlusIcon size={24} />
    </button>
{/if}
