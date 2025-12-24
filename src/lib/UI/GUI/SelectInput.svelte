<script lang="ts">
    interface Props {
        value: string | number
        className?: string
        size?: "sm" | "md" | "lg" | "xl"
        children?: import("svelte").Snippet
        onchange?: (
            event: Event & {
                currentTarget: EventTarget & HTMLSelectElement
            }
        ) => any
    }

    let { value = $bindable(), className = "", size = "md", children, onchange }: Props = $props()
</script>

<select
    class={"rounded-md border border-darkborderc bg-transparent text-textcolor shadow-sm transition-colors duration-200 focus:border-borderc focus:outline-none focus:ring-2 focus:ring-borderc" +
        (className ? " " + className : "")}
    class:text-sm={size === "sm"}
    class:text-md={size === "md"}
    class:text-lg={size === "lg"}
    class:text-xl={size === "xl"}
    class:px-4={size === "md"}
    class:py-2={size === "md"}
    class:px-2={size === "sm"}
    class:py-1={size === "sm"}
    class:px-6={size === "lg"}
    class:py-3={size === "lg"}
    bind:value
    {onchange}
>
    {@render children?.()}
</select>
