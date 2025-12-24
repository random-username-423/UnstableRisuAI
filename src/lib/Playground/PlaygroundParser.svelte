<script lang="ts">
    import { ParseMarkdown } from "src/ts/utils/parser.svelte"
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte"
    let input = $state("")
    let output = $state("")
    const onInput = async () => {
        try {
            output = await ParseMarkdown(input)
        } catch (e) {
            output = `Error: ${e}`
        }
    }
</script>

<h2 class="relative my-6 text-4xl font-black text-textcolor">Full Parser</h2>

<span class="text-lg text-textcolor">Input</span>

<TextAreaInput {onInput} bind:value={input} optimaizedInput={false} />

<span class="text-lg text-textcolor">Output HTML</span>

<TextAreaInput value={output} />
