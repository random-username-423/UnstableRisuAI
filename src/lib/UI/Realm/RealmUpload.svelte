<script lang="ts">
    import { XIcon } from "@lucide/svelte"
    import { language } from "src/lang"
    import { alertError } from "src/ts/utils/alert.svelte"
    import { shareRisuHub2 } from "src/ts/character/characterCards.svelte"
    import type { character } from "src/ts/data/storage/types"
    import { DBState } from "src/ts/stores.svelte"
    import TextInput from "../GUI/TextInput.svelte"
    import Button from "../GUI/Button.svelte"
    import SelectInput from "../GUI/SelectInput.svelte"
    import { CCLicenseData } from "src/ts/creation/license"
    import OptionInput from "../GUI/OptionInput.svelte"
    import { parseMultilangString, searchTagList, sleep } from "src/ts/utils/util"
    import MultiLangInput from "../GUI/MultiLangInput.svelte"
    interface Props {
        close?: any
        char: character
        onclick?: (
            event: MouseEvent & {
                currentTarget: EventTarget & HTMLDivElement
            }
        ) => any
    }

    let { close = () => {}, char = $bindable(), onclick }: Props = $props()
    let tags = $state("")
    let privateMode = $state(false)
    let nsfwMode = $state(false)
    let license = $state("")
    let creatorNotes: { [code: string]: string } = parseMultilangString(char.creatorNotes)
    let update = false
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="fixed left-0 top-0 z-50 flex h-full w-full flex-col items-center justify-center bg-black bg-opacity-50"
    role="button"
    tabindex="0"
    onclick={close}
>
    <div
        class="flex max-h-full w-2xl max-w-full flex-col overflow-y-auto rounded-md bg-darkbg p-4"
        role="button"
        tabindex="0"
        onclick={(e) => {
            e.stopPropagation()
            onclick?.(e)
        }}
    >
        {#if !DBState.db.account}
            <span class="w-full text-2xl font-bold">You must login to Risu Account upload to RisuRealm</span>
            <span class="text-textcolor2">You can login in app settings 🡲 account</span>
            <button
                onclick={async () => {
                    close()
                }}
                class="mt-2 cursor-pointer border-1 border-solid border-borderc bg-transparent p-4 text-lg text-textcolor transition-colors hover:bg-green-800"
                >OK</button
            >
        {:else}
            <h1 class="w-full text-2xl font-bold">
                <span>
                    Share {char.name} to {language.hub}
                </span>
                <button class="float-right text-textcolor2 hover:text-green-500" onclick={close}>
                    <XIcon />
                </button>
            </h1>
            {#if char.realmId}
                <span class="text-sm text-textcolor2">{language.updateRealmDesc}</span>
            {/if}
            <div class="mb-2 mt-2 w-full border-t-2 border-t-bgcolor"></div>
            <span class="text-textcolor">{language.creatorNotes}</span>
            <span class="text-sm text-textcolor2"
                >A description that displays when you search and when you first open a bot.</span
            >
            <span class="text-sm text-textcolor2">More than 20 characters.</span>
            <MultiLangInput bind:value={char.creatorNotes} />
            <span class="text-textcolor">{language.tags}</span>
            <span class="text-sm text-textcolor2"
                >Tags to search your character easily. latin alphabets only. seperate by comma.</span
            >
            <TextInput
                placeholder=""
                bind:value={tags}
                oninput={() => {
                    tags = tags
                        .replace(/[^a-zA-Z,-]/g, "")
                        .toLocaleLowerCase()
                        .replace(/ /g, "")
                }}
            />

            <div class="hidden flex-wrap hover:block peer-focus:block">
                {#each searchTagList(tags) as tag}
                    <button
                        class="border border-bgcolor p-2 text-sm text-textcolor2"
                        onclick={() => {
                            const splited = tags.split(",").map((e) => e.trim())
                            splited[splited.length - 1] = tag
                            tags = splited.join(",") + ","
                        }}>{tag}</button
                    >
                {/each}
            </div>

            {#if char.license !== "CC BY-NC-SA 4.0" && char.license !== "CC BY-SA 4.0"}
                <span class="mt-4 text-textcolor">License</span>
                <span class="text-sm text-textcolor2"
                    >You can choose license for the downloaders to limit the usages of your card's prompt.</span
                >
                <SelectInput bind:value={license}>
                    <OptionInput value="">None</OptionInput>
                    {#each Object.keys(CCLicenseData) as ccl}
                        <OptionInput value={ccl}>{CCLicenseData[ccl][2]} ({CCLicenseData[ccl][1]})</OptionInput>
                    {/each}
                </SelectInput>
            {/if}
            {#if !char.realmId}
                <div class="mt-4 flex flex-wrap items-center">
                    <button
                        class="rounded-lg bg-bgcolor p-2"
                        class:ring-1={!privateMode}
                        onclick={() => {
                            privateMode = false
                        }}>🌏 Show Author ID</button
                    >
                    <button
                        class="ml-2 rounded-lg bg-bgcolor p-2"
                        class:ring-1={privateMode}
                        onclick={() => {
                            privateMode = true
                        }}>🔒 Anonymized</button
                    >
                </div>
                <div class="mt-2 flex flex-wrap items-center">
                    <button
                        class="rounded-lg bg-bgcolor p-2"
                        class:ring-1={!nsfwMode}
                        onclick={() => {
                            nsfwMode = false
                        }}>🎖️ Safe</button
                    >
                    <button
                        class="ml-2 rounded-lg bg-bgcolor p-2"
                        class:ring-1={nsfwMode}
                        onclick={() => {
                            nsfwMode = true
                        }}>🔞 NSFW</button
                    >
                </div>
            {:else}
                <div class="mt-2 flex flex-wrap items-center">
                    <button
                        class="rounded-lg bg-bgcolor p-2"
                        class:ring-1={!update}
                        onclick={() => {
                            nsfwMode = false
                        }}>🚀 Update</button
                    >
                    <button
                        class="ml-2 rounded-lg bg-bgcolor p-2"
                        class:ring-1={update}
                        onclick={() => {
                            nsfwMode = true
                        }}>⭐ Upload Newly</button
                    >
                </div>
            {/if}
            {#if nsfwMode}
                <span class="text-sm text-textcolor2"
                    >Grotesque Contents and non-adult characters with NSFW would be banned.</span
                >
            {/if}
            <Button
                onclick={async () => {
                    await sleep(1) // wait for the input to be updated
                    const enNotes = creatorNotes.en
                    // eslint-disable-next-line no-control-regex
                    const latin1 = /^[\x00-\xFF]*$/
                    if (enNotes.length < 10) {
                        alertError("English version of creator notes must be longer than 10 characters")
                    }
                    if (!latin1.test(enNotes)) {
                        alertError("English version of creator notes must contain only Latin-1 characters")
                    }
                    shareRisuHub2($state.snapshot(char) as character, {
                        anon: privateMode,
                        nsfw: nsfwMode,
                        tag: tags,
                        license: license,
                        update,
                    })
                    close()
                }}
                className="mt-2"
                size="lg"
            >
                {#if char.realmId}
                    {language.updateRealm}
                {:else}
                    {language.shareCloud}
                {/if}
            </Button>
        {/if}
    </div>
</div>
