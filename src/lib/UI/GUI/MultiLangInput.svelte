<script lang="ts">
    import { encodeMultilangString, languageCodes, parseMultilangString, toLangName } from "src/ts/utils/util"
    import TextAreaInput from "./TextAreaInput.svelte"
    let addingLang = $state(false)
    let selectedLang = $state("en")
    interface Props {
        value: string
        className?: string
        onInput?: any
    }

    let { value = $bindable(), className = "", onInput = () => {} }: Props = $props()
    let parsed = parseMultilangString(value)
    if (parsed["en"] === undefined) {
        parsed["en"] = parsed["xx"]
        delete parsed["xx"]
    }
    // TODO: $derived로 변경 검토 필요 - 객체 속성 수정/삭제 및 bind:value와의 호환성 확인 필요
    let valueObject: { [code: string]: string } = $state(parsed)
    const updateValue = () => {
        for (let lang in valueObject) {
            if (valueObject[lang] === "" && lang !== selectedLang && lang !== "en") {
                delete valueObject[lang]
            }
        }
        if (valueObject.xx) {
            delete valueObject.xx
        }
        if (valueObject.en === "") {
            valueObject.en = " "
        }
        valueObject = valueObject // force update
        value = encodeMultilangString(valueObject)
    }
    updateValue()
    $effect.pre(() => {
        valueObject = parseMultilangString(value)
    })
</script>

<div class="flex max-w-fit flex-wrap gap-2 p-1">
    {#each Object.keys(valueObject) as lang}
        {#if lang !== "xx"}
            <button
                class="rounded-lg bg-bgcolor px-4 py-2"
                class:ring-1={selectedLang === lang}
                onclick={() => {
                    selectedLang = lang
                    updateValue()
                }}>{toLangName(lang)}</button
            >
        {/if}
    {/each}
    <button
        class="text-nowrap rounded-lg bg-bgcolor px-4 py-2"
        class:ring-1={addingLang}
        onclick={() => {
            addingLang = !addingLang
        }}>+</button
    >
</div>
{#if addingLang}
    <div class="g-2 m-1 flex max-w-fit flex-wrap gap-1 rounded-md border-t-bgcolor p-1">
        {#each languageCodes as lang}
            {#if toLangName(lang) !== lang}
                <button
                    class="text-nowrap rounded-lg bg-bgcolor px-4 py-2"
                    onclick={() => {
                        valueObject[lang] = ""
                        selectedLang = lang
                        addingLang = false
                    }}>{toLangName(lang)}</button
                >
            {/if}
        {/each}
    </div>
{/if}
<TextAreaInput
    autocomplete="off"
    bind:value={valueObject[selectedLang]}
    onInput={() => {
        updateValue()
        onInput()
    }}
    {className}
/>
