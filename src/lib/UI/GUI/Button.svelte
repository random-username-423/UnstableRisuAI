<script lang="ts">
    interface Props {
        selected?: boolean
        styled?: "primary" | "danger" | "outlined"
        className?: string
        size?: "sm" | "md" | "lg"
        disabled?: boolean
        children?: import("svelte").Snippet
        onclick?: (
            event: MouseEvent & {
                currentTarget: EventTarget & HTMLButtonElement
            }
        ) => any
    }

    let {
        selected = false,
        styled = "primary",
        className = "",
        size = "md",
        disabled = false,
        children,
        onclick,
    }: Props = $props()
</script>

<button
    {onclick}
    {disabled}
    class="{styled === 'primary'
        ? (selected ? 'bg-bg-selected' : 'bg-darkbutton') + ' border-darkborderc hover:bg-selected focus:ring-selected'
        : styled === 'outlined'
          ? 'border-darkborderc bg-transparent text-textcolor2 hover:bg-darkbg focus:ring-selected'
          : (selected ? 'bg-red-800' : 'bg-red-700') +
            ' border-red-600 hover:bg-red-500 focus:ring-red-600'} rounded-md border text-textcolor shadow-sm transition-colors focus:outline-none focus:ring-2 duration-200{className
        ? ' ' + className
        : ''}"
    class:px-4={size == "md"}
    class:px-2={size == "sm"}
    class:px-6={size == "lg"}
    class:py-2={size == "md"}
    class:py-1={size == "sm"}
    class:py-3={size == "lg"}
    class:text-md={size == "md"}
    class:text-sm={size == "sm"}
    class:text-lg={size == "lg"}
    class:opacity-50={disabled}
    class:cursor-not-allowed={disabled}
>
    {@render children?.()}
</button>
