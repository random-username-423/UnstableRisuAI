<script lang="ts">
    import Button from "../UI/GUI/Button.svelte"
    import TextInput from "../UI/GUI/TextInput.svelte"
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte"
    import {
        alertError,
        alertNormal,
        alertConfirm,
        alertSelect,
        alertInput,
        alertMd,
        alertWait,
        alertClear,
    } from "src/ts/alert"
    import { addToast } from "src/ts/toast.svelte"

    let errorMsg = $state("This is an error message")
    let normalMsg = $state("This is a normal message")
    let confirmMsg = $state("Are you sure you want to continue?")
    let selectOptions = $state("Option A||Option B||Option C")
    let inputPrompt = $state("Enter your name:")
    let markdownContent = $state("# Hello World\n\nThis is **bold** and this is *italic*.\n\n- List item 1\n- List item 2")
    let toastMsg = $state("Toast notification!")
    let waitMsg = $state("Loading...")

    let lastResult = $state("")

    async function testError() {
        alertError(errorMsg)
        lastResult = "Error alert shown"
    }

    async function testErrorWithStack() {
        const err = new Error(errorMsg)
        alertError(err)
        lastResult = "Error alert with stack trace shown"
    }

    async function testNormal() {
        alertNormal(normalMsg)
        lastResult = "Normal alert shown"
    }

    async function testConfirm() {
        const result = await alertConfirm(confirmMsg)
        lastResult = `Confirm result: ${result ? "YES" : "NO"}`
    }

    async function testSelect() {
        const options = selectOptions.split("||")
        const result = await alertSelect(options)
        lastResult = `Selected index: ${result}`
    }

    async function testSelectWithDisplay() {
        const options = selectOptions.split("||")
        const result = await alertSelect(options, "Choose an option:")
        lastResult = `Selected index: ${result}`
    }

    async function testInput() {
        const result = await alertInput(inputPrompt)
        lastResult = `Input result: "${result}"`
    }

    async function testInputWithDatalist() {
        const datalist: [string, string][] = [
            ["apple", "Apple"],
            ["banana", "Banana"],
            ["cherry", "Cherry"],
        ]
        const result = await alertInput(inputPrompt, datalist)
        lastResult = `Input result: "${result}"`
    }

    function testMarkdown() {
        alertMd(markdownContent)
        lastResult = "Markdown alert shown"
    }

    function testToast() {
        addToast(toastMsg)
        lastResult = "Toast shown"
    }

    function testWait() {
        alertWait(waitMsg)
        lastResult = "Wait alert shown (use Clear to dismiss)"
    }

    function clearAlert() {
        alertClear()
        lastResult = "Alert cleared"
    }
</script>

<div class="flex flex-col gap-6 p-4">
    <h1 class="text-2xl font-bold text-textcolor">Alert Playground</h1>
    <p class="text-textcolor2">Test various alert types with custom messages</p>

    <!-- Result Display -->
    {#if lastResult}
        <div class="bg-green-900/30 border border-green-500 rounded-md p-3">
            <span class="text-green-400 font-mono text-sm">{lastResult}</span>
        </div>
    {/if}

    <!-- Error Alert -->
    <div class="bg-darkbg rounded-md p-4 flex flex-col gap-2">
        <h2 class="text-lg font-bold text-red-400">Error Alert</h2>
        <TextInput bind:value={errorMsg} />
        <div class="flex gap-2 flex-wrap">
            <Button onclick={testError}>Show Error</Button>
            <Button onclick={testErrorWithStack} styled="outlined">With Stack Trace</Button>
        </div>
    </div>

    <!-- Normal Alert -->
    <div class="bg-darkbg rounded-md p-4 flex flex-col gap-2">
        <h2 class="text-lg font-bold text-blue-400">Normal Alert</h2>
        <TextInput bind:value={normalMsg} />
        <Button onclick={testNormal}>Show Normal</Button>
    </div>

    <!-- Confirm Alert -->
    <div class="bg-darkbg rounded-md p-4 flex flex-col gap-2">
        <h2 class="text-lg font-bold text-yellow-400">Confirm Alert</h2>
        <TextInput bind:value={confirmMsg} />
        <Button onclick={testConfirm}>Show Confirm</Button>
    </div>

    <!-- Select Alert -->
    <div class="bg-darkbg rounded-md p-4 flex flex-col gap-2">
        <h2 class="text-lg font-bold text-purple-400">Select Alert</h2>
        <span class="text-textcolor2 text-sm">Options separated by ||</span>
        <TextInput bind:value={selectOptions} />
        <div class="flex gap-2 flex-wrap">
            <Button onclick={testSelect}>Show Select</Button>
            <Button onclick={testSelectWithDisplay} styled="outlined">With Display Text</Button>
        </div>
    </div>

    <!-- Input Alert -->
    <div class="bg-darkbg rounded-md p-4 flex flex-col gap-2">
        <h2 class="text-lg font-bold text-cyan-400">Input Alert</h2>
        <TextInput bind:value={inputPrompt} />
        <div class="flex gap-2 flex-wrap">
            <Button onclick={testInput}>Show Input</Button>
            <Button onclick={testInputWithDatalist} styled="outlined">With Datalist</Button>
        </div>
    </div>

    <!-- Markdown Alert -->
    <div class="bg-darkbg rounded-md p-4 flex flex-col gap-2">
        <h2 class="text-lg font-bold text-pink-400">Markdown Alert</h2>
        <TextAreaInput bind:value={markdownContent} />
        <Button onclick={testMarkdown}>Show Markdown</Button>
    </div>

    <!-- Toast Alert -->
    <div class="bg-darkbg rounded-md p-4 flex flex-col gap-2">
        <h2 class="text-lg font-bold text-orange-400">Toast Alert</h2>
        <TextInput bind:value={toastMsg} />
        <Button onclick={testToast}>Show Toast</Button>
    </div>

    <!-- Wait Alert -->
    <div class="bg-darkbg rounded-md p-4 flex flex-col gap-2">
        <h2 class="text-lg font-bold text-gray-400">Wait Alert</h2>
        <TextInput bind:value={waitMsg} />
        <div class="flex gap-2 flex-wrap">
            <Button onclick={testWait}>Show Wait</Button>
            <Button onclick={clearAlert} styled="outlined">Clear Alert</Button>
        </div>
    </div>
</div>
