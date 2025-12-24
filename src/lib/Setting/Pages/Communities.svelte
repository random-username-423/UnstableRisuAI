<script lang="ts">
    import { language } from "src/lang"
    import { openURL } from "src/ts/utils/util"
</script>

<h2 class="mb-2 mt-2 text-2xl font-bold">{language.community}</h2>
<button
    onclick={async () => {
        openURL("https://github.com/kwaroran/RisuAI")
    }}
    class="ml-2 mr-2 mt-2 flex items-center justify-center border-1 border-solid border-darkbutton p-3 text-sm drop-shadow-lg hover:bg-selected"
>
    Github
</button>
<button
    onclick={async () => {
        openURL("https://discord.gg/JzP8tB9ZK8")
    }}
    class="ml-2 mr-2 mt-2 flex items-center justify-center border-1 border-solid border-darkbutton p-3 text-sm drop-shadow-lg hover:bg-selected"
>
    Discord
</button>
<button
    onclick={async () => {
        openURL("https://www.patreon.com/RisuAI")
    }}
    class="ml-2 mr-2 mt-2 flex items-center justify-center border-1 border-solid border-darkbutton p-3 text-sm drop-shadow-lg hover:bg-selected"
>
    Support Project
</button>
