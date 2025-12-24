<script lang="ts">
    import { language } from "src/lang"
    import Button from "../UI/GUI/Button.svelte"
    import { selectMultipleFile } from "src/ts/utils/util"
    import { detectPromptJSONType, promptConvertion } from "src/ts/process/utils/prompt"

    let files: { name: string; content: string; type: string }[] = $state([])

    const addFile = async () => {
        const selFiles = await selectMultipleFile(["json"])

        for (let i = 0; i < selFiles.length; i++) {
            const file = selFiles[i]
            const text = new TextDecoder().decode(file.data)
            files.push({
                name: file.name,
                content: text,
                type: detectPromptJSONType(text),
            })
        }

        console.log(files)
        files = files
    }
</script>

<h2 class="relative my-6 text-4xl font-black text-textcolor">{language.promptConvertion}</h2>
<span class="text-textcolor2">{language.convertionStep1}</span>

<div class="flex flex-col gap-2 rounded-md border border-darkborderc p-4">
    {#each files as file, i}
        <div class="flex items-center justify-between">
            <div class="flex items-center justify-start">
                {#if file.type !== "NOTSUPPORTED"}
                    <span class="mr-2 rounded-md bg-blue-500 px-2 py-1 font-bold text-white">{file.type}</span>
                {:else}
                    <span class="mr-2 rounded-md bg-red-500 px-2 py-1 font-bold text-white">NOTSUPPORTED</span>
                {/if}
                <span>{file.name}</span>
            </div>
            <Button>Delete</Button>
        </div>
    {/each}
    <Button onclick={addFile}>Add</Button>
</div>
<Button
    className="mt-6"
    onclick={() => {
        promptConvertion(files)
    }}>Run</Button
>
