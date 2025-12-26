<script lang="ts">
    import { ArrowLeft, PlusIcon, TrashIcon } from "@lucide/svelte"
    import { language } from "src/lang"
    import PromptDataItem from "src/lib/UI/PromptDataItem.svelte"
    import { tokenizePreset, type PromptItem } from "src/ts/process/utils/prompt"
    import { templateCheck } from "src/ts/process/templates/templateCheck"

    import { DBState } from "src/ts/stores.svelte"
    import Check from "src/lib/UI/GUI/CheckInput.svelte"
    import TextInput from "src/lib/UI/GUI/TextInput.svelte"
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte"
    import Help from "src/lib/Others/Help.svelte"
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte"
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte"
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte"
    import Arcodion from "src/lib/UI/Arcodion.svelte"
    import ModelList from "src/lib/UI/ModelList.svelte"

    let sorted = 0
    let opened = 0
    let warns = $derived(templateCheck(DBState.db))
    let tokens = $state(0)
    let extokens = $state(0)
    executeTokenize(DBState.db.promptTemplate)
    interface Props {
        onGoBack?: () => void
        mode?: "independent" | "inline"
        subMenu?: number
    }

    let { onGoBack = () => {}, mode = "independent", subMenu = $bindable(0) }: Props = $props()

    async function executeTokenize(prest: PromptItem[]) {
        tokens = await tokenizePreset(prest, true)
        extokens = await tokenizePreset(prest, false)
    }

    $effect.pre(() => {
        executeTokenize(DBState.db.promptTemplate)
    })
</script>

{#if mode === "independent"}
    <h2 class="mb-2 mt-2 flex items-center text-2xl font-bold">
        <button class="mr-2 text-textcolor2 hover:text-textcolor" onclick={onGoBack}>
            <ArrowLeft />
        </button>
        {language.promptTemplate}
    </h2>

    <div class="flex w-full rounded-md border border-selected">
        <button
            onclick={() => {
                subMenu = 0
            }}
            class="flex-1 p-2"
            class:bg-selected={subMenu === 0}
        >
            <span>{language.template}</span>
        </button>
        <button
            onclick={() => {
                subMenu = 1
            }}
            class="flex-1 p-2"
            class:bg-selected={subMenu === 1}
        >
            <span>{language.settings}</span>
        </button>
    </div>
{/if}
{#if warns.length > 0 && subMenu === 0}
    <div class="mt-4 flex flex-col items-start rounded-md border border-red-500 p-2 text-red-500">
        <h2 class="text-xl font-bold">Warning</h2>
        <div class="mb-2 mt-1 w-full border-b border-b-red-500"></div>
        {#each warns as warn}
            <span class="ml-4">{warn}</span>
        {/each}
    </div>
{/if}

{#if subMenu === 0}
    <div class="contain mt-4 flex w-full max-w-full flex-col rounded-md p-3">
        {#if DBState.db.promptTemplate.length === 0}
            <div class="text-textcolor2">No Format</div>
        {/if}
        {#key sorted}
            {#each DBState.db.promptTemplate as prompt, i}
                <PromptDataItem
                    bind:promptItem={DBState.db.promptTemplate[i]}
                    onRemove={() => {
                        let templates = DBState.db.promptTemplate
                        templates.splice(i, 1)
                        DBState.db.promptTemplate = templates
                    }}
                    moveDown={() => {
                        if (i === DBState.db.promptTemplate.length - 1) {
                            return
                        }
                        let templates = DBState.db.promptTemplate
                        let temp = templates[i]
                        templates[i] = templates[i + 1]
                        templates[i + 1] = temp
                        DBState.db.promptTemplate = templates
                    }}
                    moveUp={() => {
                        if (i === 0) {
                            return
                        }
                        let templates = DBState.db.promptTemplate
                        let temp = templates[i]
                        templates[i] = templates[i - 1]
                        templates[i - 1] = temp
                        DBState.db.promptTemplate = templates
                    }}
                />
            {/each}
        {/key}
    </div>

    <button
        class="cursor-pointer font-medium hover:text-green-500"
        onclick={() => {
            let value = DBState.db.promptTemplate ?? []
            value.push({
                type: "plain",
                text: "",
                role: "system",
                type2: "normal",
            })
            DBState.db.promptTemplate = value
        }}><PlusIcon /></button
    >

    <span class="mt-2 text-sm text-textcolor2">{tokens} {language.fixedTokens}</span>
    <span class="mb-6 mt-2 text-sm text-textcolor2">{extokens} {language.exactTokens}</span>
{:else}
    <span class="mt-4 text-textcolor">{language.postEndInnerFormat}</span>
    <TextInput bind:value={DBState.db.promptSettings.postEndInnerFormat} />

    <Check bind:check={DBState.db.promptSettings.sendChatAsSystem} name={language.sendChatAsSystem} className="mt-4" />
    <Check bind:check={DBState.db.promptSettings.sendName} name={language.formatGroupInSingle} className="mt-4" />
    <Check bind:check={DBState.db.promptSettings.utilOverride} name={language.utilOverride} className="mt-4" />
    <Check bind:check={DBState.db.jsonSchemaEnabled} name={language.enableJsonSchema} className="mt-4" />
    <Check bind:check={DBState.db.outputImageModal} name={language.outputImageModal} className="mt-4" />

    <Check bind:check={DBState.db.strictJsonSchema} name={language.strictJsonSchema} className="mt-4" />

    {#if DBState.db.showUnrecommended}
        <Check
            bind:check={DBState.db.promptSettings.customChainOfThought}
            name={language.customChainOfThought}
            className="mt-4"
        >
            <Help unrecommended key="customChainOfThought" />
        </Check>
    {/if}
    <span class="mt-4 text-textcolor">{language.maxThoughtTagDepth}</span>
    <NumberInput bind:value={DBState.db.promptSettings.maxThoughtTagDepth} />
    <span class="mt-4 text-textcolor">{language.groupOtherBotRole} <Help key="groupOtherBotRole" /></span>
    <SelectInput bind:value={DBState.db.groupOtherBotRole}>
        <OptionInput value="user">User</OptionInput>
        <OptionInput value="system">System</OptionInput>
        <OptionInput value="assistant">assistant</OptionInput>
    </SelectInput>
    <span class="mt-4 text-textcolor"
        >{language.customPromptTemplateToggle} <Help key="customPromptTemplateToggle" /></span
    >
    <TextAreaInput bind:value={DBState.db.customPromptTemplateToggle} />
    <span class="mt-4 text-textcolor">{language.defaultVariables} <Help key="defaultVariables" /></span>
    <TextAreaInput bind:value={DBState.db.templateDefaultVariables} />
    <span class="mt-4 text-textcolor">{language.predictedOutput}</span>
    <TextAreaInput bind:value={DBState.db.OAIPrediction} />
    <span class="mt-4 text-textcolor">{language.groupInnerFormat} <Help key="groupInnerFormat" /></span>
    <TextAreaInput
        placeholder={`<{{char}}'s Message>\n{{slot}}\n</{{char}}'s Message>`}
        bind:value={DBState.db.groupTemplate}
    />
    <span class="mt-4 text-textcolor">{language.systemContentReplacement} <Help key="systemContentReplacement" /></span>
    <TextAreaInput bind:value={DBState.db.systemContentReplacement} />
    <span class="mt-4 text-textcolor">{language.systemRoleReplacement} <Help key="systemRoleReplacement" /></span>
    <SelectInput bind:value={DBState.db.systemRoleReplacement}>
        <OptionInput value="user">User</OptionInput>
        <OptionInput value="assistant">assistant</OptionInput>
    </SelectInput>
    {#if DBState.db.jsonSchemaEnabled}
        <span class="mt-4 text-textcolor">{language.jsonSchema} <Help key="jsonSchema" /></span>
        <TextAreaInput bind:value={DBState.db.jsonSchema} />
        <span class="mt-4 text-textcolor">{language.extractJson} <Help key="extractJson" /></span>
        <TextInput bind:value={DBState.db.extractJson} />
    {/if}

    <div class="mt-4 flex items-center">
        <Check bind:check={DBState.db.seperateModelsForAxModels} name={language.seperateModelsForAxModels}></Check>
    </div>

    {#if DBState.db.seperateModelsForAxModels}
        <Check bind:check={DBState.db.doNotChangeSeperateModels} name={language.doNotChangeSeperateModels}></Check>
        <Arcodion name={language.axModelsDef} styled>
            <span class="mt-4 text-textcolor"> Memory </span>
            <ModelList bind:value={DBState.db.seperateModels.memory} blankable />

            <span class="mt-4 text-textcolor"> Translations </span>
            <ModelList bind:value={DBState.db.seperateModels.translate} blankable />

            <span class="mt-4 text-textcolor"> Emotion </span>

            <ModelList bind:value={DBState.db.seperateModels.emotion} blankable />

            <span class="mt-4 text-textcolor"> OtherAx </span>

            <ModelList bind:value={DBState.db.seperateModels.otherAx} blankable />
        </Arcodion>
    {/if}

    {#snippet fallbackModelList(arg: "model" | "memory" | "translate" | "emotion" | "otherAx")}
        {#each DBState.db.fallbackModels[arg] as model, i}
            <span class="mt-4 text-textcolor">
                {language.model}
                {i + 1}
            </span>
            <ModelList bind:value={DBState.db.fallbackModels[arg][i]} blankable />
        {/each}
        <div class="flex gap-2">
            <button
                class="rounded-md bg-selected p-2 text-white"
                onclick={() => {
                    let value = DBState.db.fallbackModels[arg] ?? []
                    value.push("")
                    DBState.db.fallbackModels[arg] = value
                }}><PlusIcon /></button
            >
            <button
                class="rounded-md bg-red-500 p-2 text-white"
                onclick={() => {
                    let value = DBState.db.fallbackModels[arg] ?? []
                    value.pop()
                    DBState.db.fallbackModels[arg] = value
                }}><TrashIcon /></button
            >
        </div>
    {/snippet}

    <Arcodion name={language.fallbackModel} styled>
        <Check
            bind:check={DBState.db.fallbackWhenBlankResponse}
            name={language.fallbackWhenBlankResponse}
            className="mt-4"
        />
        <Check
            bind:check={DBState.db.doNotChangeFallbackModels}
            name={language.doNotChangeFallbackModels}
            className="mt-4"
        />

        <Arcodion name={language.model} styled>
            {@render fallbackModelList("model")}
        </Arcodion>
        <Arcodion name="Memory" styled>
            {@render fallbackModelList("memory")}
        </Arcodion>
        <Arcodion name="Translations" styled>
            {@render fallbackModelList("translate")}
        </Arcodion>
        <Arcodion name="Emotion" styled>
            {@render fallbackModelList("emotion")}
        </Arcodion>
        <Arcodion name="OtherAx" styled>
            {@render fallbackModelList("otherAx")}
        </Arcodion>
    </Arcodion>
{/if}
