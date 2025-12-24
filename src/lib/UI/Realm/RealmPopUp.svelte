<script lang="ts">
    import { BookIcon, FlagIcon, ImageIcon, PaperclipIcon, SmileIcon, TrashIcon } from "lucide-svelte"
    import { language } from "src/lang"
    import { alertConfirm, alertInput, alertNormal } from "src/ts/utils/alert.svelte"
    import { hubURL, type hubType, downloadRisuHub, getRealmInfo } from "src/ts/character/characterCards.svelte"

    import { DBState } from "src/ts/stores.svelte"
    import RealmLicense from "./RealmLicense.svelte"
    import MultiLangDisplay from "../GUI/MultiLangDisplay.svelte"
    import { tooltip } from "src/ts/gui/tooltip"

    interface Props {
        openedData: hubType
    }

    let { openedData = $bindable() }: Props = $props()
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50 text-textcolor"
    role="button"
    tabindex="0"
    onclick={() => {
        openedData = null
    }}
>
    <div class="flex max-h-full w-2xl max-w-full flex-col gap-4 overflow-y-auto rounded-md bg-darkbg p-6">
        <div class="flex w-full flex-col">
            <h1 class="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-2xl font-bold">
                {openedData.name}
            </h1>
            {#if openedData.authorname}
                <span class="text-borderc">Made by {openedData.authorname}</span>
            {/if}
            {#if openedData.original}
                <button
                    class="text-start text-blue-400"
                    onclick={() => {
                        const original = openedData.original
                        openedData = null
                        getRealmInfo(original)
                    }}>Forked</button
                >
            {/if}
            <div class="mt-4 flex justify-start gap-4">
                <img
                    class="h-36 w-36 rounded-md object-cover object-top"
                    alt={openedData.name}
                    src={`${hubURL}/resource/` + openedData.img}
                />
                <MultiLangDisplay value={openedData.desc} markdown={true} />
            </div>
            <RealmLicense license={openedData.license} />

            <div class="mt-2 flex justify-start gap-2">
                {#each openedData.tags as tag, i}
                    <div class="p-1 text-xs text-blue-400">{tag}</div>
                {/each}
            </div>
            <div class="mt-2 flex w-full flex-row flex-wrap gap-1">
                <span class="text-textcolor2" use:tooltip={language.popularityLevelDesc}>
                    {language.popularityLevel.replace("{}", openedData.download.toString())}
                </span>

                <div class="ml-1 mr-1 border-l border-l-selected"></div>
                {#if openedData.hasEmotion}
                    <button
                        class="text-textcolor2 transition-colors hover:text-green-500"
                        onclick={(e) => {
                            alertNormal("This character includes emotion images")
                        }}><SmileIcon /></button
                    >
                {/if}
                {#if openedData.hasAsset}
                    <button
                        class="text-textcolor2 transition-colors hover:text-green-500"
                        onclick={(e) => {
                            alertNormal("This character includes additional Assets")
                        }}><ImageIcon /></button
                    >
                {/if}
                {#if openedData.hasLore}
                    <button
                        class="text-textcolor2 transition-colors hover:text-green-500"
                        onclick={(e) => {
                            alertNormal("This character includes lorebook")
                        }}><BookIcon /></button
                    >
                {/if}
            </div>
        </div>

        <div class="flex flex-row-reverse gap-2">
            <button
                class="text-textcolor2 hover:text-red-500"
                onclick={async (e) => {
                    e.stopPropagation()
                    const conf = await alertConfirm("Report this character?")
                    if (conf) {
                        const report = await alertInput(
                            "Write a report text that would be sent to the admin (for copywrite issues, use email)"
                        )
                        const da = await fetch(hubURL + "/hub/report", {
                            method: "POST",
                            body: JSON.stringify({
                                id: openedData.id,
                                report: report,
                            }),
                        })
                        alertNormal(await da.text())
                    }
                }}
            >
                <FlagIcon />
            </button>
            {#if (DBState.db.account?.token?.split("-") ?? [])[1] === openedData.creator}
                <button
                    class="text-textcolor2 hover:text-red-500"
                    onclick={async (e) => {
                        e.stopPropagation()
                        const conf = await alertConfirm("Do you want to remove this character from Realm?")
                        if (conf) {
                            const da = await fetch(hubURL + "/hub/remove", {
                                method: "POST",
                                body: JSON.stringify({
                                    id: openedData.id,
                                    token: DBState.db.account?.token,
                                }),
                            })
                            alertNormal(await da.text())
                        }
                    }}
                >
                    <TrashIcon />
                </button>
            {/if}
            <button
                class="text-textcolor2 hover:text-green-500"
                onclick={async (e) => {
                    e.stopPropagation()
                    await navigator.clipboard.writeText(`https://realm.risuai.net/character/${openedData.id}`)
                    alertNormal(language.clipboardSuccess)
                }}
            >
                <PaperclipIcon />
            </button>
            <button
                class="mr-2 flex-grow rounded-md bg-selected p-2 font-bold hover:ring"
                onclick={() => {
                    downloadRisuHub(openedData.id)
                    openedData = null
                }}
            >
                Chat
            </button>
        </div>
    </div>
</div>
