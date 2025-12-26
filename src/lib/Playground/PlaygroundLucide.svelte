<script lang="ts">
    import { CopyIcon, Share2Icon, TrashIcon } from "@lucide/svelte"

    let testType = $state<
        | "none"
        | "empty"
        | "minimal"
        | "nested-divs"
        | "depth-2"
        | "depth-3"
        | "depth-4"
        | "siblings-3"
        | "siblings-6"
        | "nested-with-class"
        | "nested-with-if"
        | "lucide"
        | "lucide-nested"
        | "svg"
        | "svg-nested"
        | "text"
        | "snippet-nested"
        | "snippet-full"
        | "raw-nested"
        | "keyed-nested"
        | "html-nested"
        | "html-full"
        | "vanilla-nested"
        | "vanilla-full"
    >("none")
    let count = $state(400)
    let renderTime = $state(0)
    let items = $state<number[]>([])
    let rawItems = $state.raw<number[]>([])
    let keyedItems = $state<{ id: number }[]>([])
    let htmlContent = $state("")

    const copySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
    const shareSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/></svg>`
    const trashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>`

    function runTest(type: typeof testType) {
        items = []
        rawItems = []
        keyedItems = []
        testType = "none"

        // Use requestAnimationFrame to measure actual render time
        requestAnimationFrame(() => {
            const start = performance.now()

            if (type === "raw-nested") {
                rawItems = Array.from({ length: count }, (_, i) => i)
            } else if (type === "keyed-nested") {
                keyedItems = Array.from({ length: count }, (_, i) => ({ id: i }))
            } else if (type === "html-nested") {
                // Build HTML string like pure HTML test
                let html = ""
                for (let i = 0; i < count; i++) {
                    html += `<div><div><span>${i}</span><div><div></div><div></div><div></div></div></div></div>`
                }
                htmlContent = html
            } else if (type === "html-full") {
                // Build full structure HTML string
                let html = ""
                for (let i = 0; i < count; i++) {
                    html += `<div class="flex items-center p-2 border-b border-darkborderc"><span>Preset ${i + 1}</span><div class="flex-grow flex justify-end gap-2"><div class="cursor-pointer">${copySvg}</div><div class="cursor-pointer">${shareSvg}</div><div class="cursor-pointer">${trashSvg}</div></div></div>`
                }
                htmlContent = html
            } else if (type === "vanilla-nested" || type === "vanilla-full") {
                // Use vanilla JS innerHTML directly - bypass Svelte completely
                const container = document.getElementById("vanilla-container")
                if (container) {
                    let html = ""
                    for (let i = 0; i < count; i++) {
                        if (type === "vanilla-nested") {
                            html += `<div><div><span>${i}</span><div><div></div><div></div><div></div></div></div></div>`
                        } else {
                            html += `<div class="flex items-center p-2 border-b border-darkborderc"><span>Preset ${i + 1}</span><div class="flex-grow flex justify-end gap-2"><div class="cursor-pointer">${copySvg}</div><div class="cursor-pointer">${shareSvg}</div><div class="cursor-pointer">${trashSvg}</div></div></div>`
                        }
                    }
                    container.innerHTML = html
                }
            } else {
                items = Array.from({ length: count }, (_, i) => i)
            }
            testType = type

            requestAnimationFrame(() => {
                renderTime = performance.now() - start
            })
        })
    }

    function clear() {
        items = []
        testType = "none"
        renderTime = 0
    }
</script>

{#snippet nestedItem(i: number)}
    <div>
        <div>
            <span>{i}</span>
            <div>
                <div></div>
                <div></div>
                <div></div>
            </div>
        </div>
    </div>
{/snippet}

{#snippet fullItem(i: number)}
    <div class="flex items-center border-b border-darkborderc p-2">
        <span>Preset {i + 1}</span>
        <div class="flex flex-grow justify-end gap-2">
            <div class="cursor-pointer">{@html copySvg}</div>
            <div class="cursor-pointer">{@html shareSvg}</div>
            <div class="cursor-pointer">{@html trashSvg}</div>
        </div>
    </div>
{/snippet}

<div class="p-4 text-textcolor">
    <h1 class="mb-4 text-xl">Lucide Performance Test (Svelte 5)</h1>

    <div class="mb-4 flex flex-wrap gap-2">
        <input type="number" bind:value={count} class="w-20 rounded border border-borderc bg-darkbg p-2" />
        <button onclick={() => runTest("empty")} class="rounded bg-borderc p-2 hover:bg-selected">Empty Loop</button>
        <button onclick={() => runTest("minimal")} class="rounded bg-borderc p-2 hover:bg-selected"
            >Minimal (just div)</button
        >
        <button onclick={() => runTest("nested-divs")} class="rounded bg-borderc p-2 hover:bg-selected"
            >Nested divs (7)</button
        >
        <button onclick={() => runTest("depth-2")} class="rounded bg-borderc p-2 hover:bg-selected">Depth 2</button>
        <button onclick={() => runTest("depth-3")} class="rounded bg-borderc p-2 hover:bg-selected">Depth 3</button>
        <button onclick={() => runTest("depth-4")} class="rounded bg-borderc p-2 hover:bg-selected">Depth 4</button>
        <button onclick={() => runTest("siblings-3")} class="rounded bg-borderc p-2 hover:bg-selected"
            >Siblings 3</button
        >
        <button onclick={() => runTest("siblings-6")} class="rounded bg-borderc p-2 hover:bg-selected"
            >Siblings 6</button
        >
        <button onclick={() => runTest("nested-with-class")} class="rounded bg-borderc p-2 hover:bg-selected"
            >+ classes</button
        >
        <button onclick={() => runTest("nested-with-if")} class="rounded bg-borderc p-2 hover:bg-selected"
            >+ {"{#if}"}</button
        >
        <button onclick={() => runTest("text")} class="rounded bg-borderc p-2 hover:bg-selected">Full Text</button>
        <button onclick={() => runTest("svg")} class="rounded bg-borderc p-2 hover:bg-selected">Inline SVG</button>
        <button onclick={() => runTest("svg-nested")} class="rounded bg-borderc p-2 hover:bg-selected"
            >Inline SVG (nested)</button
        >
        <button onclick={() => runTest("lucide")} class="rounded bg-borderc p-2 hover:bg-selected">Lucide</button>
        <button onclick={() => runTest("lucide-nested")} class="rounded bg-borderc p-2 hover:bg-selected"
            >Lucide (nested)</button
        >
        <button onclick={() => runTest("snippet-nested")} class="rounded bg-green-700 p-2 hover:bg-green-600"
            >Snippet (nested)</button
        >
        <button onclick={() => runTest("snippet-full")} class="rounded bg-green-700 p-2 hover:bg-green-600"
            >Snippet (full)</button
        >
        <button onclick={() => runTest("raw-nested")} class="rounded bg-purple-700 p-2 hover:bg-purple-600"
            >$state.raw (nested)</button
        >
        <button onclick={() => runTest("keyed-nested")} class="rounded bg-purple-700 p-2 hover:bg-purple-600"
            >Keyed (nested)</button
        >
        <button onclick={() => runTest("html-nested")} class="rounded bg-yellow-600 p-2 text-black hover:bg-yellow-500"
            >{"{@html}"} (nested)</button
        >
        <button onclick={() => runTest("html-full")} class="rounded bg-yellow-600 p-2 text-black hover:bg-yellow-500"
            >{"{@html}"} (full)</button
        >
        <button onclick={() => runTest("vanilla-nested")} class="rounded bg-blue-600 p-2 hover:bg-blue-500"
            >Vanilla JS (nested)</button
        >
        <button onclick={() => runTest("vanilla-full")} class="rounded bg-blue-600 p-2 hover:bg-blue-500"
            >Vanilla JS (full)</button
        >
        <button onclick={() => clear()} class="rounded bg-red-600 p-2 hover:bg-red-500">Clear</button>
    </div>

    <div class="mb-4 rounded bg-darkbg p-2">
        {#if renderTime > 0}
            <strong>Render time: {renderTime.toFixed(2)}ms</strong> ({testType}, {count} items)
        {:else}
            Click a button to test
        {/if}
    </div>

    <div class="max-h-96 overflow-y-auto rounded border border-borderc" style="contain: content;">
        {#each items as i}
            {#if testType === "empty"}
                <!-- Empty loop body -->
            {:else if testType === "minimal"}
                <div>{i}</div>
            {:else if testType === "nested-divs"}
                <!-- 7 nested elements -->
                <div>
                    <div>
                        <span>{i}</span>
                        <div>
                            <div></div>
                            <div></div>
                            <div></div>
                        </div>
                    </div>
                </div>
            {:else if testType === "depth-2"}
                <div><span>{i}</span></div>
            {:else if testType === "depth-3"}
                <div><div><span>{i}</span></div></div>
            {:else if testType === "depth-4"}
                <div><div><div><span>{i}</span></div></div></div>
            {:else if testType === "siblings-3"}
                <div><span>{i}</span><span></span><span></span></div>
            {:else if testType === "siblings-6"}
                <div><span>{i}</span><span></span><span></span><span></span><span></span><span></span></div>
            {:else if testType === "nested-with-class"}
                <div class="flex items-center border-b border-darkborderc p-2">
                    <div>
                        <span>{i}</span>
                        <div class="flex flex-grow justify-end gap-2">
                            <div class="cursor-pointer"></div>
                            <div class="cursor-pointer"></div>
                            <div class="cursor-pointer"></div>
                        </div>
                    </div>
                </div>
            {:else if testType === "nested-with-if"}
                <div class="flex items-center border-b border-darkborderc p-2">
                    <span>Preset {i + 1}</span>
                    <div class="flex flex-grow justify-end gap-2">
                        {#if true}
                            <div class="cursor-pointer">C</div>
                            <div class="cursor-pointer">S</div>
                            <div class="cursor-pointer">T</div>
                        {/if}
                    </div>
                </div>
            {:else if testType === "snippet-nested"}
                {@render nestedItem(i)}
            {:else if testType === "snippet-full"}
                {@render fullItem(i)}
            {/if}
        {/each}

        <!-- $state.raw test -->
        {#each rawItems as i}
            {#if testType === "raw-nested"}
                <div>
                    <div>
                        <span>{i}</span>
                        <div>
                            <div></div>
                            <div></div>
                            <div></div>
                        </div>
                    </div>
                </div>
            {/if}
        {/each}

        <!-- Keyed test -->
        {#each keyedItems as item (item.id)}
            {#if testType === "keyed-nested"}
                <div>
                    <div>
                        <span>{item.id}</span>
                        <div>
                            <div></div>
                            <div></div>
                            <div></div>
                        </div>
                    </div>
                </div>
            {/if}
        {/each}

        <!-- {@html} test - bypass Svelte's DOM creation completely -->
        {#if testType === "html-nested" || testType === "html-full"}
            {@html htmlContent}
        {/if}

        <!-- Vanilla JS container - completely outside Svelte's control -->
        <div id="vanilla-container"></div>
    </div>
</div>
