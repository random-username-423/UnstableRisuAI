<script lang="ts">
    import type { ToastType } from 'src/ts/toast.svelte'

    type Props = {
        id: string
        msg: string
        duration: number
        type: ToastType
        index: number
        onDismiss: (id: string) => void
    }

    let { id, msg, duration, type, index, onDismiss }: Props = $props()

    let visible = $state(false)
    let dismissed = $state(false)

    // Entrance animation
    $effect.pre(() => {
        visible = true
        dismissed = false
    })

    // Auto-dismiss timer
    $effect(() => {
        const timer = setTimeout(() => {
            handleDismiss()
        }, duration)

        return () => clearTimeout(timer)
    })

    function handleDismiss() {
        if (dismissed) return
        dismissed = true
        visible = false

        // Wait for exit animation, then callback
        setTimeout(() => {
            onDismiss(id)
        }, 300)
    }
</script>

<button
    class="toast-item"
    class:visible={visible}
    class:success={type === 'success'}
    class:error={type === 'error'}
    class:warning={type === 'warning'}
    class:info={type === 'info'}
    style:bottom="{index * 72}px"
    onclick={handleDismiss}
    aria-live="polite"
    type="button"
>
    {msg}
</button>

<style>
    .toast-item {
        position: absolute;
        right: 1rem;
        background-color: var(--risu-theme-darkbg);
        color: var(--risu-theme-textcolor);
        padding: 1rem;
        border-radius: 0.375rem;
        max-width: 48rem;
        min-width: 200px;
        word-break: normal;
        overflow-wrap: anywhere;
        z-index: 50;
        cursor: pointer;
        border: none;
        text-align: left;

        opacity: 0;
        transform: translateX(calc(100% + 2rem));
        transition: opacity 0.3s ease-out, transform 0.3s ease-out, bottom 0.3s ease-out;
    }

    .toast-item.visible {
        opacity: 1;
        transform: translateX(0);
    }

    /* Exit animation - triggered by removing .visible class */
    .toast-item:not(.visible) {
        opacity: 0;
        transform: translateX(50%);
    }

    /* Type-specific styles */
    .toast-item.success {
        background-color: #10b981;
        color: white;
        border-left: 4px solid #059669;
    }

    .toast-item.error {
        background-color: #ef4444;
        color: white;
        border-left: 4px solid #dc2626;
    }

    .toast-item.warning {
        background-color: #f59e0b;
        color: white;
        border-left: 4px solid #d97706;
    }

    .toast-item.info {
        background-color: #3b82f6;
        color: white;
        border-left: 4px solid #2563eb;
    }

    @media (max-width: 768px) {
        .toast-item {
            right: 1rem;
            left: 1rem;
            width: auto;
            max-width: none;
        }
    }
</style>
