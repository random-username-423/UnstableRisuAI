<script lang="ts">
    import { ArrowLeft } from "@lucide/svelte"
    import { language } from "src/lang"
    import { LayoutState, ChatState, AppState } from "src/ts/stores.svelte"
    import PlaygroundEmbedding from "./PlaygroundEmbedding.svelte"
    import PlaygroundTokenizer from "./PlaygroundTokenizer.svelte"
    import PlaygroundJinja from "./PlaygroundJinja.svelte"
    import PlaygroundSyntax from "./PlaygroundSyntax.svelte"
    import { findCharacterIndexbyId } from "src/ts/utils/util"
    import { characterFormatUpdate, createBlankChar } from "src/ts/character/characters.svelte"
    import type { character } from "src/ts/data/storage/types"
    import { DBState } from "src/ts/stores.svelte"
    import PlaygroundImageGen from "./PlaygroundImageGen.svelte"
    import PlaygroundParser from "./PlaygroundParser.svelte"
    import ToolConvertion from "./ToolConvertion.svelte"
    import { joinMultiuserRoom } from "src/ts/data/sync/multiuser.svelte"
    import PlaygroundSubtitle from "./PlaygroundSubtitle.svelte"
    import PlaygroundImageTrans from "./PlaygroundImageTrans.svelte"
    import PlaygroundTranslation from "./PlaygroundTranslation.svelte"
    import PlaygroundMcp from "./PlaygroundMCP.svelte"
    import PlaygroundDocs from "./PlaygroundDocs.svelte"
    import Playground3DViewer from "./Playground3DViewer.svelte"
    import PlaygroundLucide from "./PlaygroundLucide.svelte"

    let easterEggTouch = $state(0)

    const playgroundChat = () => {
        const charIndex = findCharacterIndexbyId("§playground")
        AppState.playground = 2

        if (charIndex !== -1) {
            const char = DBState.db.characters[charIndex] as character
            char.utilityBot = true
            char.name = "assistant"
            char.firstMessage = "{{none}}"
            DBState.db.characters[charIndex] = char
            characterFormatUpdate(charIndex)

            ChatState.selectedCharId = charIndex
            return
        }

        const character = createBlankChar()
        character.chaId = "§playground"

        DBState.db.characters.push(character)

        playgroundChat()
    }
</script>

<div class="flex h-full w-full flex-col items-center overflow-y-auto">
    {#if AppState.playground === 1}
        <h2 class="relative my-6 text-4xl font-black text-textcolor">{language.playground}</h2>
        <div class="grid w-full max-w-4xl grid-cols-1 gap-4 p-2 md:grid-cols-2">
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1 md:col-span-2"
                onclick={() => {
                    playgroundChat()
                }}
            >
                <h1 class="text-start text-2xl font-bold">{language.Chat}</h1>
            </button>
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1"
                onclick={() => {
                    AppState.playground = 13
                }}
            >
                <h1 class="text-start text-2xl font-bold">CBS Doc</h1>
            </button>
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1"
                onclick={() => {
                    AppState.playground = 3
                }}
            >
                <h1 class="text-start text-2xl font-bold">{language.embedding}</h1>
            </button>
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1"
                onclick={() => {
                    AppState.playground = 4
                }}
            >
                <h1 class="text-start text-2xl font-bold">{language.tokenizer}</h1>
            </button>
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1"
                onclick={() => {
                    AppState.playground = 5
                }}
            >
                <h1 class="text-start text-2xl font-bold">{language.syntax}</h1>
            </button>
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1"
                onclick={() => {
                    AppState.playground = 6
                }}
            >
                <h1 class="text-start text-2xl font-bold">Jinja</h1>
            </button>
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1"
                onclick={() => {
                    AppState.playground = 7
                }}
            >
                <h1 class="text-start text-2xl font-bold">{language.imageGeneration}</h1>
            </button>
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1"
                onclick={() => {
                    AppState.playground = 8
                }}
            >
                <h1 class="text-start text-2xl font-bold">Parser</h1>
            </button>
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1"
                onclick={() => {
                    AppState.playground = 9
                }}
            >
                <h1 class="text-start text-2xl font-bold">{language.subtitles}</h1>
            </button>
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1"
                onclick={() => {
                    AppState.playground = 10
                }}
            >
                <h1 class="text-start text-2xl font-bold">{language.imageTranslation}</h1>
            </button>
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1"
                onclick={() => {
                    AppState.playground = 11
                }}
            >
                <h1 class="text-start text-2xl font-bold">{language.translator}</h1>
            </button>
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1"
                onclick={() => {
                    AppState.playground = 12
                }}
            >
                <h1 class="text-start text-2xl font-bold">MCP</h1>
            </button>
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1"
                onclick={() => {
                    AppState.playground = 101
                }}
            >
                <h1 class="text-start text-2xl font-bold">{language.promptConvertion}</h1>
            </button>
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1"
                onclick={() => {
                    joinMultiuserRoom()
                }}
            >
                <h1 class="text-start text-2xl font-bold">{language.joinMultiUserRoom}</h1>
            </button>
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1"
                onclick={() => {
                    AppState.playground = 14
                }}
            >
                <h1 class="text-start text-2xl font-bold">3D Viewer</h1>
            </button>
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1"
                onclick={() => {
                    AppState.playground = 15
                }}
            >
                <h1 class="text-start text-2xl font-bold">Lucide Perf Test</h1>
            </button>
            <button
                class="flex flex-col rounded-md bg-darkbg p-6 transition-shadow hover:ring-1"
                onclick={() => {
                    easterEggTouch += 1
                }}
            >
                <h1 class="text-start text-2xl font-bold">
                    {#if easterEggTouch <= 10}
                        🤗 Coming soon
                    {:else if easterEggTouch <= 30}
                        🤗 Still coming soon
                    {:else if easterEggTouch <= 50}
                        😇 Really soon
                    {/if}
                </h1>
            </button>
        </div>
    {:else}
        {#if LayoutState.window.w < 1024}
            <div class="mt-14"></div>
        {/if}
        <div class="flex w-full max-w-4xl flex-col p-2">
            <div class="mt-4 flex items-center">
                <button class="mr-2 text-textcolor2 hover:text-green-500" onclick={() => (AppState.playground = 1)}>
                    <ArrowLeft />
                </button>
            </div>

            {#if AppState.playground === 2}
                <!-- <PlaygroundChat/> -->
            {/if}
            {#if AppState.playground === 3}
                <PlaygroundEmbedding />
            {/if}
            {#if AppState.playground === 4}
                <PlaygroundTokenizer />
            {/if}
            {#if AppState.playground === 5}
                <PlaygroundSyntax />
            {/if}
            {#if AppState.playground === 6}
                <PlaygroundJinja />
            {/if}
            {#if AppState.playground === 7}
                <PlaygroundImageGen />
            {/if}
            {#if AppState.playground === 8}
                <PlaygroundParser />
            {/if}
            {#if AppState.playground === 9}
                <PlaygroundSubtitle />
            {/if}
            {#if AppState.playground === 10}
                <PlaygroundImageTrans />
            {/if}
            {#if AppState.playground === 11}
                <PlaygroundTranslation />
            {/if}
            {#if AppState.playground === 12}
                <PlaygroundMcp />
            {/if}
            {#if AppState.playground === 13}
                <PlaygroundDocs />
            {/if}
            {#if AppState.playground === 14}
                <Playground3DViewer />
            {/if}
            {#if AppState.playground === 15}
                <PlaygroundLucide />
            {/if}
            {#if AppState.playground === 101}
                <ToolConvertion />
            {/if}
        </div>
    {/if}
</div>
