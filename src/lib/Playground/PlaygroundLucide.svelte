<script lang="ts">
    import { CopyIcon, Share2Icon, TrashIcon } from "lucide-svelte";

    let testType = $state<'none' | 'empty' | 'minimal' | 'nested-divs' | 'depth-2' | 'depth-3' | 'depth-4' | 'siblings-3' | 'siblings-6' | 'nested-with-class' | 'nested-with-if' | 'lucide' | 'lucide-nested' | 'svg' | 'svg-nested' | 'text' | 'snippet-nested' | 'snippet-full' | 'raw-nested' | 'keyed-nested' | 'html-nested' | 'html-full' | 'vanilla-nested' | 'vanilla-full'>('none');
    let count = $state(400);
    let renderTime = $state(0);
    let items = $state<number[]>([]);
    let rawItems = $state.raw<number[]>([]);
    let keyedItems = $state<{id: number}[]>([]);
    let htmlContent = $state('');

    const copySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
    const shareSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/></svg>`;
    const trashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>`;

    function runTest(type: typeof testType) {
        items = [];
        rawItems = [];
        keyedItems = [];
        testType = 'none';

        // Use requestAnimationFrame to measure actual render time
        requestAnimationFrame(() => {
            const start = performance.now();

            if (type === 'raw-nested') {
                rawItems = Array.from({ length: count }, (_, i) => i);
            } else if (type === 'keyed-nested') {
                keyedItems = Array.from({ length: count }, (_, i) => ({ id: i }));
            } else if (type === 'html-nested') {
                // Build HTML string like pure HTML test
                let html = '';
                for (let i = 0; i < count; i++) {
                    html += `<div><div><span>${i}</span><div><div></div><div></div><div></div></div></div></div>`;
                }
                htmlContent = html;
            } else if (type === 'html-full') {
                // Build full structure HTML string
                let html = '';
                for (let i = 0; i < count; i++) {
                    html += `<div class="flex items-center p-2 border-b border-darkborderc"><span>Preset ${i + 1}</span><div class="flex-grow flex justify-end gap-2"><div class="cursor-pointer">${copySvg}</div><div class="cursor-pointer">${shareSvg}</div><div class="cursor-pointer">${trashSvg}</div></div></div>`;
                }
                htmlContent = html;
            } else if (type === 'vanilla-nested' || type === 'vanilla-full') {
                // Use vanilla JS innerHTML directly - bypass Svelte completely
                const container = document.getElementById('vanilla-container');
                if (container) {
                    let html = '';
                    for (let i = 0; i < count; i++) {
                        if (type === 'vanilla-nested') {
                            html += `<div><div><span>${i}</span><div><div></div><div></div><div></div></div></div></div>`;
                        } else {
                            html += `<div class="flex items-center p-2 border-b border-darkborderc"><span>Preset ${i + 1}</span><div class="flex-grow flex justify-end gap-2"><div class="cursor-pointer">${copySvg}</div><div class="cursor-pointer">${shareSvg}</div><div class="cursor-pointer">${trashSvg}</div></div></div>`;
                        }
                    }
                    container.innerHTML = html;
                }
            } else {
                items = Array.from({ length: count }, (_, i) => i);
            }
            testType = type;

            requestAnimationFrame(() => {
                renderTime = performance.now() - start;
            });
        });
    }

    function clear() {
        items = [];
        testType = 'none';
        renderTime = 0;
    }
</script>

{#snippet nestedItem(i: number)}
    <div><div><span>{i}</span><div><div></div><div></div><div></div></div></div></div>
{/snippet}

{#snippet fullItem(i: number)}
    <div class="flex items-center p-2 border-b border-darkborderc">
        <span>Preset {i + 1}</span>
        <div class="flex-grow flex justify-end gap-2">
            <div class="cursor-pointer">{@html copySvg}</div>
            <div class="cursor-pointer">{@html shareSvg}</div>
            <div class="cursor-pointer">{@html trashSvg}</div>
        </div>
    </div>
{/snippet}

<div class="p-4 text-textcolor">
    <h1 class="text-xl mb-4">Lucide Performance Test (Svelte 5)</h1>

    <div class="flex gap-2 mb-4 flex-wrap">
        <input type="number" bind:value={count} class="w-20 p-2 bg-darkbg border border-borderc rounded" />
        <button onclick={() => runTest('empty')} class="p-2 bg-borderc rounded hover:bg-selected">Empty Loop</button>
        <button onclick={() => runTest('minimal')} class="p-2 bg-borderc rounded hover:bg-selected">Minimal (just div)</button>
        <button onclick={() => runTest('nested-divs')} class="p-2 bg-borderc rounded hover:bg-selected">Nested divs (7)</button>
        <button onclick={() => runTest('depth-2')} class="p-2 bg-borderc rounded hover:bg-selected">Depth 2</button>
        <button onclick={() => runTest('depth-3')} class="p-2 bg-borderc rounded hover:bg-selected">Depth 3</button>
        <button onclick={() => runTest('depth-4')} class="p-2 bg-borderc rounded hover:bg-selected">Depth 4</button>
        <button onclick={() => runTest('siblings-3')} class="p-2 bg-borderc rounded hover:bg-selected">Siblings 3</button>
        <button onclick={() => runTest('siblings-6')} class="p-2 bg-borderc rounded hover:bg-selected">Siblings 6</button>
        <button onclick={() => runTest('nested-with-class')} class="p-2 bg-borderc rounded hover:bg-selected">+ classes</button>
        <button onclick={() => runTest('nested-with-if')} class="p-2 bg-borderc rounded hover:bg-selected">+ {'{#if}'}</button>
        <button onclick={() => runTest('text')} class="p-2 bg-borderc rounded hover:bg-selected">Full Text</button>
        <button onclick={() => runTest('svg')} class="p-2 bg-borderc rounded hover:bg-selected">Inline SVG</button>
        <button onclick={() => runTest('svg-nested')} class="p-2 bg-borderc rounded hover:bg-selected">Inline SVG (nested)</button>
        <button onclick={() => runTest('lucide')} class="p-2 bg-borderc rounded hover:bg-selected">Lucide</button>
        <button onclick={() => runTest('lucide-nested')} class="p-2 bg-borderc rounded hover:bg-selected">Lucide (nested)</button>
        <button onclick={() => runTest('snippet-nested')} class="p-2 bg-green-700 rounded hover:bg-green-600">Snippet (nested)</button>
        <button onclick={() => runTest('snippet-full')} class="p-2 bg-green-700 rounded hover:bg-green-600">Snippet (full)</button>
        <button onclick={() => runTest('raw-nested')} class="p-2 bg-purple-700 rounded hover:bg-purple-600">$state.raw (nested)</button>
        <button onclick={() => runTest('keyed-nested')} class="p-2 bg-purple-700 rounded hover:bg-purple-600">Keyed (nested)</button>
        <button onclick={() => runTest('html-nested')} class="p-2 bg-yellow-600 rounded hover:bg-yellow-500 text-black">{'{@html}'} (nested)</button>
        <button onclick={() => runTest('html-full')} class="p-2 bg-yellow-600 rounded hover:bg-yellow-500 text-black">{'{@html}'} (full)</button>
        <button onclick={() => runTest('vanilla-nested')} class="p-2 bg-blue-600 rounded hover:bg-blue-500">Vanilla JS (nested)</button>
        <button onclick={() => runTest('vanilla-full')} class="p-2 bg-blue-600 rounded hover:bg-blue-500">Vanilla JS (full)</button>
        <button onclick={() => clear()} class="p-2 bg-red-600 rounded hover:bg-red-500">Clear</button>
    </div>

    <div class="mb-4 p-2 bg-darkbg rounded">
        {#if renderTime > 0}
            <strong>Render time: {renderTime.toFixed(2)}ms</strong> ({testType}, {count} items)
        {:else}
            Click a button to test
        {/if}
    </div>

    <div class="max-h-96 overflow-y-auto border border-borderc rounded" style="contain: content;">
        {#each items as i}
            {#if testType === 'empty'}
                <!-- Empty loop body -->
            {:else if testType === 'minimal'}
                <div>{i}</div>
            {:else if testType === 'nested-divs'}
                <!-- 7 nested elements -->
                <div><div><span>{i}</span><div><div></div><div></div><div></div></div></div></div>
            {:else if testType === 'depth-2'}
                <div><span>{i}</span></div>
            {:else if testType === 'depth-3'}
                <div><div><span>{i}</span></div></div>
            {:else if testType === 'depth-4'}
                <div><div><div><span>{i}</span></div></div></div>
            {:else if testType === 'siblings-3'}
                <div><span>{i}</span><span></span><span></span></div>
            {:else if testType === 'siblings-6'}
                <div><span>{i}</span><span></span><span></span><span></span><span></span><span></span></div>
            {:else if testType === 'nested-with-class'}
                <div class="flex items-center p-2 border-b border-darkborderc"><div><span>{i}</span><div class="flex-grow flex justify-end gap-2"><div class="cursor-pointer"></div><div class="cursor-pointer"></div><div class="cursor-pointer"></div></div></div></div>
            {:else if testType === 'nested-with-if'}
                <div class="flex items-center p-2 border-b border-darkborderc">
                    <span>Preset {i + 1}</span>
                    <div class="flex-grow flex justify-end gap-2">
                        {#if true}
                            <div class="cursor-pointer">C</div>
                            <div class="cursor-pointer">S</div>
                            <div class="cursor-pointer">T</div>
                        {/if}
                    </div>
                </div>
            {:else}
                <div class="flex items-center p-2 border-b border-darkborderc">
                    <span>Preset {i + 1}</span>
                    <div class="flex-grow flex justify-end gap-2">
                        {#if testType === 'text'}
                            <span>C</span>
                            <span>S</span>
                            <span>T</span>
                        {:else if testType === 'svg'}
                            {@html copySvg}
                            {@html shareSvg}
                            {@html trashSvg}
                        {:else if testType === 'svg-nested'}
                            <div class="cursor-pointer">{@html copySvg}</div>
                            <div class="cursor-pointer">{@html shareSvg}</div>
                            <div class="cursor-pointer">{@html trashSvg}</div>
                        {:else if testType === 'lucide'}
                            <CopyIcon size={18} />
                            <Share2Icon size={18} />
                            <TrashIcon size={18} />
                        {:else if testType === 'lucide-nested'}
                            <div class="cursor-pointer"><CopyIcon size={18} /></div>
                            <div class="cursor-pointer"><Share2Icon size={18} /></div>
                            <div class="cursor-pointer"><TrashIcon size={18} /></div>
                        {/if}
                    </div>
                </div>
            {:else if testType === 'snippet-nested'}
                {@render nestedItem(i)}
            {:else if testType === 'snippet-full'}
                {@render fullItem(i)}
            {/if}
        {/each}

        <!-- $state.raw test -->
        {#each rawItems as i}
            {#if testType === 'raw-nested'}
                <div><div><span>{i}</span><div><div></div><div></div><div></div></div></div></div>
            {/if}
        {/each}

        <!-- Keyed test -->
        {#each keyedItems as item (item.id)}
            {#if testType === 'keyed-nested'}
                <div><div><span>{item.id}</span><div><div></div><div></div><div></div></div></div></div>
            {/if}
        {/each}

        <!-- {@html} test - bypass Svelte's DOM creation completely -->
        {#if testType === 'html-nested' || testType === 'html-full'}
            {@html htmlContent}
        {/if}

        <!-- Vanilla JS container - completely outside Svelte's control -->
        <div id="vanilla-container"></div>
    </div>
</div>
