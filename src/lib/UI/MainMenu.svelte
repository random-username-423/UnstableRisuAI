<script lang="ts">
    import { DBState, RealmState } from "src/ts/stores.svelte"
    import Hub from "./Realm/RealmMain.svelte"
    import { ArrowLeft } from "@lucide/svelte"
    import { getVersionString } from "src/ts/utils/env"
    import { openURL } from "src/ts/utils/util"
    import { language } from "src/lang"
    import { getRisuHub, hubAdditionalHTML } from "src/ts/character/characterCards.svelte"
    import RisuHubIcon from "./Realm/RealmHubIcon.svelte"
    import Title from "./Title.svelte"
</script>

<div class="flex h-full w-full flex-col items-center overflow-y-auto">
    {#if !RealmState.isOpen}
        <Title />
        <h3 class="mt-1 text-textcolor2">Version {getVersionString()}</h3>
    {/if}
    <div class="flex w-full max-w-4xl flex-col p-4 text-textcolor">
        {#if !RealmState.isOpen}
            <div class="mb-4 mt-4 w-full border-t border-t-selected"></div>
            <h1 class="text-2xl font-bold">
                Recently Uploaded<button
                    class="float-right rounded-md bg-darkbg p-1 text-base font-medium hover:ring"
                    onclick={() => {
                        RealmState.isOpen = true
                    }}>Get More</button
                >
            </h1>
            {#if !DBState.db.hideRealm}
                {#await getRisuHub({ search: "", page: 0, nsfw: false, sort: "recommended" }) then charas}
                    {#if charas.length > 0}
                        {@html hubAdditionalHTML}
                        <div class="flex w-full flex-wrap justify-center gap-4 p-2">
                            {#each charas as chara}
                                <RisuHubIcon
                                    onClick={() => {
                                        RealmState.isOpen = true
                                    }}
                                    {chara}
                                />
                            {/each}
                        </div>
                    {:else}
                        <div class="text-textcolor2">Failed to load {language.hub}...</div>
                    {/if}
                {/await}
            {:else}
                <div class="text-textcolor2">{language.hideRealm}</div>
            {/if}
            <div class="mb-4 mt-4 w-full border-t border-t-selected"></div>
            <h1 class="mb-4 text-2xl font-bold">Related Links</h1>
            <div class="flex w-full flex-wrap justify-center gap-4 p-2">
                <button
                    class="relative flex w-full flex-col items-start rounded-lg bg-darkbg p-4 text-start transition-colors hover:bg-selected lg:w-96"
                    onclick={() => {
                        openURL("https://discord.gg/Exy3NrqkGm")
                    }}
                >
                    <h2 class="text-xl">Discord</h2>
                    <span class="text-textcolor2">
                        Join our Discord server to chat with other users and the developer.
                    </span>
                </button>
                <button
                    class="relative flex w-full flex-col items-start rounded-lg bg-darkbg p-4 text-start transition-colors hover:bg-selected lg:w-96"
                    onclick={() => {
                        openURL("https://risuai.net")
                    }}
                >
                    <h2 class="text-xl">Website</h2>
                    <span class="text-textcolor2"> See the official website for the project. </span>
                </button>
                <button
                    class="relative flex w-full flex-col items-start rounded-lg bg-darkbg p-4 text-start transition-colors hover:bg-selected lg:w-96"
                    onclick={() => {
                        openURL("https://github.com/kwaroran/RisuAI")
                    }}
                >
                    <h2 class="text-xl">Github</h2>
                    <span class="text-textcolor2"> View the source code and contribute to the project. </span>
                </button>
                <button
                    class="relative flex w-full flex-col items-start rounded-lg bg-darkbg p-4 text-start transition-colors hover:bg-selected lg:w-96"
                    onclick={() => {
                        openURL("mailto:support@risuai.net")
                    }}
                >
                    <h2 class="text-xl">Email</h2>
                    <span class="text-textcolor2"> Contact the developer directly. </span>
                </button>
            </div>
        {:else}
            <div class="mt-4 flex items-center">
                <button class="mr-2 text-textcolor2 hover:text-green-500" onclick={() => (RealmState.isOpen = false)}>
                    <ArrowLeft />
                </button>
            </div>
            <Hub />
        {/if}
    </div>
</div>
