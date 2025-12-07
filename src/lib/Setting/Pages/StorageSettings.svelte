<script lang="ts">
    import { language } from "src/lang"
    import { DBState } from "src/ts/stores.svelte"
    import { onMount } from "svelte"
    import { forageStorage } from "src/ts/data/storage/autoStorage"
    import { listWithSizesFromWorker, loadFromWorker } from "src/ts/data/storage/opfsWorkerClient.svelte"
    import { isTauri } from "src/ts/utils/env"
    import { getDbBackups } from "src/ts/init"
    import { RefreshCwIcon, Trash2Icon, DatabaseIcon, ImageIcon, MessageSquareIcon, FileIcon, HardDriveIcon, UsersIcon } from "lucide-svelte"
    import Button from "src/lib/UI/GUI/Button.svelte"
    import { alertConfirm, alertNormal } from "src/ts/utils/alert"

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

    let storageInfo = $state<StorageInfo | null>(null)
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

                // Chat files
                try {
                    const chatFiles = await listWithSizesFromWorker("database/chats")
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

<h2 class="mb-2 text-2xl font-bold mt-2">{language.storage}</h2>

{#if loading}
    <div class="flex items-center gap-2 text-textcolor2 mt-4">
        <RefreshCwIcon class="animate-spin" size={20} />
        <span>{language.loading}...</span>
    </div>
{:else if error}
    <div class="text-red-500 mt-4">
        {language.error}: {error}
    </div>
{:else if storageInfo}
    <!-- Total Usage -->
    <div class="mt-4 p-4 bg-darkbg rounded-lg">
        <div class="flex items-center gap-2 mb-2">
            <HardDriveIcon size={20} />
            <span class="font-semibold">{language.storageOverview}</span>
        </div>
        <div class="mt-2">
            <div class="flex justify-between text-sm mb-1">
                <span>{language.storageUsed}</span>
                <span>{formatBytes(storageInfo.totalUsage)} / {formatBytes(storageInfo.quota)}</span>
            </div>
            <div class="w-full bg-selected rounded-full h-2">
                <div
                    class="bg-green-500 h-2 rounded-full transition-all"
                    style="width: {formatPercent(storageInfo.totalUsage, storageInfo.quota)}"
                ></div>
            </div>
            <div class="text-xs text-textcolor2 mt-1">
                {formatPercent(storageInfo.totalUsage, storageInfo.quota)}
                {language.storageUsedPercent}
            </div>
        </div>
    </div>

    <!-- File Statistics -->
    <div class="mt-4 p-4 bg-darkbg rounded-lg">
        <div class="flex items-center gap-2 mb-3">
            <FileIcon size={20} />
            <span class="font-semibold">{language.storageFiles}</span>
        </div>

        <div class="grid grid-cols-2 gap-3">
            <!-- Characters -->
            <div class="flex items-center gap-2 p-2 bg-selected rounded">
                <UsersIcon size={16} />
                <div>
                    <div class="text-sm font-medium">{language.storageCharacters}</div>
                    <div class="text-sm">{storageInfo.characterCount} {language.storageItems}</div>
                </div>
            </div>

            <!-- Chats -->
            <div class="flex items-center gap-2 p-2 bg-selected rounded">
                <MessageSquareIcon size={16} />
                <div>
                    <div class="text-sm font-medium">{language.storageChats}</div>
                    <div class="text-sm">
                        {storageInfo.totalChatCount}
                        {language.storageItems}{#if storageInfo.chatsSize > 0}
                            ({formatBytes(storageInfo.chatsSize)}){/if}
                    </div>
                </div>
            </div>

            <!-- Assets -->
            <div class="flex items-center gap-2 p-2 bg-selected rounded">
                <ImageIcon size={16} />
                <div>
                    <div class="text-sm font-medium">{language.storageAssets}</div>
                    <div class="text-sm">{storageInfo.assetCount} {language.storageItems} (~{formatBytes(storageInfo.assetsSize)})</div>
                </div>
            </div>

            <!-- Backups -->
            <div class="flex items-center gap-2 p-2 bg-selected rounded">
                <DatabaseIcon size={16} />
                <div>
                    <div class="text-sm font-medium">{language.storageBackups}</div>
                    <div class="text-sm">{storageInfo.backupCount} {language.storageItems} ({formatBytes(storageInfo.backupsSize)})</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Database Files -->
    <div class="mt-4 p-4 bg-darkbg rounded-lg">
        <div class="flex items-center gap-2 mb-3">
            <DatabaseIcon size={20} />
            <span class="font-semibold">{language.storageDatabaseFiles}</span>
        </div>

        <div class="space-y-2 text-sm">
            <div class="flex justify-between">
                <span class="text-textcolor2">database.bin</span>
                <span>{formatBytes(storageInfo.dbSize)}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-textcolor2">characters.bin</span>
                <span>{formatBytes(storageInfo.charactersSize)}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-textcolor2">botpresets.bin</span>
                <span>{formatBytes(storageInfo.botPresetsSize)}</span>
            </div>
            {#if storageInfo.chatFileCount > 0}
                <div class="flex justify-between">
                    <span class="text-textcolor2">chats/ ({storageInfo.chatFileCount} {language.storageFilesCount})</span>
                    <span
                        >{#if storageInfo.chatsSize > 0}{formatBytes(storageInfo.chatsSize)}{:else}{language.storageIndividual}{/if}</span
                    >
                </div>
            {/if}
        </div>
    </div>

    <!-- Environment Info -->
    <div class="mt-4 p-4 bg-darkbg rounded-lg">
        <div class="flex items-center gap-2 mb-3">
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

    <!-- Refresh Button -->
    <div class="mt-4">
        <Button onclick={loadStorageInfo}>
            <RefreshCwIcon size={16} />
            {language.storageRefresh}
        </Button>
    </div>
{/if}
