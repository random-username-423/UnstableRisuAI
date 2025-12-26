<script lang="ts">
    import { XIcon } from "@lucide/svelte"
    import { language } from "src/lang"
    import MultiLangDisplay from "../UI/GUI/MultiLangDisplay.svelte"

    interface Props {
        onRemove: () => void
        quote: string
    }

    let { onRemove, quote }: Props = $props()
</script>

<div class="mt-4 flex w-full max-w-100vw justify-center">
    <div class="w-5/6 max-w-80vw rounded-md bg-darkbg p-3 text-sm text-textcolor">
        <h1 class="mb-2 font-bold">
            {language.creatorNotes}
            <button class="float-right" onclick={onRemove}>
                <XIcon />
            </button>
        </h1>
        <MultiLangDisplay value={quote} markdown={true} />
    </div>
</div>
