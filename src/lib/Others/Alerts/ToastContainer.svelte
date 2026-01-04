<script lang="ts">
    import { toastState, removeToast } from "src/ts/toast.svelte"
    import Toast from './Toast.svelte'

    function handleDismiss(id: string) {
        removeToast(id)
    }
</script>

<div class="toast-container">
    {#each toastState.queue as toast, index (toast.id)}
        <Toast
            id={toast.id}
            msg={toast.msg}
            duration={toast.duration}
            index={index}
            onDismiss={handleDismiss}
        />
    {/each}
</div>

<style>
    .toast-container {
        position: fixed;
        bottom: 1rem;
        right: 0;
        width: 100%;
        max-width: 50rem;
        height: auto;
        z-index: 50;
        pointer-events: none;
    }

    .toast-container :global(.toast-item) {
        pointer-events: auto;
    }
</style>
