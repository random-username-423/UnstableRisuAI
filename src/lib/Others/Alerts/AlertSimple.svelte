<script lang="ts">
    import AlertContainer from "./AlertContainer.svelte"
    import Button from "../../UI/GUI/Button.svelte"
    import TextInput from "../../UI/GUI/TextInput.svelte"
    import { ParseMarkdown } from "../../../ts/parser.svelte"
    import { alertClear } from "../../../ts/alert.svelte"

    type ButtonConfig =
        | "ok"
        | "yesno"
        | "accept"
        | { type: "select", options: string[] }
        | { type: "input", inputDatalist?: Array<[string, string]> }

    type Props = {
        title?: string
        titleColor?: "red" | "green"
        msg: string
        msgType?: "text" | "markdown"
        buttons: ButtonConfig
        onClose?: (result: string) => void
    }

    let { title, titleColor = "green", msg, msgType = "text", buttons, onClose }: Props = $props()

    let inputValue = $state("")

    function handleClose(result: string) {
        if (onClose) {
            onClose(result)
        } else {
            alertClear(result)
        }
    }
</script>

<AlertContainer {title} {titleColor}>
    <!-- Message Content -->
    {#if msgType === "markdown"}
        <div class="markdown-content">
            {#await ParseMarkdown(msg) then parsedMsg}
                {@html parsedMsg}
            {/await}
        </div>
    {:else}
        <span class="text-gray-300 whitespace-pre-wrap">{msg}</span>
    {/if}

    <!-- Input Field (for input type) -->
    {#if typeof buttons === "object" && buttons.type === "input"}
        <TextInput
            className="mt-4"
            bind:value={inputValue}
            list={buttons.inputDatalist ? "alert-simple-input-list" : undefined}
        />
        {#if buttons.inputDatalist}
            <datalist id="alert-simple-input-list">
                {#each buttons.inputDatalist as item}
                    <option value={item[0]} label={item[1] ? item[1] : item[0]}>{item[1] ? item[1] : item[0]}</option>
                {/each}
            </datalist>
        {/if}
    {/if}

    <!-- Buttons -->
    <div class="flex gap-2 mt-4">
        {#if buttons === "ok"}
            <Button onclick={() => handleClose("ok")}>OK</Button>
        {:else if buttons === "yesno"}
            <Button onclick={() => handleClose("yes")}>Yes</Button>
            <Button onclick={() => handleClose("no")}>No</Button>
        {:else if buttons === "accept"}
            <Button onclick={() => handleClose("accept")}>Accept</Button>
            <Button onclick={() => handleClose("cancel")}>Cancel</Button>
        {:else if typeof buttons === "object" && buttons.type === "select"}
            {#each buttons.options as option}
                <Button onclick={() => handleClose(option)}>{option}</Button>
            {/each}
        {:else if typeof buttons === "object" && buttons.type === "input"}
            <Button onclick={() => handleClose(inputValue)}>OK</Button>
            <Button onclick={() => handleClose("")}>Cancel</Button>
        {/if}
    </div>
</AlertContainer>

<style>
    .markdown-content :global(p) {
        margin-bottom: 0.5rem;
    }
    .markdown-content :global(ul),
    .markdown-content :global(ol) {
        margin-left: 1.5rem;
        margin-bottom: 0.5rem;
    }
    .markdown-content :global(code) {
        background-color: rgba(0, 0, 0, 0.3);
        padding: 0.125rem 0.25rem;
        border-radius: 0.25rem;
    }
</style>
