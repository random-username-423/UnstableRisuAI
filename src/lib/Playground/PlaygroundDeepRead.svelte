<script lang="ts">
    import { DBState } from "src/ts/stores.svelte"
    import Button from "../UI/GUI/Button.svelte"
    import NumberInput from "../UI/GUI/NumberInput.svelte"
    import CheckInput from "../UI/GUI/CheckInput.svelte"
    import rfdc from "rfdc"

    const rfdcClone = rfdc()

    interface TestResult {
        iterations: number
        totalMs: number
        avgMs: number
    }

    let iterations = $state(100)
    let running = $state(false)
    let useUnproxied = $state(false)
    let snapshotResult = $state<TestResult | null>(null)
    let deepReadResult = $state<TestResult | null>(null)
    let jsonStringifyResult = $state<TestResult | null>(null)
    let trackDeepResult = $state<TestResult | null>(null)
    let rfdcResult = $state<TestResult | null>(null)
    let structuredCloneResult = $state<TestResult | null>(null)

    function getTestTarget(): object {
        return useUnproxied ? $state.snapshot(DBState.db) : DBState.db
    }

    /**
     * Simple recursive tracking using for...in loop.
     * Minimal overhead, no special case handling.
     */
    function trackDeep(value: unknown): void {
        if (typeof value === "object" && value !== null) {
            for (const key in value as object) {
                trackDeep((value as Record<string, unknown>)[key])
            }
        }
    }

    /**
     * Recursively reads every key and value in an object without creating copies.
     * Handles circular references, arrays, Maps, Sets, and other edge cases.
     */
    function deepRead(obj: unknown, visited = new WeakSet<object>()): void {
        // Base case: null or undefined
        if (obj === null || obj === undefined) {
            return
        }

        const type = typeof obj

        // Primitives: reading happens by accessing the value
        if (type === "string" || type === "number" || type === "boolean" || type === "bigint" || type === "symbol") {
            void obj
            return
        }

        // Functions: just touch them
        if (type === "function") {
            void obj
            return
        }

        // Handle objects
        if (type === "object") {
            // Circular reference check
            if (visited.has(obj as object)) {
                return
            }
            visited.add(obj as object)

            // Arrays
            if (Array.isArray(obj)) {
                const len = obj.length
                for (let i = 0; i < len; i++) {
                    deepRead(obj[i], visited)
                }
                return
            }

            // Map
            if (obj instanceof Map) {
                obj.forEach((value, key) => {
                    deepRead(key, visited)
                    deepRead(value, visited)
                })
                return
            }

            // Set
            if (obj instanceof Set) {
                obj.forEach((value) => {
                    deepRead(value, visited)
                })
                return
            }

            // Date, RegExp - just read their string representation
            if (obj instanceof Date || obj instanceof RegExp) {
                void obj.toString()
                return
            }

            // TypedArrays (Uint8Array, etc.) - don't iterate each byte
            if (ArrayBuffer.isView(obj)) {
                void (obj as unknown as { length: number }).length
                return
            }

            // Plain objects - read all keys and values
            const keys = Object.keys(obj as object)
            for (const key of keys) {
                const value = (obj as Record<string, unknown>)[key]
                deepRead(value, visited)
            }
        }
    }

    async function runSnapshotTest(): Promise<void> {
        running = true

        // Let UI update
        await new Promise((r) => requestAnimationFrame(r))

        const target = getTestTarget()
        const start = performance.now()

        for (let i = 0; i < iterations; i++) {
            $state.snapshot(target)
        }

        const end = performance.now()
        const totalMs = end - start

        snapshotResult = {
            iterations,
            totalMs,
            avgMs: totalMs / iterations,
        }

        running = false
    }

    async function runDeepReadTest(): Promise<void> {
        running = true

        await new Promise((r) => requestAnimationFrame(r))

        const target = getTestTarget()
        const start = performance.now()

        for (let i = 0; i < iterations; i++) {
            deepRead(target)
        }

        const end = performance.now()
        const totalMs = end - start

        deepReadResult = {
            iterations,
            totalMs,
            avgMs: totalMs / iterations,
        }

        running = false
    }

    async function runJsonStringifyTest(): Promise<void> {
        running = true

        await new Promise((r) => requestAnimationFrame(r))

        const target = getTestTarget()
        const start = performance.now()

        for (let i = 0; i < iterations; i++) {
            JSON.stringify(target)
        }

        const end = performance.now()
        const totalMs = end - start

        jsonStringifyResult = {
            iterations,
            totalMs,
            avgMs: totalMs / iterations,
        }

        running = false
    }

    async function runTrackDeepTest(): Promise<void> {
        running = true

        await new Promise((r) => requestAnimationFrame(r))

        const target = getTestTarget()
        const start = performance.now()

        for (let i = 0; i < iterations; i++) {
            trackDeep(target)
        }

        const end = performance.now()
        const totalMs = end - start

        trackDeepResult = {
            iterations,
            totalMs,
            avgMs: totalMs / iterations,
        }

        running = false
    }

    async function runRfdcTest(): Promise<void> {
        running = true

        await new Promise((r) => requestAnimationFrame(r))

        const target = getTestTarget()
        const start = performance.now()

        for (let i = 0; i < iterations; i++) {
            rfdcClone(target)
        }

        const end = performance.now()
        const totalMs = end - start

        rfdcResult = {
            iterations,
            totalMs,
            avgMs: totalMs / iterations,
        }

        running = false
    }

    async function runStructuredCloneTest(): Promise<void> {
        running = true

        await new Promise((r) => requestAnimationFrame(r))

        const target = getTestTarget()
        const start = performance.now()

        for (let i = 0; i < iterations; i++) {
            structuredClone(target)
        }

        const end = performance.now()
        const totalMs = end - start

        structuredCloneResult = {
            iterations,
            totalMs,
            avgMs: totalMs / iterations,
        }

        running = false
    }

    async function runAllTests(): Promise<void> {
        await runSnapshotTest()
        await runDeepReadTest()
        await runJsonStringifyTest()
        await runTrackDeepTest()
        await runRfdcTest()
        await runStructuredCloneTest()
    }

    function clearResults(): void {
        snapshotResult = null
        deepReadResult = null
        jsonStringifyResult = null
        trackDeepResult = null
        rfdcResult = null
        structuredCloneResult = null
    }
</script>

<h2 class="relative my-6 text-4xl font-black text-textcolor">Deep Read Performance Test</h2>

<p class="mb-4 text-textcolor2">
    Compares $state.snapshot vs deepRead vs JSON.stringify vs trackDeep vs rfdc vs structuredClone
</p>

<!-- Configuration Section -->
<div class="mb-6 flex flex-wrap items-end gap-6">
    <div>
        <span class="text-lg text-textcolor">Iterations</span>
        <div class="mt-2">
            <NumberInput bind:value={iterations} min={1} max={10000} size="md" />
        </div>
    </div>
    <div>
        <CheckInput bind:check={useUnproxied} name="Test on unproxied object" />
        <p class="mt-1 text-sm text-textcolor2">
            {#if useUnproxied}
                Testing on plain object (snapshot first, then test)
            {:else}
                Testing on Proxy object (DBState.db directly)
            {/if}
        </p>
    </div>
</div>

<!-- Action Buttons -->
<div class="mb-6 flex flex-wrap gap-4">
    <Button onclick={runSnapshotTest} disabled={running}>$state.snapshot</Button>
    <Button onclick={runDeepReadTest} disabled={running}>deepRead</Button>
    <Button onclick={runJsonStringifyTest} disabled={running}>JSON.stringify</Button>
    <Button onclick={runTrackDeepTest} disabled={running}>trackDeep</Button>
    <Button onclick={runRfdcTest} disabled={running}>rfdc</Button>
    <Button onclick={runStructuredCloneTest} disabled={running}>structuredClone</Button>
    <Button onclick={runAllTests} disabled={running}>Run All</Button>
    <Button styled="outlined" onclick={clearResults} disabled={running}>Clear</Button>
</div>

<!-- Running indicator -->
{#if running}
    <div class="mb-4 flex items-center gap-2 text-textcolor2">
        <div class="loadmove"></div>
        Running test...
    </div>
{/if}

<!-- Results Section -->
<div class="space-y-4">
    {#if snapshotResult}
        <div class="rounded-md bg-darkbg p-4">
            <h3 class="text-lg font-bold text-textcolor">$state.snapshot Results</h3>
            <div class="mt-2 text-textcolor2">
                <p>Iterations: {snapshotResult.iterations}</p>
                <p>Total Time: {snapshotResult.totalMs.toFixed(2)} ms</p>
                <p>Average Time: {snapshotResult.avgMs.toFixed(4)} ms per operation</p>
            </div>
        </div>
    {/if}

    {#if deepReadResult}
        <div class="rounded-md bg-darkbg p-4">
            <h3 class="text-lg font-bold text-textcolor">deepRead Results</h3>
            <div class="mt-2 text-textcolor2">
                <p>Iterations: {deepReadResult.iterations}</p>
                <p>Total Time: {deepReadResult.totalMs.toFixed(2)} ms</p>
                <p>Average Time: {deepReadResult.avgMs.toFixed(4)} ms per operation</p>
            </div>
        </div>
    {/if}

    {#if jsonStringifyResult}
        <div class="rounded-md bg-darkbg p-4">
            <h3 class="text-lg font-bold text-textcolor">JSON.stringify Results</h3>
            <div class="mt-2 text-textcolor2">
                <p>Iterations: {jsonStringifyResult.iterations}</p>
                <p>Total Time: {jsonStringifyResult.totalMs.toFixed(2)} ms</p>
                <p>Average Time: {jsonStringifyResult.avgMs.toFixed(4)} ms per operation</p>
            </div>
        </div>
    {/if}

    {#if trackDeepResult}
        <div class="rounded-md bg-darkbg p-4">
            <h3 class="text-lg font-bold text-textcolor">trackDeep Results</h3>
            <div class="mt-2 text-textcolor2">
                <p>Iterations: {trackDeepResult.iterations}</p>
                <p>Total Time: {trackDeepResult.totalMs.toFixed(2)} ms</p>
                <p>Average Time: {trackDeepResult.avgMs.toFixed(4)} ms per operation</p>
            </div>
        </div>
    {/if}

    {#if rfdcResult}
        <div class="rounded-md bg-darkbg p-4">
            <h3 class="text-lg font-bold text-textcolor">rfdc Results</h3>
            <div class="mt-2 text-textcolor2">
                <p>Iterations: {rfdcResult.iterations}</p>
                <p>Total Time: {rfdcResult.totalMs.toFixed(2)} ms</p>
                <p>Average Time: {rfdcResult.avgMs.toFixed(4)} ms per operation</p>
            </div>
        </div>
    {/if}

    {#if structuredCloneResult}
        <div class="rounded-md bg-darkbg p-4">
            <h3 class="text-lg font-bold text-textcolor">structuredClone Results</h3>
            <div class="mt-2 text-textcolor2">
                <p>Iterations: {structuredCloneResult.iterations}</p>
                <p>Total Time: {structuredCloneResult.totalMs.toFixed(2)} ms</p>
                <p>Average Time: {structuredCloneResult.avgMs.toFixed(4)} ms per operation</p>
            </div>
        </div>
    {/if}

    {#if snapshotResult && deepReadResult && jsonStringifyResult && trackDeepResult && rfdcResult && structuredCloneResult}
        {@const results = [
            { name: "$state.snapshot", avgMs: snapshotResult.avgMs },
            { name: "deepRead", avgMs: deepReadResult.avgMs },
            { name: "JSON.stringify", avgMs: jsonStringifyResult.avgMs },
            { name: "trackDeep", avgMs: trackDeepResult.avgMs },
            { name: "rfdc", avgMs: rfdcResult.avgMs },
            { name: "structuredClone", avgMs: structuredCloneResult.avgMs },
        ].sort((a, b) => a.avgMs - b.avgMs)}
        {@const fastest = results[0]}
        <div class="rounded-md bg-selected p-4">
            <h3 class="text-lg font-bold text-textcolor">Comparison (sorted by speed)</h3>
            <div class="mt-2 space-y-1 text-textcolor2">
                {#each results as result, i}
                    <p>
                        {i + 1}. <strong>{result.name}</strong>: {result.avgMs.toFixed(4)} ms
                        {#if i > 0}
                            <span class="text-sm">({(result.avgMs / fastest.avgMs).toFixed(2)}x slower)</span>
                        {:else}
                            <span class="text-sm text-green-500">(fastest)</span>
                        {/if}
                    </p>
                {/each}
            </div>
        </div>
    {/if}
</div>

<!-- DB Info Section -->
<div class="mt-6 rounded-md border border-darkborderc p-4">
    <h3 class="text-lg font-bold text-textcolor">Database Info</h3>
    <div class="mt-2 text-textcolor2">
        <p>Characters: {DBState.db.characters?.length ?? 0}</p>
        <p>Bot Presets: {DBState.db.botPresets?.length ?? 0}</p>
        <p>Modules: {DBState.db.modules?.length ?? 0}</p>
        <p>Lorebooks: {DBState.db.loreBook?.length ?? 0}</p>
        <p>Personas: {DBState.db.personas?.length ?? 0}</p>
        <p>Plugins: {DBState.db.plugins?.length ?? 0}</p>
    </div>
</div>
