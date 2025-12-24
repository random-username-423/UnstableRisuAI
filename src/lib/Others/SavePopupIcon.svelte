<script lang="ts">
    import { AlertOctagon, SaveIcon } from "lucide-svelte"
    import { alertMd } from "src/ts/utils/alert.svelte"
    import { saving } from "src/ts/data/storage/autoSaveManager.svelte"
    import { AccountWarning } from "src/ts/data/storage/accountStorage.svelte"
    import { DBState } from "src/ts/stores.svelte"
</script>

{#if DBState?.db?.showSavingIcon && saving.state}
    <div
        class="saving-animation pointer-events-none absolute right-3 top-3 z-10 rounded bg-gradient-to-br from-blue-500 to-purple-800 p-2 text-white opacity-15"
    >
        <SaveIcon size={24} />
    </div>
{:else if AccountWarning.value}
    <button
        class="absolute right-3 top-3 z-10 rounded bg-red-800 p-2 text-white hover:bg-red-600"
        onclick={() => {
            alertMd(AccountWarning.value)
            AccountWarning.value = ""
        }}
    >
        <AlertOctagon size={24} />
    </button>
{/if}
