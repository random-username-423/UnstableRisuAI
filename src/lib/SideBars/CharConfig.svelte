<!--
    CharConfig.svelte - Character/Group Settings Sidebar

    Menu Structure ($CharConfigSubMenu):
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
    import { DBState } from 'src/ts/stores.svelte';
    import { untrack } from 'svelte';
    import { CharConfigSubMenu, layoutState, realmState, selectedCharID, hypaV3State } from "../../ts/stores.svelte";
    import { PlusIcon, SmileIcon, TrashIcon, UserIcon, ActivityIcon, BookIcon, User, Braces, Volume2Icon, DownloadIcon, HardDriveUploadIcon, Share2Icon, ImageIcon, ImageOffIcon, ArrowUp, ArrowDown } from '@lucide/svelte'
    import Check from "../UI/GUI/CheckInput.svelte";
    import { addCharEmotion, addingEmotion, getCharImage, rmCharEmotion, selectCharImg, makeGroupImage, removeChar, changeCharImage } from "../../ts/characters.svelte";
    import LoreBook from "./LoreBook/LoreBookSetting.svelte";
    import { alertTOS, showHypaV2Alert } from "../../ts/alert.svelte";
    import BarIcon from "./BarIcon.svelte";
    import { openFilePicker } from "../../ts/utils/util";
    import { getAuthorNoteDefaultText } from "src/ts/process/prompt"
    import { findCharacterbyId } from "../../ts/characters.svelte";
    import Help from "../Others/Help.svelte";
    import { exportChar } from "src/ts/characterCards.svelte";
    import { getElevenTTSVoices, getWebSpeechTTSVoices, getVOICEVOXVoices, oaiVoices, getNovelAIVoices } from "src/ts/process/tts";
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
    import CheckInput from "../UI/GUI/CheckInput.svelte";
    import { getDefaultNewGenData } from "src/ts/process/inlayScreen";
    import { registerOnnxModel } from "src/ts/process/transformers";
    import MultiLangInput from "../UI/GUI/MultiLangInput.svelte";
    import { applyModule } from "src/ts/process/modules";
    import { exportRegex, importRegex } from "src/ts/process/scripts";
    import SliderInput from "../UI/GUI/SliderInput.svelte";
    import Toggles from "./Toggles.svelte";

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
     * Initialize NovelAI TTS config with defaults if not set.
     */
    $effect.pre(() => {
        if (DBState.currentChar.ttsMode === 'novelai' && (DBState.currentChar as character).naittsConfig === undefined) {
            (DBState.currentChar as character).naittsConfig = {
                customvoice: false,
                voice: 'Aini',
                version: 'v2'
            };
        }
    });

    /**
     * Initialize GPT-SoVITS TTS config with defaults if not set.
     */
    $effect.pre(() => {
        if (DBState.currentChar.ttsMode === 'gptsovits' && (DBState.currentChar as character).gptSoVitsConfig === undefined) {
            (DBState.currentChar as character).gptSoVitsConfig = {
                url: '',
                use_auto_path: false,
                ref_audio_path: '',
                use_long_audio: false,
                ref_audio_data: {
                    fileName: '',
                    assetId: ''
                },
                volume: 1.0,
                text_lang: 'auto',
                text: 'en',
                use_prompt: false,
                prompt_lang: 'en',
                top_p: 1,
                temperature: 0.7,
                speed: 1,
                top_k: 5,
                text_split_method: 'cut0',
            };
        }
    });

    // Fish Speech model list
    let fishSpeechModels:{
        _id:string,
        title:string,
        description:string
    }[] = $state([])

    /**
     * Initialize Fish Speech TTS config with defaults if not set.
     */
    $effect.pre(() => {
        if (DBState.currentChar.ttsMode === 'fishspeech' && (DBState.currentChar as character).fishSpeechConfig === undefined) {
            (DBState.currentChar as character).fishSpeechConfig = {
                model: {
                    _id: '',
                    title: '',
                    description: ''
                },
                chunk_length: 200,
                normalize: false,
            };
        }
    });

    /**
     * Redirect to default menu when group selects character-only menus (Scripts, TTS).
     */
    $effect.pre(() => {
        if(DBState.currentChar.type === 'group' && ($CharConfigSubMenu === 4 || $CharConfigSubMenu === 5)){
            $CharConfigSubMenu = 0
        }

    });

    // ===== Functions =====

    /**
     * Fetch model list from Fish Speech API.
     */
    async function getFishSpeechModels() {
        try {
            const res = await fetch(`https://api.fish.audio/model?self=true`, {
                headers: {
                    'Authorization': `Bearer ${DBState.db.fishSpeechKey}`
                }
            });
            const data = await res.json();
            console.log(data.items);
            console.log(DBState.currentChar)
            
            if (Array.isArray(data.items)) {
                fishSpeechModels = data.items.map((item: { _id?: string, title?: string, description?: string }) => ({
                    _id: item._id || '',
                    title: item.title || '',
                    description: item.description || ''
                }));
            } else {
                console.error('Expected an array of items, but received:', data.items);
                fishSpeechModels = [];
            }
        } catch (error) {
            console.error('Error fetching fish speech models:', error);
            fishSpeechModels = [];
        }
    }

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
        <button class={$CharConfigSubMenu === 0 ? 'text-textcolor ' : 'text-textcolor2'} onclick={() => {$CharConfigSubMenu = 0}}>
            <UserIcon size={iconButtonSize} />
        </button>
        <button class={$CharConfigSubMenu === 1 ? 'text-textcolor' : 'text-textcolor2'} onclick={() => {$CharConfigSubMenu = 1}}>
            <SmileIcon size={iconButtonSize} />
        </button>
        <button class={$CharConfigSubMenu === 3 ? 'text-textcolor' : 'text-textcolor2'} onclick={() => {$CharConfigSubMenu = 3}}>
            <BookIcon size={iconButtonSize} />
        </button>
        {#if DBState.currentChar.type === 'character'}
            <button class={$CharConfigSubMenu === 5 ? 'text-textcolor' : 'text-textcolor2'} onclick={() => {$CharConfigSubMenu = 5}}>
                <Volume2Icon size={iconButtonSize} />
            </button>
            <button class={$CharConfigSubMenu === 4 ? 'text-textcolor' : 'text-textcolor2'} onclick={() => {$CharConfigSubMenu = 4}}>
                <Braces size={iconButtonSize} />
            </button>
        {/if}
        <button class={$CharConfigSubMenu === 2 ? 'text-textcolor' : 'text-textcolor2'} onclick={() => {$CharConfigSubMenu = 2}}>
            <ActivityIcon size={iconButtonSize} />
        </button>
        {#if DBState.currentChar.type === 'character'}
            <button class={$CharConfigSubMenu === 6 ? 'text-textcolor' : 'text-textcolor2'} onclick={() => {$CharConfigSubMenu = 6}}>
                <Share2Icon size={iconButtonSize} />
            </button>
        {/if}
    </div>
{/if}


{#if $CharConfigSubMenu === 0}
    {#if DBState.currentChar.type !== 'group' && licensed !== 'private'}
        <TextInput size="xl" marginBottom placeholder="Character Name" bind:value={DBState.currentChar.name} />
        <span class="text-textcolor">{language.description} <Help key="charDesc"/></span>
        <TextAreaInput highlight margin="both" autocomplete="off" bind:value={(DBState.currentChar as character).desc}></TextAreaInput>
        <span class="text-textcolor2 mb-6 text-sm">{tokens.desc} {language.tokens}</span>
        <span class="text-textcolor">{language.firstMessage} <Help key="charFirstMessage"/></span>
        <TextAreaInput highlight margin="both" autocomplete="off" bind:value={DBState.currentChar.firstMessage}></TextAreaInput>
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
                        <Check margin={false} bind:check={(DBState.currentChar as groupChat).characterActive[i]} />
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
    <TextAreaInput
        margin="both"
        autocomplete="off"
        bind:value={DBState.currentChat.note}
        highlight
        placeholder={getAuthorNoteDefaultText()}
    />
    <span class="text-textcolor2 mb-6 text-sm">{tokens.localNote} {language.tokens}</span>

    {#if !layoutState.betaMobile.enabled}
        <Toggles bind:chara={DBState.currentChar} noContainer />

        {#if DBState.currentChar.type === 'group'}
            <div class="flex mt-2 items-center">
                <Check bind:check={(DBState.currentChar as groupChat).orderByOrder} name={language.orderByOrder}/>
            </div>
        {/if}
    {/if}
{:else if licensed === 'private'}
    <span>You are not allowed</span>
    {(() => {
        $CharConfigSubMenu = 0
    })()}
{:else if $CharConfigSubMenu === 1}
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
                <Check bind:check={(DBState.currentChar as character).largePortrait} name={language.largePortrait}/>
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
                <TextAreaInput highlight bind:value={(DBState.currentChar as character).newGenData.emotionInstructions} />
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
{:else if $CharConfigSubMenu === 3}
    {#if !layoutState.betaMobile.enabled}
        <h2 class="mb-2 text-2xl font-bold mt-2">{language.loreBook} <Help key="lorebook"/></h2>
    {/if}
    <LoreBook />
{:else if $CharConfigSubMenu === 4}
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
{:else if $CharConfigSubMenu === 6}

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
    
{:else if $CharConfigSubMenu === 5}
    {#if DBState.currentChar.type === 'character'}
        {#if !layoutState.betaMobile.enabled}
            <h2 class="mb-2 text-2xl font-bold mt-2">TTS</h2>
        {/if}
        <span class="text-textcolor">{language.provider}</span>
        <SelectInput className="mb-4 mt-2" bind:value={DBState.currentChar.ttsMode} onchange={(e) => {
            if(DBState.currentChar.type === 'character'){
                (DBState.currentChar as character).ttsSpeech = ''
            }
        }}>
            <OptionInput value="">{language.disabled}</OptionInput>
            <OptionInput value="elevenlab">ElevenLabs</OptionInput>
            <OptionInput value="webspeech">Web Speech</OptionInput>
            <OptionInput value="VOICEVOX">VOICEVOX</OptionInput>
            <OptionInput value="openai">OpenAI</OptionInput>
            <OptionInput value="novelai">NovelAI</OptionInput>
            <OptionInput value="huggingface">Huggingface</OptionInput>
            <OptionInput value="vits">VITS</OptionInput>
            <OptionInput value="gptsovits">GPT-SoVITS</OptionInput>
            <OptionInput value="fishspeech">fish-speech</OptionInput>
        </SelectInput>
        

        {#if DBState.currentChar.ttsMode === 'webspeech'}
            {#if !speechSynthesis}
                <span class="text-textcolor">Web Speech isn't supported in your browser or OS</span>
            {:else}
                <span class="text-textcolor">{language.Speech}</span>
                <SelectInput className="mb-4 mt-2" bind:value={(DBState.currentChar as character).ttsSpeech}>
                    <OptionInput value="">Auto</OptionInput>
                    {#each getWebSpeechTTSVoices() as voice}
                        <OptionInput value={voice}>{voice}</OptionInput>
                    {/each}
                </SelectInput>
                {#if (DBState.currentChar as character).ttsSpeech !== ''}
                    <span class="text-red-400 text-sm">If you do not set it to Auto, it may not work properly when importing from another OS or browser.</span>
                {/if}
            {/if}
        {:else if DBState.currentChar.ttsMode === 'elevenlab'}
            <span class="text-sm mb-2 text-textcolor2">Please set the ElevenLabs API key in "global Settings → Bot Settings → Others → ElevenLabs API key"</span>
            {#await getElevenTTSVoices() then voices}
                <span class="text-textcolor">{language.Speech}</span>
                <SelectInput className="mb-4 mt-2" bind:value={(DBState.currentChar as character).ttsSpeech}>
                    <OptionInput value="">Unset</OptionInput>
                        {#each voices as voice}
                            <OptionInput value={voice.voice_id}>{voice.name}</OptionInput>
                        {/each}
                </SelectInput>
            {/await}
         {:else if DBState.currentChar.ttsMode === 'VOICEVOX'}
                <span class="text-textcolor">Speaker</span>
                <SelectInput className="mb-4 mt-2" bind:value={DBState.currentChar.voicevoxConfig.speaker}>
                    {#await getVOICEVOXVoices() then voices}
                        {#each voices as voice}
                            <OptionInput value={voice.list}  selected={DBState.currentChar.voicevoxConfig.speaker === voice.list}>{voice.name}</OptionInput>
                        {/each}
                    {/await}
                </SelectInput>
                {#if DBState.currentChar.voicevoxConfig.speaker}
                <span class="text=neutral-200">Style</span>
                <SelectInput className="mb-4 mt-2" bind:value={DBState.currentChar.ttsSpeech}>
                {#each JSON.parse(DBState.currentChar.voicevoxConfig.speaker) as styles}
                        <OptionInput value={styles.id} selected={DBState.currentChar.ttsSpeech === styles.id}>{styles.name}</OptionInput>
                {/each}
                </SelectInput>
                {/if}
                <span class="text-textcolor">Speed scale</span>
                <NumberInput size={"sm"} marginBottom bind:value={DBState.currentChar.voicevoxConfig.SPEED_SCALE}/>

                <span class="text-textcolor">Pitch scale</span>
                <NumberInput size={"sm"} marginBottom bind:value={DBState.currentChar.voicevoxConfig.PITCH_SCALE}/>

                <span class="text-textcolor">Volume scale</span>
                <NumberInput size={"sm"} marginBottom bind:value={DBState.currentChar.voicevoxConfig.VOLUME_SCALE}/>

                <span class="text-textcolor">Intonation scale</span>
                <NumberInput size={"sm"} marginBottom bind:value={DBState.currentChar.voicevoxConfig.INTONATION_SCALE}/>
                <span class="text-sm mb-2 text-textcolor2">To use VOICEVOX, you need to run a colab and put the localtunnel URL in "Settings → Other Bots". https://colab.research.google.com/drive/1tyeXJSklNfjW-aZJAib1JfgOMFarAwze</span>
        {:else if DBState.currentChar.ttsMode === 'novelai'}
            <span class="text-textcolor">Custom Voice Seed</span>
            <Check bind:check={DBState.currentChar.naittsConfig.customvoice}/>
            {#if !DBState.currentChar.naittsConfig.customvoice}
                <span class="text-textcolor">Voice</span>
                <SelectInput className="mb-4 mt-2" bind:value={DBState.currentChar.naittsConfig.voice}>
                    {#await getNovelAIVoices() then voices}
                        {#each voices as voiceGroup}
                            <optgroup label={voiceGroup.gender} class="bg-darkbg appearance-none">
                                {#each voiceGroup.voices as voice}
                                    <OptionInput value={voice} selected={DBState.currentChar.naittsConfig.voice === voice}>{voice}</OptionInput>
                                {/each}
                            </optgroup>
                        {/each}
                    {/await}
                </SelectInput>
            {:else}
                <span class="text-textcolor">Voice</span>
                <TextInput size={"sm"} bind:value={DBState.currentChar.naittsConfig.voice}/>
            {/if}
            <span class="text-textcolor">Version</span>
            <SelectInput className="mb-4 mt-2" bind:value={DBState.currentChar.naittsConfig.version}>
                <OptionInput value="v1">v1</OptionInput>
                <OptionInput value="v2">v2</OptionInput>
            </SelectInput>
        {:else if DBState.currentChar.ttsMode === 'openai'}
            <SelectInput className="mb-4 mt-2" bind:value={DBState.currentChar.oaiVoice}>
                <OptionInput value="">Unset</OptionInput>
                {#each oaiVoices as voice}
                    <OptionInput value={voice}>{voice}</OptionInput>
                {/each}
            </SelectInput>
        {:else if DBState.currentChar.ttsMode === 'huggingface'}
            <span class="text-textcolor">Model</span>
            <TextInput className="mb-4 mt-2" bind:value={DBState.currentChar.hfTTS.model} />

            <span class="text-textcolor">Language</span>
            <TextInput className="mb-4 mt-2" bind:value={DBState.currentChar.hfTTS.language} placeholder="en" />
        {:else if DBState.currentChar.ttsMode === 'vits'}
            {#if DBState.currentChar.vits}
                <span class="text-textcolor">{DBState.currentChar.vits.name ?? 'Unnamed VitsModel'}</span>
            {:else}
                <span class="text-textcolor">No Model</span>
            {/if}
            <Button onclick={async () => {
                const modelFile = await openFilePicker(['zip'], { readContent: true })
                if(modelFile == null){
                    return;
                }
                const model = await registerOnnxModel(modelFile.data, modelFile.name)
                if(model && DBState.currentChar.type === 'character'){
                    DBState.currentChar.vits = model
                }
            }}>{language.selectModel}</Button>
        {:else if DBState.currentChar.ttsMode === 'gptsovits'}
            <span class="text-textcolor">Volume</span>
            <SliderInput min={0.0} max={1.0} step={0.01} fixed={2} bind:value={DBState.currentChar.gptSoVitsConfig.volume}/>
            <span class="text-textcolor">URL</span>
            <TextInput className="mb-4 mt-2" bind:value={DBState.currentChar.gptSoVitsConfig.url}/>

            <span class="text-textcolor">Use Auto Path</span>
            <Check bind:check={DBState.currentChar.gptSoVitsConfig.use_auto_path}/>

            {#if !DBState.currentChar.gptSoVitsConfig.use_auto_path}
                <span class="text-textcolor">Reference Audio Path (e.g. C:/Users/user/Downloads/GPT-SoVITS-v2-240821)</span>
                <TextInput className="mb-4 mt-2" bind:value={DBState.currentChar.gptSoVitsConfig.ref_audio_path}/>
            {/if}

            <span class="text-textcolor">Use Long Audio</span>
            <Check bind:check={DBState.currentChar.gptSoVitsConfig.use_long_audio}/>

            <span class="text-textcolor">Reference Audio Data (3~10s audio file)</span>
            <Button onclick={async () => {
                const audio = await openFilePicker([
                    'wav',
                    'ogg',
                    'aac',
                    'mp3'
                ], { readContent: true })
                if(!audio){
                    return null
                }
                const saveId = await saveAsset(audio.data)
                DBState.currentChar.gptSoVitsConfig.ref_audio_data = {
                    fileName: audio.name,
                    assetId: saveId
                }

            }}
            className="h-10">
                
                {#if DBState.currentChar.gptSoVitsConfig.ref_audio_data.assetId === '' || DBState.currentChar.gptSoVitsConfig.ref_audio_data.assetId === undefined}
                    {language.selectFile}
                {:else}
                    {DBState.currentChar.gptSoVitsConfig.ref_audio_data.fileName}
                {/if}
            </Button>
            <span class="text-textcolor">Text Language</span>
            <SelectInput className="mb-4 mt-2" bind:value={DBState.currentChar.gptSoVitsConfig.text_lang}>
                <OptionInput value="auto">Multi-language Mixed</OptionInput>
                <OptionInput value="auto_yue">Multi-language Mixed (Cantonese)</OptionInput>
                <OptionInput value="en">English</OptionInput>
                <OptionInput value="zh">Chinese-English Mixed</OptionInput>
                <OptionInput value="ja">Japanese-English Mixed</OptionInput>
                <OptionInput value="yue">Cantonese-English Mixed</OptionInput>
                <OptionInput value="ko">Korean-English Mixed</OptionInput>
                <OptionInput value="all_zh">Chinese</OptionInput>
                <OptionInput value="all_ja">Japanese</OptionInput>
                <OptionInput value="all_yue">Cantonese</OptionInput>
                <OptionInput value="all_ko">Korean</OptionInput>
            </SelectInput>

            {#if !DBState.currentChar.gptSoVitsConfig.use_long_audio}
                <span class="text-textcolor">Use Reference Audio Script</span>
                <Check bind:check={DBState.currentChar.gptSoVitsConfig.use_prompt}/>
            {/if}

            {#if DBState.currentChar.gptSoVitsConfig.use_prompt && !DBState.currentChar.gptSoVitsConfig.use_long_audio}
                <span class="text-textcolor">Reference Audio Script</span>
                <TextAreaInput className="mb-4 mt-2" bind:value={DBState.currentChar.gptSoVitsConfig.prompt}/>
            {/if}

            <span class="text-textcolor">Reference Audio Language</span>
            <SelectInput className="mb-4 mt-2" bind:value={DBState.currentChar.gptSoVitsConfig.prompt_lang}>
                <OptionInput value="auto">Multi-language Mixed</OptionInput>
                <OptionInput value="auto_yue">Multi-language Mixed (Cantonese)</OptionInput>
                <OptionInput value="en">English</OptionInput>
                <OptionInput value="zh">Chinese-English Mixed</OptionInput>
                <OptionInput value="ja">Japanese-English Mixed</OptionInput>
                <OptionInput value="yue">Cantonese-English Mixed</OptionInput>
                <OptionInput value="ko">Korean-English Mixed</OptionInput>
                <OptionInput value="all_zh">Chinese</OptionInput>
                <OptionInput value="all_ja">Japanese</OptionInput>
                <OptionInput value="all_yue">Cantonese</OptionInput>
                <OptionInput value="all_ko">Korean</OptionInput>
            </SelectInput>
            <span class="text-textcolor">Top P</span>
            <SliderInput min={0.0} max={1.0} step={0.05} fixed={2} bind:value={DBState.currentChar.gptSoVitsConfig.top_p}/>

            <span class="text-textcolor">Temperature</span>
            <SliderInput min={0.0} max={1.0} step={0.05} fixed={2} bind:value={DBState.currentChar.gptSoVitsConfig.temperature}/>

            <span class="text-textcolor">Speed</span>
            <SliderInput min={0.6} max={1.65} step={0.05} fixed={2} bind:value={DBState.currentChar.gptSoVitsConfig.speed}/>

            <span class="text-textcolor">Top K</span>
            <SliderInput min={1} max={100} step={1} bind:value={DBState.currentChar.gptSoVitsConfig.top_k}/>

            <span class="text-textcolor">Text Split Method</span>
            <SelectInput className="mb-4 mt-2" bind:value={DBState.currentChar.gptSoVitsConfig.text_split_method}>
                <OptionInput value="cut0">Cut 0 (No splitting)</OptionInput>
                <OptionInput value="cut1">Cut 1 (Split every 4 sentences)</OptionInput>
                <OptionInput value="cut2">Cut 2 (Split every 50 characters)</OptionInput>
                <OptionInput value="cut3">Cut 3 (Split by Chinese periods)</OptionInput>
                <OptionInput value="cut4">Cut 4 (Split by English periods)</OptionInput>
                <OptionInput value="cut5">Cut 5 (Split by various punctuation marks)</OptionInput>
            </SelectInput>        
        {:else if DBState.currentChar.ttsMode === 'fishspeech'}
            {#await getFishSpeechModels()}
                <span class="text-textcolor">Loading...</span>
            {:then}
                <span class="text-textcolor">Model</span>
                <SelectInput className="mb-4 mt-2" bind:value={DBState.currentChar.fishSpeechConfig.model._id}>
                    <OptionInput value="">Not selected</OptionInput>
                    {#each fishSpeechModels as model}
                        <OptionInput value={model._id}>
                            <div class="flex items-center">
                                <span>{model.title}</span>
                                <span class="text-sm text-textcolor2">{model.description}</span>
                            </div>
                        </OptionInput>
                    {/each}
                </SelectInput>
            {:catch}
                <span class="text-textcolor">An error occurred while fetching the models.</span>
            {/await}

            <span class="text-textcolor">Chunk Length</span>
            <NumberInput className="mb-4 mt-2" bind:value={DBState.currentChar.fishSpeechConfig.chunk_length}/>

            <span class="mt-2 text-textcolor">Normalize</span>
            <Check className="mb-4 mt-2" bind:check={DBState.currentChar.fishSpeechConfig.normalize}/>
        {/if}
        {#if DBState.currentChar.ttsMode}
            <div class="flex items-center mt-2">
                <Check bind:check={DBState.currentChar.ttsReadOnlyQuoted} name={language.ttsReadOnlyQuoted}/>
            </div>
        {/if}
    {/if}
{:else if $CharConfigSubMenu === 2}
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
        <TextAreaInput highlight margin="both" autocomplete="off" bind:value={DBState.currentChar.exampleMessage}></TextAreaInput>

        <span class="text-textcolor">{language.creatorNotes} <Help key="creatorQuotes"/></span>
        <MultiLangInput bind:value={DBState.currentChar.creatorNotes} className="my-2" onInput={() => {
            DBState.currentChar.removedQuotes = false
        }}></MultiLangInput>

        <span class="text-textcolor">{language.systemPrompt} <Help key="systemPrompt"/></span>
        <TextAreaInput highlight margin="both" autocomplete="off" bind:value={DBState.currentChar.systemPrompt}></TextAreaInput>

        <span class="text-textcolor">{language.replaceGlobalNote} <Help key="replaceGlobalNote"/></span>
        <TextAreaInput highlight margin="both" autocomplete="off" bind:value={DBState.currentChar.replaceGlobalNote}></TextAreaInput>

        <span class="text-textcolor mt-2">{language.additionalText} <Help key="additionalText" /></span>
        <TextAreaInput highlight margin="both" autocomplete="off" bind:value={DBState.currentChar.additionalText}></TextAreaInput>

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
                            <TextAreaInput highlight bind:value={DBState.currentChar.alternateGreetings[i]} placeholder="..." fullwidth />
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
            <Check bind:check={DBState.currentChar.lowLevelAccess} name={language.lowLevelAccess}/>
            <span> <Help key="lowLevelAccess" name={language.lowLevelAccess}/></span>
        </div>

        <div class="flex items-center mt-4">
            <Check bind:check={DBState.currentChar.hideChatIcon} name={language.hideChatIcon}/>
        </div>

        <div class="flex items-center mt-4">
            <Check bind:check={DBState.currentChar.utilityBot} name={language.utilityBot}/>
            <span> <Help key="utilityBot" name={language.utilityBot}/></span>
        </div>

        <div class="flex items-center mt-4">
            <Check bind:check={DBState.currentChar.escapeOutput} name={language.escapeOutput}/>
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
            <Check bind:check={DBState.currentChar.lowLevelAccess} name={language.lowLevelAccess}/>
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