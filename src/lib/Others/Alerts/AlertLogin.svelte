<script lang="ts">
    import { hubURL } from "src/ts/characterCards.svelte"
    import AlertContainer from "./AlertContainer.svelte"
    import { alertStore } from "src/ts/stores.svelte"
    import { alertClear } from "src/ts/alert"
</script>

<svelte:window
    onmessage={async (e) => {
        if (
            e.origin.startsWith("https://sv.risuai.xyz") ||
            e.origin.startsWith("https://nightly.sv.risuai.xyz") ||
            e.origin.startsWith("http://127.0.0.1") ||
            e.origin === window.location.origin
        ) {
            if (e.data.msg?.data?.vaild && $alertStore.type === "login") {
                alertClear(JSON.stringify(e.data.msg))
            }
        }
    }}
/>

<AlertContainer>
    <span class="text-gray-300 whitespace-pre-wrap">{$alertStore.msg}</span>
    {#if $alertStore.submsg}
        <span class="text-gray-500 text-sm">{$alertStore.submsg}</span>
    {/if}

    <div class="fixed top-0 left-0 bg-black/50 w-full h-full flex justify-center items-center">
        <iframe src={hubURL + "/hub/login"} title="login" class="w-full h-full"> </iframe>
    </div>
</AlertContainer>
