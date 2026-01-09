<!-- ModalLogin.svelte -->
<script lang="ts" module>
let resolver: ((value: string) => void) | null = null
const loginState = $state({ open: false })

export function requestLogin(): Promise<string> {
    return new Promise((resolve) => {
        resolver = resolve
        loginState.open = true
    })
}
</script>

<script lang="ts">
import { hubURL } from "src/ts/characterCards.svelte"

function handleResult(data: string) {
    loginState.open = false
    resolver?.(data)
    resolver = null
}
</script>

<svelte:window onmessage={(e) => {
    if (!loginState.open) return
    
    if (
        e.origin.startsWith("https://sv.risuai.xyz") ||
        e.origin.startsWith("https://nightly.sv.risuai.xyz") ||
        e.origin.startsWith("http://127.0.0.1") ||
        e.origin === window.location.origin
    ) {
        if (e.data.msg?.data?.vaild) {
            handleResult(JSON.stringify(e.data.msg))
        }
    }
}} />

{#if open}
<div class="fixed top-0 left-0 z-50 flex h-full w-full items-center justify-center bg-black/50">
    <iframe src={hubURL + "/hub/login"} title="login" class="h-full w-full"></iframe>
</div>
{/if}

