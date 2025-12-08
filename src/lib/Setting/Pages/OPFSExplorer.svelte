<script lang="ts">
    import { language } from "src/lang"
    import { listEntriesFromWorker } from "src/ts/data/storage/opfsWorkerClient.svelte"
    import { onMount } from "svelte"
    import { FolderIcon, FileIcon, ArrowLeftIcon, XIcon } from "lucide-svelte"

    interface Props {
        close: () => void
    }
    let { close }: Props = $props()

    interface Entry {
        name: string
        size: number
        isDirectory: boolean
    }

    let currentPath = $state('')
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
            console.error('[OPFSExplorer] Error loading directory:', e)
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
        loadDirectory('')
    })
</script>

<!-- 모달 배경 -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center"
    onclick={(e) => {
        if (e.target === e.currentTarget) close()
    }}
>
    <div class="bg-darkbg p-4 rounded-md flex flex-col w-[600px] max-h-[80vh]">
        <!-- 헤더 -->
        <div class="flex items-center gap-2 mb-4">
            <button
                onclick={goBack}
                disabled={pathHistory.length === 0}
                class="p-1 rounded hover:bg-selected disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <ArrowLeftIcon size={20} />
            </button>
            <div class="flex-grow text-sm text-textcolor2 truncate">
                /{currentPath || language.opfsRoot || 'root'}
            </div>
            <button
                onclick={close}
                class="p-1 rounded hover:bg-selected"
            >
                <XIcon size={20} />
            </button>
        </div>

        <!-- 파일/폴더 목록 -->
        <div class="overflow-y-auto flex-grow border border-selected rounded-md">
            {#if loading}
                <div class="p-4 text-center text-textcolor2">
                    {language.loading}...
                </div>
            {:else if entries.length === 0}
                <div class="p-4 text-center text-textcolor2">
                    {language.opfsEmpty || 'Empty folder'}
                </div>
            {:else}
                {#each entries as entry, i}
                    {#if i !== 0}
                        <div class="border-t border-selected"></div>
                    {/if}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="flex items-center gap-2 p-2 hover:bg-selected cursor-pointer"
                        onclick={() => enterDirectory(entry)}
                    >
                        {#if entry.isDirectory}
                            <FolderIcon size={18} class="text-yellow-500 flex-shrink-0" />
                        {:else}
                            <FileIcon size={18} class="text-textcolor2 flex-shrink-0" />
                        {/if}
                        <span class="flex-grow truncate">{entry.name}</span>
                        {#if !entry.isDirectory}
                            <span class="text-sm text-textcolor2 flex-shrink-0">
                                {formatBytes(entry.size)}
                            </span>
                        {/if}
                    </div>
                {/each}
            {/if}
        </div>

        <!-- 푸터 -->
        <div class="mt-3 text-xs text-textcolor2 text-center">
            {entries.length} {language.storageItems || 'items'}
        </div>
    </div>
</div>
