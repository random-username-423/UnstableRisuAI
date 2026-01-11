<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        label: string;
        onclick: () => void;
        disabled?: boolean;
        isActive?: boolean;
        icon: Snippet;
    }

    let {
        label,
        onclick,
        disabled = false,
        isActive = false,
        icon
    }: Props = $props();
</script>

<div
    class="flex items-center cursor-pointer transition-colors"
    class:text-textcolor2={disabled}
    class:text-green-500={isActive}
    class:hover:text-green-500={!isActive}
    onclick={() => { if (!disabled) onclick(); }}
    role="button"
    tabindex="0"
    onkeydown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onclick();
        }
    }}
>
    {@render icon()}
    <span class="ml-2">{label}</span>
</div>
