<script lang="ts">
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte"
    import { risuChatParser } from "src/ts/utils/parser.svelte"
    import { language } from "src/lang"
    import { sleep } from "src/ts/utils/util"
    let input = $state("")
    let output = $state("")
    const onInput = async () => {
        try {
            await sleep(1)
            output = risuChatParser(input, {
                consistantChar: true,
            })
        } catch (e) {
            output = `Error: ${e}`
        }
    }
</script>

<h2 class="relative my-6 text-4xl font-black text-textcolor">{language.syntax}</h2>

<span class="text-lg text-textcolor">Input</span>

<TextAreaInput highlight {onInput} bind:value={input} optimaizedInput={false} />

<span class="text-lg text-textcolor">Result</span>

<TextAreaInput value={output} />
