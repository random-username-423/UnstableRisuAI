<script lang="ts">
    import { ParseMarkdown, risuChatParser } from "src/ts/utils/parser.svelte"
    import type { character, groupChat } from "src/ts/data/storage/types"
    import { DBState, RenderState, ChatState } from "src/ts/stores.svelte"

    let backgroundHTML = $derived(DBState.db?.characters?.[ChatState.selectedCharId]?.backgroundHTML)
    let currentChar: character | groupChat = $derived(DBState.db?.characters?.[ChatState.selectedCharId])
</script>

{#if backgroundHTML || RenderState.moduleBackground}
    {#if ChatState.selectedCharId > -1}
        {#key RenderState.guiReloadPointer}
            <div class="absolute left-0 top-0 h-full w-full">
                {#await ParseMarkdown(risuChatParser( (backgroundHTML || "") + "\n" + (RenderState.moduleBackground || ""), { chara: currentChar } ), currentChar, "back") then md}
                    {@html md}
                {/await}
            </div>
        {/key}
    {/if}
{/if}
