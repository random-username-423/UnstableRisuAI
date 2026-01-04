<script lang="ts">
    // ============================================================
    // IMPORTS
    // ============================================================
    import { alertStore } from "src/ts/stores.svelte"
    import ModuleChatMenu from "../Setting/Pages/Module/ModuleChatMenu.svelte"
    import Button from "../UI/GUI/Button.svelte"

    import AlertRequestLogs from "./Alerts/AlertRequestLogs.svelte"
    import AlertRequestData from "./Alerts/AlertRequestData.svelte"
    import AlertError from "./Alerts/AlertError.svelte"
    import AlertSimple from "./Alerts/AlertSimple.svelte"
    import AlertBranches from "./Alerts/AlertBranches.svelte"
    import AlertCardExport from "./Alerts/AlertCardExport.svelte"
    import AlertPluginConfirm from "./Alerts/AlertPluginConfirm.svelte"
    import AlertContainer from "./Alerts/AlertContainer.svelte"
    import AlertSelectChar from "./Alerts/AlertSelectChar.svelte"
    import AlertLogin from "./Alerts/AlertLogin.svelte"
    import AlertHypaV2 from "./Alerts/AlertHypaV2.svelte"
    import AlertAddChar from "./Alerts/AlertAddChar.svelte"
    import AlertChatOptions from "./Alerts/AlertChatOptions.svelte"
    import { alertClear } from "src/ts/alert"
</script>

<!-- ============================================================ -->
<!-- ALERT ROUTING -->
<!-- ============================================================ -->

<!-- Error Alert (with stack trace) -->
{#if $alertStore.type === "error"}
    <AlertError
        msg={$alertStore.msg}
        submsg={$alertStore.submsg}
        stackTrace={$alertStore.stackTrace}
        onClose={() => alertClear()}
    />

<!-- Simple Alerts (using AlertSimple component) -->
{:else if $alertStore.type === "normal"}
    <AlertSimple
        msg={$alertStore.msg}
        buttons="ok"
    />

{:else if $alertStore.type === "markdown"}
    <AlertSimple
        msg={$alertStore.msg}
        msgType="markdown"
        buttons="ok"
    />

{:else if $alertStore.type === "ask"}
    <AlertSimple
        title="Confirm"
        msg={$alertStore.msg}
        buttons="yesno"
    />

{:else if $alertStore.type === "input"}
    <AlertSimple
        title="Input"
        msg={$alertStore.msg}
        buttons={{ type: "input", inputDatalist: $alertStore.datalist }}
    />

{:else if $alertStore.type === "tos"}
    <AlertSimple
        msg="You should accept [Terms of Service](https://sv.risuai.xyz/hub/tos) to continue"
        msgType="markdown"
        buttons="accept"
    />

<!-- ============================================================ -->
<!-- Complex Alerts (using dedicated components) -->
<!-- ============================================================ -->
{:else if $alertStore.type === "pluginconfirm"}
    <AlertPluginConfirm msg={$alertStore.msg} />

{:else if $alertStore.type === "selectChar"}
    <AlertSelectChar />

{:else if $alertStore.type === "login"}
    <AlertLogin />

{:else if $alertStore.type === "requestdata"}
    <AlertRequestData />

{:else if $alertStore.type === "hypaV2"}
    <AlertHypaV2 />

{:else if $alertStore.type === "addchar"}
    <AlertAddChar />

{:else if $alertStore.type === "chatOptions"}
    <AlertChatOptions />

<!-- WAIT - Simple waiting message -->
{:else if $alertStore.type === "wait"}
    <AlertContainer>
        <span class="text-gray-300 whitespace-pre-wrap">{$alertStore.msg}</span>
        {#if $alertStore.submsg}
            <span class="text-gray-500 text-sm">{$alertStore.submsg}</span>
        {/if}
    </AlertContainer>

<!-- WAIT2 - Waiting message with visible background -->
{:else if $alertStore.type === "wait2"}
    <AlertContainer variant="opaque">
        <span class="text-gray-300 whitespace-pre-wrap">{$alertStore.msg}</span>
        {#if $alertStore.submsg}
            <span class="text-gray-500 text-sm">{$alertStore.submsg}</span>
        {/if}
    </AlertContainer>

<!-- SELECT - Button selection dialog -->
{:else if $alertStore.type === "select"}
    <AlertContainer>
        {@const hasDisplay = $alertStore.msg.startsWith("__DISPLAY__")}
        {#if hasDisplay}
            {@const parts = $alertStore.msg.substring(11).split("||")}
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
            {@const parts = $alertStore.msg.split("||")}
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
{:else if $alertStore.type === "progress"}
    <AlertContainer>
        <span class="text-gray-300 whitespace-pre-wrap">{$alertStore.msg}</span>
        <div class="w-full min-w-64 md:min-w-138 h-2 bg-darkbg border border-darkborderc rounded-md mt-6">
            <div
                class="h-full bg-linear-to-r from-blue-500 to-purple-800 saving-animation transition-[width]"
                style:width={$alertStore.submsg + "%"}
            ></div>
        </div>
        <div class="w-full flex justify-center mt-6">
            <span class="text-gray-500 text-sm">{$alertStore.submsg + "%"}</span>
        </div>
    </AlertContainer>

<!-- CARD EXPORT - Uses external component -->
{:else if $alertStore.type === "cardexport"}
    <AlertCardExport />

<!-- SELECT MODULE - Uses external component -->
{:else if $alertStore.type === "selectModule"}
    <ModuleChatMenu
        alertMode
        close={(d) => {
            alertClear(d)
        }}
    />

<!-- BRANCHES - Chat branch visualization -->
{:else if $alertStore.type === "branches"}
    <AlertBranches />

<!-- REQUEST LOGS - Uses external component -->
{:else if $alertStore.type === "requestlogs"}
    <AlertRequestLogs />
{/if}

