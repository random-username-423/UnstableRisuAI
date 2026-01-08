<script lang="ts">
    import { language } from "src/lang"
    import { ChevronRightIcon } from "@lucide/svelte"
    import { alertClear } from "src/ts/alert.svelte"
    import AlertContainer from "./AlertContainer.svelte"
</script>

<AlertContainer>
    <div class="w-2xl flex flex-col max-w-full">
        <button
            class="border-darkborderc border py-12 px-8 flex rounded-md hover:ring-2 justify-center items-center"
            onclick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                alertClear("importFromRealm")
            }}
        >
            <div class="flex flex-col justify-start items-start">
                <span class="text-2xl font-bold">{language.importFromRealm}</span>
                <span class="text-textcolor2">{language.importFromRealmDesc}</span>
            </div>
            <div class="ml-9 float-right flex-1 flex justify-end">
                <ChevronRightIcon />
            </div>
        </button>
        <button
            class="border-darkborderc border py-2 px-8 flex rounded-md hover:ring-2 items-center mt-2"
            onclick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                alertClear("importCharacter")
            }}
        >
            <div class="flex flex-col justify-start items-start">
                <span>{language.importCharacter}</span>
            </div>
            <div class="ml-9 float-right flex-1 flex justify-end">
                <ChevronRightIcon />
            </div>
        </button>
        <button
            class="border-darkborderc border py-2 px-8 flex rounded-md hover:ring-2 items-center mt-2"
            onclick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                alertClear("createfromScratch")
            }}
        >
            <div class="flex flex-col justify-start items-start">
                <span>{language.createfromScratch}</span>
            </div>
            <div class="ml-9 float-right flex-1 flex justify-end">
                <ChevronRightIcon />
            </div>
        </button>
        <button
            class="border-darkborderc border py-2 px-8 flex rounded-md hover:ring-2 items-center mt-2"
            onclick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                alertClear("createGroup")
            }}
        >
            <div class="flex flex-col justify-start items-start">
                <span>{language.createGroup}</span>
            </div>
            <div class="ml-9 float-right flex-1 flex justify-end">
                <ChevronRightIcon />
            </div>
        </button>
        <button
            class="border-darkborderc border py-2 px-8 flex rounded-md hover:ring-2 items-center mt-2"
            onclick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                alertClear("cancel")
            }}
        >
            <div class="flex flex-col justify-start items-start">
                <span>{language.cancel}</span>
            </div>
        </button>
    </div>
</AlertContainer>
