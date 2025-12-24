<script lang="ts">
    import { untrack } from "svelte"
    import { ChevronUpIcon, ChevronDownIcon } from "lucide-svelte"
    import { type SerializableSummary } from "src/ts/process/memory/hypav3Types"
    import { alertNormalWait } from "src/ts/utils/alert.svelte"
    import { DBState, ChatState } from "src/ts/stores.svelte"
    import { language } from "src/lang"
    import ModalHeader from "./HypaV3Modal/modal-header.svelte"
    import ModalSummaryItem from "./HypaV3Modal/modal-summary-item.svelte"
    import ModalFooter from "./HypaV3Modal/modal-footer.svelte"
    import type { SummaryItemState, ExpandedMessageState, SearchState, SearchResult } from "./HypaV3Modal/types"

    const hypaV3Data = $derived(
        DBState.db.characters[ChatState.selectedCharId].chats[DBState.db.characters[ChatState.selectedCharId].chatPage]
            .hypaV3Data
    )

    let summaryItemStateMap = new WeakMap<SerializableSummary, SummaryItemState>()
    let expandedMessageState = $state<ExpandedMessageState>(null)
    let searchState = $state<SearchState>(null)
    let filterImportant = $state(false)
    let dropdownOpen = $state(false)
    let filterSelected = $state(false)

    $effect.pre(() => {
        hypaV3Data?.summaries?.length
        filterImportant
        filterSelected

        untrack(() => {
            DBState.db.characters[ChatState.selectedCharId].chats[
                DBState.db.characters[ChatState.selectedCharId].chatPage
            ].hypaV3Data ??= {
                summaries: [],
            }

            expandedMessageState = null
            searchState = null
        })
    })

    function onSearch(e: KeyboardEvent) {
        if (!searchState) return

        if (e.key === "Escape") {
            searchState = null
            return
        }

        if (e.key === "Enter") {
            e.preventDefault?.() // Prevent event default action

            const query = searchState.query.trim()

            if (!query) return

            // When received a new query
            if (searchState.currentResultIndex === -1) {
                const results = generateSearchResults(query)

                if (results.length === 0) return

                searchState.results = results
            }

            const nextResult = getNextSearchResult(e.shiftKey)

            if (nextResult) {
                navigateToSearchResult(nextResult)
            }
        }
    }

    function generateSearchResults(query: string): SearchResult[] {
        const results: SearchResult[] = []
        const normalizedQuery = query.trim().toLowerCase()

        // Search summary index
        if (query.match(/^#\d+$/)) {
            const summaryIndex = parseInt(query.substring(1)) - 1

            if (summaryIndex >= 0 && summaryIndex < hypaV3Data.summaries.length && isSummaryVisible(summaryIndex)) {
                results.push({ type: "summary", summaryIndex, start: 0, end: 0 })
            }

            return results
        }

        if (isGuidLike(query)) {
            // Search chatMemo
            hypaV3Data.summaries.forEach((summary, summaryIndex) => {
                if (!isSummaryVisible(summaryIndex)) return

                const summaryItemState = summaryItemStateMap.get(summary)

                summaryItemState.chatMemoRefs.forEach((buttonRef, memoIndex) => {
                    const buttonText = buttonRef.textContent?.toLowerCase() || ""

                    if (buttonText.includes(normalizedQuery)) {
                        results.push({ type: "chatmemo", summaryIndex, memoIndex })
                    }
                })
            })
        } else {
            // Search summary
            hypaV3Data.summaries.forEach((summary, summaryIndex) => {
                if (!isSummaryVisible(summaryIndex)) return

                const summaryItemState = summaryItemStateMap.get(summary)
                const textAreaText = summaryItemState.originalRef.value?.toLowerCase()
                let pos = -1

                while ((pos = textAreaText.indexOf(normalizedQuery, pos + 1)) !== -1) {
                    results.push({
                        type: "summary",
                        summaryIndex,
                        start: pos,
                        end: pos + normalizedQuery.length,
                    })
                }
            })
        }

        return results
    }

    function isGuidLike(str: string): boolean {
        const strTrimed = str.trim()

        // Exclude too short inputs
        if (strTrimed.length < 4) return false

        return /^[0-9a-f]{4,12}(-[0-9a-f]{4,12}){0,4}-?$/i.test(strTrimed)
    }

    function getNextSearchResult(backward: boolean): SearchResult | null {
        if (!searchState || searchState.results.length === 0) return null

        let nextIndex: number

        if (searchState.requestedSearchFromIndex !== -1) {
            const fromSummaryIndex = searchState.requestedSearchFromIndex

            nextIndex = backward
                ? searchState.results.findLastIndex((r) => r.summaryIndex <= fromSummaryIndex)
                : searchState.results.findIndex((r) => r.summaryIndex >= fromSummaryIndex)

            if (nextIndex === -1) {
                nextIndex = backward ? searchState.results.length - 1 : 0
            }

            searchState.requestedSearchFromIndex = -1
        } else {
            const delta = backward ? -1 : 1

            nextIndex =
                (searchState.currentResultIndex + delta + searchState.results.length) % searchState.results.length
        }

        searchState.currentResultIndex = nextIndex
        return searchState.results[nextIndex]
    }

    function navigateToSearchResult(result: SearchResult) {
        searchState.isNavigating = true

        if (result.type === "summary") {
            const summary = hypaV3Data.summaries[result.summaryIndex]
            const summaryItemState = summaryItemStateMap.get(summary)
            const textarea = summaryItemState.originalRef

            // Scroll to element
            textarea.scrollIntoView({
                behavior: "instant",
                block: "center",
            })

            if (result.start === result.end) {
                searchState.isNavigating = false
                return
            }

            // Scroll to query
            textarea.setSelectionRange(result.start, result.end)
            scrollToSelection(textarea)

            // Highlight query on desktop environment
            if (!("ontouchend" in window)) {
                // Make readonly temporarily
                textarea.readOnly = true
                textarea.focus()
                window.setTimeout(() => {
                    searchState.ref.focus() // Restore focus to search bar
                    textarea.readOnly = false // Remove readonly after focus moved
                }, 300)
            }
        } else {
            const summary = hypaV3Data.summaries[result.summaryIndex]
            const summaryItemState = summaryItemStateMap.get(summary)
            const button = summaryItemState.chatMemoRefs[result.memoIndex]

            // Scroll to element
            button.scrollIntoView({
                behavior: "instant",
                block: "center",
            })

            // Highlight chatMemo
            button.classList.add("ring-2", "ring-zinc-500")

            // Remove highlight after a short delay
            window.setTimeout(() => {
                button.classList.remove("ring-2", "ring-zinc-500")
            }, 1000)
        }

        searchState.isNavigating = false
    }

    function scrollToSelection(textarea: HTMLTextAreaElement) {
        const { selectionStart, selectionEnd } = textarea

        if (selectionStart === null || selectionEnd === null || selectionStart === selectionEnd) {
            return // Exit if there is no selected text
        }

        // Calculate the text before the selected position based on the textarea's text
        const textBeforeSelection = textarea.value.substring(0, selectionStart)

        // Use a temporary DOM element to calculate the exact position of the selected text
        const tempDiv = document.createElement("div")
        tempDiv.style.position = "absolute"
        tempDiv.style.whiteSpace = "pre-wrap"
        tempDiv.style.overflowWrap = "break-word"
        tempDiv.style.font = window.getComputedStyle(textarea).font
        tempDiv.style.width = `${textarea.offsetWidth}px`
        tempDiv.style.visibility = "hidden" // Set it to be invisible

        tempDiv.textContent = textBeforeSelection
        document.body.appendChild(tempDiv)

        // Calculate the position of the selected text within the textarea
        const selectionTop = tempDiv.offsetHeight
        document.body.removeChild(tempDiv)

        // Adjust the scroll so that the selected text is centered on the screen
        textarea.scrollTop = selectionTop - textarea.clientHeight / 2
    }

    function isSummaryVisible(index: number): boolean {
        const summary = hypaV3Data.summaries[index]
        const metrics = hypaV3Data.metrics

        const selectedFilter =
            !filterSelected ||
            !metrics ||
            metrics.lastImportantSummaries.includes(index) ||
            metrics.lastRecentSummaries.includes(index) ||
            metrics.lastSimilarSummaries.includes(index) ||
            metrics.lastRandomSummaries.includes(index)

        const importantFilter = !filterImportant || summary.isImportant

        return selectedFilter && importantFilter
    }

    function isHypaV2ConversionPossible(): boolean {
        const char = DBState.db.characters[ChatState.selectedCharId]
        const chat = char.chats[DBState.db.characters[ChatState.selectedCharId].chatPage]

        return chat.hypaV3Data?.summaries?.length === 0 && chat.hypaV2Data != null
    }

    function convertHypaV2ToV3(): { success: boolean; error?: string } {
        try {
            const char = DBState.db.characters[ChatState.selectedCharId]
            const chat = char.chats[DBState.db.characters[ChatState.selectedCharId].chatPage]
            const hypaV2Data = chat.hypaV2Data

            if (chat.hypaV3Data?.summaries?.length > 0) {
                return {
                    success: false,
                    error: "HypaV3 data already exists.",
                }
            }

            if (!hypaV2Data) {
                return {
                    success: false,
                    error: "HypaV2 data not found.",
                }
            }

            if (hypaV2Data.mainChunks.length === 0) {
                return {
                    success: false,
                    error: "No main chunks found.",
                }
            }

            for (let i = 0; i < hypaV2Data.mainChunks.length; i++) {
                const mainChunk = hypaV2Data.mainChunks[i]

                if (!Array.isArray(mainChunk.chatMemos)) {
                    return {
                        success: false,
                        error: `Chunk ${i}'s chatMemos is not an array.`,
                    }
                }

                if (mainChunk.chatMemos.length === 0) {
                    return {
                        success: false,
                        error: `Chunk ${i}'s chatMemos is empty.`,
                    }
                }
            }

            const newHypaV3Data = {
                summaries: hypaV2Data.mainChunks.map((mainChunk) => ({
                    text: mainChunk.text,
                    chatMemos: [...mainChunk.chatMemos],
                    isImportant: false,
                })),
            }

            chat.hypaV3Data = newHypaV3Data

            return {
                success: true,
            }
        } catch (error) {
            return {
                success: false,
                error: `Error occurred: ${error.message}`,
            }
        }
    }
</script>

<!-- Modal Backdrop -->
<div class="fixed inset-0 z-40 bg-black/50 p-1 sm:p-2">
    <!-- Modal Wrapper -->
    <div class="flex h-full w-full justify-center">
        <!-- Modal Window -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="flex w-full max-w-3xl flex-col rounded-lg bg-zinc-900 p-3 sm:p-6 {hypaV3Data.summaries.length === 0
                ? 'h-fit'
                : 'h-full'}"
            onclick={(e) => {
                e.stopPropagation()
                dropdownOpen = false
            }}
        >
            <!-- Header -->
            <ModalHeader bind:searchState bind:filterImportant bind:dropdownOpen bind:filterSelected />

            <!-- Scrollable Container -->
            <div class="flex flex-col gap-2 overflow-y-auto sm:gap-4" tabindex="-1">
                {#if hypaV3Data.summaries.length === 0}
                    <!-- Conversion Section -->
                    {#if isHypaV2ConversionPossible()}
                        <div class="flex flex-col rounded-lg border border-zinc-700 bg-zinc-800/50 p-2 sm:p-4">
                            <div class="flex flex-col items-center">
                                <div class="my-1 text-center text-zinc-300 sm:my-2">
                                    {language.hypaV3Modal.convertLabel}
                                </div>
                                <button
                                    class="my-1 rounded-md bg-zinc-700 px-4 py-2 font-semibold text-zinc-300 transition-colors hover:bg-zinc-500 sm:my-2"
                                    tabindex="-1"
                                    onclick={async () => {
                                        const conversionResult = convertHypaV2ToV3()

                                        if (conversionResult.success) {
                                            await alertNormalWait(language.hypaV3Modal.convertSuccessMessage)
                                        } else {
                                            await alertNormalWait(
                                                language.hypaV3Modal.convertErrorMessage.replace(
                                                    "{0}",
                                                    conversionResult.error
                                                )
                                            )
                                        }
                                    }}
                                >
                                    {language.hypaV3Modal.convertButton}
                                </button>
                            </div>
                        </div>
                    {:else}
                        <div class="p-4 text-center text-zinc-400 sm:p-3 md:p-4">
                            {language.hypaV3Modal.noSummariesLabel}
                        </div>
                    {/if}

                    <!-- Search Bar -->
                {:else if searchState}
                    <div class="sticky top-0 bg-zinc-800 p-2 sm:p-3">
                        <div class="flex items-center gap-2">
                            <div class="relative flex flex-1 items-center">
                                <form
                                    class="w-full"
                                    onsubmit={(e) => {
                                        e.preventDefault()
                                        onSearch({ key: "Enter" } as KeyboardEvent)
                                    }}
                                >
                                    <input
                                        class="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500 sm:px-4 sm:py-3"
                                        placeholder={language.hypaV3Modal.searchPlaceholder}
                                        bind:this={searchState.ref}
                                        bind:value={searchState.query}
                                        oninput={() => {
                                            if (searchState) {
                                                searchState.results = []
                                                searchState.currentResultIndex = -1
                                            }
                                        }}
                                        onkeydown={(e) => onSearch(e)}
                                    />
                                </form>

                                {#if searchState.results.length > 0}
                                    <span
                                        class="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-zinc-700/65 px-1.5 py-1 text-sm font-semibold text-zinc-100 sm:px-3 sm:py-2"
                                    >
                                        {searchState.currentResultIndex + 1}/{searchState.results.length}
                                    </span>
                                {/if}
                            </div>

                            <!-- Previous Button -->
                            <button
                                class="p-2 text-zinc-400 transition-colors hover:text-zinc-200"
                                tabindex="-1"
                                onclick={() => {
                                    onSearch({ shiftKey: true, key: "Enter" } as KeyboardEvent)
                                }}
                            >
                                <ChevronUpIcon class="h-6 w-6" />
                            </button>

                            <!-- Next Button -->
                            <button
                                class="p-2 text-zinc-400 transition-colors hover:text-zinc-200"
                                tabindex="-1"
                                onclick={() => {
                                    onSearch({ key: "Enter" } as KeyboardEvent)
                                }}
                            >
                                <ChevronDownIcon class="h-6 w-6" />
                            </button>
                        </div>
                    </div>
                {/if}

                <!-- Summaries List -->
                {#each hypaV3Data.summaries as summary, i (summary)}
                    {#if isSummaryVisible(i)}
                        <!-- Summary Item  -->
                        <ModalSummaryItem
                            summaryIndex={i}
                            {hypaV3Data}
                            {summaryItemStateMap}
                            bind:expandedMessageState
                            bind:searchState
                            {filterSelected}
                        />
                    {/if}
                {/each}

                <!-- Footer -->
                <ModalFooter {hypaV3Data} />
            </div>
        </div>
    </div>
</div>
