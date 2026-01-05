<script lang="ts">
    import { hubURL } from "src/ts/characterCards.svelte"
    import { alertState } from "src/ts/stores.svelte"
    import { alertClear } from "src/ts/alert.svelte"
</script>

<svelte:window
    onmessage={async (e) => {
        if (
            e.origin.startsWith("https://sv.risuai.xyz") ||
            e.origin.startsWith("https://nightly.sv.risuai.xyz") ||
            e.origin.startsWith("http://127.0.0.1") ||
            e.origin === window.location.origin
        ) {
            if (e.data.msg?.data?.vaild && alertState.type === "login") {
                alertClear(JSON.stringify(e.data.msg))
            }
        }
    }}
/>

<div class="fixed top-0 left-0 z-50 flex h-full w-full items-center justify-center bg-black/50">
    <iframe src={hubURL + "/hub/login"} title="login" class="h-full w-full"> </iframe>
</div>
