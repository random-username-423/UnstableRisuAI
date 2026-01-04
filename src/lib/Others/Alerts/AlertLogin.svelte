<script lang="ts">
    import { hubURL } from "src/ts/characterCards.svelte"
    import AlertContainer from "./AlertContainer.svelte"
    import { alertStore } from "src/ts/stores.svelte"
</script>

<AlertContainer>
    <span class="text-gray-300 whitespace-pre-wrap">{$alertStore.msg}</span>
    {#if $alertStore.submsg}
        <span class="text-gray-500 text-sm">{$alertStore.submsg}</span>
    {/if}

    <div class="fixed top-0 left-0 bg-black/50 w-full h-full flex justify-center items-center">
        <iframe src={hubURL + "/hub/login"} title="login" class="w-full h-full"> </iframe>
    </div>
</AlertContainer>
