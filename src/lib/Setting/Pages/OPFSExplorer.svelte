<script lang="ts">
    import { language } from "src/lang"
    import { listEntriesFromWorker } from "src/ts/data/storage/opfsWorkerClient.svelte"
    import { onMount } from "svelte"
    import { FolderIcon, FileIcon, ArrowLeftIcon, XIcon } from "@lucide/svelte"

    interface Props {
        close: () => void
    }
    let { close }: Props = $props()

    interface Entry {
        name: string
        size: number
        isDirectory: boolean
    }

    let currentPath = $state("")
    let entries = $state<Entry[]>([])
    let loading = $state(true)
    let pathHistory = $state<string[]>([])

    function formatBytes(bytes: number): string {
        if (bytes === 0) return "0 B"
        if (bytes < 0) return "0 B"
        const k = 1024
        const sizes = ["B", "KB", "MB", "GB", "TB"]
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    }

    async function loadDirectory(path: string) {
        loading = true
        try {
            entries = await listEntriesFromWorker(path)
        } catch (e) {
            console.error("[OPFSExplorer] Error loading directory:", e)
            entries = []
        }
        loading = false
    }

    function goBack() {
        if (pathHistory.length > 0) {
            const prevPath = pathHistory.pop()!
            pathHistory = pathHistory
            currentPath = prevPath
            loadDirectory(currentPath)
        }
    }

    function enterDirectory(entry: Entry) {
        if (entry.isDirectory) {
            pathHistory = [...pathHistory, currentPath]
            currentPath = currentPath ? `${currentPath}/${entry.name}` : entry.name
            loadDirectory(currentPath)
        }
    }

    onMount(() => {
        loadDirectory("")
    })
</script>

<!-- 모달 배경 -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    onclick={(e) => {
        if (e.target === e.currentTarget) close()
    }}
>
    <div class="flex max-h-[80vh] w-[600px] flex-col rounded-md bg-darkbg p-4">
        <!-- 헤더 -->
        <div class="mb-4 flex items-center gap-2">
            <button
                onclick={goBack}
                disabled={pathHistory.length === 0}
                class="rounded p-1 hover:bg-selected disabled:cursor-not-allowed disabled:opacity-30"
            >
                <ArrowLeftIcon size={20} />
            </button>
            <div class="flex-grow truncate text-sm text-textcolor2">
                /{currentPath || language.opfsRoot || "root"}
            </div>
            <button onclick={close} class="rounded p-1 hover:bg-selected">
                <XIcon size={20} />
            </button>
        </div>

        <!-- 파일/폴더 목록 -->
        <div class="flex-grow overflow-y-auto rounded-md border border-selected">
            {#if loading}
                <div class="p-4 text-center text-textcolor2">
                    {language.loading}...
                </div>
            {:else if entries.length === 0}
                <div class="p-4 text-center text-textcolor2">
                    {language.opfsEmpty || "Empty folder"}
                </div>
            {:else}
                {#each entries as entry, i}
                    {#if i !== 0}
                        <div class="border-t border-selected"></div>
                    {/if}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="flex cursor-pointer items-center gap-2 p-2 hover:bg-selected"
                        onclick={() => enterDirectory(entry)}
                    >
                        {#if entry.isDirectory}
                            <FolderIcon size={18} class="flex-shrink-0 text-yellow-500" />
                        {:else}
                            <FileIcon size={18} class="flex-shrink-0 text-textcolor2" />
                        {/if}
                        <span class="flex-grow truncate">{entry.name}</span>
                        {#if !entry.isDirectory}
                            <span class="flex-shrink-0 text-sm text-textcolor2">
                                {formatBytes(entry.size)}
                            </span>
                        {/if}
                    </div>
                {/each}
            {/if}
        </div>

        <!-- 푸터 -->
        <div class="mt-3 text-center text-xs text-textcolor2">
            {entries.length}
            {language.storageItems || "items"}
        </div>
    </div>
</div>
