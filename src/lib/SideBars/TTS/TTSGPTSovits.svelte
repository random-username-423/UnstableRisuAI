<script lang="ts">
    import { language } from "src/lang"
    import Button from "src/lib/UI/GUI/Button.svelte"
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte"
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte"
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte"
    import SliderInput from "src/lib/UI/GUI/SliderInput.svelte"
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte"
    import TextInput from "src/lib/UI/GUI/TextInput.svelte"
    import { saveAsset } from "src/ts/globalApi.svelte"
    import { DBState } from "src/ts/stores.svelte"
    import { openFilePicker } from "src/ts/utils/util"

    /**
     * Initialize GPT-SoVITS TTS config with defaults if not set.
     */
    $effect.pre(() => {
        if (DBState.currentChar.ttsMode === "gptsovits" && (DBState.currentChar as character).gptSoVitsConfig === undefined) {
            ;(DBState.currentChar as character).gptSoVitsConfig = {
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
</script>

<span class="text-textcolor">Volume</span>
<SliderInput min={0.0} max={1.0} step={0.01} fixed={2} bind:value={DBState.currentChar.gptSoVitsConfig.volume} />
<span class="text-textcolor">URL</span>
<TextInput className="mb-4 mt-2" bind:value={DBState.currentChar.gptSoVitsConfig.url} />

<span class="text-textcolor">Use Auto Path</span>
<CheckInput bind:check={DBState.currentChar.gptSoVitsConfig.use_auto_path} />

{#if !DBState.currentChar.gptSoVitsConfig.use_auto_path}
    <span class="text-textcolor">Reference Audio Path (e.g. C:/Users/user/Downloads/GPT-SoVITS-v2-240821)</span>
    <TextInput className="mb-4 mt-2" bind:value={DBState.currentChar.gptSoVitsConfig.ref_audio_path} />
{/if}

<span class="text-textcolor">Use Long Audio</span>
<CheckInput bind:check={DBState.currentChar.gptSoVitsConfig.use_long_audio} />

<span class="text-textcolor">Reference Audio Data (3~10s audio file)</span>
<Button
    onclick={async () => {
        const audio = await openFilePicker(["wav", "ogg", "aac", "mp3"], { readContent: true })
        if (!audio) {
            return null
        }
        const saveId = await saveAsset(audio.data)
        DBState.currentChar.gptSoVitsConfig.ref_audio_data = {
            fileName: audio.name,
            assetId: saveId,
        }
    }}
    className="h-10"
>
    {#if DBState.currentChar.gptSoVitsConfig.ref_audio_data.assetId === "" || DBState.currentChar.gptSoVitsConfig.ref_audio_data.assetId === undefined}
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
    <CheckInput bind:check={DBState.currentChar.gptSoVitsConfig.use_prompt} />
{/if}

{#if DBState.currentChar.gptSoVitsConfig.use_prompt && !DBState.currentChar.gptSoVitsConfig.use_long_audio}
    <span class="text-textcolor">Reference Audio Script</span>
    <TextAreaInput className="mb-4 mt-2" bind:value={DBState.currentChar.gptSoVitsConfig.prompt} />
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
<SliderInput min={0.0} max={1.0} step={0.05} fixed={2} bind:value={DBState.currentChar.gptSoVitsConfig.top_p} />

<span class="text-textcolor">Temperature</span>
<SliderInput min={0.0} max={1.0} step={0.05} fixed={2} bind:value={DBState.currentChar.gptSoVitsConfig.temperature} />

<span class="text-textcolor">Speed</span>
<SliderInput min={0.6} max={1.65} step={0.05} fixed={2} bind:value={DBState.currentChar.gptSoVitsConfig.speed} />

<span class="text-textcolor">Top K</span>
<SliderInput min={1} max={100} step={1} bind:value={DBState.currentChar.gptSoVitsConfig.top_k} />

<span class="text-textcolor">Text Split Method</span>
<SelectInput className="mb-4 mt-2" bind:value={DBState.currentChar.gptSoVitsConfig.text_split_method}>
    <OptionInput value="cut0">Cut 0 (No splitting)</OptionInput>
    <OptionInput value="cut1">Cut 1 (Split every 4 sentences)</OptionInput>
    <OptionInput value="cut2">Cut 2 (Split every 50 characters)</OptionInput>
    <OptionInput value="cut3">Cut 3 (Split by Chinese periods)</OptionInput>
    <OptionInput value="cut4">Cut 4 (Split by English periods)</OptionInput>
    <OptionInput value="cut5">Cut 5 (Split by various punctuation marks)</OptionInput>
</SelectInput>
