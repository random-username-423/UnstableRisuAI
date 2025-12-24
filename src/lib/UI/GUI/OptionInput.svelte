<script lang="ts">
    interface Props {
        value: string | number
        selected?: boolean
        children?: import("svelte").Snippet
    }

    let { value, selected = false, children }: Props = $props()
</script>

<option {value} {selected} class="appearance-none bg-darkbg">{@render children?.()}</option>
