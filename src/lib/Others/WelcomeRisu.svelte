<script lang="ts">
    import { Send } from "lucide-svelte"
    import { changeLanguage, language } from "src/lang"
    import { setPreset } from "src/ts/data/storage/utils/presetManager"
    import { DBState } from "src/ts/stores.svelte"
    import Chat from "../ChatScreens/Chat.svelte"
    import { prebuiltPresets } from "src/ts/process/templates/templates"
    import { updateTextThemeAndCSS } from "src/ts/gui/colorscheme.svelte"
    import Airisu from "../../etc/Airisu.webp"

    const airisuStyle = `background: url("${Airisu}");background-size: cover;`
    let step = $state(0)
    let provider = $state("")
    let input = $state("")
    let chatLang = $state(0)
    let chatMemorySelection = $state(0)

    {
        const browserLang = navigator.language
        const browserLangShort = browserLang.split("-")[0]
        const usableLangs = ["de", "en", "ko", "cn", "vi", "zh-Hant"]
        if (usableLangs.includes(browserLangShort)) {
            changeLanguage(browserLangShort)
            DBState.db.language = browserLangShort
            step = 1
        }
    }
    let start = $state(false)

    function send() {
        switch (step) {
            case 1: {
                if (input.length > 0) {
                    DBState.db.username = input
                    step = 2
                    input = ""
                }
                break
            }
            case 2: {
                if (["openai", "openrouter", "horde", "later"].includes(input.toLocaleLowerCase())) {
                    provider = input.toLocaleLowerCase()
                    step = 3
                    input = ""
                }
                break
            }
            case 4: {
                if (provider === "openai") {
                    if (input.length > 0 && input.startsWith("sk-")) {
                        DBState.db.openAIKey = input
                        step = 5
                        input = ""
                    }
                }
                if (provider === "openrouter") {
                    if (input.length > 0 && input.startsWith("sk-")) {
                        DBState.db.openrouterKey = input
                        step = 5
                        input = ""
                    }
                }
                if (provider === "claude") {
                    if (input.length > 0 && input.startsWith("sk-")) {
                        DBState.db.claudeAPIKey = input
                        step = 5
                        input = ""
                    }
                }
            }
        }
    }

    $effect.pre(() => {
        if (step === 10) {
            setTimeout(() => {
                DBState.db = setPreset(DBState.db, prebuiltPresets.OAI2)
                DBState.db.textTheme = "highcontrast"
                updateTextThemeAndCSS()

                switch (chatMemorySelection) {
                    case 0: {
                        DBState.db.maxContext = 16000
                        DBState.db.maxResponse = 1000
                        break
                    }
                    case 1: {
                        DBState.db.maxContext = 8000
                        DBState.db.maxResponse = 500
                        break
                    }
                    case 2: {
                        DBState.db.maxContext = 12000
                        DBState.db.maxResponse = 800
                        break
                    }
                    case 3: {
                        DBState.db.maxContext = 100000
                        DBState.db.maxResponse = 1000
                        break
                    }
                }

                if (provider === "claude") {
                    DBState.db.aiModel = "claude-sonnet-4-5-20250929"
                    DBState.db.subModel = "claude-sonnet-4-5-20250929"
                }

                if (provider === "openai") {
                    DBState.db.aiModel = "gpt-5.1-2025-11-13"
                    DBState.db.subModel = "gpt-5.1-2025-11-13"
                }

                if (provider === "openrouter") {
                    DBState.db.aiModel = "openrouter"
                    DBState.db.subModel = "openrouter"
                    DBState.db.openrouterRequestModel = "risu/free"
                }
                if (provider === "horde") {
                    DBState.db.aiModel = "horde:::auto"
                    DBState.db.subModel = "horde:::auto"
                }
                if (chatLang !== 0) {
                    switch (DBState.db.language) {
                        case "de": {
                            DBState.db.translator = "de"
                            break
                        }
                        case "en": {
                            DBState.db.translator = "en"
                            break
                        }
                        case "ko": {
                            DBState.db.translator = "ko"
                            break
                        }
                        case "cn": {
                            DBState.db.translator = "zh"
                            break
                        }
                        case "vi": {
                            DBState.db.translator = "vi"
                            break
                        }
                        case "zh-Hant": {
                            DBState.db.translator = "zh-TW"
                            break
                        }
                    }
                }
                if (chatLang === 1) {
                    DBState.db.autoTranslate = true
                    DBState.db.translatorType = "google"
                    DBState.db.useAutoTranslateInput = true
                }

                DBState.db.didFirstSetup = true
            }, 1000)

            DBState.db.claudeCachingExperimental = true
        }
    })
</script>

<div class="welcome-bg relative flex h-full w-full justify-center bg-gray-900 text-textcolor">
    <div
        class="flex h-full min-h-full w-2xl max-w-full flex-col overflow-x-hidden overflow-y-hidden"
        class:justify-center={!start}
    >
        {#if !start}
            <div
                class="logo-animation mt-8 flex w-full justify-center"
                onanimationend={() => {
                    start = true
                }}
            >
                <img src="/logo_typo_trans.png" alt="logo" class="mb-0 w-full max-w-screen-sm" />
            </div>
        {:else}
            <div
                class="chat-animation relative mt-5 flex w-full max-w-full flex-grow flex-col overflow-y-auto overflow-x-hidden rounded-t-lg border border-gray-800 bg-darkbg p-5"
            >
                {#if step === 0}
                    <h2 class="animate-bounce">Choose your language</h2>
                    <div class="ml-2 flex flex-col items-start">
                        <button
                            class="transition-colors hover:text-green-500"
                            onclick={() => {
                                changeLanguage("de")
                                DBState.db.language = "de"
                                step = 1
                            }}>• Deutsch</button
                        >
                        <button
                            class="transition-colors hover:text-green-500"
                            onclick={() => {
                                changeLanguage("en")
                                DBState.db.language = "en"
                                step = 1
                            }}>• English</button
                        >
                        <button
                            class="transition-colors hover:text-green-500"
                            onclick={() => {
                                changeLanguage("ko")
                                DBState.db.language = "ko"
                                step = 1
                            }}>• 한국어</button
                        >
                        <button
                            class="transition-colors hover:text-green-500"
                            onclick={() => {
                                changeLanguage("cn")
                                DBState.db.language = "cn"
                                step = 1
                            }}>• 中文</button
                        >
                        <button
                            class="transition-colors hover:text-green-500"
                            onclick={() => {
                                changeLanguage("zh-Hant")
                                DBState.db.language = "zh-Hant"
                                step = 1
                            }}>• 中文(繁體)</button
                        >
                        <button
                            class="transition-colors hover:text-green-500"
                            onclick={() => {
                                changeLanguage("vi")
                                DBState.db.language = "vi"
                                step = 1
                            }}>• Tiếng Việt</button
                        >
                    </div>
                {:else}
                    <Chat name="Airisu" img={airisuStyle} message={language.setup.welcome} isLastMemory={false} />
                    {#if step >= 2}
                        <Chat name={DBState.db.username} message={DBState.db.username} isLastMemory={false} />
                        <Chat
                            name="Airisu"
                            img={airisuStyle}
                            message={language.setup.setupLaterMessage.replace("{username}", DBState.db.username)}
                            isLastMemory={false}
                        />
                    {/if}
                    {#if step === 2}
                        <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
                            <button
                                class="col-span-2 flex flex-col border-l-4 border-l-blue-500 p-6 transition-shadow hover:ring-1"
                                onclick={() => {
                                    step = 3
                                }}
                            >
                                <h1 class="text-start text-2xl font-bold">{language.setup.setupMessageOption1}</h1>
                                <span class="mt-2 text-start text-textcolor2"
                                    >{language.setup.setupMessageOption1Desc}</span
                                >
                            </button>
                            <button
                                class="flex flex-col border-l-4 border-l-gray-500 p-6 transition-shadow hover:ring-1"
                                onclick={() => {
                                    provider = "later"
                                    step = 10
                                }}
                            >
                                <h1 class="text-md text-start font-bold text-gray-500">
                                    {language.setup.setupMessageOption2}
                                </h1>
                            </button>
                        </div>
                    {/if}
                    {#if step >= 3}
                        <Chat
                            name={DBState.db.username}
                            message={language.setup.setupMessageOption1}
                            isLastMemory={false}
                        />
                        <Chat
                            name="Airisu"
                            img={airisuStyle}
                            message={language.setup.welcome2.replace("{username}", DBState.db.username)}
                            isLastMemory={false}
                        />
                    {/if}
                    {#if step === 3}
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <button
                                class="flex flex-col border-l-4 border-l-gray-500 p-6 transition-shadow hover:ring-1"
                                onclick={() => {
                                    provider = "claude"
                                    step = 4
                                }}
                            >
                                <h1 class="text-start text-2xl font-bold">
                                    Claude <span class="rounded bg-blue-500 p-1 text-sm text-white"
                                        >{language.recommended}</span
                                    >
                                </h1>
                                <span class="mt-2 text-start text-textcolor2">{language.setup.claudeDesc}</span>
                            </button>
                            <button
                                class="flex flex-col border-l-4 border-l-blue-500 p-6 transition-shadow hover:ring-1"
                                onclick={() => {
                                    provider = "openai"
                                    step = 4
                                }}
                            >
                                <h1 class="text-start text-2xl font-bold">OpenAI</h1>
                                <span class="mt-2 text-start text-textcolor2">{language.setup.openAIDesc}</span>
                            </button>
                            <button
                                class="flex flex-col border-l-4 border-l-red-500 p-6 transition-shadow hover:ring-1"
                                onclick={() => {
                                    provider = "horde"
                                    step = 10
                                }}
                            >
                                <h1 class="text-start text-2xl font-bold">Horde</h1>
                                <span class="mt-2 text-start text-textcolor2">{language.setup.hordeProvider}</span>
                            </button>
                            <button
                                class="flex flex-col border-l-4 border-l-green-500 p-6 transition-shadow hover:ring-1"
                                onclick={() => {
                                    provider = "openrouter"
                                    step = 4
                                }}
                            >
                                <h1 class="text-start text-2xl font-bold">OpenRouter</h1>
                                <span class="mt-2 text-start text-textcolor2">{language.setup.openrouterProvider}</span>
                            </button>
                        </div>
                    {/if}
                    {#if step >= 4}
                        <Chat name={DBState.db.username} message={provider} isLastMemory={false} />
                        {#if provider === "openai"}
                            <Chat
                                name="Airisu"
                                img={airisuStyle}
                                message={language.setup.setupOpenAI}
                                isLastMemory={false}
                            />
                        {/if}
                        {#if provider === "openrouter"}
                            <Chat
                                name="Airisu"
                                img={airisuStyle}
                                message={language.setup.setupOpenrouter}
                                isLastMemory={false}
                            />
                        {/if}
                        {#if provider === "claude"}
                            {#each language.setup.setupClaudeSteps as step, i}
                                <Chat
                                    name="Airisu"
                                    img={airisuStyle}
                                    message={`![alt text](/welcome/claude/ant_${i}.webp)\n\n${i === 0 ? "https://console.anthropic.com/login?returnTo=%2F%3F\n\n" : ""}` +
                                        step}
                                    isLastMemory={false}
                                />
                            {/each}
                        {/if}
                    {/if}
                    {#if step >= 5}
                        <Chat name={DBState.db.username} message="<HIDDEN>" isLastMemory={false} />
                        <Chat
                            name="Airisu"
                            img={airisuStyle}
                            message={language.setup.chooseChatType}
                            isLastMemory={false}
                        />
                    {/if}
                    {#if step === 5}
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <button
                                class="flex flex-col border-l-4 border-l-blue-500 p-6 transition-shadow hover:ring-1"
                                onclick={() => {
                                    chatLang = 0
                                    step = 6
                                }}
                            >
                                <h1 class="text-start text-2xl font-bold">{language.setup.chooseChatTypeOption1}</h1>
                                <span class="mt-2 text-start text-textcolor2"
                                    >{language.setup.chooseChatTypeOption1Desc}</span
                                >
                            </button>
                            <button
                                class="flex flex-col border-l-4 border-l-green-500 p-6 transition-shadow hover:ring-1"
                                onclick={() => {
                                    chatLang = 1
                                    step = 6
                                }}
                            >
                                <h1 class="text-start text-2xl font-bold">{language.setup.chooseChatTypeOption2}</h1>
                                <span class="mt-2 text-start text-textcolor2"
                                    >{language.setup.chooseChatTypeOption2Desc}</span
                                >
                            </button>
                            <button
                                class="flex flex-col border-l-4 border-l-red-500 p-6 transition-shadow hover:ring-1"
                                onclick={() => {
                                    chatLang = 2
                                    step = 6
                                }}
                            >
                                <h1 class="text-start text-2xl font-bold">{language.setup.chooseChatTypeOption3}</h1>
                                <span class="mt-2 text-start text-textcolor2"
                                    >{language.setup.chooseChatTypeOption3Desc}</span
                                >
                            </button>
                        </div>
                    {/if}
                    {#if step >= 6}
                        <Chat
                            name={DBState.db.username}
                            message={language.setup[`chooseChatTypeOption${chatLang + 1}`]}
                            isLastMemory={false}
                        />
                        <Chat
                            name="Airisu"
                            img={airisuStyle}
                            message={language.setup.chooseCheapOrMemory}
                            isLastMemory={false}
                        />
                    {/if}
                    {#if step === 6}
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <button
                                class="flex flex-col border-l-4 border-l-red-500 p-6 transition-shadow hover:ring-1"
                                onclick={() => {
                                    chatMemorySelection = 2
                                    step = 10
                                }}
                            >
                                <h1 class="text-start text-2xl font-bold">
                                    {language.setup.chooseCheapOrMemoryOption3}
                                    <span class="rounded bg-blue-500 p-1 text-sm text-white"
                                        >{language.recommended}</span
                                    >
                                </h1>
                                <span class="mt-2 text-start text-textcolor2"
                                    >{language.setup.chooseCheapOrMemoryOption3Desc}</span
                                >
                            </button>
                            <button
                                class="flex flex-col border-l-4 border-l-blue-500 p-6 transition-shadow hover:ring-1"
                                onclick={() => {
                                    chatMemorySelection = 0
                                    step = 10
                                }}
                            >
                                <h1 class="text-start text-2xl font-bold">
                                    {language.setup.chooseCheapOrMemoryOption1}
                                </h1>
                                <span class="mt-2 text-start text-textcolor2"
                                    >{language.setup.chooseCheapOrMemoryOption1Desc}</span
                                >
                            </button>
                            <button
                                class="flex flex-col border-l-4 border-l-green-500 p-6 transition-shadow hover:ring-1"
                                onclick={() => {
                                    chatMemorySelection = 1
                                    step = 10
                                }}
                            >
                                <h1 class="text-start text-2xl font-bold">
                                    {language.setup.chooseCheapOrMemoryOption2}
                                </h1>
                                <span class="mt-2 text-start text-textcolor2"
                                    >{language.setup.chooseCheapOrMemoryOption2Desc}</span
                                >
                            </button>
                            <button
                                class="flex flex-col border-l-4 border-l-yellow-500 p-6 transition-shadow hover:ring-1"
                                onclick={() => {
                                    chatMemorySelection = 3
                                    step = 10
                                }}
                            >
                                <h1 class="text-start text-2xl font-bold">
                                    {language.setup.chooseCheapOrMemoryOption4}
                                </h1>
                                <span class="mt-2 text-start text-textcolor2"
                                    >{language.setup.chooseCheapOrMemoryOption4Desc}</span
                                >
                            </button>
                        </div>
                    {/if}
                    {#if step === 10}
                        <Chat name="Airisu" img={airisuStyle} message={language.setup.allDone} isLastMemory={false} />
                    {/if}
                    <div class="mb-2 mt-auto flex w-full items-stretch">
                        <textarea
                            class="input-text peer ml-4 min-w-0 max-w-full flex-grow resize-none overflow-x-hidden overflow-y-hidden rounded-md rounded-r-none border border-r-0 border-darkborderc bg-transparent p-2 text-xl text-textcolor outline-none transition-colors focus:border-textcolor"
                            bind:value={input}
                            onkeydown={(e) => {
                                if (e.key.toLocaleLowerCase() === "enter" && !e.shiftKey && !e.isComposing) {
                                    e.preventDefault()
                                    send()
                                }
                            }}
                            style:height="44px"
                        ></textarea>
                        <button
                            onclick={send}
                            class="flex items-center justify-center rounded-r-md border-y border-r border-darkborderc p-2 text-gray-100 transition-colors hover:bg-blue-500 peer-focus:border-textcolor"
                        >
                            <Send />
                        </button>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .welcome-bg {
        background-size: cover;
        position: relative;
    }

    @keyframes darkness {
        from {
            opacity: 0;
        }
        50% {
            opacity: 0.2;
        }
        to {
            opacity: 0;
        }
    }

    .logo-animation {
        animation: logo-animation 3s ease-in-out;
        opacity: 0;
    }
    @keyframes logo-animation {
        from {
            opacity: 0;
        }
        80% {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }

    .chat-animation {
        animation: chat-animation 3s ease-in-out;
    }
    @keyframes chat-animation {
        from {
            top: 100vh;
        }
        to {
            top: 0;
        }
    }
</style>
