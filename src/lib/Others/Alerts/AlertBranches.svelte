<script lang="ts">
    import { XIcon } from "@lucide/svelte"
    import { getChatBranches } from "src/ts/gui/branches"
    import { getCurrentCharacter } from "src/ts/storage/database.svelte"
    import { alertClear } from "src/ts/alert"

    // Local state for hover preview
    let branchHover: null | {
        x: number
        y: number
        content: string
    } = $state(null)

    // Reset hover state when component is destroyed
    $effect.pre(() => {
        return () => {
            branchHover = null
        }
    })
</script>

<!-- ============================================================ -->
<!-- BRANCHES - Chat branch visualization -->
<!-- ============================================================ -->
<div class="absolute w-full h-full z-50 bg-black/80 flex justify-center items-center overflow-x-auto overflow-y-auto">
    {#if branchHover !== null}
        <div
            class="z-30 whitespace-pre-wrap p-4 text-textcolor bg-darkbg border-darkborderc border rounded-md absolute text-white"
            style="top: {branchHover.y * 80 + 24}px; left: {(branchHover.x + 1) * 80 + 24}px"
        >
            {branchHover.content}
        </div>
    {/if}

    <div class="x-50 right-2 top-2 absolute">
        <button
            class="bg-darkbg border-darkborderc border p-2 rounded-md"
            onclick={() => alertClear()}
        >
            <XIcon />
        </button>
    </div>

    {#each getChatBranches() as obj}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
            role="table"
            class="peer w-12 h-12 z-20 bg-bgcolor border border-darkborderc rounded-full flex justify-center items-center overflow-y-auto absolute"
            style="top: {obj.y * 80 + 24}px; left: {obj.x * 80 + 24}px"
            onmouseenter={() => {
                if (branchHover === null) {
                    const char = getCurrentCharacter()
                    branchHover = {
                        x: obj.x,
                        y: obj.y,
                        content: char.chats[obj.chatId].message[obj.y - 1].data,
                    }
                }
            }}
            onclick={() => {
                if (branchHover === null) {
                    const char = getCurrentCharacter()
                    branchHover = {
                        x: obj.x,
                        y: obj.y,
                        content: char.chats[obj.chatId].message[obj.y - 1].data,
                    }
                }
            }}
            onmouseleave={() => {
                branchHover = null
            }}
        ></div>
        {#if obj.connectX === obj.x}
            {#if obj.multiChild}
                <div class="w-0 h-20 border-x border-x-red-500 absolute" style="top: {(obj.y - 1) * 80 + 24}px; left: {obj.x * 80 + 45}px"></div>
            {:else}
                <div class="w-0 h-20 border-x border-x-blue-500 absolute" style="top: {(obj.y - 1) * 80 + 24}px; left: {obj.x * 80 + 45}px"></div>
            {/if}
        {:else if obj.connectX !== -1}
            <div class="w-0 h-10 border-x border-x-red-500 absolute" style="top: {obj.y * 80}px; left: {obj.x * 80 + 45}px"></div>
            <div
                class="h-0 border-y border-y-red-500 absolute"
                style="top: {obj.y * 80}px; left: {obj.connectX * 80 + 46}px"
                style:width={Math.abs((obj.x - obj.connectX) * 80) + "px"}
            ></div>
        {/if}
    {/each}
</div>
