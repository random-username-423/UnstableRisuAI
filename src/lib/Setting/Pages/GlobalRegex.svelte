<script lang="ts">
    import { DownloadIcon, HardDriveUploadIcon, PlusIcon } from "lucide-svelte"
    import { language } from "src/lang"
    import Help from "src/lib/Others/Help.svelte"

    import { DBState } from "src/ts/stores.svelte"
    import { exportRegex, importRegex } from "src/ts/process/scripting/scripts"
    import RegexList from "src/lib/SideBars/Scripts/RegexList.svelte"
</script>

<h2 class="mb-2 mt-2 text-2xl font-bold">{language.globalRegexScript} <Help key="regexScript" /></h2>
<RegexList bind:value={DBState.db.globalscript} />
<div class="mt-2 flex gap-2 text-textcolor2">
    <button
        class="cursor-pointer font-medium hover:text-green-500"
        onclick={() => {
            let script = DBState.db.globalscript
            script.push({
                comment: "",
                in: "",
                out: "",
                type: "editinput",
            })
            DBState.db.globalscript = script
        }}><PlusIcon /></button
    >
    <button
        class="cursor-pointer font-medium hover:text-green-500"
        onclick={() => {
            exportRegex()
        }}><DownloadIcon /></button
    >
    <button
        class="cursor-pointer font-medium hover:text-green-500"
        onclick={() => {
            importRegex()
        }}><HardDriveUploadIcon /></button
    >
</div>
