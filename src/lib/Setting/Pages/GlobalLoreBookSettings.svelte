<script lang="ts">
    import { language } from "src/lang"
    import Help from "src/lib/Others/Help.svelte"
    import LoreBookSetting from "src/lib/SideBars/LoreBook/LoreBookSetting.svelte"

    import { DBState } from "src/ts/stores.svelte"
    interface Props {
        openLoreList?: boolean
    }

    let { openLoreList = $bindable(false) }: Props = $props()
</script>

<h2 class="mb-2 mt-2 text-2xl font-bold">{language.globalLoreBook} <Help key="lorebook" /></h2>
<button
    onclick={() => {
        openLoreList = true
    }}
    class="mb-4 ml-2 mr-2 mt-4 flex items-center justify-center rounded-lg bg-selected p-3 drop-shadow-lg"
    >{DBState.db.loreBook[DBState.db.loreBookPage].name}</button
>

<LoreBookSetting globalMode />
