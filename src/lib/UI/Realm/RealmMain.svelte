<script lang="ts">
    import {
        downloadRisuHub,
        getRisuHub,
        hubAdditionalHTML,
        type hubType,
    } from "src/ts/character/characterCards.svelte"
    import { ArrowLeft, ArrowRight, MenuIcon, SearchIcon, XIcon } from "@lucide/svelte"
    import { alertInput } from "src/ts/utils/alert.svelte"
    import { language } from "src/lang"
    import RisuHubIcon from "./RealmHubIcon.svelte"
    import { MobileState } from "src/ts/stores.svelte"
    import RealmPopUp from "./RealmPopUp.svelte"

    let openedData: null | hubType = $state(null)

    let charas: hubType[] = $state([])

    let page = $state(0)
    let sort = $state("recommended")

    let search = $state("")
    let menuOpen = $state(false)
    let nsfw = $state(false)

    async function getHub() {
        charas = await getRisuHub({
            search: search,
            page: page,
            nsfw: nsfw,
            sort: sort,
        })
    }

    function changeSort(type: string) {
        if (sort === type) {
            sort = "recommended"
        } else {
            sort = type
        }
        page = 0
        return getHub()
    }

    getHub()
</script>

<div class="mb-2 mt-4 flex w-full justify-center">
    <div class="flex w-2xl max-w-full items-stretch">
        <input
            bind:value={search}
            class="input-text peer ml-4 min-w-0 max-w-full flex-grow resize-none overflow-x-hidden overflow-y-hidden rounded-md rounded-r-none border border-r-0 border-darkborderc bg-transparent p-2 text-xl text-textcolor outline-none transition-colors focus:border-textcolor"
        />
        <button
            onclick={() => {
                if (sort === "random" || sort === "recommended") {
                    sort = ""
                }
                page = 0
                getHub()
            }}
            class="flex items-center justify-center border-y border-darkborderc p-3 text-gray-100 transition-colors hover:bg-blue-500 peer-focus:border-textcolor"
        >
            <SearchIcon />
        </button>
        <button
            onclick={(e) => {
                menuOpen = true
            }}
            class="mr-2 flex items-center justify-center rounded-r-md border-y border-r border-darkborderc p-3 text-gray-100 transition-colors hover:bg-blue-500 peer-focus:border-textcolor"
        >
            <MenuIcon />
        </button>
    </div>
</div>
{#if MobileState.enabled}
    <div class="ml-4 flex items-start">
        <div class="mb-3 flex gap-2 overflow-x-auto rounded-lg border border-darkborderc p-2">
            <button
                onclick={() => {
                    nsfw = !nsfw
                    getHub()
                }}
            >
                {nsfw ? "NSFW" : "SFW"}
            </button>
            <div class="h-full border-r border-r-selected"></div>
            <button
                onclick={() => {
                    switch (sort) {
                        case "":
                            sort = "trending"
                            break
                        case "trending":
                            sort = "downloads"
                            break
                        case "downloads":
                            sort = "random"
                            break
                        default:
                            sort = ""
                            break
                    }
                    getHub()
                }}
            >
                {sort === "recommended"
                    ? language.recommended
                    : sort === ""
                      ? language.recent
                      : sort === "trending"
                        ? language.trending
                        : sort === "downloads"
                          ? language.downloads
                          : language.random}
            </button>
        </div>
    </div>
{:else}
    <div class="mb-3 flex w-full overflow-x-auto p-1 sm:justify-center">
        <button
            class="ml-2 flex items-center justify-center rounded-lg bg-darkbg p-2 transition-shadow hover:bg-selected"
            class:ring={nsfw}
            onclick={() => {
                nsfw = !nsfw
                getHub()
            }}
        >
            NSFW
        </button>
        <div class="ml-2 mr-2 h-full border-r border-r-selected"></div>
        <button
            class="ml-2 flex items-center justify-center rounded-lg bg-darkbg p-2 transition-shadow hover:bg-selected"
            class:ring={sort === ""}
            onclick={() => {
                changeSort("")
            }}
        >
            {language.recent}
        </button>
        <button
            class="ml-2 flex items-center justify-center rounded-lg bg-darkbg p-2 transition-shadow hover:bg-selected"
            class:ring={sort === "trending"}
            onclick={() => {
                changeSort("trending")
            }}
        >
            {language.trending}
        </button>
        <button
            class="ml-2 flex items-center justify-center rounded-lg bg-darkbg p-2 transition-shadow hover:bg-selected"
            class:ring={sort === "downloads"}
            onclick={() => {
                changeSort("downloads")
            }}
        >
            {language.downloads}
        </button>
        <button
            class="ml-2 flex min-w-0 max-w-full items-center justify-center rounded-lg bg-darkbg p-2 transition-shadow hover:bg-selected"
            class:ring={sort === "random"}
            onclick={() => {
                changeSort("random")
            }}
        >
            {language.random}
        </button>
    </div>
{/if}
{@html hubAdditionalHTML}
<div class="flex w-full flex-wrap justify-center gap-4 p-2">
    {#key charas}
        {#each charas as chara}
            <RisuHubIcon
                onClick={() => {
                    openedData = chara
                }}
                {chara}
            />
        {/each}
    {/key}
</div>
{#if sort !== "random" && sort !== "recommended"}
    <div class="flex w-full justify-center">
        <div class="flex">
            <button
                class="flex h-14 w-14 min-w-14 items-center justify-center rounded-lg bg-darkbg transition-shadow hover:ring"
                onclick={() => {
                    if (page > 0) {
                        page -= 1
                        getHub()
                    }
                }}
            >
                <ArrowLeft />
            </button>
            <button
                class="ml-2 flex h-14 w-14 min-w-14 items-center justify-center rounded-lg bg-darkbg transition-shadow"
            >
                <span>{page + 1}</span>
            </button>
            <button
                class="ml-2 flex h-14 w-14 min-w-14 items-center justify-center rounded-lg bg-darkbg transition-shadow hover:ring"
                onclick={() => {
                    page += 1
                    getHub()
                }}
            >
                <ArrowRight />
            </button>
        </div>
    </div>
{/if}

{#if openedData}
    <RealmPopUp bind:openedData />
{/if}

{#if menuOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50"
        role="button"
        tabindex="0"
        onclick={() => {
            menuOpen = false
        }}
    >
        <div class="flex max-w-full flex-col gap-4 overflow-y-auto rounded-md bg-darkbg p-4">
            <h1 class="w-full text-2xl font-bold">
                <span> Menu </span>
                <button
                    class="float-right text-textcolor2 hover:text-green-500"
                    onclick={() => {
                        menuOpen = false
                    }}
                >
                    <XIcon />
                </button>
            </h1>
            <div class=" mt-2 w-full border-t-2 border-t-bgcolor"></div>
            <button
                class="w-full p-4 hover:bg-selected"
                onclick={async (e) => {
                    e.stopPropagation()
                    menuOpen = false
                    const input = await alertInput("Input URL or ID")
                    if (input.startsWith("http")) {
                        const url = new URL(input)
                        const id =
                            url.searchParams.get("realm") ?? url.searchParams.get("code") ?? input.split("/").at(-1)
                        if (id) {
                            downloadRisuHub(id)
                            return
                        }
                    }
                    const id = input.split("?").at(-1)
                    downloadRisuHub(id)
                }}>Import Character from URL or ID</button
            >
        </div>
    </div>
{/if}
