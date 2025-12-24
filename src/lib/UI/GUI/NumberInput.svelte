<script lang="ts">
    interface Props {
        min?: number
        max?: number
        size?: "sm" | "md" | "lg"
        value: number
        id?: string
        padding?: boolean
        marginBottom?: boolean
        fullwidth?: boolean
        fullh?: boolean
        onChange?: (
            event: Event & {
                currentTarget: EventTarget & HTMLInputElement
            }
        ) => any
        className?: string
        disabled?: boolean
    }

    let {
        min = undefined,
        max = undefined,
        size = "sm",
        value = $bindable(),
        id = undefined,
        padding = true,
        marginBottom = false,
        fullwidth = false,
        fullh = false,
        onChange = () => {},
        className = "",
        disabled = false,
    }: Props = $props()
</script>

<input
    class={"numinput rounded-md border border-darkborderc bg-transparent shadow-sm transition-colors duration-200 focus:border-borderc focus:outline-none focus:ring-2 focus:ring-borderc" +
        (className ? " " + className : "")}
    class:text-sm={size === "sm"}
    class:text-md={size === "md"}
    class:text-lg={size === "lg"}
    class:text-textcolor={!disabled}
    class:text-textcolor2={disabled}
    class:px-4={size === "md" && padding}
    class:py-2={size === "md" && padding}
    class:px-2={size === "sm" && padding}
    class:py-1={size === "sm" && padding}
    class:px-6={size === "lg" && padding}
    class:py-3={size === "lg" && padding}
    class:mb-4={marginBottom}
    class:w-full={fullwidth}
    class:h-full={fullh}
    type="number"
    {min}
    {max}
    {id}
    {disabled}
    bind:value
    onchange={onChange}
/>

<style>
    .numinput::-webkit-outer-spin-button,
    .numinput::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    /* Firefox */
    .numinput {
        -moz-appearance: textfield;
        appearance: textfield;
    }
</style>
