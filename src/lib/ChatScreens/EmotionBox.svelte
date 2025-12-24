<script>
    import { DBState } from "src/ts/stores.svelte"
    import { ChatState } from "../../ts/stores.svelte"
    import { getEmotion } from "../../ts/utils/util"
</script>

{#await getEmotion(DBState.db, ChatState.emotions, "contain") then images}
    {#each images as image, i}
        <div
            style={image + `width:${100 / images.length}%;bottom:0;left:${(100 / images.length) * i}%`}
            class="absolute h-full bg-center"
        ></div>
    {/each}
{/await}

<style>
    .h-full {
        height: 100%;
    }
    .bg-center {
        background-position: center;
    }
</style>
