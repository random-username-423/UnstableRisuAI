<script lang="ts">
    import { DynamicGUI, sideBarStore } from '../../ts/stores.svelte';
    import Sidebar from '../SideBars/Sidebar.svelte';
    import ChatScreen from './ChatScreen.svelte';
    import GridChars from '../Others/GridChars.svelte';

    let gridOpen = $state(false)
</script>

{#if gridOpen}
    <GridChars endGrid={() => {gridOpen = false}} />
{:else}
    {#if (!$DynamicGUI)}
        <Sidebar openGrid={() => {gridOpen = true}} hidden={!$sideBarStore} />
    {:else}
        <div class="top-0 w-full h-full left-0 z-30 flex flex-row items-center" class:fixed={$sideBarStore} class:hidden={!$sideBarStore} >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <Sidebar openGrid={() => {gridOpen = true}}  hidden={false} />
        </div>
    {/if}
    <ChatScreen />
{/if}
