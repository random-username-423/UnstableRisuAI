<script lang="ts">
    import { encode } from "src/ts/utils/tokenizer"
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte"
    import { language } from "src/lang"

    let input = $state("")
    let output = $state("")
    let outputLength = $state(0)
    let time = $state(0)
    const onInput = async () => {
        try {
            const start = performance.now()
            const tokenized = await encode(input)
            time = performance.now() - start
            const tokenizedNumArray = Array.from(tokenized)
            outputLength = tokenizedNumArray.length
            output = JSON.stringify(tokenizedNumArray)
        } catch (e) {
            output = `Error: ${e}`
        }
    }
</script>

<h2 class="relative my-6 text-4xl font-black text-textcolor">{language.tokenizer}</h2>

<span class="text-lg text-textcolor">Input</span>

<TextAreaInput {onInput} bind:value={input} optimaizedInput={false} />

<span class="text-lg text-textcolor">Result</span>

<TextAreaInput value={output} />

<span class="text-lg text-textcolor2">{outputLength} {language.tokens}</span>
<span class="text-lg text-textcolor2">{time} ms</span>
