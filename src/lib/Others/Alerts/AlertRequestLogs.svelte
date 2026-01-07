<script lang="ts">
    import { CheckIcon, ChevronDownIcon, ChevronUpIcon, CopyIcon, XIcon } from '@lucide/svelte'
    import hljs from 'highlight.js/lib/core';
    import json from 'highlight.js/lib/languages/json';
    import { language } from 'src/lang'
    import Button from "src/lib/UI/GUI/Button.svelte"
    import { alertClear } from 'src/ts/alert.svelte'
    import { getFetchLogs } from "src/ts/fetch"

    let expandedLogs: Set<number> = $state(new Set())
    let allExpanded = $state(false)

    let logs = getFetchLogs()

    let copiedKey: string | null = $state(null)

    // Register JSON language for syntax highlighting
    if (!hljs.getLanguage('json')) {
        hljs.registerLanguage('json', json)
    }

    function highlightJson(code: string): string {
        try {
            return hljs.highlight(code, { language: 'json' }).value
        } catch {
            return code.replace(/</g, '&lt;').replace(/>/g, '&gt;')
        }
    }

    async function copyToClipboard(text: string, key: string) {
        try {
            await navigator.clipboard.writeText(text)
        } catch {
            // fallback
            const textarea = document.createElement("textarea")
            textarea.value = text
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand("copy")
            document.body.removeChild(textarea)
        }
        copiedKey = key
        setTimeout(() => {
            if (copiedKey === key) copiedKey = null
        }, 1500)
    }
</script>

<div class="fixed inset-0 z-50 bg-black/80 flex justify-center items-start overflow-y-auto p-4">
    <div class="bg-darkbg rounded-lg w-full max-w-4xl my-4 flex flex-col max-h-[90vh]">
        <div class="flex items-center justify-between p-4 border-b border-darkborderc sticky top-0 bg-darkbg z-10">
            <h1 class="text-xl font-bold text-textcolor">{language.ShowLog}</h1>
            <div class="flex items-center gap-2">
                <Button
                    size="sm"
                    onclick={() => {
                        if (allExpanded) {
                            expandedLogs = new Set()
                        } else {
                            expandedLogs = new Set(logs.map((_, i) => i))
                        }
                        allExpanded = !allExpanded
                    }}
                >
                    {allExpanded ? language.collapseAll : language.expandAll}
                </Button>
                <button
                    class="text-textcolor2 hover:text-textcolor p-1"
                    onclick={() => alertClear()}
                >
                    <XIcon />
                </button>
            </div>
        </div>
        <div class="flex-1 overflow-y-auto p-4">
            {#if logs.length === 0}
                <div class="text-textcolor2 text-center py-8">{language.noRequestLogs}</div>
            {:else}
                <div class="flex flex-col gap-2">
                    {#each logs as log, i}
                        {@const isExpanded = expandedLogs.has(i)}
                        <div class="border border-darkborderc rounded-lg overflow-hidden">
                            <button
                                class="w-full flex items-center justify-between p-3 hover:bg-bgcolor/50 transition-colors"
                                onclick={() => {
                                    const newSet = new Set(expandedLogs)
                                    if (isExpanded) {
                                        newSet.delete(i)
                                    } else {
                                        newSet.add(i)
                                    }
                                    expandedLogs = newSet
                                }}
                            >
                                <div class="flex items-center gap-3 min-w-0 flex-1">
                                    <span
                                        class="px-2 py-1 rounded text-xs font-bold font-mono {log.success
                                            ? 'bg-green-600 text-white'
                                            : 'bg-red-600 text-white'}"
                                    >
                                        {log.status ?? (log.success ? "OK" : "ERR")}
                                    </span>
                                    <span class="text-textcolor text-sm truncate flex-1 text-left font-mono" title={log.url}>
                                        {log.url}
                                    </span>
                                    <span class="text-textcolor text-xs whitespace-nowrap opacity-70">{log.date}</span>
                                </div>
                                <div class="ml-2 text-textcolor">
                                    {#if isExpanded}
                                        <ChevronUpIcon size={20} />
                                    {:else}
                                        <ChevronDownIcon size={20} />
                                    {/if}
                                </div>
                            </button>
                            {#if isExpanded}
                                <div class="border-t border-darkborderc p-4 bg-bgcolor/30">
                                    <div class="space-y-4">
                                        <div>
                                            <div class="flex items-center justify-between mb-2">
                                                <span class="text-textcolor text-sm font-semibold">URL</span>
                                                <button
                                                    class="p-1 rounded hover:bg-bgcolor transition-colors {copiedKey === `${i}-url`
                                                        ? 'text-green-500'
                                                        : 'text-textcolor2 hover:text-textcolor'}"
                                                    onclick={(e) => {
                                                        e.stopPropagation()
                                                        copyToClipboard(log.url, `${i}-url`)
                                                    }}
                                                    title="Copy"
                                                >
                                                    {#if copiedKey === `${i}-url`}
                                                        <CheckIcon size={14} />
                                                    {:else}
                                                        <CopyIcon size={14} />
                                                    {/if}
                                                </button>
                                            </div>
                                            <pre class="request-log-code hljs text-sm">{log.url}</pre>
                                        </div>
                                        <div>
                                            <div class="flex items-center justify-between mb-2">
                                                <span class="text-textcolor text-sm font-semibold">Request Body</span>
                                                <button
                                                    class="p-1 rounded hover:bg-bgcolor transition-colors {copiedKey === `${i}-body`
                                                        ? 'text-green-500'
                                                        : 'text-textcolor2 hover:text-textcolor'}"
                                                    onclick={(e) => {
                                                        e.stopPropagation()
                                                        copyToClipboard(log.body, `${i}-body`)
                                                    }}
                                                    title="Copy"
                                                >
                                                    {#if copiedKey === `${i}-body`}
                                                        <CheckIcon size={14} />
                                                    {:else}
                                                        <CopyIcon size={14} />
                                                    {/if}
                                                </button>
                                            </div>
                                            <pre class="request-log-code hljs">{@html highlightJson(log.body)}</pre>
                                        </div>
                                        <div>
                                            <div class="flex items-center justify-between mb-2">
                                                <span class="text-textcolor text-sm font-semibold">Request Header</span>
                                                <button
                                                    class="p-1 rounded hover:bg-bgcolor transition-colors {copiedKey === `${i}-header`
                                                        ? 'text-green-500'
                                                        : 'text-textcolor2 hover:text-textcolor'}"
                                                    onclick={(e) => {
                                                        e.stopPropagation()
                                                        copyToClipboard(log.header, `${i}-header`)
                                                    }}
                                                    title="Copy"
                                                >
                                                    {#if copiedKey === `${i}-header`}
                                                        <CheckIcon size={14} />
                                                    {:else}
                                                        <CopyIcon size={14} />
                                                    {/if}
                                                </button>
                                            </div>
                                            <pre class="request-log-code hljs max-h-32">{@html highlightJson(log.header)}</pre>
                                        </div>
                                        <div>
                                            <div class="flex items-center justify-between mb-2">
                                                <span class="text-textcolor text-sm font-semibold">Response</span>
                                                <button
                                                    class="p-1 rounded hover:bg-bgcolor transition-colors {copiedKey === `${i}-response`
                                                        ? 'text-green-500'
                                                        : 'text-textcolor2 hover:text-textcolor'}"
                                                    onclick={(e) => {
                                                        e.stopPropagation()
                                                        copyToClipboard(log.response, `${i}-response`)
                                                    }}
                                                    title="Copy"
                                                >
                                                    {#if copiedKey === `${i}-response`}
                                                        <CheckIcon size={14} />
                                                    {:else}
                                                        <CopyIcon size={14} />
                                                    {/if}
                                                </button>
                                            </div>
                                            <pre class="request-log-code hljs max-h-64">{@html highlightJson(log.response)}</pre>
                                        </div>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .request-log-code {
        background-color: #1a1a2e;
        color: #e0e0e0;
        border: 1px solid var(--risu-theme-darkborderc);
        border-radius: 0.375rem;
        padding: 0.75rem;
        font-family: "Consolas", "Monaco", "Courier New", monospace;
        font-size: 0.75rem;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-all;
        max-height: 12rem;
        overflow: auto;
    }
</style>
