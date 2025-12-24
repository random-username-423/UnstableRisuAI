<script lang="ts">
    import { characterFormatUpdate, getCharImage, removeChar } from "../../ts/character/characters.svelte"
    import type { Database } from "../../ts/data/storage/types"
    import { DBState, ChatState } from "src/ts/stores.svelte"
    import BarIcon from "../SideBars/BarIcon.svelte"
    import { ArrowLeft, User, Users, Inspect, TrashIcon, Undo2Icon } from "lucide-svelte"
    import TextInput from "../UI/GUI/TextInput.svelte"
    import Button from "../UI/GUI/Button.svelte"
    import { language } from "src/lang"
    import { parseMultilangString } from "src/ts/utils/util"
    import { checkCharOrder } from "src/ts/character/characters.svelte"
    import MobileCharacters from "../Mobile/MobileCharacters.svelte"
    interface Props {
        endGrid?: any
    }

    let { endGrid = () => {} }: Props = $props()
    let search = $state("")
    let selected = $state(3)

    function changeChar(index = -1) {
        characterFormatUpdate(index)
        ChatState.selectedCharId = index
        endGrid()
    }

    function formatChars(search: string, db: Database, trash = false) {
        let charas: {
            image: string
            index: number
            type: string
            name: string
            desc: string
        }[] = []

        for (let i = 0; i < db.characters.length; i++) {
            const c = db.characters[i]
            if (c.trashTime && !trash) {
                continue
            }
            if (!c.trashTime && trash) {
                continue
            }
            if (c.name.replace(/ /g, "").toLocaleLowerCase().includes(search.toLocaleLowerCase().replace(/ /g, ""))) {
                charas.push({
                    image: c.image,
                    index: i,
                    type: c.type,
                    name: c.name,
                    desc: c.creatorNotes ?? "No description",
                })
            }
        }
        return charas
    }
</script>

<div class="flex h-full w-full justify-center">
    <div class="flex h-full w-2xl max-w-full flex-col overflow-y-auto bg-darkbg p-6">
        <div class="mx-4 mb-6 flex flex-col">
            <div class="mb-2 flex items-center gap-3">
                <button
                    class="flex flex-shrink-0 items-center justify-center rounded-lg p-2 transition-colors hover:bg-selected"
                    onclick={() => endGrid()}
                    title="Back"
                >
                    <ArrowLeft size={20} />
                </button>
                <div class="flex-1">
                    <TextInput placeholder="Search" bind:value={search} size="lg" autocomplete="off" fullwidth={true} />
                </div>
            </div>
            <div class="mt-2 flex flex-wrap gap-2">
                <Button
                    styled={selected === 3 ? "primary" : "outlined"}
                    size="sm"
                    onclick={() => {
                        selected = 3
                    }}
                >
                    {language.simple}
                </Button>
                <Button
                    styled={selected === 0 ? "primary" : "outlined"}
                    size="sm"
                    onclick={() => {
                        selected = 0
                    }}
                >
                    {language.grid}
                </Button>
                <Button
                    styled={selected === 1 ? "primary" : "outlined"}
                    size="sm"
                    onclick={() => {
                        selected = 1
                    }}
                >
                    {language.list}
                </Button>
                <Button
                    styled={selected === 2 ? "primary" : "outlined"}
                    size="sm"
                    onclick={() => {
                        selected = 2
                    }}
                >
                    {language.trash}
                </Button>
                <div class="flex-grow"></div>
                <span class="text-sm text-textcolor2">
                    {formatChars(search, DBState.db).length}
                    {language.character}
                </span>
            </div>
        </div>
        {#if selected === 0}
            <div class="flex w-full justify-center">
                <div class="flex w-full flex-wrap justify-center gap-2">
                    {#each formatChars(search, DBState.db) as char}
                        <div class="flex items-center text-textcolor">
                            {#if char.image}
                                <BarIcon
                                    onClick={() => {
                                        changeChar(char.index)
                                    }}
                                    additionalStyle={getCharImage(char.image, "css")}
                                ></BarIcon>
                            {:else}
                                <BarIcon
                                    onClick={() => {
                                        changeChar(char.index)
                                    }}
                                    additionalStyle={char.index === ChatState.selectedCharId
                                        ? "background:var(--risu-theme-selected)"
                                        : ""}
                                >
                                    {#if char.type === "group"}
                                        <Users />
                                    {:else}
                                        <User />
                                    {/if}
                                </BarIcon>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>
        {:else if selected === 1}
            {#each formatChars(search, DBState.db) as char}
                <div class="mb-2 flex rounded-md border border-darkborderc p-2">
                    <BarIcon
                        onClick={() => {
                            changeChar(char.index)
                        }}
                        additionalStyle={getCharImage(char.image, "css")}
                    ></BarIcon>
                    <div class="ml-2 flex flex-1 flex-col">
                        <h4 class="mb-1 text-lg font-bold text-textcolor">{char.name || "Unnamed"}</h4>
                        <span class="text-textcolor2"
                            >{parseMultilangString(char.desc)["en"] ||
                                parseMultilangString(char.desc)["xx"] ||
                                "No description"}</span
                        >
                        <div class="flex justify-end gap-2">
                            <button
                                class="text-textcolor2 hover:text-textcolor"
                                onclick={() => {
                                    changeChar(char.index)
                                }}
                            >
                                <Inspect />
                            </button>
                            <button
                                class="text-textcolor2 hover:text-textcolor"
                                onclick={() => {
                                    removeChar(char.index, char.name)
                                }}
                            >
                                <TrashIcon />
                            </button>
                        </div>
                    </div>
                </div>
            {/each}
        {:else if selected === 2}
            <span class="mb-2 text-sm text-textcolor2">{language.trashDesc}</span>
            {#each formatChars(search, DBState.db, true) as char}
                <div class="mb-2 flex rounded-md border border-darkborderc p-2">
                    <BarIcon
                        onClick={() => {
                            changeChar(char.index)
                        }}
                        additionalStyle={getCharImage(char.image, "css")}
                    ></BarIcon>
                    <div class="ml-2 flex flex-1 flex-col">
                        <h4 class="mb-1 text-lg font-bold text-textcolor">{char.name || "Unnamed"}</h4>
                        <span class="text-textcolor2"
                            >{parseMultilangString(char.desc)["en"] ||
                                parseMultilangString(char.desc)["xx"] ||
                                "No description"}</span
                        >
                        <div class="flex justify-end gap-2">
                            <button
                                class="text-textcolor2 hover:text-textcolor"
                                onclick={() => {
                                    DBState.db.characters[char.index].trashTime = undefined
                                    checkCharOrder()
                                }}
                            >
                                <Undo2Icon />
                            </button>
                            <button
                                class="text-textcolor2 hover:text-textcolor"
                                onclick={() => {
                                    removeChar(char.index, char.name, "permanent")
                                }}
                            >
                                <TrashIcon />
                            </button>
                        </div>
                    </div>
                </div>
            {/each}
        {:else if selected === 3}
            <MobileCharacters gridMode {endGrid} />
        {/if}
    </div>
</div>
