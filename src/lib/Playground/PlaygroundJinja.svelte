<script lang="ts">
    import { Template } from "@huggingface/jinja"
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte"
    let input = $state("")
    let json = $state(
        JSON.stringify(
            {
                messages: [
                    {
                        role: "user",
                        content: "Hello, I'm a user!",
                    },
                    {
                        role: "assistant",
                        content: "Hello, I'm a bot!",
                    },
                ],
                eos_token: "",
                bos_token: "",
            },
            null,
            4
        )
    )
    let output = $state("")
    const onInput = () => {
        try {
            const template = new Template(input)
            const values = JSON.parse(json)
            output = template.render(values)
        } catch (e) {
            //log error stack of e
            console.error(e.stack)
            output = `Error: ${e}`
        }
    }
</script>

<h2 class="relative my-6 text-4xl font-black text-textcolor">Jinja</h2>

<span class="text-lg text-textcolor">Jinja</span>

<TextAreaInput {onInput} bind:value={input} />

<span class="text-lg text-textcolor">Data (JSON)</span>

<TextAreaInput {onInput} bind:value={json} />

<span class="text-lg text-textcolor">Result</span>

<TextAreaInput value={output} />
