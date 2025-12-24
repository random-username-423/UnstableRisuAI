<script lang="ts">
    import { getModuleToggles } from "src/ts/process/scripting/modules"
    import { DBState, MobileState } from "src/ts/stores.svelte"
    import { parseToggleSyntax, type sidebarToggle, type sidebarToggleGroup } from "src/ts/utils/util"
    import { language } from "src/lang"
    import type { character, groupChat } from "src/ts/data/storage/types"
    import Arcodion from "../UI/Arcodion.svelte"
    import CheckInput from "../UI/GUI/CheckInput.svelte"
    import SelectInput from "../UI/GUI/SelectInput.svelte"
    import OptionInput from "../UI/GUI/OptionInput.svelte"
    import TextInput from "../UI/GUI/TextInput.svelte"

    interface Props {
        chara?: character | groupChat
        noContainer?: boolean
    }

    let { chara = $bindable(), noContainer }: Props = $props()

    let groupedToggles = $derived.by(() => {
        const ungrouped = parseToggleSyntax(DBState.db.customPromptTemplateToggle + getModuleToggles())

        let groupOpen = false
        // group toggles together between group ... groupEnd
        return ungrouped.reduce<sidebarToggle[]>((acc, toggle) => {
            if (toggle.type === "group") {
                groupOpen = true
                acc.push(toggle)
            } else if (toggle.type === "groupEnd") {
                groupOpen = false
            } else if (groupOpen) {
                ;(acc.at(-1) as sidebarToggleGroup).children.push(toggle)
            } else {
                acc.push(toggle)
            }
            return acc
        }, [])
    })
</script>

{#snippet toggles(items: sidebarToggle[], reverse: boolean = false)}
    {#each items as toggle, index}
        {#if toggle.type === "group" && toggle.children.length > 0}
            <div class="w-full">
                <Arcodion styled name={toggle.value}>
                    {@render toggles((toggle as sidebarToggleGroup).children, reverse)}
                </Arcodion>
            </div>
        {:else if toggle.type === "select"}
            <div class="mt-2 flex w-full items-center gap-2" class:justify-end={MobileState.enabled}>
                <span>{toggle.value}</span>
                <SelectInput className="w-32" bind:value={DBState.db.globalChatVariables[`toggle_${toggle.key}`]}>
                    {#each toggle.options as option, i}
                        <OptionInput value={i.toString()}>{option}</OptionInput>
                    {/each}
                </SelectInput>
            </div>
        {:else if toggle.type === "text"}
            <div class="mt-2 flex w-full items-center gap-2" class:justify-end={MobileState.enabled}>
                <span>{toggle.value}</span>
                <TextInput className="w-32" bind:value={DBState.db.globalChatVariables[`toggle_${toggle.key}`]} />
            </div>
        {:else if toggle.type === "divider"}
            <!-- Prevent multiple dividers appearing in a row -->
            {#if index === 0 || items[index - 1]?.type !== "divider" || items[index - 1]?.value !== toggle.value}
                <div class="mt-2 flex min-h-5 w-full items-center gap-2" class:justify-end={!reverse}>
                    {#if toggle.value}
                        <span class="shrink-0">{toggle.value}</span>
                    {/if}
                    <hr class="m-0 flex-grow border-t border-darkborderc" />
                </div>
            {/if}
        {:else}
            <div class="mt-2 flex w-full items-center" class:justify-end={MobileState.enabled}>
                <CheckInput
                    check={DBState.db.globalChatVariables[`toggle_${toggle.key}`] === "1"}
                    {reverse}
                    name={toggle.value}
                    onChange={() => {
                        DBState.db.globalChatVariables[`toggle_${toggle.key}`] =
                            DBState.db.globalChatVariables[`toggle_${toggle.key}`] === "1" ? "0" : "1"
                    }}
                />
            </div>
        {/if}
    {/each}
{/snippet}

{#if !noContainer && groupedToggles.length > 4}
    <div class="mt-2 flex h-48 flex-col items-start overflow-y-auto rounded border border-darkborderc p-2">
        <div class="mt-2 flex w-full items-center" class:justify-end={MobileState.enabled}>
            <CheckInput bind:check={DBState.db.jailbreakToggle} name={language.jailbreakToggle} reverse />
        </div>
        {@render toggles(groupedToggles, true)}
        {#if DBState.db.supaModelType !== "none" || DBState.db.hanuraiEnable || DBState.db.hypaV3}
            <div class="mt-2 flex w-full items-center" class:justify-end={MobileState.enabled}>
                <CheckInput
                    bind:check={chara.supaMemory}
                    reverse
                    name={DBState.db.hypaV3
                        ? language.ToggleHypaMemory
                        : DBState.db.hanuraiEnable
                          ? language.hanuraiMemory
                          : DBState.db.hypaMemory
                            ? language.ToggleHypaMemory
                            : language.ToggleSuperMemory}
                />
            </div>
        {/if}
    </div>
{:else}
    <div class="mt-2 flex items-center">
        <CheckInput bind:check={DBState.db.jailbreakToggle} name={language.jailbreakToggle} />
    </div>
    {@render toggles(groupedToggles)}
    {#if DBState.db.supaModelType !== "none" || DBState.db.hanuraiEnable || DBState.db.hypaV3}
        <div class="mt-2 flex items-center">
            <CheckInput
                bind:check={chara.supaMemory}
                name={DBState.db.hypaV3
                    ? language.ToggleHypaMemory
                    : DBState.db.hanuraiEnable
                      ? language.hanuraiMemory
                      : DBState.db.hypaMemory
                        ? language.ToggleHypaMemory
                        : language.ToggleSuperMemory}
            />
        </div>
    {/if}
{/if}
