<script lang="ts">
    import { DBState } from "src/ts/stores.svelte"
    import { getCharImage } from "src/ts/characters.svelte"
    import BarIcon from "src/lib/SideBars/BarIcon.svelte"
    import { User } from "@lucide/svelte"
    import { alertClear } from "src/ts/alert.svelte"
    import AlertContainer from "./AlertContainer.svelte"
    import { alertState } from "src/ts/stores.svelte"
</script>

<AlertContainer title="Select" titleColor="green">
    <span class="text-gray-300 whitespace-pre-wrap">{alertState.msg}</span>
    {#if alertState.submsg}
        <span class="text-gray-500 text-sm">{alertState.submsg}</span>
    {/if}

    <div class="flex w-full items-start flex-wrap gap-2 justify-start">
        {#each DBState.db.characters as char, i}
            {#if char.type !== "group"}
                {#if char.image}
                    {#await getCharImage(DBState.db.characters[i].image, "css")}
                        <BarIcon
                            onClick={() => {
                                alertClear(char.chaId)
                            }}
                        >
                            <User />
                        </BarIcon>
                    {:then im}
                        <BarIcon
                            onClick={() => {
                                alertClear(char.chaId)
                            }}
                            additionalStyle={im}
                        />
                    {/await}
                {:else}
                    <BarIcon
                        onClick={() => {
                            alertClear(char.chaId)
                        }}
                    >
                        <User />
                    </BarIcon>
                {/if}
            {/if}
        {/each}
    </div>
</AlertContainer>
