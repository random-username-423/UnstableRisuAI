<script lang="ts">
    import { alertMd } from "src/ts/utils/alert.svelte"
    import { shareRealmCardData } from "src/ts/realm"
    import { downloadPreset } from "src/ts/data/storage/utils/presetManager"
    import { DBState, RealmState, ChatState } from "src/ts/stores.svelte"
    import { sleep } from "src/ts/utils/util"
    import { onDestroy, onMount } from "svelte"

    const close = () => {
        RealmState.frameContent = ""
    }
    let iframe: HTMLIFrameElement = $state(null)
    const tk = DBState.db?.account?.token
    const id = DBState.db?.account?.id
    let loadingStage = $state(0)
    let pongGot = false

    const pmfunc = (e: MessageEvent) => {
        if (e.data.type === "filedata" && e.data.success) {
            loadingStage = 2
        }
        if (e.data.type === "pong") {
            pongGot = true
        }
        if (e.data.type === "close") {
            close()
        }
        if (e.data.type === "success") {
            alertMd(
                `## Upload Success\n\nYour character has been uploaded to Realm successfully.\n\n${"```\nhttps://realm.risuai.net/character/" + e.data.id + "\n```"}`
            )
            if (RealmState.frameContent.startsWith("preset") || RealmState.frameContent.startsWith("module")) {
                //TODO, add preset edit
            } else if (DBState.db.characters[ChatState.selectedCharId].type === "character") {
                loadingStage = 0
                DBState.db.characters[ChatState.selectedCharId].realmId = e.data.id
            }
            close()
        }
    }

    const waitPing = async () => {
        if (iframe) {
            while (!pongGot) {
                iframe.contentWindow.postMessage(
                    {
                        type: "ping",
                    },
                    "*"
                )
                await sleep(300)
            }
        }
    }

    onMount(async () => {
        window.addEventListener("message", pmfunc)

        let data: {
            data: ArrayBuffer
            name: ArrayBuffer
        }

        if (RealmState.frameContent.startsWith("preset")) {
            const predata = await downloadPreset(Number(RealmState.frameContent.split(":")[1]), "return")
            const encodedPredata = predata.buf
            const encodedPredataName = new TextEncoder().encode(predata.data.name + ".risup")
            data = {
                data: encodedPredata.buffer as ArrayBuffer,
                name: encodedPredataName.buffer as ArrayBuffer,
            }
        } else if (RealmState.frameContent.startsWith("module")) {
            const predata = DBState.db.modules[Number(RealmState.frameContent.split(":")[1])]
            const encodedPredata = new TextEncoder().encode(JSON.stringify({ ...predata, type: "risuModule" }))
            const encodedPredataName = new TextEncoder().encode(predata.name + ".json")
            data = {
                data: encodedPredata.buffer as ArrayBuffer,
                name: encodedPredataName.buffer as ArrayBuffer,
            }
        } else {
            data = await shareRealmCardData()
        }

        if (iframe) {
            await waitPing()
            loadingStage = 1
            iframe.contentWindow.postMessage(
                {
                    type: "filedata",
                    buf: [data.data, data.name],
                },
                "*",
                [data.data, data.name]
            )
        }
    })

    const getUrl = () => {
        let url = tk ? `https://realm.risuai.net/upload?token=${tk}&token_id=${id}` : "https://realm.risuai.net/upload"
        if (RealmState.frameContent.startsWith("preset") || RealmState.frameContent.startsWith("module")) {
            //TODO, add preset edit
        } else if (
            DBState.db.characters[ChatState.selectedCharId].type === "character" &&
            DBState.db.characters[ChatState.selectedCharId].realmId
        ) {
            url += `&edit=${DBState.db.characters[ChatState.selectedCharId].realmId}&edit-type=normal`
        }
        url += "#noLayout"
        return url
    }

    onDestroy(() => {
        window.removeEventListener("message", pmfunc)
    })
</script>

<div class="fixed left-0 top-0 z-50 flex h-full w-full flex-col items-center justify-center bg-white text-textcolor">
    <div class="flex w-full border-b border-b-darkborderc bg-darkbg p-2">
        <h1 class="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-2xl font-bold">Upload to Realm</h1>
        <button class="ml-auto text-lg text-textcolor hover:text-red-500" onclick={close}>&times;</button>
    </div>
    {#if loadingStage < 1}
        <div class="flex w-full flex-1 items-center justify-center p-4">
            <div class="loadmove"></div>
        </div>
    {/if}
    <iframe bind:this={iframe} src={getUrl()} title="upload" class="w-full flex-1" class:hidden={loadingStage < 1}
    ></iframe>
</div>
