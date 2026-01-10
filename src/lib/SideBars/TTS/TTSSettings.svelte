<script lang="ts">
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte"
    import { language } from "src/lang"
    import Button from "src/lib/UI/GUI/Button.svelte"
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte"
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte"
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte"
    import TextInput from "src/lib/UI/GUI/TextInput.svelte"
    import { registerOnnxModel } from "src/ts/process/transformers"
    import { getElevenTTSVoices, getNovelAIVoices, getVOICEVOXVoices, getWebSpeechTTSVoices, oaiVoices } from "src/ts/process/tts"
    import { DBState, layoutState } from "src/ts/stores.svelte"
    import { openFilePicker } from "src/ts/utils/util"
    import type { character } from "src/ts/storage/types"
    import TTSGPTSovits from "./TTSGPTSovits.svelte"

    /**
     * Initialize NovelAI TTS config with defaults if not set.
     */
    $effect.pre(() => {
        if (DBState.currentChar.ttsMode === "novelai" && (DBState.currentChar as character).naittsConfig === undefined) {
            ;(DBState.currentChar as character).naittsConfig = {
                customvoice: false,
                voice: "Aini",
                version: "v2",
            }
        }
    })

    // Fish Speech model list
    let fishSpeechModels: {
        _id: string
        title: string
        description: string
    }[] = $state([])

    /**
     * Initialize Fish Speech TTS config with defaults if not set.
     */
    $effect.pre(() => {
        if (DBState.currentChar.ttsMode === "fishspeech" && (DBState.currentChar as character).fishSpeechConfig === undefined) {
            ;(DBState.currentChar as character).fishSpeechConfig = {
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

    function getFishSpeechModels() {
        throw new Error("Function not implemented.")
    }
</script>

{#if DBState.currentChar.type === "character"}
    {#if !layoutState.betaMobile.enabled}
        <h2 class="mb-2 text-2xl font-bold mt-2">TTS</h2>
    {/if}
    <span class="text-textcolor">{language.provider}</span>
    <SelectInput
        className="mb-4 mt-2"
        value={DBState.currentChar.ttsMode ?? ""}
        onchange={(e) => {
            DBState.currentChar.ttsMode = e.currentTarget.value
            if (DBState.currentChar.type === "character") {
                ;(DBState.currentChar as character).ttsSpeech = ""
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

    {#if DBState.currentChar.ttsMode === "webspeech"}
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
            {#if (DBState.currentChar as character).ttsSpeech !== ""}
                <span class="text-red-400 text-sm"
                    >If you do not set it to Auto, it may not work properly when importing from another OS or browser.</span
                >
            {/if}
        {/if}
    {:else if DBState.currentChar.ttsMode === "elevenlab"}
        <span class="text-sm mb-2 text-textcolor2"
            >Please set the ElevenLabs API key in "global Settings → Bot Settings → Others → ElevenLabs API key"</span
        >
        {#await getElevenTTSVoices() then voices}
            <span class="text-textcolor">{language.Speech}</span>
            <SelectInput className="mb-4 mt-2" bind:value={(DBState.currentChar as character).ttsSpeech}>
                <OptionInput value="">Unset</OptionInput>
                {#each voices as voice}
                    <OptionInput value={voice.voice_id}>{voice.name}</OptionInput>
                {/each}
            </SelectInput>
        {/await}
    {:else if DBState.currentChar.ttsMode === "VOICEVOX"}
        <span class="text-textcolor">Speaker</span>
        <SelectInput className="mb-4 mt-2" bind:value={DBState.currentChar.voicevoxConfig.speaker}>
            {#await getVOICEVOXVoices() then voices}
                {#each voices as voice}
                    <OptionInput value={voice.list} selected={DBState.currentChar.voicevoxConfig.speaker === voice.list}>{voice.name}</OptionInput>
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
        <NumberInput size={"sm"} marginBottom bind:value={DBState.currentChar.voicevoxConfig.SPEED_SCALE} />

        <span class="text-textcolor">Pitch scale</span>
        <NumberInput size={"sm"} marginBottom bind:value={DBState.currentChar.voicevoxConfig.PITCH_SCALE} />

        <span class="text-textcolor">Volume scale</span>
        <NumberInput size={"sm"} marginBottom bind:value={DBState.currentChar.voicevoxConfig.VOLUME_SCALE} />

        <span class="text-textcolor">Intonation scale</span>
        <NumberInput size={"sm"} marginBottom bind:value={DBState.currentChar.voicevoxConfig.INTONATION_SCALE} />
        <span class="text-sm mb-2 text-textcolor2"
            >To use VOICEVOX, you need to run a colab and put the localtunnel URL in "Settings → Other Bots".
            https://colab.research.google.com/drive/1tyeXJSklNfjW-aZJAib1JfgOMFarAwze</span
        >
    {:else if DBState.currentChar.ttsMode === "novelai"}
        <span class="text-textcolor">Custom Voice Seed</span>
        <CheckInput bind:check={DBState.currentChar.naittsConfig.customvoice} />
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
            <TextInput size={"sm"} bind:value={DBState.currentChar.naittsConfig.voice} />
        {/if}
        <span class="text-textcolor">Version</span>
        <SelectInput className="mb-4 mt-2" bind:value={DBState.currentChar.naittsConfig.version}>
            <OptionInput value="v1">v1</OptionInput>
            <OptionInput value="v2">v2</OptionInput>
        </SelectInput>
    {:else if DBState.currentChar.ttsMode === "openai"}
        <SelectInput className="mb-4 mt-2" bind:value={DBState.currentChar.oaiVoice}>
            <OptionInput value="">Unset</OptionInput>
            {#each oaiVoices as voice}
                <OptionInput value={voice}>{voice}</OptionInput>
            {/each}
        </SelectInput>
    {:else if DBState.currentChar.ttsMode === "huggingface"}
        <span class="text-textcolor">Model</span>
        <TextInput className="mb-4 mt-2" bind:value={DBState.currentChar.hfTTS.model} />

        <span class="text-textcolor">Language</span>
        <TextInput className="mb-4 mt-2" bind:value={DBState.currentChar.hfTTS.language} placeholder="en" />
    {:else if DBState.currentChar.ttsMode === "vits"}
        {#if DBState.currentChar.vits}
            <span class="text-textcolor">{DBState.currentChar.vits.name ?? "Unnamed VitsModel"}</span>
        {:else}
            <span class="text-textcolor">No Model</span>
        {/if}
        <Button
            onclick={async () => {
                const modelFile = await openFilePicker(["zip"], { readContent: true })
                if (modelFile == null) {
                    return
                }
                const model = await registerOnnxModel(modelFile.data, modelFile.name)
                if (model && DBState.currentChar.type === "character") {
                    DBState.currentChar.vits = model
                }
            }}>{language.selectModel}</Button
        >
    {:else if DBState.currentChar.ttsMode === "gptsovits"}
        <TTSGPTSovits />
    {:else if DBState.currentChar.ttsMode === "fishspeech"}
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
        <NumberInput className="mb-4 mt-2" bind:value={DBState.currentChar.fishSpeechConfig.chunk_length} />

        <span class="mt-2 text-textcolor">Normalize</span>
        <CheckInput className="mb-4 mt-2" bind:check={DBState.currentChar.fishSpeechConfig.normalize} />
    {/if}
    {#if DBState.currentChar.ttsMode}
        <div class="flex items-center mt-2">
            <CheckInput bind:check={DBState.currentChar.ttsReadOnlyQuoted} name={language.ttsReadOnlyQuoted} />
        </div>
    {/if}
{/if}
