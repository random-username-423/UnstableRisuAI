<script lang="ts">
    // ============================================================
    // IMPORTS
    // ============================================================
    import { alertState } from "src/ts/stores.svelte"
    import ModuleChatMenu from "../Setting/Pages/Module/ModuleChatMenu.svelte"
    import Button from "../UI/GUI/Button.svelte"

    import AlertError from "./Alerts/AlertError.svelte"
    import AlertSimple from "./Alerts/AlertSimple.svelte"
    import AlertPluginConfirm from "./Alerts/AlertPluginConfirm.svelte"
    import AlertContainer from "./Alerts/AlertContainer.svelte"
    import AlertSelectChar from "./Alerts/AlertSelectChar.svelte"
    import AlertHypaV2 from "./Alerts/AlertHypaV2.svelte"
    import AlertAddChar from "./Alerts/AlertAddChar.svelte"
    import AlertChatOptions from "./Alerts/AlertChatOptions.svelte"
    import { alertClear } from "src/ts/alert.svelte"
</script>

<!-- ============================================================ -->
<!-- ALERT ROUTING -->
<!-- ============================================================ -->

<!-- Error Alert (with stack trace) -->
{#if alertState.type === "error"}
    <AlertError
        msg={alertState.msg}
        submsg={alertState.submsg}
        stackTrace={alertState.stackTrace}
        onClose={() => alertClear()}
    />

<!-- Simple Alerts (using AlertSimple component) -->
{:else if alertState.type === "normal"}
    <AlertSimple
        msg={alertState.msg}
        buttons="ok"
    />

{:else if alertState.type === "markdown"}
    <AlertSimple
        msg={alertState.msg}
        msgType="markdown"
        buttons="ok"
    />

{:else if alertState.type === "ask"}
    <AlertSimple
        title="Confirm"
        msg={alertState.msg}
        buttons="yesno"
    />

{:else if alertState.type === "input"}
    <AlertSimple
        title="Input"
        msg={alertState.msg}
        buttons={{ type: "input", inputDatalist: alertState.datalist }}
    />

{:else if alertState.type === "tos"}
    <AlertSimple
        msg="You should accept [Terms of Service](https://sv.risuai.xyz/hub/tos) to continue"
        msgType="markdown"
        buttons="accept"
    />

<!-- ============================================================ -->
<!-- Complex Alerts (using dedicated components) -->
<!-- ============================================================ -->
<!-- PLUGIN CONFIRM - Plugin confirmation dialog -->
{:else if alertState.type === "pluginconfirm"}
    <AlertPluginConfirm msg={alertState.msg} />

<!-- SELECT CHAR - Character selection dialog -->
{:else if alertState.type === "selectChar"}
    <AlertSelectChar />

<!-- HYPA V2 - HypaV2 data editor -->
{:else if alertState.type === "hypaV2"}
    <AlertHypaV2 />

<!-- ADD CHAR - Character addition menu -->
{:else if alertState.type === "addchar"}
    <AlertAddChar />

<!-- CHAT OPTIONS - Chat options menu -->
{:else if alertState.type === "chatOptions"}
    <AlertChatOptions />

<!-- WAIT - Simple waiting message -->
{:else if alertState.type === "wait"}
    <AlertContainer>
        <span class="text-gray-300 whitespace-pre-wrap">{alertState.msg}</span>
        {#if alertState.submsg}
            <span class="text-gray-500 text-sm">{alertState.submsg}</span>
        {/if}
    </AlertContainer>

<!-- WAIT2 - Waiting message with visible background -->
{:else if alertState.type === "wait2"}
    <AlertContainer variant="opaque">
        <span class="text-gray-300 whitespace-pre-wrap">{alertState.msg}</span>
        {#if alertState.submsg}
            <span class="text-gray-500 text-sm">{alertState.submsg}</span>
        {/if}
    </AlertContainer>

<!-- SELECT - Button selection dialog -->
{:else if alertState.type === "select"}
    <AlertContainer>
        {@const hasDisplay = alertState.msg.startsWith("__DISPLAY__")}
        {#if hasDisplay}
            {@const parts = alertState.msg.substring(11).split("||")}
            <div class="mb-4 text-textcolor">{parts[0]}</div>
            {#each parts.slice(1) as n, i}
                <Button
                    className="mt-4"
                    onclick={() => {
                        alertClear(i.toString())
                    }}>{n}</Button
                >
            {/each}
        {:else}
            {@const parts = alertState.msg.split("||")}
            {#each parts as n, i}
                <Button
                    className="mt-4"
                    onclick={() => {
                        alertClear(i.toString())
                    }}>{n}</Button
                >
            {/each}
        {/if}
    </AlertContainer>

<!-- PROGRESS - Progress bar display -->
{:else if alertState.type === "progress"}
    <AlertContainer>
        <span class="text-gray-300 whitespace-pre-wrap">{alertState.msg}</span>
        <div class="w-full min-w-64 md:min-w-138 h-2 bg-darkbg border border-darkborderc rounded-md mt-6">
            <div
                class="h-full bg-linear-to-r from-blue-500 to-purple-800 saving-animation transition-[width]"
                style:width={alertState.submsg + "%"}
            ></div>
        </div>
        <div class="w-full flex justify-center mt-6">
            <span class="text-gray-500 text-sm">{alertState.submsg + "%"}</span>
        </div>
    </AlertContainer>

<!-- SELECT MODULE - Uses external component -->
{:else if alertState.type === "selectModule"}
    <ModuleChatMenu
        alertMode
        close={(d) => {
            alertClear(d)
        }}
    />
{/if}
