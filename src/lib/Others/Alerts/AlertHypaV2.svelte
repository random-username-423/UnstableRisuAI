<script lang="ts">
    import { DBState, selectedCharID } from "src/ts/stores.svelte"
    import Button from "src/lib/UI/GUI/Button.svelte"
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte"
    import { alertClear } from "src/ts/alert"
    import AlertContainer from "./AlertContainer.svelte"

    let generationInfoMenuIndex = $state(0)
</script>

<AlertContainer>
    <div class="flex flex-wrap gap-2 mb-4 max-w-full w-124">
        <Button
            selected={generationInfoMenuIndex === 0}
            size="sm"
            onclick={() => {
                generationInfoMenuIndex = 0
            }}
        >
            Chunks
        </Button>
        <Button
            selected={generationInfoMenuIndex === 1}
            size="sm"
            onclick={() => {
                generationInfoMenuIndex = 1
            }}
        >
            Summarized
        </Button>
        <button
            class="ml-auto"
            onclick={() => {
                alertClear("")
            }}>✖</button
        >
    </div>
    {#if generationInfoMenuIndex === 0}
        <div class="flex flex-col gap-2 w-full">
            {#each DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].hypaV2Data.chunks as chunk, i}
                <TextAreaInput bind:value={chunk.text} />
            {/each}

            <!-- Adding non-bound chunk is not okay, change the user flow to edit existing ones. -->
        </div>
    {:else}
        {#each DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].hypaV2Data.mainChunks as chunk, i}
            <!-- Summarized should be mainChunks, afaik. Be aware of that chunks are created with mainChunks, however this editing would not change related chunks. -->
            <div class="flex flex-col p-2 rounded-md border-darkborderc border">
                {#if i === 0}
                    <span class="text-green-500">Active</span>
                {:else}
                    <span>Inactive</span>
                {/if}
                <TextAreaInput bind:value={chunk.text} />
            </div>
        {/each}
    {/if}
</AlertContainer>
