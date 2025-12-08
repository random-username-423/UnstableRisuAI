<script lang="ts">
    import { language } from "src/lang"
    import { onMount } from "svelte"
    import { DatabaseIcon, FolderIcon, FileIcon, ArrowLeftIcon, XIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-svelte"

    interface Props {
        close: () => void
    }
    let { close }: Props = $props()

    const PAGE_SIZE = 50

    // Navigation state
    let level = $state(0) // 0: DB list, 1: Store list, 2: Key-Value list
    let selectedDb = $state<string | null>(null)
    let selectedStore = $state<string | null>(null)
    let openedDb = $state<IDBDatabase | null>(null)

    // Data state
    let databases = $state<{name: string, version: number}[]>([])
    let stores = $state<string[]>([])
    let allKeys = $state<IDBValidKey[]>([])
    let entries = $state<{key: string, valuePreview: string}[]>([])

    // Pagination
    let currentPage = $state(0)
    let totalKeys = $state(0)

    // Loading
    let loading = $state(true)

    // Format value for preview
    function formatValue(value: unknown): string {
        if (value === null) return 'null'
        if (value === undefined) return 'undefined'

        if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
            const size = value instanceof Uint8Array ? value.byteLength : value.byteLength
            return `[Binary: ${formatBytes(size)}]`
        }

        if (typeof value === 'string') {
            if (value.length > 100) {
                return value.slice(0, 100) + '...'
            }
            return value
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value)
        }

        if (Array.isArray(value)) {
            return `[Array: ${value.length} items]`
        }

        if (typeof value === 'object') {
            try {
                const json = JSON.stringify(value)
                if (json.length > 100) {
                    return json.slice(0, 100) + '...'
                }
                return json
            } catch {
                return '[Object]'
            }
        }

        return String(value)
    }

    function formatBytes(bytes: number): string {
        if (bytes === 0) return "0 B"
        if (bytes < 0) return "0 B"
        const k = 1024
        const sizes = ["B", "KB", "MB", "GB", "TB"]
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    }

    function formatKey(key: IDBValidKey): string {
        if (typeof key === 'string') return key
        if (typeof key === 'number') return String(key)
        if (key instanceof Date) return key.toISOString()
        if (Array.isArray(key)) return JSON.stringify(key)
        if (key instanceof ArrayBuffer) return `[ArrayBuffer: ${key.byteLength} bytes]`
        return String(key)
    }

    // Level 0: Load all databases
    async function loadDatabases() {
        loading = true
        try {
            const dbs = await indexedDB.databases()
            databases = dbs
                .filter(db => db.name) // Filter out undefined names
                .map(db => ({ name: db.name!, version: db.version ?? 1 }))
                .sort((a, b) => a.name.localeCompare(b.name))
        } catch (e) {
            console.error('[IndexedDBExplorer] Error loading databases:', e)
            databases = []
        }
        loading = false
    }

    // Level 1: Load object stores for a database
    async function loadStores(dbName: string) {
        loading = true
        try {
            // Close previous database if open
            if (openedDb) {
                openedDb.close()
                openedDb = null
            }

            const db = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open(dbName)
                request.onsuccess = () => resolve(request.result)
                request.onerror = () => reject(request.error)
            })

            openedDb = db
            stores = Array.from(db.objectStoreNames).sort()
            selectedDb = dbName
            level = 1
        } catch (e) {
            console.error('[IndexedDBExplorer] Error loading stores:', e)
            stores = []
        }
        loading = false
    }

    // Level 2: Load keys from an object store
    async function loadEntries(storeName: string, page: number = 0) {
        loading = true
        try {
            if (!openedDb) {
                throw new Error('No database open')
            }

            const tx = openedDb.transaction(storeName, 'readonly')
            const store = tx.objectStore(storeName)

            // Get all keys first (for pagination)
            const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
                const request = store.getAllKeys()
                request.onsuccess = () => resolve(request.result)
                request.onerror = () => reject(request.error)
            })

            allKeys = keys
            totalKeys = keys.length
            currentPage = page

            // Get keys for current page
            const startIdx = page * PAGE_SIZE
            const endIdx = Math.min(startIdx + PAGE_SIZE, keys.length)
            const pageKeys = keys.slice(startIdx, endIdx)

            // Get values for these keys
            const tx2 = openedDb.transaction(storeName, 'readonly')
            const store2 = tx2.objectStore(storeName)

            const entriesData: {key: string, valuePreview: string}[] = []
            for (const key of pageKeys) {
                const value = await new Promise<unknown>((resolve, reject) => {
                    const request = store2.get(key)
                    request.onsuccess = () => resolve(request.result)
                    request.onerror = () => reject(request.error)
                })
                entriesData.push({
                    key: formatKey(key),
                    valuePreview: formatValue(value)
                })
            }

            entries = entriesData
            selectedStore = storeName
            level = 2
        } catch (e) {
            console.error('[IndexedDBExplorer] Error loading entries:', e)
            entries = []
        }
        loading = false
    }

    // Navigation
    function goBack() {
        if (level === 2) {
            level = 1
            selectedStore = null
            entries = []
            allKeys = []
            currentPage = 0
        } else if (level === 1) {
            level = 0
            selectedDb = null
            stores = []
            if (openedDb) {
                openedDb.close()
                openedDb = null
            }
        }
    }

    function selectDatabase(dbName: string) {
        loadStores(dbName)
    }

    function selectStore(storeName: string) {
        loadEntries(storeName, 0)
    }

    function prevPage() {
        if (currentPage > 0 && selectedStore) {
            loadEntries(selectedStore, currentPage - 1)
        }
    }

    function nextPage() {
        if ((currentPage + 1) * PAGE_SIZE < totalKeys && selectedStore) {
            loadEntries(selectedStore, currentPage + 1)
        }
    }

    // Get breadcrumb path
    function getBreadcrumb(): string {
        if (level === 0) {
            return language.indexedDBAllDatabases || 'All Databases'
        } else if (level === 1) {
            return `${selectedDb}`
        } else {
            return `${selectedDb} / ${selectedStore}`
        }
    }

    onMount(() => {
        loadDatabases()

        // Cleanup on unmount
        return () => {
            if (openedDb) {
                openedDb.close()
            }
        }
    })
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center"
    onclick={(e) => {
        if (e.target === e.currentTarget) close()
    }}
>
    <div class="bg-darkbg p-4 rounded-md flex flex-col w-[700px] max-h-[80vh]">
        <!-- Header -->
        <div class="flex items-center gap-2 mb-4">
            <button
                onclick={goBack}
                disabled={level === 0}
                class="p-1 rounded hover:bg-selected disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <ArrowLeftIcon size={20} />
            </button>
            <div class="flex-grow text-sm text-textcolor2 truncate">
                {getBreadcrumb()}
            </div>
            <button
                onclick={close}
                class="p-1 rounded hover:bg-selected"
            >
                <XIcon size={20} />
            </button>
        </div>

        <!-- Content -->
        <div class="overflow-y-auto flex-grow border border-selected rounded-md">
            {#if loading}
                <div class="p-4 text-center text-textcolor2">
                    {language.loading}...
                </div>
            {:else if level === 0}
                <!-- Database list -->
                {#if databases.length === 0}
                    <div class="p-4 text-center text-textcolor2">
                        {language.opfsEmpty || 'No databases found'}
                    </div>
                {:else}
                    {#each databases as db, i}
                        {#if i !== 0}
                            <div class="border-t border-selected"></div>
                        {/if}
                        <div
                            class="flex items-center gap-2 p-2 hover:bg-selected cursor-pointer"
                            onclick={() => selectDatabase(db.name)}
                        >
                            <DatabaseIcon size={18} class="text-blue-500 flex-shrink-0" />
                            <span class="flex-grow truncate">{db.name}</span>
                            <span class="text-sm text-textcolor2 flex-shrink-0">v{db.version}</span>
                        </div>
                    {/each}
                {/if}
            {:else if level === 1}
                <!-- Object Store list -->
                {#if stores.length === 0}
                    <div class="p-4 text-center text-textcolor2">
                        {language.opfsEmpty || 'No object stores found'}
                    </div>
                {:else}
                    {#each stores as store, i}
                        {#if i !== 0}
                            <div class="border-t border-selected"></div>
                        {/if}
                        <div
                            class="flex items-center gap-2 p-2 hover:bg-selected cursor-pointer"
                            onclick={() => selectStore(store)}
                        >
                            <FolderIcon size={18} class="text-yellow-500 flex-shrink-0" />
                            <span class="flex-grow truncate">{store}</span>
                        </div>
                    {/each}
                {/if}
            {:else}
                <!-- Key-Value list -->
                {#if entries.length === 0}
                    <div class="p-4 text-center text-textcolor2">
                        {language.opfsEmpty || 'No entries found'}
                    </div>
                {:else}
                    {#each entries as entry, i}
                        {#if i !== 0}
                            <div class="border-t border-selected"></div>
                        {/if}
                        <div class="flex flex-col p-2 hover:bg-selected">
                            <div class="flex items-center gap-2">
                                <FileIcon size={16} class="text-textcolor2 flex-shrink-0" />
                                <span class="font-mono text-sm truncate">{entry.key}</span>
                            </div>
                            <div class="ml-6 text-xs text-textcolor2 truncate mt-1">
                                {entry.valuePreview}
                            </div>
                        </div>
                    {/each}
                {/if}
            {/if}
        </div>

        <!-- Footer -->
        <div class="mt-3 flex items-center justify-between text-xs text-textcolor2">
            {#if level === 2 && totalKeys > 0}
                <!-- Pagination -->
                <button
                    onclick={prevPage}
                    disabled={currentPage === 0}
                    class="p-1 rounded hover:bg-selected disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeftIcon size={16} />
                </button>
                <span>
                    {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, totalKeys)}
                    {language.indexedDBOf || 'of'}
                    {totalKeys}
                </span>
                <button
                    onclick={nextPage}
                    disabled={(currentPage + 1) * PAGE_SIZE >= totalKeys}
                    class="p-1 rounded hover:bg-selected disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronRightIcon size={16} />
                </button>
            {:else if level === 0}
                <span class="w-full text-center">{databases.length} {language.storageItems || 'databases'}</span>
            {:else if level === 1}
                <span class="w-full text-center">{stores.length} {language.storageItems || 'stores'}</span>
            {:else}
                <span class="w-full text-center">0 {language.storageItems || 'items'}</span>
            {/if}
        </div>
    </div>
</div>
