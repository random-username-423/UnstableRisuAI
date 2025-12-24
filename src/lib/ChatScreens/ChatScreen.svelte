<script lang="ts">
    import { getCustomBackground, getEmotion } from "../../ts/utils/util"

    import { DBState } from "src/ts/stores.svelte"
    import { ChatState, RenderState } from "../../ts/stores.svelte"
    import ResizeBox from "./ResizeBox.svelte"
    import DefaultChatScreen from "./DefaultChatScreen.svelte"
    import defaultWallpaper from "../../etc/bg.jpg"
    import ChatList from "../Others/ChatList.svelte"
    import TransitionImage from "./TransitionImage.svelte"
    import BackgroundDom from "./BackgroundDom.svelte"
    import SideBarArrow from "../UI/GUI/SideBarArrow.svelte"
    import VisualNovelMain from "../VisualNovel/VisualNovelMain.svelte"
    import ModuleChatMenu from "../Setting/Pages/Module/ModuleChatMenu.svelte"
    let openChatList = $state(false)
    let openModuleList = $state(false)

    const wallPaper = `background: url(${defaultWallpaper})`
    const externalStyles =
        "background: " +
        (DBState.db.textScreenColor ? DBState.db.textScreenColor + "80" : "rgba(0,0,0,0.8)") +
        ";\n" +
        (DBState.db.textBorder
            ? "text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;"
            : "") +
        (DBState.db.textScreenRounded ? "border-radius: 2rem; padding: 1rem;" : "") +
        (DBState.db.textScreenBorder ? `border: 0.3rem solid ${DBState.db.textScreenBorder};` : "")
    let bgImg = $state("")
    let lastBg = $state("")
    $effect.pre(() => {
        ;(async () => {
            if (DBState.db.customBackground !== lastBg) {
                lastBg = DBState.db.customBackground
                bgImg = await getCustomBackground(DBState.db.customBackground)
            }
        })()
    })
</script>

{#if RenderState.showVisualNovel}
    <VisualNovelMain />
{:else if DBState.db.theme === "waifu"}
    <div class="relative flex h-full flex-grow justify-center" style={bgImg.length < 4 ? wallPaper : bgImg}>
        <SideBarArrow />
        <BackgroundDom />
        {#if ChatState.selectedCharId >= 0}
            {#if DBState.db.characters[ChatState.selectedCharId].viewScreen !== "none"}
                <div class="halfw mr-10 flex h-full justify-end" style:width="{42 * (DBState.db.waifuWidth2 / 100)}rem">
                    <TransitionImage classType="waifu" src={getEmotion(DBState.db, ChatState.emotions, "plain")} />
                </div>
            {/if}
        {/if}
        <div
            class="h-full w-2xl"
            style:width="{42 * (DBState.db.waifuWidth / 100)}rem"
            class:halfwp={ChatState.selectedCharId >= 0 &&
                DBState.db.characters[ChatState.selectedCharId].viewScreen !== "none"}
        >
            <DefaultChatScreen
                customStyle={`${externalStyles}backdrop-filter: blur(4px);`}
                bind:openChatList
                bind:openModuleList
            />
        </div>
    </div>
{:else if DBState.db.theme === "waifuMobile"}
    <div class="relative h-full flex-grow" style={bgImg.length < 4 ? wallPaper : bgImg}>
        <SideBarArrow />
        <BackgroundDom />
        <div
            class="absolute bottom-0 left-0 z-10 w-full"
            class:per33={ChatState.selectedCharId >= 0 &&
                DBState.db.characters[ChatState.selectedCharId].viewScreen !== "none"}
            class:h-full={!(
                ChatState.selectedCharId >= 0 && DBState.db.characters[ChatState.selectedCharId].viewScreen !== "none"
            )}
        >
            <DefaultChatScreen
                customStyle={`${externalStyles}backdrop-filter: blur(4px);`}
                bind:openChatList
                bind:openModuleList
            />
        </div>
        {#if ChatState.selectedCharId >= 0}
            {#if DBState.db.characters[ChatState.selectedCharId].viewScreen !== "none"}
                <div class="absolute bottom-0 left-0 h-full w-full max-w-full">
                    <TransitionImage classType="mobile" src={getEmotion(DBState.db, ChatState.emotions, "plain")} />
                </div>
            {/if}
        {/if}
    </div>
{:else}
    <div class="relative flex h-full min-w-0 flex-grow justify-center">
        <SideBarArrow />
        <BackgroundDom />
        <div style={bgImg} class="h-full w-full" class:max-w-6xl={DBState.db.classicMaxWidth}>
            {#if ChatState.selectedCharId >= 0}
                {#if DBState.db.characters[ChatState.selectedCharId].viewScreen !== "none" && (DBState.db.characters[ChatState.selectedCharId].type === "group" || !DBState.db.characters[ChatState.selectedCharId].inlayViewScreen)}
                    <ResizeBox />
                {/if}
            {/if}
            <DefaultChatScreen
                customStyle={bgImg.length > 2 ? `${externalStyles}` : ""}
                bind:openChatList
                bind:openModuleList
            />
        </div>
    </div>
{/if}
{#if openChatList}
    <ChatList
        close={() => {
            openChatList = false
        }}
    />
{:else if openModuleList}
    <ModuleChatMenu
        close={() => {
            openModuleList = false
        }}
    />
{/if}

<style>
    .halfw {
        max-width: calc(50% - 5rem);
    }
    .halfwp {
        max-width: calc(50% - 5rem);
    }
    .per33 {
        height: 33.333333%;
    }
</style>
