<script lang="ts">
    import { ArrowLeft } from "lucide-svelte";
    import { language } from "src/lang";
    import { LayoutState, ChatState, AppState } from "src/ts/stores.svelte";
    import PlaygroundEmbedding from "./PlaygroundEmbedding.svelte";
    import PlaygroundTokenizer from "./PlaygroundTokenizer.svelte";
    import PlaygroundJinja from "./PlaygroundJinja.svelte";
    import PlaygroundSyntax from "./PlaygroundSyntax.svelte";
    import { findCharacterIndexbyId } from "src/ts/utils/util";
    import { characterFormatUpdate, createBlankChar } from "src/ts/character/characters";
    import type { character } from "src/ts/data/storage/types";
    import { DBState } from 'src/ts/stores.svelte';
    import PlaygroundImageGen from "./PlaygroundImageGen.svelte";
    import PlaygroundParser from "./PlaygroundParser.svelte";
    import ToolConvertion from "./ToolConvertion.svelte";
    import { joinMultiuserRoom } from "src/ts/data/sync/multiuser";
  import PlaygroundSubtitle from "./PlaygroundSubtitle.svelte";
  import PlaygroundImageTrans from "./PlaygroundImageTrans.svelte";
  import PlaygroundTranslation from "./PlaygroundTranslation.svelte";
  import PlaygroundMcp from "./PlaygroundMCP.svelte";
    import PlaygroundDocs from "./PlaygroundDocs.svelte";
    import Playground3DViewer from "./Playground3DViewer.svelte";

    let easterEggTouch = $state(0)

    const playgroundChat = () => {
        const charIndex = findCharacterIndexbyId('§playground')
        AppState.playground = 2

        if (charIndex !== -1) {

            const char = DBState.db.characters[charIndex] as character
            char.utilityBot = true
            char.name = 'assistant'
            char.firstMessage = '{{none}}'
            DBState.db.characters[charIndex] = char
            characterFormatUpdate(charIndex)

            ChatState.selectedCharId = charIndex
            return
        }

        const character = createBlankChar()
        character.chaId = '§playground'

        DBState.db.characters.push(character)

        playgroundChat()

    }
</script>

<div class="h-full w-full flex flex-col overflow-y-auto items-center">
    {#if AppState.playground === 1}
        <h2 class="text-4xl text-textcolor my-6 font-black relative">{language.playground}</h2>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 w-full max-w-4xl p-2">
            <button class="bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1 md:col-span-2" onclick={() => {
                playgroundChat()
            }}>
                <h1 class="text-2xl font-bold text-start">{language.Chat}</h1>
            </button>
            <button class="bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1" onclick={() => {
                AppState.playground = 13
            }}>
                <h1 class="text-2xl font-bold text-start">CBS Doc</h1>
            </button>
            <button class="bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1" onclick={() => {
                AppState.playground = 3
            }}>
                <h1 class="text-2xl font-bold text-start">{language.embedding}</h1>
            </button>
            <button class="bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1" onclick={() => {
                AppState.playground = 4
            }}>
                <h1 class="text-2xl font-bold text-start">{language.tokenizer}</h1>
            </button>
            <button class="bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1" onclick={() => {
                AppState.playground = 5
            }}>
                <h1 class="text-2xl font-bold text-start">{language.syntax}</h1>
            </button>
            <button class="bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1" onclick={() => {
                AppState.playground = 6
            }}>
                <h1 class="text-2xl font-bold text-start">Jinja</h1>
            </button>
            <button class="bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1" onclick={() => {
                AppState.playground = 7
            }}>
                <h1 class="text-2xl font-bold text-start">{language.imageGeneration}</h1>
            </button>
            <button class="bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1" onclick={() => {
                AppState.playground = 8
            }}>
                <h1 class="text-2xl font-bold text-start">Parser</h1>
            </button>
            <button class="bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1" onclick={() => {
                AppState.playground = 9
            }}>
                <h1 class="text-2xl font-bold text-start">{language.subtitles}</h1>
            </button>
            <button class="bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1" onclick={() => {
                AppState.playground = 10
            }}>
                <h1 class="text-2xl font-bold text-start">{language.imageTranslation}</h1>
            </button>
            <button class="bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1" onclick={() => {
                AppState.playground = 11
            }}>
                <h1 class="text-2xl font-bold text-start">{language.translator}</h1>
            </button>
            <button class="bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1" onclick={() => {
                AppState.playground = 12
            }}>
                <h1 class="text-2xl font-bold text-start">MCP</h1>
            </button>
            <button class="bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1" onclick={() => {
                AppState.playground = 101
            }}>
                <h1 class="text-2xl font-bold text-start">{language.promptConvertion}</h1>
            </button>
            <button class="bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1" onclick={() => {
                joinMultiuserRoom()
            }}>
                <h1 class="text-2xl font-bold text-start">{language.joinMultiUserRoom}</h1>
            </button>
            <button class="bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1" onclick={() => {
                AppState.playground = 14
            }}>
                <h1 class="text-2xl font-bold text-start">3D Viewer</h1>
            </button>
            <button class="bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1" onclick={() => {
                easterEggTouch += 1
            }}>
                <h1 class="text-2xl font-bold text-start">
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
        <div class="w-full max-w-4xl flex flex-col p-2">
            <div class="flex items-center mt-4">
                <button class="mr-2 text-textcolor2 hover:text-green-500" onclick={() => (AppState.playground = 1)}>
                <ArrowLeft/>
                </button>
            </div>

            {#if AppState.playground === 2}
                <!-- <PlaygroundChat/> -->
            {/if}
            {#if AppState.playground === 3}
                <PlaygroundEmbedding/>
            {/if}
            {#if AppState.playground === 4}
                <PlaygroundTokenizer/>
            {/if}
            {#if AppState.playground === 5}
                <PlaygroundSyntax/>
            {/if}
            {#if AppState.playground === 6}
                <PlaygroundJinja/>
            {/if}
            {#if AppState.playground === 7}
                <PlaygroundImageGen/>
            {/if}  
            {#if AppState.playground === 8}
                <PlaygroundParser/>
            {/if}  
            {#if AppState.playground === 9}
                <PlaygroundSubtitle/>
            {/if}
            {#if AppState.playground === 10}
               <PlaygroundImageTrans/>
            {/if}
            {#if AppState.playground === 11}
                <PlaygroundTranslation/>
            {/if}
            {#if AppState.playground === 12}
                <PlaygroundMcp/>
            {/if}
            {#if AppState.playground === 13}
                <PlaygroundDocs/>
            {/if}
            {#if AppState.playground === 14}
                <Playground3DViewer/>
            {/if}
            {#if AppState.playground === 101}
                <ToolConvertion/>
            {/if}  
        </div>
    {/if}
</div>