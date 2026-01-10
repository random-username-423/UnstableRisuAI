<script lang="ts">
    import { getCustomBackground, getEmotion } from "../../ts/characters.svelte";
    import { DBState } from 'src/ts/stores.svelte';
    import { CharEmotion, layoutState, selectedCharID } from "../../ts/stores.svelte";
    import ResizeBox from './ResizeBox.svelte'
    import DefaultChatScreen from "./DefaultChatScreen.svelte";
    import defaultWallpaper from '../../etc/bg.jpg'
    import ChatList from "../Others/ChatList.svelte";
    import TransitionImage from "./TransitionImage.svelte";
    import BackgroundDom from "./BackgroundDom.svelte";
    import SideBarArrow from "../UI/GUI/SideBarArrow.svelte";
    import VisualNovelMain from "../VisualNovel/VisualNovelMain.svelte";
    import ModuleChatMenu from "../Setting/Pages/Module/ModuleChatMenu.svelte";
    let openChatList = $state(false)
    let openModuleList = $state(false)

    const wallPaper = `background: url(${defaultWallpaper})`
    const externalStyles =
            ("background: " + (DBState.db.textScreenColor ? (DBState.db.textScreenColor + '80') : "rgba(0,0,0,0.8)") + ';\n')
        +   (DBState.db.textBorder ? "text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;" : '')
        +   (DBState.db.textScreenRounded ? "border-radius: 2rem; padding: 1rem;" : '')
        +   (DBState.db.textScreenBorder ? `border: 0.3rem solid ${DBState.db.textScreenBorder};` : '')
    let bgImg= $state('')
    let lastBg = $state('')
    $effect.pre(() => {
        (async () =>{
            if(DBState.db.customBackground !== lastBg){
                lastBg = DBState.db.customBackground
                bgImg = await getCustomBackground(DBState.db.customBackground)
            }
        })()
    });

    function parseLayoutHTML(html: string): HTMLElement {
        try {
            if (!html || html.trim() === '') {
                const placeholder = document.createElement('div')
                return placeholder
            }
            // Convert self-closing custom tags to proper closing tags
            // e.g., <RISUCHATSCREEN /> -> <RISUCHATSCREEN></RISUCHATSCREEN>
            const customTags = ['RISUCHATSCREEN', 'RISUCHARIMAGE', 'RISUCHARAREA', 'RISUNOCHARAREA', 'RISUBACKGROUND', 'RISUSIDEBAR', 'RISURESIZEBOX']
            let processedHtml = html
            for (const tag of customTags) {
                // Match both <TAG /> and <TAG/> formats (case insensitive)
                const regex = new RegExp(`<(${tag})(\\s[^>]*)?\\/?>`, 'gi')
                processedHtml = processedHtml.replace(regex, (_, tagName, attrs) => {
                    return `<${tagName}${attrs || ''}></${tagName}>`
                })
            }
            const parser = new DOMParser()
            const doc = parser.parseFromString(processedHtml, 'text/html')
            return doc.body
        } catch (error) {
            const placeholder = document.createElement('div')
            return placeholder
        }
    }

    // Preset layout templates
    const getWaifuLayoutHTML = () => `
<div style="display: flex; justify-content: center; height: 100vh; width: 100%; position: relative;">
  <RISUSIDEBAR />
  <RISUBACKGROUND />
  <RISUCHARAREA style="height: 100%; display: flex; justify-content: flex-end; width: ${42 * (DBState.db.waifuWidth2 / 100)}rem; margin-right: 2.5rem; max-width: calc(50% - 5rem);">
    <RISUCHARIMAGE classType="waifu" />
  </RISUCHARAREA>
  <div style="height: 100%; width: ${42 * (DBState.db.waifuWidth / 100)}rem;" chararea-style="max-width: calc(50% - 5rem);">
    <RISUCHATSCREEN style="${externalStyles}backdrop-filter: blur(4px);" />
  </div>
</div>`

    const getWaifuMobileLayoutHTML = () => `
<div style="position: relative; height: 100vh; width: 100%;">
  <RISUSIDEBAR />
  <RISUBACKGROUND />
  <RISUCHARAREA style="position: absolute; bottom: 0; left: 0; width: 100%; height: 100%;">
    <RISUCHARIMAGE classType="mobile" />
  </RISUCHARAREA>
  <div style="position: absolute; bottom: 0; left: 0; width: 100%; z-index: 10;">
    <RISUCHATSCREEN
      style="${externalStyles}backdrop-filter: blur(4px);"
      charStyle="height: 33.333vh;"
      noCharStyle="height: 100vh;"
    />
  </div>
</div>`

    let layoutHTML = $derived.by(() => {
        if (DBState.db.theme === 'waifu') return getWaifuLayoutHTML()
        if (DBState.db.theme === 'waifuMobile') return getWaifuMobileLayoutHTML()
        if (DBState.db.theme === 'customLayout') return DBState.db.layoutHTML ?? ''
        return ''
    })

    let parsedLayout = $derived(parseLayoutHTML(layoutHTML))
</script>

{#if layoutState.ShowVN}
    <VisualNovelMain />
{:else if DBState.db.theme === 'waifu' || DBState.db.theme === 'waifuMobile' || DBState.db.theme === 'customLayout'}
    {@render renderLayoutPart(parsedLayout)}
{:else}
    <div class="grow h-full min-w-0 relative justify-center flex">
        <SideBarArrow />
        <BackgroundDom />
        <div style={bgImg} class="h-full w-full" class:max-w-6xl={DBState.db.classicMaxWidth}>
            {#if $selectedCharID >= 0}
                {#if DBState.currentChar.viewScreen !== 'none' && (DBState.currentChar.type === 'group' || (!DBState.currentChar.inlayViewScreen))}
                    <ResizeBox />
                {/if}
            {/if}
            <DefaultChatScreen customStyle={bgImg.length > 2 ? `${externalStyles}`: ''} bind:openChatList bind:openModuleList/>
        </div>
    </div>
{/if}

{#snippet renderLayoutPart(dom: HTMLElement)}
    {#if dom.tagName === 'RISUCHATSCREEN'}
        {@const hasChar = $selectedCharID >= 0 && DBState.currentChar.viewScreen !== 'none'}
        {@const baseStyle = dom.getAttribute('style') ?? (bgImg.length > 2 ? externalStyles : '')}
        {@const charStyle = dom.getAttribute('charstyle') ?? ''}
        {@const noCharStyle = dom.getAttribute('nocharstyle') ?? ''}
        <DefaultChatScreen
            customStyle={baseStyle + (hasChar ? charStyle : noCharStyle)}
            bind:openChatList
            bind:openModuleList
        />
    {:else if dom.tagName === 'RISUCHARIMAGE'}
        {#if $selectedCharID >= 0 && DBState.currentChar.viewScreen !== 'none'}
            <TransitionImage
                classType={dom.getAttribute('classtype') ?? dom.getAttribute('classType') ?? 'waifu'}
                src={getEmotion(DBState.db, $CharEmotion, 'plain')}
            />
        {/if}
    {:else if dom.tagName === 'RISUCHARAREA'}
        {#if $selectedCharID >= 0 && DBState.currentChar.viewScreen !== 'none'}
            <div class={dom.getAttribute('class') ?? ''} style={dom.getAttribute('style') ?? ''}>
                {@render renderLayoutChilds(dom)}
            </div>
        {/if}
    {:else if dom.tagName === 'RISUNOCHARAREA'}
        {#if !($selectedCharID >= 0 && DBState.currentChar.viewScreen !== 'none')}
            <div class={dom.getAttribute('class') ?? ''} style={dom.getAttribute('style') ?? ''}>
                {@render renderLayoutChilds(dom)}
            </div>
        {/if}
    {:else if dom.tagName === 'RISUBACKGROUND'}
        <BackgroundDom />
    {:else if dom.tagName === 'RISUSIDEBAR'}
        <SideBarArrow />
    {:else if dom.tagName === 'RISURESIZEBOX'}
        {#if $selectedCharID >= 0 && DBState.currentChar.viewScreen !== 'none' && (DBState.currentChar.type === 'group' || (!DBState.currentChar.inlayViewScreen))}
            <ResizeBox />
        {/if}
    {:else if dom.tagName === 'STYLE'}
        <svelte:element this={'style'}>
            {dom.innerHTML}
        </svelte:element>
    {:else if dom.tagName === 'DIV'}
        <div class={dom.getAttribute('class') ?? ''} style={dom.getAttribute('style') ?? ''}>
            {@render renderLayoutChilds(dom)}
        </div>
    {:else if dom.tagName === 'SPAN'}
        <span class={dom.getAttribute('class') ?? ''} style={dom.getAttribute('style') ?? ''}>
            {@render renderLayoutChilds(dom)}
        </span>
    {:else if dom.tagName === 'IMG'}
        <img class={dom.getAttribute('class') ?? ''} style={dom.getAttribute('style') ?? ''} src={dom.getAttribute('src') ?? ''} alt="" />
    {:else if dom.tagName === 'BODY'}
        <div class="grow h-full min-w-0 relative flex justify-center" style={bgImg.length > 2 ? bgImg : wallPaper}>
            {@render renderLayoutChilds(dom)}
        </div>
    {:else}
        <div class={dom.getAttribute('class') ?? ''} style={dom.getAttribute('style') ?? ''}>
            {@render renderLayoutChilds(dom)}
        </div>
    {/if}
{/snippet}

{#snippet renderLayoutChilds(dom: HTMLElement)}
    {#each dom.childNodes as node}
        {#if node.nodeType === Node.TEXT_NODE}
            {node.textContent}
        {:else if node.nodeType === Node.ELEMENT_NODE}
            {@render renderLayoutPart(node as HTMLElement)}
        {/if}
    {/each}
{/snippet}
{#if openChatList}
    <ChatList close={() => {openChatList = false}}/>
{:else if openModuleList}
    <ModuleChatMenu close={() => {openModuleList = false}}/>
{/if}

<style>
    .halfw{
        max-width: calc(50% - 5rem);
    }
    .halfwp{
        max-width: calc(50% - 5rem);
    }
    .per33{
        height: 33.333333%;
    }
</style>