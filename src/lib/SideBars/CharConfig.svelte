<script lang="ts">
    import { language } from "../../lang"
    import { tokenizeAccurate } from "../../ts/utils/tokenizer"
    import { saveImage as saveAsset } from "../../ts/data/storage/database.svelte"
    import type { character, groupChat } from "../../ts/data/storage/types"
    import { DBState } from "src/ts/stores.svelte"
    import { ChatState, RealmState, ModalState } from "../../ts/stores.svelte"
    import { MobileState } from "src/ts/stores.svelte"
    import {
        PlusIcon,
        SmileIcon,
        TrashIcon,
        UserIcon,
        ActivityIcon,
        BookIcon,
        User,
        CurlyBraces,
        Volume2Icon,
        DownloadIcon,
        HardDriveUploadIcon,
        Share2Icon,
        ImageIcon,
        ImageOffIcon,
        ArrowUp,
        ArrowDown,
    } from "lucide-svelte"
    import Check from "../UI/GUI/CheckInput.svelte"
    import {
        addCharEmotion,
        addingEmotion,
        getCharImage,
        rmCharEmotion,
        selectCharImg,
        makeGroupImage,
        removeChar,
        changeCharImage,
    } from "../../ts/character/characters.svelte"
    import LoreBook from "./LoreBook/LoreBookSetting.svelte"
    import { alertTOS, showHypaV2Alert } from "../../ts/utils/alert.svelte"
    import BarIcon from "./BarIcon.svelte"
    import {
        findCharacterbyId,
        getAuthorNoteDefaultText,
        selectMultipleFile,
        selectSingleFile,
    } from "../../ts/utils/util"
    import Help from "../Others/Help.svelte"
    import { exportChar } from "src/ts/character/characterCards.svelte"
    import {
        getElevenTTSVoices,
        getWebSpeechTTSVoices,
        getVOICEVOXVoices,
        oaiVoices,
        getNovelAIVoices,
    } from "src/ts/process/postprocess/tts"
    import { getFileSrc } from "src/ts/utils/fileIO"
    import { addGroupChar, rmCharFromGroup } from "src/ts/process/chat/group"
    import TextInput from "../UI/GUI/TextInput.svelte"
    import NumberInput from "../UI/GUI/NumberInput.svelte"
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte"
    import Button from "../UI/GUI/Button.svelte"
    import SelectInput from "../UI/GUI/SelectInput.svelte"
    import OptionInput from "../UI/GUI/OptionInput.svelte"
    import RegexList from "./Scripts/RegexList.svelte"
    import TriggerList from "./Scripts/TriggerList.svelte"
    import CheckInput from "../UI/GUI/CheckInput.svelte"
    import { updateInlayScreen } from "src/ts/process/postprocess/inlayScreen"
    import { registerOnnxModel } from "src/ts/process/integrations/transformers"
    import MultiLangInput from "../UI/GUI/MultiLangInput.svelte"
    import { applyModule } from "src/ts/process/scripting/modules"
    import { exportRegex, importRegex } from "src/ts/process/scripting/scripts"
    import SliderInput from "../UI/GUI/SliderInput.svelte"
    import Toggles from "./Toggles.svelte"

    let iconRemoveMode = $state(false)
    let viewSubMenu = $state(0)
    let emos: [string, string][] = $state([])
    let iconButtonSize = window.innerWidth > 360 ? (24 as const) : (20 as const)
    let tokens = $state({
        desc: 0,
        firstMsg: 0,
        localNote: 0,
        charaNote: 0,
    })

    let lasttokens = {
        desc: "",
        firstMsg: "",
        localNote: "",
        charaNote: "",
    }

    async function loadTokenize(chara) {
        // Skip if chat is not fully loaded yet (lazy loading)
        const currentChat =
            DBState.db.characters[ChatState.selectedCharId]?.chats?.[
                DBState.db.characters[ChatState.selectedCharId]?.chatPage
            ]
        if (currentChat?.message === undefined) return

        const cha = chara
        if (cha.type !== "group") {
            if (lasttokens.desc !== cha.desc) {
                if (cha.desc) {
                    lasttokens.desc = cha.desc
                    tokens.desc = await tokenizeAccurate(cha.desc)
                }
            }
            if (lasttokens.firstMsg !== chara.firstMessage) {
                if (chara.firstMessage) {
                    lasttokens.firstMsg = chara.firstMessage
                    tokens.firstMsg = await tokenizeAccurate(chara.firstMessage)
                }
            }
        }

        if (lasttokens.localNote !== currentChat.note) {
            lasttokens.localNote = currentChat.note ?? ""
            tokens.localNote = await tokenizeAccurate(currentChat.note ?? "")
        }
    }

    let assetFileExtensions: string[] = $state([])
    let assetFilePath: string[] = $state([])
    let licensed = $derived(
        DBState.db.characters[ChatState.selectedCharId].type === "character"
            ? (DBState.db.characters[ChatState.selectedCharId] as character).license
            : ""
    )

    $effect.pre(() => {
        emos = DBState.db.characters[ChatState.selectedCharId].emotionImages
        loadTokenize(DBState.db.characters[ChatState.selectedCharId])

        if (
            DBState.db.characters[ChatState.selectedCharId].type === "character" &&
            DBState.db.useAdditionalAssetsPreview
        ) {
            if ((DBState.db.characters[ChatState.selectedCharId] as character).additionalAssets) {
                for (
                    let i = 0;
                    i < (DBState.db.characters[ChatState.selectedCharId] as character).additionalAssets.length;
                    i++
                ) {
                    if (
                        (DBState.db.characters[ChatState.selectedCharId] as character).additionalAssets[i].length > 2 &&
                        (DBState.db.characters[ChatState.selectedCharId] as character).additionalAssets[i][2]
                    ) {
                        assetFileExtensions[i] = (
                            DBState.db.characters[ChatState.selectedCharId] as character
                        ).additionalAssets[i][2]
                    } else
                        assetFileExtensions[i] = (
                            DBState.db.characters[ChatState.selectedCharId] as character
                        ).additionalAssets[i][1]
                            .split(".")
                            .pop()
                    getFileSrc(
                        (DBState.db.characters[ChatState.selectedCharId] as character).additionalAssets[i][1]
                    ).then((filePath) => {
                        assetFilePath[i] = filePath
                    })
                }
            }
        }
    })

    $effect.pre(() => {
        if (
            DBState.db.characters[ChatState.selectedCharId].ttsMode === "novelai" &&
            (DBState.db.characters[ChatState.selectedCharId] as character).naittsConfig === undefined
        ) {
            ;(DBState.db.characters[ChatState.selectedCharId] as character).naittsConfig = {
                customvoice: false,
                voice: "Aini",
                version: "v2",
            }
        }
    })
    $effect.pre(() => {
        if (
            DBState.db.characters[ChatState.selectedCharId].ttsMode === "gptsovits" &&
            (DBState.db.characters[ChatState.selectedCharId] as character).gptSoVitsConfig === undefined
        ) {
            ;(DBState.db.characters[ChatState.selectedCharId] as character).gptSoVitsConfig = {
                url: "",
                use_auto_path: false,
                ref_audio_path: "",
                use_long_audio: false,
                ref_audio_data: {
                    fileName: "",
                    assetId: "",
                },
                volume: 1.0,
                text_lang: "auto",
                text: "en",
                use_prompt: false,
                prompt_lang: "en",
                top_p: 1,
                temperature: 0.7,
                speed: 1,
                top_k: 5,
                text_split_method: "cut0",
            }
        }
    })

    let fishSpeechModels: {
        _id: string
        title: string
        description: string
    }[] = $state([])

    $effect.pre(() => {
        if (
            DBState.db.characters[ChatState.selectedCharId].ttsMode === "fishspeech" &&
            (DBState.db.characters[ChatState.selectedCharId] as character).fishSpeechConfig === undefined
        ) {
            ;(DBState.db.characters[ChatState.selectedCharId] as character).fishSpeechConfig = {
                model: {
                    _id: "",
                    title: "",
                    description: "",
                },
                chunk_length: 200,
                normalize: false,
            }
        }
    })

    $effect.pre(() => {
        if (
            DBState.db.characters[ChatState.selectedCharId].type === "group" &&
            (ChatState.configSubMenu === 4 || ChatState.configSubMenu === 5)
        ) {
            ChatState.configSubMenu = 0
        }
    })

    async function getFishSpeechModels() {
        try {
            const res = await fetch(`https://api.fish.audio/model?self=true`, {
                headers: {
                    Authorization: `Bearer ${DBState.db.fishSpeechKey}`,
                },
            })
            const data = await res.json()
            console.log(data.items)
            console.log(DBState.db.characters[ChatState.selectedCharId])

            if (Array.isArray(data.items)) {
                fishSpeechModels = data.items.map((item) => ({
                    _id: item._id || "",
                    title: item.title || "",
                    description: item.description || "",
                }))
            } else {
                console.error("Expected an array of items, but received:", data.items)
                fishSpeechModels = []
            }
        } catch (error) {
            console.error("Error fetching fish speech models:", error)
            fishSpeechModels = []
        }
    }

    function moveAlternateGreetingUp(index: number) {
        if (index === 0) return
        if (DBState.db.characters[ChatState.selectedCharId].type === "character") {
            let alternateGreetings = DBState.db.characters[ChatState.selectedCharId].alternateGreetings
            let temp = alternateGreetings[index]
            alternateGreetings[index] = alternateGreetings[index - 1]
            alternateGreetings[index - 1] = temp
            DBState.db.characters[ChatState.selectedCharId].alternateGreetings = alternateGreetings
        }
    }

    function moveAlternateGreetingDown(index: number) {
        if (index === DBState.db.characters[ChatState.selectedCharId].alternateGreetings.length - 1) return
        if (DBState.db.characters[ChatState.selectedCharId].type === "character") {
            let alternateGreetings = DBState.db.characters[ChatState.selectedCharId].alternateGreetings
            let temp = alternateGreetings[index]
            alternateGreetings[index] = alternateGreetings[index + 1]
            alternateGreetings[index + 1] = temp
            DBState.db.characters[ChatState.selectedCharId].alternateGreetings = alternateGreetings
        }
    }
</script>

{#if licensed !== "private" && !MobileState.enabled}
    <div class="mb-2 flex" class:gap-2={iconButtonSize === 24} class:gap-1={iconButtonSize < 24}>
        <button
            class={ChatState.configSubMenu === 0 ? "text-textcolor " : "text-textcolor2"}
            onclick={() => {
                ChatState.configSubMenu = 0
            }}
        >
            <UserIcon size={iconButtonSize} />
        </button>
        <button
            class={ChatState.configSubMenu === 1 ? "text-textcolor" : "text-textcolor2"}
            onclick={() => {
                ChatState.configSubMenu = 1
            }}
        >
            <SmileIcon size={iconButtonSize} />
        </button>
        <button
            class={ChatState.configSubMenu === 3 ? "text-textcolor" : "text-textcolor2"}
            onclick={() => {
                ChatState.configSubMenu = 3
            }}
        >
            <BookIcon size={iconButtonSize} />
        </button>
        {#if DBState.db.characters[ChatState.selectedCharId].type === "character"}
            <button
                class={ChatState.configSubMenu === 5 ? "text-textcolor" : "text-textcolor2"}
                onclick={() => {
                    ChatState.configSubMenu = 5
                }}
            >
                <Volume2Icon size={iconButtonSize} />
            </button>
            <button
                class={ChatState.configSubMenu === 4 ? "text-textcolor" : "text-textcolor2"}
                onclick={() => {
                    ChatState.configSubMenu = 4
                }}
            >
                <CurlyBraces size={iconButtonSize} />
            </button>
        {/if}
        <button
            class={ChatState.configSubMenu === 2 ? "text-textcolor" : "text-textcolor2"}
            onclick={() => {
                ChatState.configSubMenu = 2
            }}
        >
            <ActivityIcon size={iconButtonSize} />
        </button>
        {#if DBState.db.characters[ChatState.selectedCharId].type === "character"}
            <button
                class={ChatState.configSubMenu === 6 ? "text-textcolor" : "text-textcolor2"}
                onclick={() => {
                    ChatState.configSubMenu = 6
                }}
            >
                <Share2Icon size={iconButtonSize} />
            </button>
        {/if}
    </div>
{/if}

{#if ChatState.configSubMenu === 0}
    {#if DBState.db.characters[ChatState.selectedCharId].type !== "group" && licensed !== "private"}
        <TextInput
            size="xl"
            marginBottom
            fullwidth
            placeholder="Character Name"
            bind:value={DBState.db.characters[ChatState.selectedCharId].name}
        />
        <div class="text-textcolor">{language.description} <Help key="charDesc" /></div>
        <TextAreaInput
            highlight
            margin="both"
            autocomplete="off"
            bind:value={(DBState.db.characters[ChatState.selectedCharId] as character).desc}
        ></TextAreaInput>
        <div class="mb-6 text-sm text-textcolor2">{tokens.desc} {language.tokens}</div>
        <div class="text-textcolor">{language.firstMessage} <Help key="charFirstMessage" /></div>
        <TextAreaInput
            highlight
            margin="both"
            autocomplete="off"
            bind:value={DBState.db.characters[ChatState.selectedCharId].firstMessage}
        ></TextAreaInput>
        <div class="mb-6 text-sm text-textcolor2">{tokens.firstMsg} {language.tokens}</div>
    {:else if licensed !== "private" && DBState.db.characters[ChatState.selectedCharId].type === "group"}
        <TextInput
            size="xl"
            marginBottom
            fullwidth
            placeholder="Group Name"
            bind:value={DBState.db.characters[ChatState.selectedCharId].name}
        />
        <div class="text-textcolor">{language.character}</div>
        <div class="char-grid gap-2 rounded-lg bg-bgcolor p-4">
            {#if (DBState.db.characters[ChatState.selectedCharId] as groupChat).characters.length === 0}
                <span class="text-textcolor2">No Character</span>
            {:else}
                <div></div>
                <div class="text-center">{language.talkness}</div>
                <div class="text-center">{language.active}</div>
                {#each (DBState.db.characters[ChatState.selectedCharId] as groupChat).characters as char, i}
                    {#await getCharImage(findCharacterbyId(char).image, "css")}
                        <BarIcon
                            onClick={() => {
                                rmCharFromGroup(i)
                            }}
                        >
                            <User />
                        </BarIcon>
                    {:then im}
                        <BarIcon
                            onClick={() => {
                                rmCharFromGroup(i)
                            }}
                            additionalStyle={im}
                        />
                    {/await}
                    <div class="flex items-center px-2 py-3">
                        {#each [1, 2, 3, 4, 5, 6] as barIndex}
                            <button
                                class="h-full flex-1 border-r border-r-bgcolor bg-selected"
                                aria-labelledby="loading"
                                class:bg-green-500={(DBState.db.characters[ChatState.selectedCharId] as groupChat)
                                    .characterTalks[i] >=
                                    (1 / 6) * barIndex}
                                class:bg-selected={(DBState.db.characters[ChatState.selectedCharId] as groupChat)
                                    .characterTalks[i] <
                                    (1 / 6) * barIndex}
                                class:rounded-l-lg={barIndex === 1}
                                class:rounded-r-lg={barIndex === 6}
                                onclick={() => {
                                    if (DBState.db.characters[ChatState.selectedCharId].type === "group") {
                                        ;(DBState.db.characters[ChatState.selectedCharId] as groupChat).characterTalks[
                                            i
                                        ] = (1 / 6) * barIndex
                                    }
                                }}
                            ></button>
                        {/each}
                    </div>
                    <div class="flex items-center justify-center">
                        <Check
                            margin={false}
                            bind:check={
                                (DBState.db.characters[ChatState.selectedCharId] as groupChat).characterActive[i]
                            }
                        />
                    </div>
                {/each}
            {/if}
        </div>
        <div class="mb-6 mt-1 flex text-textcolor2">
            <button onclick={addGroupChar} class="cursor-pointer hover:text-textcolor">
                <PlusIcon />
            </button>
        </div>
    {/if}
    <div class="text-textcolor">{language.authorNote} <Help key="chatNote" /></div>
    <TextAreaInput
        margin="both"
        autocomplete="off"
        bind:value={
            DBState.db.characters[ChatState.selectedCharId].chats[
                DBState.db.characters[ChatState.selectedCharId].chatPage
            ].note
        }
        highlight
        placeholder={getAuthorNoteDefaultText()}
    />
    <div class="mb-6 text-sm text-textcolor2">{tokens.localNote} {language.tokens}</div>

    {#if !MobileState.enabled}
        <Toggles bind:chara={DBState.db.characters[ChatState.selectedCharId]} noContainer />

        {#if DBState.db.characters[ChatState.selectedCharId].type === "group"}
            <div class="mt-2 flex items-center">
                <Check
                    bind:check={(DBState.db.characters[ChatState.selectedCharId] as groupChat).orderByOrder}
                    name={language.orderByOrder}
                />
            </div>
        {/if}
    {/if}
{:else if licensed === "private"}
    <span>You are not allowed</span>
    {(() => {
        ChatState.configSubMenu = 0
    })()}
{:else if ChatState.configSubMenu === 1}
    {#if !MobileState.enabled}
        <h2 class="mb-2 mt-2 text-2xl font-bold">{language.characterDisplay}</h2>
    {/if}

    <div class="mb-4 flex w-full rounded-md border border-selected">
        <button
            onclick={() => {
                viewSubMenu = 0
            }}
            class="flex-1 p-2"
            class:bg-selected={viewSubMenu === 0}
        >
            <span
                >{DBState.db.characters[ChatState.selectedCharId].type !== "group"
                    ? language.charIcon
                    : language.groupIcon}</span
            >
        </button>
        <button
            onclick={() => {
                viewSubMenu = 1
            }}
            class="p2 flex-1 border-l border-r border-selected"
            class:bg-selected={viewSubMenu === 1}
        >
            <span>{language.viewScreen}</span>
        </button>
        <button
            onclick={() => {
                viewSubMenu = 2
            }}
            class="flex-1 p-2"
            class:bg-selected={viewSubMenu === 2}
        >
            <span>{language.additionalAssets}</span>
        </button>
    </div>

    {#if viewSubMenu === 0}
        {#if DBState.db.characters[ChatState.selectedCharId].type === "group"}
            <button
                onclick={async () => {
                    await selectCharImg(ChatState.selectedCharId)
                }}
            >
                {#await getCharImage(DBState.db.characters[ChatState.selectedCharId].image, "css")}
                    <div class="h-24 w-24 cursor-pointer rounded-md bg-textcolor2 shadow-lg ring"></div>
                {:then im}
                    <div class="h-24 w-24 cursor-pointer rounded-md bg-textcolor2 shadow-lg ring" style={im}></div>
                {/await}
            </button>
        {:else}
            <div class="flex flex-wrap gap-2 rounded-md border border-darkborderc p-2">
                {#if DBState.db.characters[ChatState.selectedCharId].image !== "" && DBState.db.characters[ChatState.selectedCharId].image}
                    <button
                        onclick={() => {
                            if (
                                DBState.db.characters[ChatState.selectedCharId].type === "character" &&
                                DBState.db.characters[ChatState.selectedCharId].image !== "" &&
                                DBState.db.characters[ChatState.selectedCharId].image &&
                                iconRemoveMode
                            ) {
                                DBState.db.characters[ChatState.selectedCharId].image = ""
                                if (
                                    (DBState.db.characters[ChatState.selectedCharId] as character).ccAssets &&
                                    (DBState.db.characters[ChatState.selectedCharId] as character).ccAssets.length > 0
                                ) {
                                    changeCharImage(ChatState.selectedCharId, 0)
                                }
                                iconRemoveMode = false
                            }
                        }}
                    >
                        {#await getCharImage(DBState.db.characters[ChatState.selectedCharId].image, (DBState.db.characters[ChatState.selectedCharId] as character).largePortrait ? "lgcss" : "css")}
                            <div
                                class="h-24 w-24 cursor-pointer rounded-md bg-textcolor2 shadow-lg ring transition-shadow"
                                class:ring-red-500={iconRemoveMode}
                            ></div>
                        {:then im}
                            <div
                                class="h-24 w-24 cursor-pointer rounded-md bg-textcolor2 shadow-lg ring transition-shadow"
                                class:ring-red-500={iconRemoveMode}
                                style={im}
                            ></div>
                        {/await}
                    </button>
                {/if}
                {#if (DBState.db.characters[ChatState.selectedCharId] as character).ccAssets}
                    {#each (DBState.db.characters[ChatState.selectedCharId] as character).ccAssets as assets, i}
                        <button
                            onclick={async () => {
                                if (!iconRemoveMode) {
                                    changeCharImage(ChatState.selectedCharId, i)
                                } else if (DBState.db.characters[ChatState.selectedCharId].type === "character") {
                                    ;(DBState.db.characters[ChatState.selectedCharId] as character).ccAssets.splice(
                                        i,
                                        1
                                    )
                                    iconRemoveMode = false
                                }
                            }}
                        >
                            {#await getCharImage(assets.uri, (DBState.db.characters[ChatState.selectedCharId] as character).largePortrait ? "lgcss" : "css")}
                                <div
                                    class="h-24 w-24 cursor-pointer rounded-md bg-textcolor2 shadow-lg transition-shadow hover:ring"
                                    class:ring-red-500={iconRemoveMode}
                                    class:ring={iconRemoveMode}
                                ></div>
                            {:then im}
                                <div
                                    class="h-24 w-24 cursor-pointer rounded-md bg-textcolor2 shadow-lg transition-shadow hover:ring"
                                    style={im}
                                    class:ring-red-500={iconRemoveMode}
                                    class:ring={iconRemoveMode}
                                ></div>
                            {/await}
                        </button>
                    {/each}
                {/if}
                <button
                    onclick={async () => {
                        await selectCharImg(ChatState.selectedCharId)
                    }}
                >
                    <div
                        class="flex h-24 w-24 cursor-pointer items-center justify-center rounded-md border border-dashed border-darkborderc hover:border-blue-500"
                        style={(DBState.db.characters[ChatState.selectedCharId] as character).largePortrait
                            ? "height: 10.66rem;"
                            : ""}
                    >
                        <PlusIcon />
                    </div>
                </button>
            </div>
            <div class="mt-2 flex w-full items-end justify-end">
                <button
                    class={iconRemoveMode ? "text-red-500" : "text-textcolor2 hover:text-textcolor"}
                    onclick={() => {
                        iconRemoveMode = !iconRemoveMode
                    }}
                >
                    <TrashIcon size="18" />
                </button>
            </div>
        {/if}

        {#if DBState.db.characters[ChatState.selectedCharId].type === "character" && DBState.db.characters[ChatState.selectedCharId].image !== ""}
            <div class="mt-4 flex items-center">
                <Check
                    bind:check={(DBState.db.characters[ChatState.selectedCharId] as character).largePortrait}
                    name={language.largePortrait}
                />
            </div>
        {/if}

        {#if DBState.db.characters[ChatState.selectedCharId].type === "group"}
            <Button onclick={makeGroupImage}>
                {language.createGroupImg}
            </Button>
        {/if}
    {:else if viewSubMenu === 1}
        {#if DBState.db.characters[ChatState.selectedCharId].type !== "group"}
            <SelectInput
                className="mb-2"
                bind:value={DBState.db.characters[ChatState.selectedCharId].viewScreen}
                onchange={() => {
                    if (DBState.db.characters[ChatState.selectedCharId].type === "character") {
                        DBState.db.characters[ChatState.selectedCharId] = updateInlayScreen(
                            DBState.db.characters[ChatState.selectedCharId] as character
                        )
                    }
                }}
            >
                <OptionInput value="none">{language.none}</OptionInput>
                <OptionInput value="emotion">{language.emotionImage}</OptionInput>
                <OptionInput value="imggen">{language.imageGeneration}</OptionInput>
                {#if DBState.db.tpo}
                    <OptionInput value="vn">VN test</OptionInput>
                {/if}
            </SelectInput>
        {:else}
            <SelectInput className="mb-2" bind:value={DBState.db.characters[ChatState.selectedCharId].viewScreen}>
                <OptionInput value="none">{language.none}</OptionInput>
                <OptionInput value="single">{language.singleView}</OptionInput>
                <OptionInput value="multiple">{language.SpacedView}</OptionInput>
                <OptionInput value="emp">{language.emphasizedView}</OptionInput>
            </SelectInput>
        {/if}

        {#if DBState.db.characters[ChatState.selectedCharId].viewScreen === "emotion"}
            <span class="mt-6 text-textcolor">{language.emotionImage} <Help key="emotion" /></span>
            <span class="text-xs text-textcolor2">{language.emotionWarn}</span>

            <div class="w-full max-w-full rounded-md border border-selected p-2">
                <table class="tabler w-full max-w-full">
                    <tbody>
                        <tr>
                            <th class="w-1/3 font-medium">{language.image}</th>
                            <th class="w-1/2 font-medium">{language.emotion}</th>
                            <th class="font-medium"></th>
                        </tr>
                        {#if DBState.db.characters[ChatState.selectedCharId].emotionImages.length === 0}
                            <tr>
                                <td colspan="3">{language.noImages}</td>
                            </tr>
                        {:else}
                            {#each emos as emo, i}
                                <tr>
                                    {#await getCharImage(emo[1], "plain")}
                                        <td class="w-1/3 truncate font-medium"></td>
                                    {:then im}
                                        <td class="w-1/3 truncate font-medium"
                                            ><img src={im} alt="img" class="w-full" /></td
                                        >
                                    {/await}
                                    <td class="w-1/2 truncate font-medium">
                                        <TextInput
                                            marginBottom
                                            size="lg"
                                            bind:value={
                                                DBState.db.characters[ChatState.selectedCharId].emotionImages[i][0]
                                            }
                                        />
                                    </td>
                                    <td>
                                        <button
                                            class="cursor-pointer font-medium hover:text-green-500"
                                            onclick={() => {
                                                rmCharEmotion(ChatState.selectedCharId, i)
                                            }}><TrashIcon /></button
                                        >
                                    </td>
                                </tr>
                            {/each}
                        {/if}
                    </tbody>
                </table>
            </div>

            <div class="mt-2 flex text-textcolor2 hover:text-textcolor">
                {#if !addingEmotion.value}
                    <button
                        class="cursor-pointer hover:text-green-500"
                        onclick={() => {
                            addCharEmotion(ChatState.selectedCharId)
                        }}
                    >
                        <PlusIcon />
                    </button>
                {:else}
                    <span>Loading...</span>
                {/if}
            </div>

            {#if (DBState.db.characters[ChatState.selectedCharId] as character).inlayViewScreen}
                <span class="mt-2 text-textcolor">{language.imgGenInstructions}</span>
                <TextAreaInput
                    highlight
                    bind:value={
                        (DBState.db.characters[ChatState.selectedCharId] as character).newGenData.emotionInstructions
                    }
                />
            {/if}

            <CheckInput
                bind:check={(DBState.db.characters[ChatState.selectedCharId] as character).inlayViewScreen}
                name={language.inlayViewScreen}
                onChange={() => {
                    if (DBState.db.characters[ChatState.selectedCharId].type === "character") {
                        if (
                            (DBState.db.characters[ChatState.selectedCharId] as character).inlayViewScreen &&
                            (DBState.db.characters[ChatState.selectedCharId] as character).additionalAssets ===
                                undefined
                        ) {
                            ;(DBState.db.characters[ChatState.selectedCharId] as character).additionalAssets = []
                        } else if (
                            !(DBState.db.characters[ChatState.selectedCharId] as character).inlayViewScreen &&
                            (DBState.db.characters[ChatState.selectedCharId] as character).additionalAssets.length === 0
                        ) {
                            ;(DBState.db.characters[ChatState.selectedCharId] as character).additionalAssets = undefined
                        }

                        DBState.db.characters[ChatState.selectedCharId] = updateInlayScreen(
                            DBState.db.characters[ChatState.selectedCharId] as character
                        )
                    }
                }}
            />
        {/if}
        {#if DBState.db.characters[ChatState.selectedCharId].viewScreen === "imggen"}
            <span class="mt-6 text-textcolor">{language.imageGeneration} <Help key="imggen" /></span>
            <span class="text-xs text-textcolor2">{language.emotionWarn}</span>

            <span class="mt-2 text-textcolor">{language.imgGenPrompt}</span>
            <TextAreaInput
                highlight
                bind:value={(DBState.db.characters[ChatState.selectedCharId] as character).newGenData.prompt}
            />
            <span class="mt-2 text-textcolor">{language.imgGenNegatives}</span>
            <TextAreaInput
                highlight
                bind:value={(DBState.db.characters[ChatState.selectedCharId] as character).newGenData.negative}
            />
            <span class="mt-2 text-textcolor">{language.imgGenInstructions}</span>
            <TextAreaInput
                highlight
                bind:value={(DBState.db.characters[ChatState.selectedCharId] as character).newGenData.instructions}
            />

            <CheckInput
                bind:check={(DBState.db.characters[ChatState.selectedCharId] as character).inlayViewScreen}
                name={language.inlayViewScreen}
                onChange={() => {
                    if ((DBState.db.characters[ChatState.selectedCharId] as character).type === "character") {
                        ;(DBState.db.characters[ChatState.selectedCharId] as character) = updateInlayScreen(
                            DBState.db.characters[ChatState.selectedCharId] as character
                        )
                    }
                }}
            />
        {/if}
    {:else if viewSubMenu === 2}
        {#if DBState.db.newImageHandlingBeta}
            <CheckInput
                bind:check={DBState.db.characters[ChatState.selectedCharId].prebuiltAssetCommand}
                name={language.insertAssetPrompt}
            />

            {#if DBState.db.characters[ChatState.selectedCharId].prebuiltAssetCommand}
                <span class="mt-2 text-textcolor">{language.assetStyle}</span>
                <SelectInput
                    className="mb-2"
                    bind:value={DBState.db.characters[ChatState.selectedCharId].prebuiltAssetStyle}
                >
                    <OptionInput value="">{language.static}</OptionInput>
                    <OptionInput value="dynamic">{language.dynamic}</OptionInput>
                </SelectInput>
            {/if}
        {/if}
        <div class="mt-2 w-full max-w-full rounded-md border border-selected p-2">
            <table class="contain tabler mt-2 w-full max-w-full">
                <tbody>
                    <tr>
                        <th class="font-medium">{language.value}</th>
                        <th class="w-10 cursor-pointer font-medium">
                            <button
                                class="hover:text-green-500"
                                onclick={async () => {
                                    if (DBState.db.characters[ChatState.selectedCharId].type === "character") {
                                        const da = await selectMultipleFile([
                                            "png",
                                            "webp",
                                            "mp4",
                                            "mp3",
                                            "gif",
                                            "jpeg",
                                            "jpg",
                                            "ttf",
                                            "otf",
                                            "css",
                                            "webm",
                                            "woff",
                                            "woff2",
                                            "svg",
                                            "avif",
                                        ])
                                        DBState.db.characters[ChatState.selectedCharId].additionalAssets =
                                            DBState.db.characters[ChatState.selectedCharId].additionalAssets ?? []
                                        if (!da) {
                                            return
                                        }
                                        for (const f of da) {
                                            const img = f.data
                                            const name = f.name
                                            const extension = name.split(".").pop().toLowerCase()
                                            const imgp = await saveAsset(img as Uint8Array<ArrayBuffer>, "", extension)
                                            DBState.db.characters[ChatState.selectedCharId].additionalAssets.push([
                                                name,
                                                imgp,
                                                extension,
                                            ])
                                            DBState.db.characters[ChatState.selectedCharId].additionalAssets =
                                                DBState.db.characters[ChatState.selectedCharId].additionalAssets
                                        }
                                    }
                                }}
                            >
                                <PlusIcon />
                            </button>
                        </th>
                    </tr>
                    {#if !DBState.db.characters[ChatState.selectedCharId].additionalAssets || DBState.db.characters[ChatState.selectedCharId].additionalAssets.length === 0}
                        <tr>
                            <td class="text-textcolor2"> No Assets</td>
                        </tr>
                    {:else}
                        {#each DBState.db.characters[ChatState.selectedCharId].additionalAssets as assets, i}
                            <tr>
                                <td class="truncate font-medium">
                                    {#if assetFilePath[i] && DBState.db.useAdditionalAssetsPreview}
                                        {#if assetFileExtensions[i] === "mp4"}
                                            <video controls class="m-1 mt-2 w-full rounded-md px-2"
                                                ><source src={assetFilePath[i]} type="video/mp4" /></video
                                            >
                                        {:else if assetFileExtensions[i] === "mp3"}
                                            <audio controls class="m-1 mt-2 h-16 w-full rounded-md px-2" loop
                                                ><source src={assetFilePath[i]} type="audio/mpeg" /></audio
                                            >
                                        {:else if ["png", "webp", "jpeg", "jpg", "gif"].includes(assetFileExtensions[i])}
                                            <img
                                                src={assetFilePath[i]}
                                                class="m-1 h-16 w-16 rounded-md"
                                                alt={assets[0]}
                                            />
                                        {/if}
                                    {/if}
                                    <TextInput
                                        size="sm"
                                        marginBottom
                                        bind:value={
                                            DBState.db.characters[ChatState.selectedCharId].additionalAssets[i][0]
                                        }
                                        placeholder="..."
                                    />
                                </td>

                                <th class="w-10 cursor-pointer font-medium">
                                    <button
                                        class="hover:text-blue-500"
                                        onclick={() => {
                                            if (DBState.db.characters[ChatState.selectedCharId].type === "character") {
                                                DBState.db.characters[ChatState.selectedCharId].chats[
                                                    DBState.db.characters[ChatState.selectedCharId].chatPage
                                                ].fmIndex = -1
                                                let additionalAssets =
                                                    DBState.db.characters[ChatState.selectedCharId].additionalAssets
                                                additionalAssets.splice(i, 1)
                                                DBState.db.characters[ChatState.selectedCharId].additionalAssets =
                                                    additionalAssets
                                            }
                                        }}
                                    >
                                        <TrashIcon />
                                    </button>
                                    {#if DBState.db.useAdditionalAssetsPreview}
                                        <button
                                            class="hover:text-blue-500"
                                            class:text-textcolor2={DBState.db.characters[
                                                ChatState.selectedCharId
                                            ].prebuiltAssetExclude?.includes?.(assetFilePath[i])}
                                            onclick={() => {
                                                DBState.db.characters[ChatState.selectedCharId].prebuiltAssetExclude ??=
                                                    []
                                                if (
                                                    DBState.db.characters[
                                                        ChatState.selectedCharId
                                                    ].prebuiltAssetExclude.includes(assets[1])
                                                ) {
                                                    DBState.db.characters[
                                                        ChatState.selectedCharId
                                                    ].prebuiltAssetExclude = DBState.db.characters[
                                                        ChatState.selectedCharId
                                                    ].prebuiltAssetExclude.filter((e) => e !== assetFilePath[i])
                                                } else {
                                                    DBState.db.characters[
                                                        ChatState.selectedCharId
                                                    ].prebuiltAssetExclude.push(assets[1])
                                                }
                                            }}
                                        >
                                            {#if DBState.db.characters[ChatState.selectedCharId]?.prebuiltAssetExclude?.includes?.(assets[1])}
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
{:else if ChatState.configSubMenu === 3}
    {#if !MobileState.enabled}
        <h2 class="mb-2 mt-2 text-2xl font-bold">{language.loreBook} <Help key="lorebook" /></h2>
    {/if}
    <LoreBook />
{:else if ChatState.configSubMenu === 4}
    {#if DBState.db.characters[ChatState.selectedCharId].type === "character"}
        {#if !MobileState.enabled}
            <h2 class="mb-2 mt-2 text-2xl font-bold">{language.scripts}</h2>
        {/if}

        <div class="mt-2 text-textcolor">{language.backgroundHTML} <Help key="backgroundHTML" /></div>
        <TextAreaInput
            highlight
            margin="both"
            autocomplete="off"
            bind:value={DBState.db.characters[ChatState.selectedCharId].backgroundHTML}
        ></TextAreaInput>

        <div class="mt-4 text-textcolor">{language.regexScript} <Help key="regexScript" /></div>
        <RegexList bind:value={DBState.db.characters[ChatState.selectedCharId].customscript} />
        <div class="mb-6 mt-2 flex gap-2 text-textcolor2">
            <button
                class="cursor-pointer font-medium hover:text-green-500"
                onclick={() => {
                    if (DBState.db.characters[ChatState.selectedCharId].type === "character") {
                        let script = DBState.db.characters[ChatState.selectedCharId].customscript
                        script.push({
                            comment: "",
                            in: "",
                            out: "",
                            type: "editinput",
                        })
                        DBState.db.characters[ChatState.selectedCharId].customscript = script
                    }
                }}><PlusIcon /></button
            >
            <button
                class="cursor-pointer font-medium hover:text-green-500"
                onclick={() => {
                    exportRegex(DBState.db.characters[ChatState.selectedCharId].customscript)
                }}><DownloadIcon /></button
            >
            <button
                class="cursor-pointer font-medium hover:text-green-500"
                onclick={async () => {
                    DBState.db.characters[ChatState.selectedCharId].customscript = await importRegex(
                        DBState.db.characters[ChatState.selectedCharId].customscript
                    )
                }}><HardDriveUploadIcon /></button
            >
        </div>

        <div class="mt-4 text-textcolor">{language.triggerScript} <Help key="triggerScript" /></div>
        <TriggerList
            bind:value={(DBState.db.characters[ChatState.selectedCharId] as character).triggerscript}
            lowLevelAble={DBState.db.characters[ChatState.selectedCharId].lowLevelAccess}
        />

        {#if DBState.db.characters[ChatState.selectedCharId].virtualscript || DBState.db.showUnrecommended}
            <div class="mt-6 text-textcolor">{language.charjs} <Help key="charjs" unrecommended /></div>
            <TextAreaInput
                margin="both"
                autocomplete="off"
                bind:value={DBState.db.characters[ChatState.selectedCharId].virtualscript}
            ></TextAreaInput>
        {/if}
    {/if}
{:else if ChatState.configSubMenu === 6}
    {#if DBState.db.characters[ChatState.selectedCharId].license !== "CC BY-NC-SA 4.0" && DBState.db.characters[ChatState.selectedCharId].license !== "CC BY-SA 4.0"}
        <Button
            onclick={async () => {
                if (await alertTOS()) {
                    RealmState.frameContent = "character"
                }
            }}
            className="mt-2 w-full"
        >
            {#if DBState.db.characters[ChatState.selectedCharId].realmId}
                {language.updateRealm}
            {:else}
                {language.shareCloud}
            {/if}
        </Button>
    {/if}

    {#if (DBState.db.characters[ChatState.selectedCharId].license !== "CC BY-NC-SA 4.0" && DBState.db.characters[ChatState.selectedCharId].license !== "CC BY-SA 4.0" && DBState.db.characters[ChatState.selectedCharId].license !== "CC BY-ND 4.0" && DBState.db.characters[ChatState.selectedCharId].license !== "CC BY-NC-ND 4.0") || DBState.db.tpo}
        <Button
            onclick={async () => {
                const res = await exportChar(ChatState.selectedCharId)
            }}
            className="mt-2 w-full">{language.exportCharacter}</Button
        >
    {/if}

    <Button
        onclick={async () => {
            removeChar(ChatState.selectedCharId, DBState.db.characters[ChatState.selectedCharId].name)
        }}
        className="mt-2 w-full"
        >{DBState.db.characters[ChatState.selectedCharId].type === "group"
            ? language.removeGroup
            : language.removeCharacter}</Button
    >
{:else if ChatState.configSubMenu === 5}
    {#if DBState.db.characters[ChatState.selectedCharId].type === "character"}
        {#if !MobileState.enabled}
            <h2 class="mb-2 mt-2 text-2xl font-bold">TTS</h2>
        {/if}
        <span class="text-textcolor">{language.provider}</span>
        <SelectInput
            className="mb-4 mt-2 w-full"
            bind:value={DBState.db.characters[ChatState.selectedCharId].ttsMode}
            onchange={(e) => {
                if (DBState.db.characters[ChatState.selectedCharId].type === "character") {
                    ;(DBState.db.characters[ChatState.selectedCharId] as character).ttsSpeech = ""
                }
            }}
        >
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

        {#if DBState.db.characters[ChatState.selectedCharId].ttsMode === "webspeech"}
            {#if !speechSynthesis}
                <span class="text-textcolor">Web Speech isn't supported in your browser or OS</span>
            {:else}
                <span class="text-textcolor">{language.Speech}</span>
                <SelectInput
                    className="mb-4 mt-2"
                    bind:value={(DBState.db.characters[ChatState.selectedCharId] as character).ttsSpeech}
                >
                    <OptionInput value="">Auto</OptionInput>
                    {#each getWebSpeechTTSVoices() as voice}
                        <OptionInput value={voice}>{voice}</OptionInput>
                    {/each}
                </SelectInput>
                {#if (DBState.db.characters[ChatState.selectedCharId] as character).ttsSpeech !== ""}
                    <span class="text-sm text-red-400"
                        >If you do not set it to Auto, it may not work properly when importing from another OS or
                        browser.</span
                    >
                {/if}
            {/if}
        {:else if DBState.db.characters[ChatState.selectedCharId].ttsMode === "elevenlab"}
            <span class="mb-2 text-sm text-textcolor2"
                >Please set the ElevenLabs API key in "global Settings → Bot Settings → Others → ElevenLabs API key"</span
            >
            {#await getElevenTTSVoices() then voices}
                <span class="text-textcolor">{language.Speech}</span>
                <SelectInput
                    className="mb-4 mt-2"
                    bind:value={(DBState.db.characters[ChatState.selectedCharId] as character).ttsSpeech}
                >
                    <OptionInput value="">Unset</OptionInput>
                    {#each voices as voice}
                        <OptionInput value={voice.voice_id}>{voice.name}</OptionInput>
                    {/each}
                </SelectInput>
            {/await}
        {:else if DBState.db.characters[ChatState.selectedCharId].ttsMode === "VOICEVOX"}
            <span class="text-textcolor">Speaker</span>
            <SelectInput
                className="mb-4 mt-2"
                bind:value={DBState.db.characters[ChatState.selectedCharId].voicevoxConfig.speaker}
            >
                {#await getVOICEVOXVoices() then voices}
                    {#each voices as voice}
                        <OptionInput
                            value={voice.list}
                            selected={DBState.db.characters[ChatState.selectedCharId].voicevoxConfig.speaker ===
                                voice.list}>{voice.name}</OptionInput
                        >
                    {/each}
                {/await}
            </SelectInput>
            {#if DBState.db.characters[ChatState.selectedCharId].voicevoxConfig.speaker}
                <span class="text=neutral-200">Style</span>
                <SelectInput
                    className="mb-4 mt-2"
                    bind:value={DBState.db.characters[ChatState.selectedCharId].ttsSpeech}
                >
                    {#each JSON.parse(DBState.db.characters[ChatState.selectedCharId].voicevoxConfig.speaker) as styles}
                        <OptionInput
                            value={styles.id}
                            selected={DBState.db.characters[ChatState.selectedCharId].ttsSpeech === styles.id}
                            >{styles.name}</OptionInput
                        >
                    {/each}
                </SelectInput>
            {/if}
            <span class="text-textcolor">Speed scale</span>
            <NumberInput
                size="sm"
                marginBottom
                bind:value={DBState.db.characters[ChatState.selectedCharId].voicevoxConfig.SPEED_SCALE}
            />

            <span class="text-textcolor">Pitch scale</span>
            <NumberInput
                size="sm"
                marginBottom
                bind:value={DBState.db.characters[ChatState.selectedCharId].voicevoxConfig.PITCH_SCALE}
            />

            <span class="text-textcolor">Volume scale</span>
            <NumberInput
                size="sm"
                marginBottom
                bind:value={DBState.db.characters[ChatState.selectedCharId].voicevoxConfig.VOLUME_SCALE}
            />

            <span class="text-textcolor">Intonation scale</span>
            <NumberInput
                size="sm"
                marginBottom
                bind:value={DBState.db.characters[ChatState.selectedCharId].voicevoxConfig.INTONATION_SCALE}
            />
            <span class="mb-2 text-sm text-textcolor2"
                >To use VOICEVOX, you need to run a colab and put the localtunnel URL in "Settings → Other Bots".
                https://colab.research.google.com/drive/1tyeXJSklNfjW-aZJAib1JfgOMFarAwze</span
            >
        {:else if DBState.db.characters[ChatState.selectedCharId].ttsMode === "novelai"}
            <span class="text-textcolor">Custom Voice Seed</span>
            <Check bind:check={DBState.db.characters[ChatState.selectedCharId].naittsConfig.customvoice} />
            {#if !DBState.db.characters[ChatState.selectedCharId].naittsConfig.customvoice}
                <span class="text-textcolor">Voice</span>
                <SelectInput
                    className="mb-4 mt-2"
                    bind:value={DBState.db.characters[ChatState.selectedCharId].naittsConfig.voice}
                >
                    {#await getNovelAIVoices() then voices}
                        {#each voices as voiceGroup}
                            <optgroup label={voiceGroup.gender} class="appearance-none bg-darkbg">
                                {#each voiceGroup.voices as voice}
                                    <OptionInput
                                        value={voice}
                                        selected={DBState.db.characters[ChatState.selectedCharId].naittsConfig.voice ===
                                            voice}>{voice}</OptionInput
                                    >
                                {/each}
                            </optgroup>
                        {/each}
                    {/await}
                </SelectInput>
            {:else}
                <span class="text-textcolor">Voice</span>
                <TextInput size="sm" bind:value={DBState.db.characters[ChatState.selectedCharId].naittsConfig.voice} />
            {/if}
            <span class="text-textcolor">Version</span>
            <SelectInput
                className="mb-4 mt-2"
                bind:value={DBState.db.characters[ChatState.selectedCharId].naittsConfig.version}
            >
                <OptionInput value="v1">v1</OptionInput>
                <OptionInput value="v2">v2</OptionInput>
            </SelectInput>
        {:else if DBState.db.characters[ChatState.selectedCharId].ttsMode === "openai"}
            <SelectInput className="mb-4 mt-2" bind:value={DBState.db.characters[ChatState.selectedCharId].oaiVoice}>
                <OptionInput value="">Unset</OptionInput>
                {#each oaiVoices as voice}
                    <OptionInput value={voice}>{voice}</OptionInput>
                {/each}
            </SelectInput>
        {:else if DBState.db.characters[ChatState.selectedCharId].ttsMode === "huggingface"}
            <span class="text-textcolor">Model</span>
            <TextInput className="mb-4 mt-2" bind:value={DBState.db.characters[ChatState.selectedCharId].hfTTS.model} />

            <span class="text-textcolor">Language</span>
            <TextInput
                className="mb-4 mt-2"
                bind:value={DBState.db.characters[ChatState.selectedCharId].hfTTS.language}
                placeholder="en"
            />
        {:else if DBState.db.characters[ChatState.selectedCharId].ttsMode === "vits"}
            {#if DBState.db.characters[ChatState.selectedCharId].vits}
                <span class="text-textcolor"
                    >{DBState.db.characters[ChatState.selectedCharId].vits.name ?? "Unnamed VitsModel"}</span
                >
            {:else}
                <span class="text-textcolor">No Model</span>
            {/if}
            <Button
                onclick={async () => {
                    const model = await registerOnnxModel()
                    if (model && DBState.db.characters[ChatState.selectedCharId].type === "character") {
                        DBState.db.characters[ChatState.selectedCharId].vits = model
                    }
                }}>{language.selectModel}</Button
            >
        {:else if DBState.db.characters[ChatState.selectedCharId].ttsMode === "gptsovits"}
            <span class="text-textcolor">Volume</span>
            <SliderInput
                min={0.0}
                max={1.0}
                step={0.01}
                fixed={2}
                bind:value={DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.volume}
            />
            <span class="text-textcolor">URL</span>
            <TextInput
                className="mb-4 mt-2"
                bind:value={DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.url}
            />

            <span class="text-textcolor">Use Auto Path</span>
            <Check bind:check={DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.use_auto_path} />

            {#if !DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.use_auto_path}
                <span class="text-textcolor"
                    >Reference Audio Path (e.g. C:/Users/user/Downloads/GPT-SoVITS-v2-240821)</span
                >
                <TextInput
                    className="mb-4 mt-2"
                    bind:value={DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.ref_audio_path}
                />
            {/if}

            <span class="text-textcolor">Use Long Audio</span>
            <Check bind:check={DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.use_long_audio} />

            <span class="text-textcolor">Reference Audio Data (3~10s audio file)</span>
            <Button
                onclick={async () => {
                    const audio = await selectSingleFile(["wav", "ogg", "aac", "mp3"])
                    if (!audio) {
                        return null
                    }
                    const saveId = await saveAsset(audio.data as Uint8Array<ArrayBuffer>)
                    DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.ref_audio_data = {
                        fileName: audio.name,
                        assetId: saveId,
                    }
                }}
                className="h-10"
            >
                {#if DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.ref_audio_data.assetId === "" || DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.ref_audio_data.assetId === undefined}
                    {language.selectFile}
                {:else}
                    {DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.ref_audio_data.fileName}
                {/if}
            </Button>
            <span class="text-textcolor">Text Language</span>
            <SelectInput
                className="mb-4 mt-2"
                bind:value={DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.text_lang}
            >
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

            {#if !DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.use_long_audio}
                <span class="text-textcolor">Use Reference Audio Script</span>
                <Check bind:check={DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.use_prompt} />
            {/if}

            {#if DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.use_prompt && !DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.use_long_audio}
                <span class="text-textcolor">Reference Audio Script</span>
                <TextAreaInput
                    className="mb-4 mt-2"
                    bind:value={DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.prompt}
                />
            {/if}

            <span class="text-textcolor">Reference Audio Language</span>
            <SelectInput
                className="mb-4 mt-2"
                bind:value={DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.prompt_lang}
            >
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
            <SliderInput
                min={0.0}
                max={1.0}
                step={0.05}
                fixed={2}
                bind:value={DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.top_p}
            />

            <span class="text-textcolor">Temperature</span>
            <SliderInput
                min={0.0}
                max={1.0}
                step={0.05}
                fixed={2}
                bind:value={DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.temperature}
            />

            <span class="text-textcolor">Speed</span>
            <SliderInput
                min={0.6}
                max={1.65}
                step={0.05}
                fixed={2}
                bind:value={DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.speed}
            />

            <span class="text-textcolor">Top K</span>
            <SliderInput
                min={1}
                max={100}
                step={1}
                bind:value={DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.top_k}
            />

            <span class="text-textcolor">Text Split Method</span>
            <SelectInput
                className="mb-4 mt-2"
                bind:value={DBState.db.characters[ChatState.selectedCharId].gptSoVitsConfig.text_split_method}
            >
                <OptionInput value="cut0">Cut 0 (No splitting)</OptionInput>
                <OptionInput value="cut1">Cut 1 (Split every 4 sentences)</OptionInput>
                <OptionInput value="cut2">Cut 2 (Split every 50 characters)</OptionInput>
                <OptionInput value="cut3">Cut 3 (Split by Chinese periods)</OptionInput>
                <OptionInput value="cut4">Cut 4 (Split by English periods)</OptionInput>
                <OptionInput value="cut5">Cut 5 (Split by various punctuation marks)</OptionInput>
            </SelectInput>
        {:else if DBState.db.characters[ChatState.selectedCharId].ttsMode === "fishspeech"}
            {#await getFishSpeechModels()}
                <span class="text-textcolor">Loading...</span>
            {:then}
                <span class="text-textcolor">Model</span>
                <SelectInput
                    className="mb-4 mt-2"
                    bind:value={DBState.db.characters[ChatState.selectedCharId].fishSpeechConfig.model._id}
                >
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
            <NumberInput
                className="mb-4 mt-2"
                bind:value={DBState.db.characters[ChatState.selectedCharId].fishSpeechConfig.chunk_length}
            />

            <span class="mt-2 text-textcolor">Normalize</span>
            <Check
                className="mb-4 mt-2"
                bind:check={DBState.db.characters[ChatState.selectedCharId].fishSpeechConfig.normalize}
            />
        {/if}
        {#if DBState.db.characters[ChatState.selectedCharId].ttsMode}
            <div class="mt-2 flex items-center">
                <Check
                    bind:check={DBState.db.characters[ChatState.selectedCharId].ttsReadOnlyQuoted}
                    name={language.ttsReadOnlyQuoted}
                />
            </div>
        {/if}
    {/if}
{:else if ChatState.configSubMenu === 2}
    {#if !MobileState.enabled}
        <h2 class="mb-2 mt-2 text-2xl font-bold">{language.advancedSettings}</h2>
    {/if}
    {#if DBState.db.characters[ChatState.selectedCharId].type !== "group"}
        <span class="mt-2 text-textcolor">Bias <Help key="bias" /></span>
        <div class="mb-2 w-full max-w-full rounded-md border border-selected p-2">
            <table class="tabler mt-2 w-full max-w-full">
                <tbody>
                    <tr>
                        <th class="w-1/2 font-medium">Bias</th>
                        <th class="w-1/3 font-medium">{language.value}</th>
                        <th>
                            <button
                                class="cursor-pointer font-medium hover:text-green-500"
                                onclick={() => {
                                    if (DBState.db.characters[ChatState.selectedCharId].type === "character") {
                                        ;(DBState.db.characters[ChatState.selectedCharId] as character).bias.push([
                                            "",
                                            0,
                                        ])
                                    }
                                }}><PlusIcon /></button
                            >
                        </th>
                    </tr>
                    {#if (DBState.db.characters[ChatState.selectedCharId] as character).bias.length === 0}
                        <tr>
                            <td colspan="3">{language.noBias}</td>
                        </tr>
                    {/if}
                    {#each (DBState.db.characters[ChatState.selectedCharId] as character).bias as bias, i}
                        <tr class="text-center align-middle">
                            <td class="w-1/2 truncate font-medium">
                                <TextInput
                                    fullh
                                    fullwidth
                                    bind:value={
                                        (DBState.db.characters[ChatState.selectedCharId] as character).bias[i][0]
                                    }
                                    placeholder="string"
                                />
                            </td>
                            <td class="w-1/3 truncate font-medium">
                                <NumberInput
                                    fullh
                                    fullwidth
                                    bind:value={
                                        (DBState.db.characters[ChatState.selectedCharId] as character).bias[i][1]
                                    }
                                    max={100}
                                    min={-100}
                                />
                            </td>
                            <td>
                                <button
                                    class="flex h-full w-full cursor-pointer items-center justify-center font-medium hover:text-green-500"
                                    onclick={() => {
                                        if (DBState.db.characters[ChatState.selectedCharId].type === "character") {
                                            ;(DBState.db.characters[ChatState.selectedCharId] as character).bias.splice(
                                                i,
                                                1
                                            )
                                        }
                                    }}><TrashIcon /></button
                                >
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        <span class="text-textcolor">{language.exampleMessage} <Help key="exampleMessage" /></span>
        <TextAreaInput
            highlight
            margin="both"
            autocomplete="off"
            bind:value={DBState.db.characters[ChatState.selectedCharId].exampleMessage}
        ></TextAreaInput>

        <span class="text-textcolor">{language.creatorNotes} <Help key="creatorQuotes" /></span>
        <MultiLangInput
            bind:value={DBState.db.characters[ChatState.selectedCharId].creatorNotes}
            className="my-2"
            onInput={() => {
                DBState.db.characters[ChatState.selectedCharId].removedQuotes = false
            }}
        ></MultiLangInput>

        <span class="text-textcolor">{language.systemPrompt} <Help key="systemPrompt" /></span>
        <TextAreaInput
            highlight
            margin="both"
            autocomplete="off"
            bind:value={DBState.db.characters[ChatState.selectedCharId].systemPrompt}
        ></TextAreaInput>

        <span class="text-textcolor">{language.replaceGlobalNote} <Help key="replaceGlobalNote" /></span>
        <TextAreaInput
            highlight
            margin="both"
            autocomplete="off"
            bind:value={DBState.db.characters[ChatState.selectedCharId].replaceGlobalNote}
        ></TextAreaInput>

        <span class="mt-2 text-textcolor">{language.additionalText} <Help key="additionalText" /></span>
        <TextAreaInput
            highlight
            margin="both"
            autocomplete="off"
            bind:value={DBState.db.characters[ChatState.selectedCharId].additionalText}
        ></TextAreaInput>

        {#if DBState.db.showUnrecommended || DBState.db.characters[ChatState.selectedCharId].personality.length > 3}
            <span class="text-textcolor">{language.personality} <Help key="personality" unrecommended /></span>
            <TextAreaInput
                highlight
                margin="both"
                autocomplete="off"
                bind:value={DBState.db.characters[ChatState.selectedCharId].personality}
            ></TextAreaInput>
        {/if}
        {#if DBState.db.showUnrecommended || DBState.db.characters[ChatState.selectedCharId].scenario.length > 3}
            <span class="text-textcolor">{language.scenario} <Help key="scenario" unrecommended /></span>
            <TextAreaInput
                highlight
                margin="both"
                autocomplete="off"
                bind:value={DBState.db.characters[ChatState.selectedCharId].scenario}
            ></TextAreaInput>
        {/if}

        <span class="mt-2 text-textcolor">{language.defaultVariables} <Help key="defaultVariables" /></span>
        <TextAreaInput
            margin="both"
            autocomplete="off"
            bind:value={DBState.db.characters[ChatState.selectedCharId].defaultVariables}
        ></TextAreaInput>

        <span class="mt-2 text-textcolor">{language.translatorNote} <Help key="translatorNote" /></span>
        <TextAreaInput
            margin="both"
            autocomplete="off"
            bind:value={DBState.db.characters[ChatState.selectedCharId].translatorNote}
        ></TextAreaInput>

        <span class="text-textcolor">{language.creator}</span>
        <TextInput
            size="sm"
            fullwidth
            autocomplete="off"
            bind:value={DBState.db.characters[ChatState.selectedCharId].additionalData.creator}
        />

        <span class="text-textcolor">{language.CharVersion}</span>
        <TextInput
            size="sm"
            fullwidth
            bind:value={DBState.db.characters[ChatState.selectedCharId].additionalData.character_version}
        />

        <span class="text-textcolor">{language.nickname} <Help key="nickname" /></span>
        <TextInput size="sm" fullwidth bind:value={DBState.db.characters[ChatState.selectedCharId].nickname} />

        <span class="text-textcolor">{language.depthPrompt}</span>
        <div class="flex items-center justify-center">
            <NumberInput
                size="sm"
                bind:value={DBState.db.characters[ChatState.selectedCharId].depth_prompt.depth}
                className="w-12"
            />
            <TextInput
                size="sm"
                bind:value={DBState.db.characters[ChatState.selectedCharId].depth_prompt.prompt}
                className="flex-1"
            />
        </div>

        <span class="mt-2 text-textcolor">{language.altGreet}</span>
        <div class="w-full max-w-full rounded-md border border-selected p-2">
            <table class="contain tabler mt-2 w-full max-w-full">
                <tbody>
                    <tr>
                        <th class="font-medium">{language.value}</th>
                        <th class="w-8 cursor-pointer font-medium">
                            <button
                                class="hover:text-green-500"
                                onclick={() => {
                                    if (DBState.db.characters[ChatState.selectedCharId].type === "character") {
                                        let alternateGreetings =
                                            DBState.db.characters[ChatState.selectedCharId].alternateGreetings
                                        alternateGreetings.push("")
                                        DBState.db.characters[ChatState.selectedCharId].alternateGreetings =
                                            alternateGreetings
                                    }
                                }}
                            >
                                <PlusIcon />
                            </button>
                        </th>
                    </tr>
                    {#if DBState.db.characters[ChatState.selectedCharId].alternateGreetings.length === 0}
                        <tr>
                            <td colspan="3">{language.noData}</td>
                        </tr>
                    {/if}
                    {#each DBState.db.characters[ChatState.selectedCharId].alternateGreetings as bias, i}
                        <tr>
                            <td class="truncate font-medium">
                                <TextAreaInput
                                    highlight
                                    bind:value={DBState.db.characters[ChatState.selectedCharId].alternateGreetings[i]}
                                    placeholder="..."
                                    fullwidth
                                />
                            </td>
                            <th class="w-8 cursor-pointer font-medium">
                                <div class="flex flex-col items-center">
                                    <button
                                        class="p-1 hover:text-blue-500"
                                        onclick={() => moveAlternateGreetingUp(i)}
                                        disabled={i === 0}
                                    >
                                        <ArrowUp size={16} />
                                    </button>
                                    <button
                                        class="p-1 hover:text-blue-500"
                                        onclick={() => moveAlternateGreetingDown(i)}
                                        disabled={i ===
                                            DBState.db.characters[ChatState.selectedCharId].alternateGreetings.length -
                                                1}
                                    >
                                        <ArrowDown size={16} />
                                    </button>
                                    <button
                                        class="p-1 hover:text-red-500"
                                        onclick={() => {
                                            if (DBState.db.characters[ChatState.selectedCharId].type === "character") {
                                                DBState.db.characters[ChatState.selectedCharId].chats[
                                                    DBState.db.characters[ChatState.selectedCharId].chatPage
                                                ].fmIndex = -1
                                                let alternateGreetings =
                                                    DBState.db.characters[ChatState.selectedCharId].alternateGreetings
                                                alternateGreetings.splice(i, 1)
                                                DBState.db.characters[ChatState.selectedCharId].alternateGreetings =
                                                    alternateGreetings
                                            }
                                        }}
                                    >
                                        <TrashIcon size={16} />
                                    </button>
                                </div>
                            </th>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        <div class="mt-4 flex items-center">
            <Check
                bind:check={DBState.db.characters[ChatState.selectedCharId].lowLevelAccess}
                name={language.lowLevelAccess}
            />
            <span> <Help key="lowLevelAccess" name={language.lowLevelAccess} /></span>
        </div>

        <div class="mt-4 flex items-center">
            <Check
                bind:check={DBState.db.characters[ChatState.selectedCharId].hideChatIcon}
                name={language.hideChatIcon}
            />
        </div>

        <div class="mt-4 flex items-center">
            <Check bind:check={DBState.db.characters[ChatState.selectedCharId].utilityBot} name={language.utilityBot} />
            <span> <Help key="utilityBot" name={language.utilityBot} /></span>
        </div>

        <div class="mt-4 flex items-center">
            <Check
                bind:check={DBState.db.characters[ChatState.selectedCharId].escapeOutput}
                name={language.escapeOutput}
            />
        </div>

        {#if DBState.db.supaModelType !== "none" && DBState.db.hypav2}
            <Button
                onclick={() => {
                    DBState.db.characters[ChatState.selectedCharId].chats[
                        DBState.db.characters[ChatState.selectedCharId].chatPage
                    ].hypaV2Data ??= {
                        lastMainChunkID: 0,
                        mainChunks: [],
                        chunks: [],
                    }
                    showHypaV2Alert()
                }}
                className="mt-4 w-full"
            >
                {language.hypaMemoryV2Modal}
            </Button>
        {:else if DBState.db.hypaV3}
            <Button
                onclick={() => {
                    ModalState.hypaV3.modalOpen = true
                }}
                className="mt-4 w-full"
            >
                {language.hypaMemoryV3Modal}
            </Button>
        {:else if (DBState.db.characters[ChatState.selectedCharId].chats[DBState.db.characters[ChatState.selectedCharId].chatPage].supaMemoryData && DBState.db.characters[ChatState.selectedCharId].chats[DBState.db.characters[ChatState.selectedCharId].chatPage].supaMemoryData.length > 4) || DBState.db.characters[ChatState.selectedCharId].supaMemory}
            <span class="mt-4 text-textcolor">{language.SuperMemory}</span>
            <TextAreaInput
                margin="both"
                autocomplete="off"
                bind:value={
                    DBState.db.characters[ChatState.selectedCharId].chats[
                        DBState.db.characters[ChatState.selectedCharId].chatPage
                    ].supaMemoryData
                }
            ></TextAreaInput>
        {/if}

        <Button onclick={applyModule} className="mt-4 w-full">
            {language.applyModule}
        </Button>
    {:else}
        {#if (DBState.db.characters[ChatState.selectedCharId].chats[DBState.db.characters[ChatState.selectedCharId].chatPage].supaMemoryData && DBState.db.characters[ChatState.selectedCharId].chats[DBState.db.characters[ChatState.selectedCharId].chatPage].supaMemoryData.length > 4) || DBState.db.characters[ChatState.selectedCharId].supaMemory}
            <span class="mt-4 text-textcolor">{language.SuperMemory}</span>
            <TextAreaInput
                margin="both"
                autocomplete="off"
                bind:value={
                    DBState.db.characters[ChatState.selectedCharId].chats[
                        DBState.db.characters[ChatState.selectedCharId].chatPage
                    ].supaMemoryData
                }
            ></TextAreaInput>
        {/if}

        <div class="mt-4 flex items-center">
            <Check
                bind:check={DBState.db.characters[ChatState.selectedCharId].lowLevelAccess}
                name={language.lowLevelAccess}
            />
            <span> <Help key="lowLevelAccess" name={language.lowLevelAccess} /></span>
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

    .char-grid {
        display: grid;
        grid-template-columns: auto 1fr auto;
    }
</style>
