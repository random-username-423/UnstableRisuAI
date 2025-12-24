<script lang="ts">
    import { LayoutState } from "../../ts/stores.svelte"
    import Sidebar from "../SideBars/Sidebar.svelte"
    import ChatScreen from "./ChatScreen.svelte"
    import GridChars from "../Others/GridChars.svelte"

    let gridOpen = $state(false)
</script>

{#if gridOpen}
    <GridChars
        endGrid={() => {
            gridOpen = false
        }}
    />
{:else}
    {#if !LayoutState.isDynamicMode}
        <Sidebar
            openGrid={() => {
                gridOpen = true
            }}
            hidden={!LayoutState.sidebar.isOpen}
        />
    {:else}
        <div
            class="left-0 top-0 z-30 flex h-full w-full flex-row items-center"
            class:fixed={LayoutState.sidebar.isOpen}
            class:hidden={!LayoutState.sidebar.isOpen}
        >
            <Sidebar
                openGrid={() => {
                    gridOpen = true
                }}
                hidden={false}
            />
        </div>
    {/if}
    <ChatScreen />
{/if}
