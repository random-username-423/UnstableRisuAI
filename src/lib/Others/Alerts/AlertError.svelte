<script lang="ts">
    import AlertContainer from "./AlertContainer.svelte"
    import Button from "../../UI/GUI/Button.svelte"
    import { ChevronRightIcon, XIcon } from "@lucide/svelte"
    import { language } from "src/lang"
    import { translateStackTrace } from "src/ts/sourcemap"
    import { DBState } from "src/ts/stores.svelte"

    type Props = {
        msg: string
        submsg?: string
        stackTrace?: string
        onClose: () => void
    }

     let { msg, submsg, stackTrace, onClose }: Props = $props()

    let showDetails = $state(false)
    let translatedStackTrace = $state("")
    let isTranslated = $state(false)
    let isTranslating = $state(false)

    $effect.pre(() => {
        showDetails = false
        translatedStackTrace = ""
        isTranslated = false
        isTranslating = false
    })

    $effect(() => {
        if (showDetails) {
            const shouldAutoTranslate = DBState.db.sourcemapTranslate
            isTranslated = shouldAutoTranslate
            if (shouldAutoTranslate && !translatedStackTrace) {
                loadTranslatedTrace()
            }
        }
    })

    async function loadTranslatedTrace() {
        if (isTranslating || translatedStackTrace) return
        isTranslating = true
        try {
            translatedStackTrace = await translateStackTrace(stackTrace)
        } catch (e) {
            console.error("Failed to translate stack trace:", e)
            isTranslated = false
        } finally {
            isTranslating = false
        }
    }

    async function handleToggleTranslate() {
        if (!isTranslated && !translatedStackTrace) {
            await loadTranslatedTrace()
        }
        isTranslated = !isTranslated
    }
</script>

<AlertContainer title="Error" titleColor="red">
    <!-- Error message -->
    <span class="text-gray-300 whitespace-pre-wrap">{msg}</span>
    {#if submsg}
        <span class="text-gray-500 text-sm">{submsg}</span>
    {/if}

    <!-- Stack trace -->
    {#if stackTrace}
        <div class="mt-4">
            <Button styled="outlined" size="sm" onclick={() => (showDetails = !showDetails)}>
                {showDetails ? language.hideErrorDetails : language.showErrorDetails}
                {#if showDetails}
                    <XIcon class="inline ml-2" />
                {:else}
                    <ChevronRightIcon class="inline ml-2" />
                {/if}
            </Button>
            {#if showDetails}
                <Button styled="outlined" size="sm" onclick={handleToggleTranslate} disabled={isTranslating} className="ml-2">
                    {#if isTranslating}
                        {language.translating}
                    {:else if isTranslated}
                        {language.showOriginal}
                    {:else}
                        {language.translateCode}
                    {/if}
                </Button>
                <pre class="stack-trace">{@html isTranslated ? translatedStackTrace : stackTrace}</pre>
            {/if}
        </div>
    {/if}

    <!-- OK button -->
    <Button className="mt-4" onclick={onClose}>OK</Button>
</AlertContainer>

<style>
    .stack-trace {
        background-color: var(--risu-theme-bgcolor);
        color: var(--risu-theme-textcolor2);
        border: 1px solid var(--risu-theme-darkborderc);
        border-radius: 0.25rem;
        padding: 0.5rem;
        margin-top: 0.5rem;
        font-family: monospace;
        font-size: 0.75rem;
        white-space: pre-wrap;
        word-break: break-all;
        max-height: 200px;
        overflow-y: auto;
    }
</style>
