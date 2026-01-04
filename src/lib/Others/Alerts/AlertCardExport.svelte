<script lang="ts">
    // ============================================================
    // IMPORTS
    // ============================================================
    import { DBState, alertStore, selectedCharID } from "src/ts/stores.svelte"
    import { alertClear } from "src/ts/alert"
    import { XIcon } from "@lucide/svelte"
    import { isCharacterHasAssets } from "src/ts/characterCards.svelte"
    import Button from "../../UI/GUI/Button.svelte"
    import SelectInput from "../../UI/GUI/SelectInput.svelte"
    import OptionInput from "../../UI/GUI/OptionInput.svelte"
    import { language } from "src/lang"

    // ============================================================
    // STATE VARIABLES
    // ============================================================
    let cardExportType = $state("realm")
    let cardExportType2 = $state("")

    // ============================================================
    // EFFECTS - Cleanup on Component Unmount
    // ============================================================
    $effect.pre(() => {
        return () => {
            cardExportType = "realm"
            cardExportType2 = ""
        }
    })
</script>

<!-- ============================================================ -->
<!-- CARD EXPORT MODAL -->
<!-- ============================================================ -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="fixed top-0 left-0 h-full w-full bg-black/50 flex flex-col z-50 items-center justify-center"
    role="button"
    tabindex="0"
    onclick={close}
>
    <div
        class="bg-darkbg rounded-md p-4 max-w-full flex flex-col w-2xl"
        role="button"
        tabindex="0"
        onclick={(e) => {
            e.stopPropagation()
        }}
    >
        <h1 class="font-bold text-2xl w-full">
            <span>
                {language.shareExport}
            </span>
            <button
                class="float-right text-textcolor2 hover:text-green-500"
                onclick={() => {
                    alertClear(JSON.stringify({
                        type: "cancel",
                        type2: cardExportType2,
                    }))
                }}
            >
                <XIcon />
            </button>
        </h1>
        <span class="text-textcolor mt-4">{language.type}</span>
        {#if cardExportType === ""}
            {#if $alertStore.submsg === "module"}
                <span class="text-textcolor2 text-sm">{language.risuMDesc}</span>
            {:else if $alertStore.submsg === "preset"}
                <span class="text-textcolor2 text-sm">{language.risupresetDesc}</span>
                {#if cardExportType2 === "preset" && (DBState.db.botPresets[DBState.db.botPresetsId].image || DBState.db.botPresets[DBState.db.botPresetsId].regex?.length > 0)}
                    <span class="text-red-500 text-sm"
                        >Use RisuRealm to share the preset. Preset with image or regexes cannot be exported for now.</span
                    >
                {/if}
            {:else}
                <span class="text-textcolor2 text-sm">{language.ccv3Desc}</span>
                {#if cardExportType2 !== "charx" && cardExportType2 !== "charxJpeg" && isCharacterHasAssets(DBState.db.characters[$selectedCharID])}
                    <span class="text-red-500 text-sm">{language.notCharxWarn}</span>
                {/if}
            {/if}
        {:else if cardExportType === "json"}
            <span class="text-textcolor2 text-sm">{language.jsonDesc}</span>
        {:else if cardExportType === "ccv2"}
            <span class="text-textcolor2 text-sm">{language.ccv2Desc}</span>
            <span class="text-red-500 text-sm">{language.v2Warning}</span>
        {:else}
            <span class="text-textcolor2 text-sm">{language.realmDesc}</span>
        {/if}
        <div class="flex items-center flex-wrap mt-2">
            {#if $alertStore.submsg === "preset"}
                <button
                    class="bg-bgcolor px-2 py-4 rounded-lg flex-1"
                    class:ring-1={cardExportType === "realm"}
                    onclick={() => {
                        cardExportType = "realm"
                    }}>RisuRealm</button
                >
                <button
                    class="bg-bgcolor px-2 py-4 rounded-lg ml-2 flex-1"
                    class:ring-1={cardExportType === ""}
                    onclick={() => {
                        cardExportType = ""
                    }}>Risupreset</button
                >
            {:else if $alertStore.submsg === "module"}
                <button
                    class="bg-bgcolor px-2 py-4 rounded-lg ml-2 flex-1"
                    class:ring-1={cardExportType === "realm"}
                    onclick={() => {
                        cardExportType = "realm"
                    }}>RisuRealm</button
                >
                <button
                    class="bg-bgcolor px-2 py-4 rounded-lg flex-1"
                    class:ring-1={cardExportType === ""}
                    onclick={() => {
                        cardExportType = ""
                    }}>RisuM</button
                >
            {:else}
                <button
                    class="bg-bgcolor px-2 py-4 rounded-lg flex-1"
                    class:ring-1={cardExportType === "realm"}
                    onclick={() => {
                        cardExportType = "realm"
                    }}>RisuRealm</button
                >
                <button
                    class="bg-bgcolor px-2 py-4 rounded-lg ml-2 flex-1"
                    class:ring-1={cardExportType === ""}
                    onclick={() => {
                        cardExportType = ""
                        cardExportType2 = "charxJpeg"
                    }}>Character Card V3</button
                >
                <button
                    class="bg-bgcolor px-2 py-4 rounded-lg ml-2 flex-1"
                    class:ring-1={cardExportType === "ccv2"}
                    onclick={() => {
                        cardExportType = "ccv2"
                    }}>Character Card V2</button
                >
            {/if}
        </div>
        {#if $alertStore.submsg === "" && cardExportType === ""}
            <span class="text-textcolor mt-4">{language.format}</span>
            <SelectInput bind:value={cardExportType2} className="mt-2">
                <OptionInput value="charx">CHARX</OptionInput>
                <OptionInput value="charxJpeg">CHARX-JPEG</OptionInput>
                <OptionInput value="">PNG</OptionInput>
                <OptionInput value="json">JSON</OptionInput>
            </SelectInput>
        {/if}
        <Button
            className="mt-4"
            onclick={() => {
                alertClear(JSON.stringify({
                    type: cardExportType,
                    type2: cardExportType2,
                }))
            }}>{cardExportType === "realm" ? language.shareCloud : language.export}</Button
        >
    </div>
</div>
