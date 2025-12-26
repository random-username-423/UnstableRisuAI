<script lang="ts">
    import { language } from "src/lang"
    import { DBState } from "src/ts/stores.svelte"
    import { onMount } from "svelte"
    import { forageStorage } from "src/ts/data/storage/autoStorage"
    import { listWithSizesRecursiveFromWorker, loadFromWorker } from "src/ts/data/storage/opfsWorkerClient.svelte"
    import { isTauri } from "src/ts/utils/env"
    import { getDbBackups } from "src/ts/init"
    import {
        RefreshCwIcon,
        DatabaseIcon,
        ImageIcon,
        MessageSquareIcon,
        FileIcon,
        HardDriveIcon,
        UsersIcon,
        FolderOpenIcon,
    } from "@lucide/svelte"
    import Button from "src/lib/UI/GUI/Button.svelte"
    import OPFSExplorer from "./OPFSExplorer.svelte"
    import IndexedDBExplorer from "./IndexedDBExplorer.svelte"

    let showExplorer = $state(false)
    let showIndexedDBExplorer = $state(false)

    interface StorageInfo {
        totalUsage: number
        quota: number
        dbSize: number
        charactersSize: number
        botPresetsSize: number
        backupsSize: number
        backupCount: number
        chatsSize: number
        chatFileCount: number
        assetsSize: number
        assetCount: number
        characterCount: number
        totalChatCount: number
    }

    let storageInfo = $state<StorageInfo>({
        totalUsage: 0,
        quota: 15 * 1024 * 1024 * 1024, // 15GB
        dbSize: 0,
        charactersSize: 0,
        botPresetsSize: 0,
        backupsSize: 0,
        backupCount: 0,
        chatsSize: 0,
        chatFileCount: 0,
        assetsSize: 0,
        assetCount: 0,
        characterCount: DBState.db?.characters?.length ?? 0,
        totalChatCount: DBState.db?.characters?.reduce((sum, char) => sum + (char.chats?.length ?? 0), 0) ?? 0,
    })
    let loading = $state(true)
    let error = $state<string | null>(null)

    function formatBytes(bytes: number): string {
        if (bytes === 0) return "0 B"
        if (bytes < 0) return "0 B"
        const k = 1024
        const sizes = ["B", "KB", "MB", "GB", "TB"]
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    }

    function formatPercent(used: number, total: number): string {
        if (total === 0) return "0%"
        return ((used / total) * 100).toFixed(1) + "%"
    }

    async function loadStorageInfo() {
        loading = true
        error = null

        try {
            const info: StorageInfo = {
                totalUsage: 0,
                quota: 0,
                dbSize: 0,
                charactersSize: 0,
                botPresetsSize: 0,
                backupsSize: 0,
                backupCount: 0,
                chatsSize: 0,
                chatFileCount: 0,
                assetsSize: 0,
                assetCount: 0,
                characterCount: DBState.db?.characters?.length ?? 0,
                totalChatCount: 0,
            }

            // Count total chats from all characters
            if (DBState.db?.characters) {
                for (const char of DBState.db.characters) {
                    info.totalChatCount += char.chats?.length ?? 0
                }
            }

            // Get browser storage estimate
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate()
                info.totalUsage = estimate.usage ?? 0
                info.quota = 15 * 1024 * 1024 * 1024 // 15GB 하드코딩
            }

            // Get OPFS file sizes
            try {
                // Database file
                const dbData = await loadFromWorker("database/database.bin")
                if (dbData) {
                    info.dbSize = dbData.byteLength
                }

                // Characters file
                const charsData = await loadFromWorker("database/characters.bin")
                if (charsData) {
                    info.charactersSize = charsData.byteLength
                }

                // Bot presets file
                const presetsData = await loadFromWorker("database/botpresets.bin")
                if (presetsData) {
                    info.botPresetsSize = presetsData.byteLength
                }

                // Backup files
                const backups = await getDbBackups()
                info.backupCount = backups.length
                for (const backup of backups) {
                    try {
                        const backupData = await loadFromWorker(`database/dbbackup-${backup}.bin`)
                        if (backupData) {
                            info.backupsSize += backupData.byteLength
                        }
                    } catch (e) {
                        // Ignore individual backup errors
                    }
                }

                // Chat files (nested structure: chaId/chatId.bin)
                try {
                    const chatFiles = await listWithSizesRecursiveFromWorker("database/chats")
                    info.chatFileCount = chatFiles.length
                    info.chatsSize = chatFiles.reduce((sum, f) => sum + f.size, 0)
                } catch (e) {
                    // No chat directory
                }
            } catch (e) {
                console.error("[StorageSettings] OPFS error:", e)
            }

            // Get IndexedDB asset sizes
            try {
                const keys = await forageStorage.keys()
                const assetKeys = keys.filter((key) => key && key.startsWith("assets/"))
                info.assetCount = assetKeys.length

                // Sample a few assets to estimate average size
                const sampleSize = Math.min(10, assetKeys.length)
                let sampleTotal = 0
                for (let i = 0; i < sampleSize; i++) {
                    try {
                        const data = (await forageStorage.getItem(assetKeys[i])) as unknown as Uint8Array
                        if (data) {
                            sampleTotal += data.byteLength
                        }
                    } catch (e) {
                        // Ignore
                    }
                }
                if (sampleSize > 0) {
                    const avgSize = sampleTotal / sampleSize
                    info.assetsSize = Math.round(avgSize * assetKeys.length)
                }
            } catch (e) {
                console.error("[StorageSettings] IndexedDB error:", e)
            }

            storageInfo = info
        } catch (e) {
            error = e instanceof Error ? e.message : String(e)
        } finally {
            loading = false
        }
    }

    onMount(() => {
        loadStorageInfo()
    })
</script>

<h2 class="mb-2 mt-2 text-2xl font-bold">{language.storage}</h2>

{#if error}
    <div class="mt-4 text-red-500">
        {language.error}: {error}
    </div>
{:else}
    <!-- Total Usage -->
    <div class="mt-4 rounded-lg bg-darkbg p-4">
        <div class="mb-2 flex items-center gap-2">
            <HardDriveIcon size={20} />
            <span class="font-semibold">{language.storageOverview}</span>
        </div>
        <div class="mt-2">
            <div class="mb-1 flex justify-between text-sm">
                <span>{language.storageUsed}</span>
                {#if loading}
                    <span class="text-textcolor2">{language.storageCalculating}</span>
                {:else}
                    <span>{formatBytes(storageInfo.totalUsage)} / {formatBytes(storageInfo.quota)}</span>
                {/if}
            </div>
            <div class="h-2 w-full rounded-full bg-selected">
                <div
                    class="h-2 rounded-full bg-green-500 transition-all"
                    style="width: {loading ? '0%' : formatPercent(storageInfo.totalUsage, storageInfo.quota)}"
                ></div>
            </div>
            <div class="mt-1 text-xs text-textcolor2">
                {#if loading}
                    {language.storageCalculating}
                {:else}
                    {formatPercent(storageInfo.totalUsage, storageInfo.quota)}
                    {language.storageUsedPercent}
                {/if}
            </div>
        </div>
    </div>

    <!-- File Statistics -->
    <div class="mt-4 rounded-lg bg-darkbg p-4">
        <div class="mb-3 flex items-center gap-2">
            <FileIcon size={20} />
            <span class="font-semibold">{language.storageFiles}</span>
        </div>

        <div class="grid grid-cols-2 gap-3">
            <!-- Characters -->
            <div class="flex items-center gap-2 rounded bg-selected p-2">
                <UsersIcon size={16} />
                <div>
                    <div class="text-sm font-medium">{language.storageCharacters}</div>
                    <div class="text-sm">{storageInfo.characterCount} {language.storageItems}</div>
                </div>
            </div>

            <!-- Chats -->
            <div class="flex items-center gap-2 rounded bg-selected p-2">
                <MessageSquareIcon size={16} />
                <div>
                    <div class="text-sm font-medium">{language.storageChats}</div>
                    <div class="text-sm">
                        {storageInfo.totalChatCount}
                        {language.storageItems}{#if loading}
                            (<span class="text-textcolor2">{language.storageCalculating}</span>)
                        {:else if storageInfo.chatsSize > 0}
                            ({formatBytes(storageInfo.chatsSize)}){/if}
                    </div>
                </div>
            </div>

            <!-- Assets -->
            <div class="flex items-center gap-2 rounded bg-selected p-2">
                <ImageIcon size={16} />
                <div>
                    <div class="text-sm font-medium">{language.storageAssets}</div>
                    <div class="text-sm">
                        {#if loading}
                            <span class="text-textcolor2">{language.storageCalculating}</span>
                        {:else}
                            {storageInfo.assetCount} {language.storageItems} (~{formatBytes(storageInfo.assetsSize)})
                        {/if}
                    </div>
                </div>
            </div>

            <!-- Backups -->
            <div class="flex items-center gap-2 rounded bg-selected p-2">
                <DatabaseIcon size={16} />
                <div>
                    <div class="text-sm font-medium">{language.storageBackups}</div>
                    <div class="text-sm">
                        {#if loading}
                            <span class="text-textcolor2">{language.storageCalculating}</span>
                        {:else}
                            {storageInfo.backupCount} {language.storageItems} ({formatBytes(storageInfo.backupsSize)})
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Database Files -->
    <div class="mt-4 rounded-lg bg-darkbg p-4">
        <div class="mb-3 flex items-center gap-2">
            <DatabaseIcon size={20} />
            <span class="font-semibold">{language.storageDatabaseFiles}</span>
        </div>

        <div class="space-y-2 text-sm">
            <div class="flex justify-between">
                <span class="text-textcolor2">database.bin</span>
                {#if loading}
                    <span class="text-textcolor2">{language.storageCalculating}</span>
                {:else}
                    <span>{formatBytes(storageInfo.dbSize)}</span>
                {/if}
            </div>
            <div class="flex justify-between">
                <span class="text-textcolor2">characters.bin</span>
                {#if loading}
                    <span class="text-textcolor2">{language.storageCalculating}</span>
                {:else}
                    <span>{formatBytes(storageInfo.charactersSize)}</span>
                {/if}
            </div>
            <div class="flex justify-between">
                <span class="text-textcolor2">botpresets.bin</span>
                {#if loading}
                    <span class="text-textcolor2">{language.storageCalculating}</span>
                {:else}
                    <span>{formatBytes(storageInfo.botPresetsSize)}</span>
                {/if}
            </div>
            {#if loading}
                <div class="flex justify-between">
                    <span class="text-textcolor2">chats/</span>
                    <span class="text-textcolor2">{language.storageCalculating}</span>
                </div>
            {:else if storageInfo.chatFileCount > 0}
                <div class="flex justify-between">
                    <span class="text-textcolor2"
                        >chats/ ({storageInfo.chatFileCount} {language.storageFilesCount})</span
                    >
                    <span
                        >{#if storageInfo.chatsSize > 0}{formatBytes(
                                storageInfo.chatsSize
                            )}{:else}{language.storageIndividual}{/if}</span
                    >
                </div>
            {/if}
        </div>
    </div>

    <!-- Environment Info -->
    <div class="mt-4 rounded-lg bg-darkbg p-4">
        <div class="mb-3 flex items-center gap-2">
            <FileIcon size={20} />
            <span class="font-semibold">{language.storageEnvironment}</span>
        </div>

        <div class="space-y-2 text-sm">
            <div class="flex justify-between">
                <span class="text-textcolor2">{language.storagePlatform}</span>
                <span>{isTauri ? "Tauri (Desktop)" : "Web Browser"}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-textcolor2">{language.storageDbLocation}</span>
                <span>OPFS</span>
            </div>
            <div class="flex justify-between">
                <span class="text-textcolor2">{language.storageAssetLocation}</span>
                <span>IndexedDB</span>
            </div>
        </div>
    </div>

    <!-- Buttons -->
    <div class="mt-4 flex gap-2">
        <Button onclick={loadStorageInfo} disabled={loading}>
            <RefreshCwIcon size={16} class={loading ? "animate-spin" : ""} />
            {language.storageRefresh}
        </Button>
        <Button onclick={() => (showExplorer = true)}>
            <FolderOpenIcon size={16} />
            {language.openOPFSExplorer || "Open OPFS Explorer"}
        </Button>
        <Button onclick={() => (showIndexedDBExplorer = true)}>
            <FolderOpenIcon size={16} />
            {language.openIndexedDBExplorer || "Open IndexedDB Explorer"}
        </Button>
    </div>
{/if}

{#if showExplorer}
    <OPFSExplorer close={() => (showExplorer = false)} />
{/if}

{#if showIndexedDBExplorer}
    <IndexedDBExplorer close={() => (showIndexedDBExplorer = false)} />
{/if}
