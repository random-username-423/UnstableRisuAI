<script lang="ts">
    import { language } from "src/lang"
    import { ChevronRightIcon } from "@lucide/svelte"
    import { DBState } from "src/ts/stores.svelte"
    import { alertClear } from "src/ts/alert.svelte"
    import Help from "../Help.svelte"
    import AlertContainer from "./AlertContainer.svelte"
</script>

<AlertContainer>
    <div class="w-2xl flex flex-col max-w-full">
        <h1 class="text-xl mb-4 font-bold">
            {language.chatOptions}
        </h1>
        <button
            class="border-darkborderc border py-2 px-8 flex rounded-md hover:ring-2 items-center mt-2"
            onclick={() => {
                alertClear("0")
            }}
        >
            <div class="flex flex-col justify-start items-start">
                <span>{language.createCopy}</span>
            </div>
            <div class="ml-9 float-right flex-1 flex justify-end">
                <ChevronRightIcon />
            </div>
        </button>
        <button
            class="border-darkborderc border py-2 px-8 flex rounded-md hover:ring-2 items-center mt-2"
            onclick={() => {
                alertClear("1")
            }}
        >
            <div class="flex flex-col justify-start items-start">
                <span>{language.bindPersona}</span>
            </div>
            <div class="ml-9 float-right flex-1 flex justify-end">
                <ChevronRightIcon />
            </div>
        </button>
        {#if DBState.db.useExperimental}
            <button
                class="border-darkborderc border py-2 px-8 flex rounded-md hover:ring-2 items-center mt-2"
                onclick={() => {
                    alertClear("2")
                }}
            >
                <div class="flex flex-col justify-start items-start">
                    <span>{language.createMultiuserRoom} <Help key="experimental" /></span>
                </div>
                <div class="ml-9 float-right flex-1 flex justify-end">
                    <ChevronRightIcon />
                </div>
            </button>
        {/if}
        <button
            class="border-darkborderc border py-2 px-8 flex rounded-md hover:ring-2 items-center mt-2"
            onclick={() => {
                alertClear("cancel")
            }}
        >
            <div class="flex flex-col justify-start items-start">
                <span>{language.cancel}</span>
            </div>
        </button>
    </div>
</AlertContainer>
