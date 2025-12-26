<script lang="ts">
    import type { customscript } from "src/ts/data/storage/types"
    import RegexData from "./RegexData.svelte"
    import Sortable from "sortablejs"
    import { sleep, sortableOptions } from "src/ts/utils/util"
    import { onDestroy, onMount } from "svelte"
    import { DownloadIcon, HardDriveUploadIcon, PlusIcon } from "@lucide/svelte"
    import { exportRegex, importRegex } from "src/ts/process/scripting/scripts"
    interface Props {
        value?: customscript[]
        buttons?: boolean
    }

    let { value = $bindable([]), buttons = false }: Props = $props()
    let stb: Sortable = null
    let ele: HTMLDivElement = $state()
    let sorted = $state(0)
    let opened = 0
    const createStb = () => {
        stb = Sortable.create(ele, {
            onEnd: async () => {
                let idx: number[] = []
                ele.querySelectorAll("[data-risu-idx]").forEach((e, i) => {
                    idx.push(parseInt(e.getAttribute("data-risu-idx")))
                })
                let newValue: customscript[] = []
                idx.forEach((i) => {
                    newValue.push(value[i])
                })
                value = newValue
                try {
                    stb.destroy()
                } catch {
                    /* ignore */
                }
                sorted += 1
                await sleep(1)
                createStb()
            },
            ...sortableOptions,
        })
    }

    const onOpen = () => {
        opened += 1
        if (stb) {
            try {
                stb.destroy()
            } catch {
                /* ignore */
            }
        }
    }
    const onClose = () => {
        opened -= 1
        if (opened === 0) {
            createStb()
        }
    }

    onMount(createStb)

    onDestroy(() => {
        if (stb) {
            try {
                stb.destroy()
            } catch {
                /* ignore */
            }
        }
    })
</script>

{#key sorted}
    <div
        class="contain mt-2 flex w-full max-w-full flex-col rounded-md border-1 border-selected bg-darkbg p-3"
        bind:this={ele}
    >
        {#if value.length === 0}
            <div class="text-textcolor2">No Scripts</div>
        {/if}
        {#each value as customscript, i}
            <RegexData
                idx={i}
                bind:value={value[i]}
                {onOpen}
                {onClose}
                onRemove={() => {
                    let customscript = value
                    customscript.splice(i, 1)
                    value = customscript
                }}
            />
        {/each}
    </div>
{/key}
{#if buttons}
    <div class="mt-2 flex gap-2">
        <button
            class="rounded-md text-textcolor2 focus-within:text-textcolor hover:text-textcolor"
            onclick={() => {
                value.push({
                    comment: "",
                    in: "",
                    out: "",
                    type: "editinput",
                })
            }}
        >
            <PlusIcon />
        </button>
        <button
            class="rounded-md text-textcolor2 focus-within:text-textcolor hover:text-textcolor"
            onclick={() => {
                exportRegex(value)
            }}><DownloadIcon /></button
        >
        <button
            class="rounded-md text-textcolor2 focus-within:text-textcolor hover:text-textcolor"
            onclick={async () => {
                value = await importRegex(value)
            }}><HardDriveUploadIcon /></button
        >
    </div>
{/if}
