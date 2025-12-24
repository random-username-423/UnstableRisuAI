<script lang="ts">
    import Check from "src/lib/UI/GUI/CheckInput.svelte"
    import { language } from "src/lang"
    import { DBState } from "src/ts/stores.svelte"
</script>

<h2 class="mb-2 mt-2 text-2xl font-bold">{language.accessibility}</h2>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.askRemoval} name={language.askRemoval} />
</div>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.swipe} name={language.SwipeRegenerate} />
</div>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.instantRemove} name={language.instantRemove} />
</div>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.sendWithEnter} name={language.sendWithEnter} />
</div>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.fixedChatTextarea} name={language.fixedChatTextarea} />
</div>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.clickToEdit} name={language.clickToEdit} />
</div>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.botSettingAtStart} name={language.botSettingAtStart} />
</div>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.toggleConfirmRecommendedPreset} name={language.toggleConfirmRecommendedPreset} />
</div>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.showMenuChatList} name={language.showMenuChatList} />
</div>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.showMenuHypaMemoryModal} name={language.showMenuHypaMemoryModal} />
</div>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.goCharacterOnImport} name={language.goCharacterOnImport} />
</div>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.sideMenuRerollButton} name={language.sideMenuRerollButton} />
</div>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.localActivationInGlobalLorebook} name={language.localActivationInGlobalLorebook} />
</div>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.requestInfoInsideChat} name={language.requestInfoInsideChat} />
</div>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.inlayErrorResponse} name={language.inlayErrorResponse} />
</div>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.bulkEnabling} name={language.bulkEnabling} />
</div>

<div class="mt-2 flex items-center">
    <Check bind:check={DBState.db.showTranslationLoading} name={language.showTranslationLoading} />
</div>
