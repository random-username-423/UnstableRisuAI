<script lang="ts">
    import { SettingsState, RealmState, ModalState, AppState } from "./ts/stores.svelte"
    import { MobileState } from "./ts/stores.svelte"
    import { DBState } from "./ts/stores.svelte"
    import ChatWorkspace from "./lib/ChatScreens/ChatWorkspace.svelte"
    import AlertComp from "./lib/Others/AlertComp.svelte"
    import SyncProgress from "./lib/UI/SyncProgress.svelte"
    import RealmPopUp from "./lib/UI/Realm/RealmPopUp.svelte"
    import WelcomeRisu from "./lib/Others/WelcomeRisu.svelte"
    import Settings from "./lib/Setting/Settings.svelte"
    import { showRealmInfoStore, importCharacterProcess } from "./ts/character/characterCards.svelte"
    import RealmFrame from "./lib/UI/Realm/RealmFrame.svelte"
    import SavePopupIconComp from "./lib/Others/SavePopupIcon.svelte"
    import Botpreset from "./lib/Setting/botpreset.svelte"
    import ListedPersona from "./lib/Setting/listedPersona.svelte"
    import MobileHeader from "./lib/Mobile/MobileHeader.svelte"
    import MobileBody from "./lib/Mobile/MobileBody.svelte"
    import MobileFooter from "./lib/Mobile/MobileFooter.svelte"
    import CustomGUISettingMenu from "./lib/Setting/Pages/CustomGUISettingMenu.svelte"
    import { checkCharOrder } from "src/ts/character/characters.svelte"
    import AprilFools from "./lib/Others/AprilFools.svelte"
    import HypaV3Modal from "./lib/Others/HypaV3Modal.svelte"
    import HypaV3Progress from "./lib/Others/HypaV3Progress.svelte"

    let didFirstSetup: boolean = $derived(DBState.db?.didFirstSetup)
    let aprilFools = $state(new Date().getMonth() === 3 && new Date().getDate() === 1)
</script>

<!--
    Drag & Drop: 파일을 앱에 드래그하면 캐릭터 카드로 import
    TODO: .risum (모듈), .risup (프리셋) 등도 지원하면 좋겠음
-->
<main
    class="bg-bg flex h-full w-full max-w-100vw text-textcolor"
    ondragover={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "link"
    }}
    ondrop={async (e) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) {
            await importCharacterProcess({
                name: file.name,
                data: file,
            })
            checkCharOrder()
        }
    }}
>
    <!-- Main View: 화면 전체를 차지하는 뷰 (한 번에 하나만 표시) -->
    {#if aprilFools}
        <AprilFools onExit={() => (aprilFools = false)} />
    {:else if !AppState.loaded}
        <div class="flex h-full w-full flex-col items-center justify-center bg-gray-900 text-xl text-textcolor">
            <div class="flex flex-row items-center">
                <svg
                    class="-ml-1 mr-3 h-5 w-5 animate-spin text-textcolor"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span>Loading...</span>
            </div>

            <span class="mt-2 text-sm text-textcolor2">{AppState.loadingText}</span>
        </div>
    {:else if SettingsState.customGUIOpen}
        <CustomGUISettingMenu />
    {:else if !didFirstSetup}
        <WelcomeRisu />
    {:else if SettingsState.isOpen}
        <Settings />
    {:else if MobileState.enabled}
        <div class="flex h-full w-full flex-col">
            <MobileHeader />
            <MobileBody />
            <MobileFooter />
        </div>
    {:else}
        <ChatWorkspace />
    {/if}

    <!-- Overlays: 메인 뷰 위에 표시되는 모달/팝업 -->
    {#if ModalState.alert.type !== "none"}
        <AlertComp />
    {/if}
    <SyncProgress />
    {#if showRealmInfoStore.value}
        <RealmPopUp bind:openedData={showRealmInfoStore.value} />
    {/if}
    {#if RealmState.frameContent}
        <RealmFrame />
    {/if}
    {#if ModalState.presetListOpen}
        <Botpreset
            close={() => {
                ModalState.presetListOpen = false
            }}
        />
    {/if}
    {#if ModalState.personaListOpen}
        <ListedPersona
            close={() => {
                ModalState.personaListOpen = false
            }}
        />
    {/if}
    {#if ModalState.hypaV3.modalOpen}
        <HypaV3Modal />
    {/if}
    <SavePopupIconComp />
    {#if ModalState.hypaV3.progress.open}
        <HypaV3Progress />
    {/if}
</main>
