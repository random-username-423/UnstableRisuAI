<!--
    CharConfig.svelte - Character/Group Settings Sidebar

    Menu Structure (viewState.charConfigSubMenu):
    - 0: Basic Info (name, description, first message, author note)
    - 1: Display (icon, viewscreen, additional assets)
    - 2: Advanced Settings (bias, example message, system prompt, etc.)
    - 3: Lorebook
    - 4: Scripts (Regex, Trigger) - character only
    - 5: TTS Settings - character only
    - 6: Share/Export - character only
-->
<script lang="ts">
    // ===== Imports =====
    import { language } from "../../lang";
    import { tokenizeAccurate } from "../../ts/tokenizer";
    import { saveImage as saveAsset } from "../../ts/storage/database.svelte";
    import type { character, groupChat } from "../../ts/storage/types/character";
    import { DBState, viewState } from 'src/ts/stores.svelte';
    import { untrack } from 'svelte';
    import { layoutState, realmState, selectedCharID, hypaV3State } from "../../ts/stores.svelte";
    import { PlusIcon, SmileIcon, TrashIcon, UserIcon, ActivityIcon, BookIcon, User, Braces, Volume2Icon, DownloadIcon, HardDriveUploadIcon, Share2Icon, ImageIcon, ImageOffIcon, ArrowUp, ArrowDown } from '@lucide/svelte'
    import CheckInput from "../UI/GUI/CheckInput.svelte";
    import { addCharEmotion, addingEmotion, getCharImage, rmCharEmotion, selectCharImg, makeGroupImage, removeChar, changeCharImage } from "../../ts/characters.svelte";
    import LoreBook from "./LoreBook/LoreBookSetting.svelte";
    import { alertTOS, showHypaV2Alert } from "../../ts/alert.svelte";
    import BarIcon from "./BarIcon.svelte";
    import { openFilePicker } from "../../ts/utils/util";
    import { getAuthorNoteDefaultText } from "src/ts/process/prompt"
    import { findCharacterbyId } from "../../ts/characters.svelte";
    import Help from "../Others/Help.svelte";
    import { exportChar } from "src/ts/characterCards.svelte";
    import { getFileSrc } from "src/ts/globalApi.svelte";
    import { addGroupChar, rmCharFromGroup } from "src/ts/process/group.svelte";
    import TextInput from "../UI/GUI/TextInput.svelte";
    import NumberInput from "../UI/GUI/NumberInput.svelte";
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte";
    import Button from "../UI/GUI/Button.svelte";
    import SelectInput from "../UI/GUI/SelectInput.svelte";
    import OptionInput from "../UI/GUI/OptionInput.svelte";
    import RegexList from "./Scripts/RegexList.svelte";
    import TriggerList from "./Scripts/TriggerList.svelte";
    import { getDefaultNewGenData } from "src/ts/process/inlayScreen";
    import MultiLangInput from "../UI/GUI/MultiLangInput.svelte";
    import { applyModule } from "src/ts/process/modules";
    import { exportRegex, importRegex } from "src/ts/process/scripts";
    import Toggles from "./Toggles.svelte";
    import TTSSettings from "./TTS/TTSSettings.svelte"
    import CodeMirrorEditor from "../UI/GUI/CodeMirrorEditor.svelte"

    // ===== Local State =====
    let iconRemoveMode = $state(false)       // Icon delete mode toggle
    let viewSubMenu = $state(0)              // Display tab submenu (0: icon, 1: viewscreen, 2: assets)
    let emos:[string, string][] = $state([]) // Emotion images list [name, path]
    let iconButtonSize = window.innerWidth > 360 ? 24 as const : 20 as const // Responsive icon size

    // Token count display (for description, first message, local note)
    let tokens = $state({
        desc: 0,
        firstMsg: 0,
        localNote: 0,
        charaNote: 0
    })

    // Cache to prevent unnecessary token recalculation (compare with previous values)
    let lasttokens = {
        desc: '',
        firstMsg: '',
        localNote: '',
        charaNote: ''
    }

    /**
     * Calculate token count for character fields.
     * Compares with lasttokens to only recalculate when changed (performance optimization).
     */
    async function loadTokenize(
        desc: string | null,
        firstMsg: string | null,
        localNote: string
    ) {
        if (desc !== null && lasttokens.desc !== desc) {
            lasttokens.desc = desc
            tokens.desc = await tokenizeAccurate(desc)
        }
        if (firstMsg !== null && lasttokens.firstMsg !== firstMsg) {
            lasttokens.firstMsg = firstMsg
            tokens.firstMsg = await tokenizeAccurate(firstMsg)
        }
        if (lasttokens.localNote !== localNote) {
            lasttokens.localNote = localNote
            tokens.localNote = await tokenizeAccurate(localNote)
        }
    }

    // Additional assets preview (extensions and file paths for rendering)
    let assetFileExtensions:string[] = $state([])
    let assetFilePath:string[] = $state([])

    // Character license (restricts editing if 'private')
    let licensed = $state((DBState.currentChar.type === 'character') ? (DBState.currentChar as character).license : '')

    // ===== $effect.pre: Reactive data sync =====

    /**
     * Sync emotion images list.
     * Triggers: $selectedCharID change, emotionImages change
     */
    $effect.pre(() => {
        emos = DBState.currentChar.emotionImages
    });

    /**
     * Calculate token counts for character fields.
     * Dependencies (tracked): $selectedCharID, desc, firstMessage, note
     * Logic (untracked): loadTokenize call with lasttokens comparison
     */
    $effect.pre(() => {
        // ===== Dependencies (tracked) =====
        const chara = DBState.currentChar
        const desc = chara.type !== 'group' ? (chara as character).desc : null
        const firstMsg = chara.type !== 'group' ? chara.firstMessage : null
        const localNote = DBState.currentChar
            .chats[DBState.currentChar.chatPage].note

        // ===== Async work (untracked) =====
        untrack(() => {
            loadTokenize(desc, firstMsg, localNote)
        })
    });

    /**
     * Load additional assets preview (extensions and file paths).
     * Triggers: $selectedCharID change, additionalAssets change, useAdditionalAssetsPreview change
     */
    $effect.pre(() => {
        if (DBState.currentChar.type !== 'character') return
        if (!DBState.db.useAdditionalAssetsPreview) return

        const additionalAssets = (DBState.currentChar as character).additionalAssets
        if (!additionalAssets) return

        for (let i = 0; i < additionalAssets.length; i++) {
            // Extract extension: use [2] if exists, otherwise extract from filename
            if (additionalAssets[i].length > 2 && additionalAssets[i][2]) {
                assetFileExtensions[i] = additionalAssets[i][2]
            } else {
                assetFileExtensions[i] = additionalAssets[i][1].split('.').pop()!
            }
            // Load file path asynchronously
            getFileSrc(additionalAssets[i][1]).then((filePath) => {
                if (!filePath) throw new Error(`Asset not found: name=${additionalAssets[i][0]}, path=${additionalAssets[i][1]}, ext=${additionalAssets[i][2]}`)
                assetFilePath[i] = filePath
            })
        }
    });

    /**
     * Sync license state.
     */
    $effect.pre(() => {
        licensed = (DBState.currentChar.type === 'character') ? (DBState.currentChar as character).license : ''
    });

    
    /**
     * Redirect to default menu when group selects character-only menus (Scripts, TTS).
     */
    $effect.pre(() => {
        if(DBState.currentChar.type === 'group' && (viewState.charConfigSubMenu === 4 || viewState.charConfigSubMenu === 5)){
            viewState.charConfigSubMenu = 0
        }

    });

    // ===== Functions =====

    /**
     * Move alternate greeting up in the list (swap with previous).
     */
    function moveAlternateGreetingUp(index: number) {
        if(index === 0) return
        if(DBState.currentChar.type === 'character'){
            let alternateGreetings = DBState.currentChar.alternateGreetings
            let temp = alternateGreetings[index]
            alternateGreetings[index] = alternateGreetings[index - 1]
            alternateGreetings[index - 1] = temp
            DBState.currentChar.alternateGreetings = alternateGreetings
        }
    }

    /**
     * Move alternate greeting down in the list (swap with next).
     */
    function moveAlternateGreetingDown(index: number) {
        if(DBState.currentChar.type !== 'character') return
        if(index === DBState.currentChar.alternateGreetings.length - 1) return
        let alternateGreetings = DBState.currentChar.alternateGreetings
        let temp = alternateGreetings[index]
        alternateGreetings[index] = alternateGreetings[index + 1]
        alternateGreetings[index + 1] = temp
        DBState.currentChar.alternateGreetings = alternateGreetings
    }

</script>

{#if licensed !== 'private' && !layoutState.betaMobile.enabled}
    <div class="flex mb-2" class:gap-2={iconButtonSize === 24} class:gap-1={iconButtonSize < 24}>
        <button class={viewState.charConfigSubMenu === 0 ? 'text-textcolor ' : 'text-textcolor2'} onclick={() => {viewState.charConfigSubMenu = 0}}>
            <UserIcon size={iconButtonSize} />
        </button>
        <button class={viewState.charConfigSubMenu === 1 ? 'text-textcolor' : 'text-textcolor2'} onclick={() => {viewState.charConfigSubMenu = 1}}>
            <SmileIcon size={iconButtonSize} />
        </button>
        <button class={viewState.charConfigSubMenu === 3 ? 'text-textcolor' : 'text-textcolor2'} onclick={() => {viewState.charConfigSubMenu = 3}}>
            <BookIcon size={iconButtonSize} />
        </button>
        {#if DBState.currentChar.type === 'character'}
            <button class={viewState.charConfigSubMenu === 5 ? 'text-textcolor' : 'text-textcolor2'} onclick={() => {viewState.charConfigSubMenu = 5}}>
                <Volume2Icon size={iconButtonSize} />
            </button>
            <button class={viewState.charConfigSubMenu === 4 ? 'text-textcolor' : 'text-textcolor2'} onclick={() => {viewState.charConfigSubMenu = 4}}>
                <Braces size={iconButtonSize} />
            </button>
        {/if}
        <button class={viewState.charConfigSubMenu === 2 ? 'text-textcolor' : 'text-textcolor2'} onclick={() => {viewState.charConfigSubMenu = 2}}>
            <ActivityIcon size={iconButtonSize} />
        </button>
        {#if DBState.currentChar.type === 'character'}
            <button class={viewState.charConfigSubMenu === 6 ? 'text-textcolor' : 'text-textcolor2'} onclick={() => {viewState.charConfigSubMenu = 6}}>
                <Share2Icon size={iconButtonSize} />
            </button>
        {/if}
    </div>
{/if}


{#if viewState.charConfigSubMenu === 0}
    {#if DBState.currentChar.type !== 'group' && licensed !== 'private'}
        <TextInput size="xl" marginBottom placeholder="Character Name" bind:value={DBState.currentChar.name} />
        <span class="text-textcolor">{language.description} <Help key="charDesc"/></span>
        <CodeMirrorEditor bind:value={(DBState.currentChar as character).desc} class="my-2" />
        <span class="text-textcolor2 mb-6 text-sm">{tokens.desc} {language.tokens}</span>
        <span class="text-textcolor">{language.firstMessage} <Help key="charFirstMessage"/></span>
        <CodeMirrorEditor bind:value={DBState.currentChar.firstMessage} class="my-2" />
        <span class="text-textcolor2 mb-6 text-sm">{tokens.firstMsg} {language.tokens}</span>

    {:else if licensed !== 'private' && DBState.currentChar.type === 'group'}
        <TextInput size="xl" marginBottom placeholder="Group Name" bind:value={DBState.currentChar.name} />
        <span class="text-textcolor">{language.character}</span>
        <div class="p-4 gap-2 bg-bgcolor rounded-lg char-grid">
            {#if (DBState.currentChar as groupChat).characters.length === 0}
                <span class="text-textcolor2">No Character</span>
            {:else}
                <div></div>
                <div class="text-center">{language.talkness}</div>
                <div class="text-center">{language.active}</div>
                {#each (DBState.currentChar as groupChat).characters as char, i}
                    {#await getCharImage(findCharacterbyId(char).image ?? "", 'css')}
                        <BarIcon onClick={() => {
                            rmCharFromGroup(i)
                        }}>
                            <User/>
                        </BarIcon>
                    {:then im} 
                        <BarIcon onClick={() => {
                            rmCharFromGroup(i)
                        }} additionalStyle={im} />
                    {/await}
                    <div class="flex items-center px-2 py-3">
                        {#each [1,2,3,4,5,6] as barIndex}
                            <button class="bg-selected h-full flex-1 border-r-bgcolor border-r" 
                                aria-labelledby="loading"
                                class:bg-green-500={(DBState.currentChar as groupChat).characterTalks[i] >= (1 / 6 * barIndex)}
                                class:bg-selected={(DBState.currentChar as groupChat).characterTalks[i] < (1 / 6 * barIndex)}
                                class:rounded-l-lg={barIndex === 1}
                                class:rounded-r-lg={barIndex === 6}
                                onclick={() => {
                                    if(DBState.currentChar.type === 'group'){
                                        (DBState.currentChar as groupChat).characterTalks[i] = (1 / 6 * barIndex)
                                    }
                                }}
                            ></button>
                        {/each}
                    </div>
                    <div class="flex items-center justify-center">
                        <CheckInput margin={false} bind:check={(DBState.currentChar as groupChat).characterActive[i]} />
                    </div>
                {/each}
            {/if}
        </div>
        <div class="text-textcolor2 mt-1 flex mb-6">
            <button onclick={addGroupChar} class="hover:text-textcolor cursor-pointer">
                <PlusIcon />
            </button>
        </div>

    {/if}
    <span class="text-textcolor">{language.authorNote} <Help key="chatNote"/></span>
    <CodeMirrorEditor bind:value={DBState.currentChat.note} class="my-2" />
    <span class="text-textcolor2 mb-6 text-sm">{tokens.localNote} {language.tokens}</span>

    {#if !layoutState.betaMobile.enabled}
        <Toggles bind:chara={DBState.currentChar} noContainer />

        {#if DBState.currentChar.type === 'group'}
            <div class="flex mt-2 items-center">
                <CheckInput bind:check={(DBState.currentChar as groupChat).orderByOrder} name={language.orderByOrder}/>
            </div>
        {/if}
    {/if}
{:else if licensed === 'private'}
    <span>You are not allowed</span>
    {(() => {
        viewState.charConfigSubMenu = 0
    })()}
{:else if viewState.charConfigSubMenu === 1}
    {#if !layoutState.betaMobile.enabled}
        <h2 class="mb-2 text-2xl font-bold mt-2">{language.characterDisplay}</h2>
    {/if}

    <div class="flex w-full rounded-md border border-selected mb-4">
        <button onclick={() => {
            viewSubMenu = 0
        }} class="p-2 flex-1" class:bg-selected={viewSubMenu === 0}>
            <span>{DBState.currentChar.type !== 'group' ? language.charIcon : language.groupIcon}</span>
        </button>
        <button onclick={() => {
            viewSubMenu = 1
        }} class="p2 flex-1 border-r border-l border-selected" class:bg-selected={viewSubMenu === 1}>
            <span>{language.viewScreen}</span>
        </button>
        <button onclick={() => {
            viewSubMenu = 2
        }} class="p-2 flex-1" class:bg-selected={viewSubMenu === 2}>
            <span>{language.additionalAssets}</span>
        </button>
    </div>

    {#if viewSubMenu === 0}
        {#if DBState.currentChar.type === 'group'}
            <button onclick={async () => {await selectCharImg($selectedCharID)}}>
                {#await getCharImage(DBState.currentChar.image ?? "", 'css')}
                    <div class="rounded-md h-24 w-24 shadow-lg bg-textcolor2 cursor-pointer ring-3"></div>
                {:then im}
                    <div class="rounded-md h-24 w-24 shadow-lg bg-textcolor2 cursor-pointer ring-3" style={im}></div>     
                {/await}
            </button>
        {:else}
            <div class="p-2 border-darkborderc border rounded-md flex flex-wrap gap-2">
                {#if DBState.currentChar.image !== '' && DBState.currentChar.image}
                    <button onclick={() => {
                        if(
                            DBState.currentChar.type === 'character' &&
                            DBState.currentChar.image !== '' &&
                            DBState.currentChar.image &&
                            iconRemoveMode
                        ){
                            DBState.currentChar.image = ''
                            if(((DBState.currentChar! as character).ccAssets?.length ?? 0) > 0){
                                changeCharImage($selectedCharID, 0)
                            }
                            iconRemoveMode = false
                        }
                    }}>
                        {#await getCharImage(DBState.currentChar.image, (DBState.currentChar as character).largePortrait ? 'lgcss' : 'css')}
                            <div
                                class="rounded-md h-24 w-24 shadow-lg bg-textcolor2 cursor-pointer ring-3 transition-shadow"
                                class:ring-red-500={iconRemoveMode}
    ></div>
                        {:then im}
                            <div
                                class="rounded-md h-24 w-24 shadow-lg bg-textcolor2 cursor-pointer ring-3 transition-shadow"
                                class:ring-red-500={iconRemoveMode}
                                style={im}
    ></div>     
                        {/await}
                    </button>
                {/if}
                {#if (DBState.currentChar as character).ccAssets}
                    {#each (DBState.currentChar as character).ccAssets as assets, i}
                        <button onclick={async () => {
                            if(!iconRemoveMode){
                                changeCharImage($selectedCharID, i)
                            }
                            else if(DBState.currentChar.type === 'character'){
                                (DBState.currentChar as character).ccAssets?.splice(i, 1)
                                iconRemoveMode = false
                            }
                        }}>
                            {#await getCharImage(assets.uri, (DBState.currentChar as character).largePortrait ? 'lgcss' : 'css')}
                                <div
                                    class="rounded-md h-24 w-24 shadow-lg bg-textcolor2 cursor-pointer hover:ring-3 transition-shadow"
                                    class:ring-red-500={iconRemoveMode} class:ring-3={iconRemoveMode}
    ></div>
                            {:then im}
                                <div
                                    class="rounded-md h-24 w-24 shadow-lg bg-textcolor2 cursor-pointer hover:ring-3 transition-shadow"
                                    style={im} class:ring-red-500={iconRemoveMode} class:ring-3={iconRemoveMode}
    ></div>     
                            {/await}
                        </button>
                    {/each}
                {/if}
                <button onclick={async () => {await selectCharImg($selectedCharID);}}>
                    <div
                        class="rounded-md h-24 w-24 cursor-pointer border-darkborderc border border-dashed flex justify-center items-center hover:border-blue-500"
                        style={(DBState.currentChar as character).largePortrait ? 'height: 10.66rem;' : ''}
                    >
                        <PlusIcon />
                    </div>
                </button>
            </div>
            <div class="flex w-full items-end justify-end mt-2">
                <button class={iconRemoveMode ? "text-red-500" : "text-textcolor2 hover:text-textcolor"} onclick={() => {
                    iconRemoveMode = !iconRemoveMode
                }}>
                    <TrashIcon size="18" />
                </button>
            </div>
        {/if}

        {#if DBState.currentChar.type === 'character' && DBState.currentChar.image !== ''}
            <div class="flex items-center mt-4">
                <CheckInput bind:check={(DBState.currentChar as character).largePortrait} name={language.largePortrait}/>
            </div>
        {/if}

        {#if DBState.currentChar.type === 'group'}
            <Button onclick={makeGroupImage}>
                {language.createGroupImg}
            </Button>
        {/if}


    {:else if viewSubMenu === 1}
        {#if DBState.currentChar.type !== 'group'}
            <SelectInput className="mb-2" bind:value={DBState.currentChar.viewScreen} onchange={() => {
                if(DBState.currentChar.type === 'character'){
                    const char = DBState.currentChar as character
                    char.newGenData = getDefaultNewGenData(char.viewScreen, char.inlayViewScreen ?? false)
                }
            }}>
                <OptionInput value="none">{language.none}</OptionInput>
                <OptionInput value="emotion">{language.emotionImage}</OptionInput>
                <OptionInput value="imggen">{language.imageGeneration}</OptionInput>
                {#if DBState.db.tpo}
                    <OptionInput value="vn">VN test</OptionInput>
                {/if}
            </SelectInput>
        {:else}
            <SelectInput className="mb-2" bind:value={DBState.currentChar.viewScreen}>
                <OptionInput value="none">{language.none}</OptionInput>
                <OptionInput value="single">{language.singleView}</OptionInput>
                <OptionInput value="multiple">{language.SpacedView}</OptionInput>
                <OptionInput value="emp">{language.emphasizedView}</OptionInput>

            </SelectInput>
        {/if}

        {#if DBState.currentChar.viewScreen === 'emotion'}
            <span class="text-textcolor mt-6">{language.emotionImage} <Help key="emotion"/></span>
            <span class="text-textcolor2 text-xs">{language.emotionWarn}</span>

            <div class="w-full max-w-full border border-selected p-2 rounded-md">

                <table class="w-full max-w-full tabler">
                    <tbody>
                    <tr>
                        <th class="font-medium w-1/3">{language.image}</th>
                        <th class="font-medium w-1/2">{language.emotion}</th>
                        <th class="font-medium"></th>
                    </tr>
                    {#if DBState.currentChar.emotionImages.length === 0}
                        <tr>
                            <td colspan="3">{language.noImages}</td>
                        </tr>
                    {:else}
                        {#each emos as emo, i}
                            <tr>
                                {#await getCharImage(emo[1], 'plain')}
                                    <td class="font-medium truncate w-1/3"></td>
                                {:then im}
                                    <td class="font-medium truncate w-1/3"><img src={im} alt="img" class="w-full"></td>                        
                                {/await}
                                <td class="font-medium truncate w-1/2">
                                    <TextInput marginBottom size='lg' bind:value={DBState.currentChar.emotionImages[i][0]} />
                                </td>
                                <td>
                                    <button class="font-medium cursor-pointer hover:text-green-500" onclick={() => {
                                        rmCharEmotion($selectedCharID,i)
                                    }}><TrashIcon /></button>
                                </td>

                            </tr>
                        {/each}
                    {/if}
                    </tbody>
                </table>

            </div>

            <div class="text-textcolor2 hover:text-textcolor mt-2 flex">
                {#if !$addingEmotion}
                    <button class="cursor-pointer hover:text-green-500" onclick={() => {addCharEmotion($selectedCharID)}}>
                        <PlusIcon />
                    </button>
                {:else}
                    <span>Loading...</span>
                {/if}
            </div>

            {#if (DBState.currentChar as character).inlayViewScreen && (DBState.currentChar as character).newGenData}
                <span class="text-textcolor mt-2">{language.imgGenInstructions}</span>
                <TextAreaInput highlight bind:value={(DBState.currentChar as character).newGenData!.emotionInstructions} />
            {/if}

            <CheckInput bind:check={(DBState.currentChar as character).inlayViewScreen} name={language.inlayViewScreen} onChange={() => {
                if(DBState.currentChar.type === 'character'){
                    const char = DBState.currentChar as character
                    if(char.inlayViewScreen && char.additionalAssets === undefined){
                        char.additionalAssets = []
                    }else if(!char.inlayViewScreen && char.additionalAssets?.length === 0){
                        char.additionalAssets = undefined
                    }
                    char.newGenData = getDefaultNewGenData(char.viewScreen, char.inlayViewScreen ?? false)
                }
            }}/>
        {/if}
        {#if DBState.currentChar.viewScreen === 'imggen'}
            <span class="text-textcolor mt-6">{language.imageGeneration} <Help key="imggen"/></span>
            <span class="text-textcolor2 text-xs">{language.emotionWarn}</span>
            
            <span class="text-textcolor mt-2">{language.imgGenPrompt}</span>
            <TextAreaInput highlight bind:value={(DBState.currentChar as character).newGenData.prompt} />
            <span class="text-textcolor mt-2">{language.imgGenNegatives}</span>
            <TextAreaInput highlight bind:value={(DBState.currentChar as character).newGenData.negative} />
            <span class="text-textcolor mt-2">{language.imgGenInstructions}</span>
            <TextAreaInput highlight bind:value={(DBState.currentChar as character).newGenData.instructions} />

            <CheckInput bind:check={(DBState.currentChar as character).inlayViewScreen} name={language.inlayViewScreen} onChange={() => {
                if(DBState.currentChar.type === 'character'){
                    const char = DBState.currentChar as character
                    char.newGenData = getDefaultNewGenData(char.viewScreen, char.inlayViewScreen ?? false)
                }
            }}/>
        {/if}
    {:else if viewSubMenu === 2}

            {#if DBState.db.newImageHandlingBeta}
            <CheckInput bind:check={DBState.currentChar.prebuiltAssetCommand} name={language.insertAssetPrompt}/>

            {#if DBState.currentChar.prebuiltAssetCommand}

            <span class="text-textcolor mt-2">{language.assetStyle}</span>
            <SelectInput className="mb-2" bind:value={DBState.currentChar.prebuiltAssetStyle}>
                <OptionInput value="">{language.static}</OptionInput>
                <OptionInput value="dynamic">{language.dynamic}</OptionInput>
            </SelectInput>
            {/if}
            {/if}
            <div class="w-full max-w-full border border-selected rounded-md p-2 mt-2">
                <table class="contain w-full max-w-full tabler mt-2">
                <tbody>
                    <tr>
                        <th class="font-medium">{language.value}</th>
                        <th class="font-medium cursor-pointer w-10">
                            <button class="hover:text-green-500" onclick={async () => {
                                if(DBState.currentChar.type === 'character'){
                                    const da = await openFilePicker(['png', 'webp', 'mp4', 'mp3', 'gif', 'jpeg', 'jpg', 'ttf', 'otf', 'css', 'webm', 'woff', 'woff2', 'svg', 'avif'], { multiple: true, readContent: true })
                                    DBState.currentChar.additionalAssets = DBState.currentChar.additionalAssets ?? []
                                    if(!da){
                                        return
                                    }
                                    for(const f of da){
                                        const img = f.data
                                        const name = f.name
                                        const extension = name.split('.').pop().toLowerCase()
                                        const imgp = await saveAsset(img,'', extension)
                                        DBState.currentChar.additionalAssets.push([name, imgp, extension])
                                        DBState.currentChar.additionalAssets = DBState.currentChar.additionalAssets
                                    }
                                }
                            }}>
                                <PlusIcon />
                            </button>
                        </th>
                    </tr>
                    {#if (!DBState.currentChar.additionalAssets) || DBState.currentChar.additionalAssets.length === 0}
                        <tr>
                            <td class="text-textcolor2"> No Assets</td>
                        </tr>
                    {:else}
                        {#each DBState.currentChar.additionalAssets as assets, i}
                            <tr>
                                <td class="font-medium truncate">
                                    {#if assetFilePath[i] && DBState.db.useAdditionalAssetsPreview}
                                        {#if assetFileExtensions[i] === 'mp4'}
                                            <video controls class="mt-2 px-2 w-full m-1 rounded-md"><source src={assetFilePath[i]} type="video/mp4"></video>
                                        {:else if assetFileExtensions[i] === 'mp3'}
                                            <audio controls class="mt-2 px-2 w-full h-16 m-1 rounded-md" loop><source src={assetFilePath[i]} type="audio/mpeg"></audio>
                                        {:else if ['png', 'webp', 'jpeg', 'jpg', 'gif'].includes(assetFileExtensions[i])}
                                            <img src={assetFilePath[i]} class="w-16 h-16 m-1 rounded-md" alt={assets[0]}/>
                                        {/if}
                                    {/if}
                                    <TextInput size="sm" marginBottom bind:value={DBState.currentChar.additionalAssets[i][0]} placeholder="..." />
                                </td>
                                
                                <th class="font-medium cursor-pointer w-10">
                                    <button class="hover:text-blue-500" onclick={() => {
                                        if(DBState.currentChar.type === 'character'){
                                            DBState.currentChat.fmIndex = -1
                                            let additionalAssets = DBState.currentChar.additionalAssets
                                            additionalAssets.splice(i, 1)
                                            DBState.currentChar.additionalAssets = additionalAssets
                                        }
                                    }}>
                                        <TrashIcon />
                                    </button>
                                    {#if DBState.db.useAdditionalAssetsPreview}
                                        <button class="hover:text-blue-500" class:text-textcolor2={DBState.currentChar.prebuiltAssetExclude?.includes?.(assets[1])} onclick={() => {
                                            DBState.currentChar.prebuiltAssetExclude ??= []
                                            if(DBState.currentChar.prebuiltAssetExclude.includes(assets[1])){
                                                DBState.currentChar.prebuiltAssetExclude = DBState.currentChar.prebuiltAssetExclude.filter((e) => e !== assets[1])
                                            }
                                            else {
                                                DBState.currentChar.prebuiltAssetExclude.push(assets[1])
                                            }
                                        }}>
                                            {#if DBState.currentChar?.prebuiltAssetExclude?.includes?.(assets[1])}
                                                <ImageOffIcon />
                                            {:else}
                                                <ImageIcon />
                                            {/if}
                                        </button>
                                    {/if}
                                </th>
                            </tr>
                        {/each}
                    {/if}
                </tbody>
                </table>
            </div>
    {/if}
{:else if viewState.charConfigSubMenu === 3}
    {#if !layoutState.betaMobile.enabled}
        <h2 class="mb-2 text-2xl font-bold mt-2">{language.loreBook} <Help key="lorebook"/></h2>
    {/if}
    <LoreBook />
{:else if viewState.charConfigSubMenu === 4}
    {#if DBState.currentChar.type === 'character'}
        {#if !layoutState.betaMobile.enabled}
            <h2 class="mb-2 text-2xl font-bold mt-2">{language.scripts}</h2>
        {/if}

        <span class="text-textcolor mt-2">{language.backgroundHTML} <Help key="backgroundHTML" /></span>
        <TextAreaInput highlight margin="both" autocomplete="off" bind:value={DBState.currentChar.backgroundHTML}></TextAreaInput>

        <span class="text-textcolor mt-4">{language.regexScript} <Help key="regexScript"/></span>
        <RegexList bind:value={DBState.currentChar.customscript} />
        <div class="text-textcolor2 mt-2 flex gap-2">
            <button class="font-medium cursor-pointer hover:text-green-500" onclick={() => {
                if(DBState.currentChar.type === 'character'){
                    let script = DBState.currentChar.customscript
                    script.push({
                    comment: "",
                    in: "",
                    out: "",
                    type: "editinput"
                    })
                    DBState.currentChar.customscript = script
                }
            }}><PlusIcon /></button>
            <button class="font-medium cursor-pointer hover:text-green-500" onclick={() => {
                exportRegex(DBState.currentChar.customscript)
            }}><DownloadIcon /></button>
            <button class="font-medium cursor-pointer hover:text-green-500" onclick={async () => {
                DBState.currentChar.customscript = await importRegex(DBState.currentChar.customscript)
            }}><HardDriveUploadIcon /></button>
        </div>

        <span class="text-textcolor mt-4">{language.triggerScript} <Help key="triggerScript"/></span>
        <TriggerList bind:value={(DBState.currentChar as character).triggerscript} lowLevelAble={DBState.currentChar.lowLevelAccess} />


        {#if DBState.currentChar.virtualscript || DBState.db.showUnrecommended}
            <span class="text-textcolor mt-4">{language.charjs} <Help key="charjs" unrecommended/></span>
            <TextAreaInput margin="both" autocomplete="off" bind:value={DBState.currentChar.virtualscript}></TextAreaInput>
        {/if}
    {/if}
{:else if viewState.charConfigSubMenu === 6}

    {#if DBState.currentChar.license !== 'CC BY-NC-SA 4.0'
    && DBState.currentChar.license !== 'CC BY-SA 4.0'
    }
        <Button size="lg" onclick={async () => {
            if(await alertTOS()){
                realmState.uploadTarget = 'character'
            }
        }} className="mt-2">
            {#if DBState.currentChar.realmId}
                {language.updateRealm}
            {:else}
                {language.shareCloud}
            {/if}
        </Button>
    {/if}

    {#if DBState.currentChar.license !== 'CC BY-NC-SA 4.0'
        && DBState.currentChar.license !== 'CC BY-SA 4.0'
        && DBState.currentChar.license !== 'CC BY-ND 4.0'
        && DBState.currentChar.license !== 'CC BY-NC-ND 4.0'
        || DBState.db.tpo
        }
        <Button size="sm" onclick={async () => {
            const res = await exportChar($selectedCharID)
        }} className="mt-2">{language.exportCharacter}</Button>
    {/if}

    <Button onclick={async () => {
        removeChar($selectedCharID, DBState.currentChar.name)
    }} className="mt-2" size="sm">{ DBState.currentChar.type === 'group' ? language.removeGroup : language.removeCharacter}</Button>
    
{:else if viewState.charConfigSubMenu === 5}
    <TTSSettings/>
{:else if viewState.charConfigSubMenu === 2}
    {#if !layoutState.betaMobile.enabled}
        <h2 class="mb-2 text-2xl font-bold mt-2">{language.advancedSettings}</h2>
    {/if}
        {#if DBState.currentChar.type !== 'group'}
        <span class="text-textcolor mt-2">Bias <Help key="bias"/></span>
        <div class="w-full max-w-full border border-selected rounded-md p-2 mb-2">

        <table class="w-full max-w-full tabler mt-2">
            <tbody>
            <tr>
                <th class="font-medium w-1/2">Bias</th>
                <th class="font-medium w-1/3">{language.value}</th>
                <th>
                    <button class="font-medium cursor-pointer hover:text-green-500" onclick={() => {
                        if(DBState.currentChar.type === 'character'){
                            (DBState.currentChar as character).bias.push(['', 0])
                        }
                    }}><PlusIcon /></button>
                </th>
            </tr>
            {#if (DBState.currentChar as character).bias.length === 0}
                <tr>
                    <td colspan="3">{language.noBias}</td>

                </tr>
            {/if}
            {#each (DBState.currentChar as character).bias as bias, i}
                <tr class="align-middle text-center">
                    <td class="font-medium truncate w-1/2">
                        <TextInput fullh fullwidth bind:value={(DBState.currentChar as character).bias[i][0]} placeholder="string" />
                    </td> 
                    <td class="font-medium truncate w-1/3">
                        <NumberInput fullh fullwidth bind:value={(DBState.currentChar as character).bias[i][1]} max={100} min={-100} />
                    </td>
                    <td>
                        <button class="font-medium flex justify-center items-center w-full h-full cursor-pointer hover:text-green-500" onclick={() => {
                            if(DBState.currentChar.type === 'character'){
                                (DBState.currentChar as character).bias.splice(i, 1)
                            }
                        }}><TrashIcon /></button>
                    </td>
                </tr>
            {/each}
            </tbody>
            
        </table>
        </div>

        <span class="text-textcolor">{language.exampleMessage} <Help key="exampleMessage"/></span>
        <CodeMirrorEditor bind:value={DBState.currentChar.exampleMessage} class="my-2" />

        <span class="text-textcolor">{language.creatorNotes} <Help key="creatorQuotes"/></span>
        <MultiLangInput bind:value={DBState.currentChar.creatorNotes} className="my-2" onInput={() => {
            DBState.currentChar.removedQuotes = false
        }}></MultiLangInput>

        <span class="text-textcolor">{language.systemPrompt} <Help key="systemPrompt"/></span>
        <CodeMirrorEditor bind:value={DBState.currentChar.systemPrompt} class="my-2" />

        <span class="text-textcolor">{language.replaceGlobalNote} <Help key="replaceGlobalNote"/></span>
        <CodeMirrorEditor bind:value={DBState.currentChar.replaceGlobalNote} class="my-2" />

        <span class="text-textcolor mt-2">{language.additionalText} <Help key="additionalText" /></span>
        <CodeMirrorEditor bind:value={DBState.currentChar.additionalText} class="my-2" />

        {#if DBState.db.showUnrecommended || DBState.currentChar.personality.length > 3}
            <span class="text-textcolor">{language.personality} <Help key="personality" unrecommended/></span>
            <TextAreaInput highlight margin="both" autocomplete="off" bind:value={DBState.currentChar.personality}></TextAreaInput>
        {/if}
        {#if DBState.db.showUnrecommended || DBState.currentChar.scenario.length > 3}
            <span class="text-textcolor">{language.scenario} <Help key="scenario" unrecommended/></span>
            <TextAreaInput highlight margin="both" autocomplete="off" bind:value={DBState.currentChar.scenario}></TextAreaInput>
        {/if}

        <span class="text-textcolor mt-2">{language.defaultVariables} <Help key="defaultVariables" /></span>
        <TextAreaInput margin="both" autocomplete="off" bind:value={DBState.currentChar.defaultVariables}></TextAreaInput>

        <span class="text-textcolor mt-2">{language.translatorNote} <Help key="translatorNote" /></span>
        <TextAreaInput margin="both" autocomplete="off" bind:value={DBState.currentChar.translatorNote}></TextAreaInput>

        <span class="text-textcolor">{language.creator}</span>
        <TextInput size="sm" autocomplete="off" bind:value={DBState.currentChar.additionalData.creator} />

        <span class="text-textcolor">{language.CharVersion}</span>
        <TextInput size="sm" bind:value={DBState.currentChar.additionalData.character_version}/>

        <span class="text-textcolor">{language.nickname} <Help key="nickname" /></span>
        <TextInput size="sm" bind:value={DBState.currentChar.nickname}/>

        <span class="text-textcolor">{language.depthPrompt}</span>
        <div class="flex justify-center items-center">
            <NumberInput size="sm" bind:value={DBState.currentChar.depth_prompt.depth} className="w-12"/>
            <TextInput size="sm" bind:value={DBState.currentChar.depth_prompt.prompt} className="flex-1"/>
        </div>

        <span class="text-textcolor mt-2">{language.altGreet}</span>
        <div class="w-full max-w-full border border-selected rounded-md p-2">
            <table class="contain w-full max-w-full tabler mt-2">
                <tbody>
                <tr>
                    <th class="font-medium">{language.value}</th>
                    <th class="font-medium cursor-pointer w-8">
                        <button class="hover:text-green-500" onclick={() => {
                            if(DBState.currentChar.type === 'character'){
                                let alternateGreetings = DBState.currentChar.alternateGreetings
                                alternateGreetings.push('')
                                DBState.currentChar.alternateGreetings = alternateGreetings
                            }
                        }}>
                            <PlusIcon />
                        </button>
                    </th>
                </tr>
                {#if DBState.currentChar.alternateGreetings.length === 0}
                    <tr>
                        <td colspan="3">{language.noData}</td>
                    </tr>
                {/if}
                {#each DBState.currentChar.alternateGreetings as bias, i}
                    <tr>
                        <td class="font-medium truncate">
                            <CodeMirrorEditor bind:value={DBState.currentChar.alternateGreetings[i]} class="h-[150px]" />
                        </td>
                        <th class="font-medium cursor-pointer w-8">
                            <div class="flex flex-col items-center">
                                <button class="hover:text-blue-500 p-1" onclick={() => moveAlternateGreetingUp(i)} disabled={i === 0}>
                                    <ArrowUp size={16} />
                                </button>
                                <button class="hover:text-blue-500 p-1" onclick={() => moveAlternateGreetingDown(i)} disabled={i === DBState.currentChar.alternateGreetings.length - 1}>
                                    <ArrowDown size={16} />
                                </button>
                                <button class="hover:text-red-500 p-1" onclick={() => {
                                    if(DBState.currentChar.type === 'character'){
                                        DBState.currentChat.fmIndex = -1
                                        let alternateGreetings = DBState.currentChar.alternateGreetings
                                        alternateGreetings.splice(i, 1)
                                        DBState.currentChar.alternateGreetings = alternateGreetings
                                    }
                                }}>
                                    <TrashIcon size={16} />
                                </button>
                            </div>
                        </th>
                    </tr>
                {/each}
            </tbody>
            </table>
        </div>

        <div class="flex items-center mt-4">
            <CheckInput bind:check={DBState.currentChar.lowLevelAccess} name={language.lowLevelAccess}/>
            <span> <Help key="lowLevelAccess" name={language.lowLevelAccess}/></span>
        </div>

        <div class="flex items-center mt-4">
            <CheckInput bind:check={DBState.currentChar.hideChatIcon} name={language.hideChatIcon}/>
        </div>

        <div class="flex items-center mt-4">
            <CheckInput bind:check={DBState.currentChar.utilityBot} name={language.utilityBot}/>
            <span> <Help key="utilityBot" name={language.utilityBot}/></span>
        </div>

        <div class="flex items-center mt-4">
            <CheckInput bind:check={DBState.currentChar.escapeOutput} name={language.escapeOutput}/>
        </div>

        {#if DBState.db.supaModelType !== 'none' && DBState.db.hypav2}
            <Button
                onclick={() => {
                    DBState.currentChat.hypaV2Data ??= {
                        lastMainChunkID: 0,
                        mainChunks: [],
                        chunks: [],
                    }
                    showHypaV2Alert()
                }}
                className="mt-4"
            >
                {language.hypaMemoryV2Modal}
            </Button>
        {:else if DBState.db.hypaV3}
            <Button
                onclick={() => {
                    hypaV3State.open = true
                }}
                className="mt-4"
            >
                {language.hypaMemoryV3Modal}
            </Button>
        {:else if DBState.currentChat.supaMemoryData && DBState.currentChat.supaMemoryData.length > 4 || DBState.currentChar.supaMemory}
            <span class="text-textcolor mt-4">{language.SuperMemory}</span>
            <TextAreaInput margin="both" autocomplete="off" bind:value={DBState.currentChat.supaMemoryData}></TextAreaInput>
        {/if}

        <Button
            onclick={applyModule}
            className="mt-4"
        >
            {language.applyModule}
        </Button>

    {:else}
        {#if DBState.currentChat.supaMemoryData && DBState.currentChat.supaMemoryData.length > 4 || DBState.currentChar.supaMemory}
            <span class="text-textcolor mt-4">{language.SuperMemory}</span>
            <TextAreaInput margin="both" autocomplete="off" bind:value={DBState.currentChat.supaMemoryData}></TextAreaInput>
        {/if}

        <div class="flex items-center mt-4">
            <CheckInput bind:check={DBState.currentChar.lowLevelAccess} name={language.lowLevelAccess}/>
            <span> <Help key="lowLevelAccess" name={language.lowLevelAccess}/></span>
        </div>
    {/if}
{/if}


<style>

    .tabler {
    table-layout: fixed;
    }

    .tabler td {
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .char-grid{
        display: grid;
        grid-template-columns: auto 1fr auto;
    }
</style>