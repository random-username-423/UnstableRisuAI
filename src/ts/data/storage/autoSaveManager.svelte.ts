import { sleep } from "../../utils/util"
import { getDbBackups } from "../../init"
import { getDatabase } from "./database.svelte"
import { ChatState, DBState } from "../../stores.svelte"
import { syncDrive } from "../drive/drive"
import { RisuSaveEncoder, type toSaveType } from "./risuSave"
import { saveMainData } from "./dbStorage"
import { forageStorage } from "./autoStorage"
import { saveDbKei } from "../kei/backup"
import { initOPFSWorker } from "./opfsWorkerClient.svelte"
import { tabSyncManager } from "./tabSyncManager"
import { autoSaveErrorHandler } from "./autoSaveErrorHandler"

let lastBackupTime = 0
let isRunning = false

export const saving = $state({
    state: false,
    paused: false, // 백업 복원 중 저장 일시정지
})

export const requiresFullEncoderReload = $state({
    state: false,
})

/**
 * Saves the current state of the database.
 * This is the main autosave scheduler loop.
 *
 * @returns {Promise<void>} - A promise that resolves when the database has been saved.
 */
export async function startAutoSaveLoop() {
    if (isRunning) {
        return
    }
    isRunning = true

    // ============================================================
    // Stage 1: 초기화
    // ============================================================
    let changed = false
    syncDrive()

    // Stage 1-1: 탭 동기화 매니저 초기화
    tabSyncManager.init()

    // Stage 1-2: OPFS Worker 초기화
    await initOPFSWorker()

    // Stage 1-3: 변경 추적 객체 초기화
    const changeTracker: toSaveType = {
        character: [],
        chat: [],
        botPreset: false,
        modules: false,
    }

    // Stage 1-4: RisuSaveEncoder 초기화
    let encoder = new RisuSaveEncoder()
    // Account 동기화 모드에서는 chats 분리 안 함 (기존 형식 유지)
    const shouldExcludeChats = !forageStorage.isAccount
    // Account 동기화 모드에서는 characters/presets 분리 안 함
    const shouldSeparateCharactersAndPresets = !forageStorage.isAccount
    await encoder.init(getDatabase(), {
        compression: forageStorage.isAccount,
        excludeChats: shouldExcludeChats,
        separateCharactersAndPresets: shouldSeparateCharactersAndPresets,
    })

    // ============================================================
    // Stage 2: 변경 감지 설정 ($effect.root)
    // ============================================================
    $effect.root(() => {
        const debounceTime = 500 // 500 milliseconds
        let saveTimeout: ReturnType<typeof setTimeout> | null = null

        // 디바운스 함수: 500ms 후에 changed = true 설정
        function saveTimeoutExecute() {
            if (saveTimeout) {
                clearTimeout(saveTimeout)
            }
            saveTimeout = setTimeout(() => {
                changed = true
            }, debounceTime)
        }

        // Stage 2-1: botPresets 변경 감지
        $effect(() => {
            DBState.db.botPresetsId
            DBState.db.botPresets.length
            changeTracker.botPreset = true
            saveTimeoutExecute()
        })

        // Stage 2-2: modules 변경 감지
        $effect(() => {
            $state.snapshot(DBState.db.modules)
            changeTracker.modules = true
            saveTimeoutExecute()
        })

        $effect(() => {})

        // Stage 2-3: DB 전체 + 현재 캐릭터/채팅 변경 감지
        $effect(() => {
            // DB의 characters, botPresets, modules 외 모든 필드 감지
            for (const key in DBState.db) {
                if (key !== "characters" && key !== "botPresets" && key !== "modules") {
                    $state.snapshot(DBState.db[key])
                }
            }

            // 현재 선택된 캐릭터의 변경 감지
            const charIndex = ChatState.selectedCharId
            if (DBState?.db?.characters?.[charIndex]) {
                const currentChar = DBState.db.characters[charIndex]
                for (const key in currentChar) {
                    if (key !== "chats") {
                        $state.snapshot(currentChar[key])
                    }
                }
                // Track chats length and current chat only (not all chats) for performance
                const chats = currentChar.chats
                chats?.length
                const currentChatPage = currentChar.chatPage
                const currentChat = chats?.[currentChatPage]
                if (currentChat) {
                    // Exclude 'message' and 'modifiedAt' from tracking
                    // - message changes are handled by saveChat()
                    // - modifiedAt is updated by saveChat() and would cause infinite loop
                    for (const key in currentChat) {
                        if (key !== "message" && key !== "modifiedAt") {
                            $state.snapshot(currentChat[key])
                        }
                    }
                }
                // 변경된 캐릭터 ID 추적
                if (changeTracker.character[0] !== currentChar?.chaId) {
                    changeTracker.character.unshift(currentChar?.chaId)
                }
                // 변경된 채팅 ID 추적
                if (
                    changeTracker.chat[0]?.[0] !== currentChar?.chaId ||
                    changeTracker.chat[0]?.[1] !== currentChar?.chats[currentChar?.chatPage].id
                ) {
                    changeTracker.chat.unshift([currentChar?.chaId, currentChar?.chats[currentChar?.chatPage].id])
                }
            }

            const char = DBState.db.characters[charIndex]
            const chatPage = char?.chatPage
            // chatPage 변경 시 자동으로 preload
            if (char && chatPage !== undefined) {
                console.log("chatpage changed test")
            }

            saveTimeoutExecute()
        })
    })

    // ============================================================
    // Stage 3: 무한 저장 루프
    // ============================================================
    await sleep(1000)
    while (true) {
        // Stage 3-1: 변경 없거나 일시정지 상태면 대기
        if (!changed || saving.paused) {
            await sleep(500)
            continue
        }

        saving.state = true
        changed = false
        try {
            // Stage 3-2: encoder 재초기화 필요 시 처리
            if (requiresFullEncoderReload.state) {
                encoder = new RisuSaveEncoder()
                await encoder.init(getDatabase(), {
                    compression: forageStorage.isAccount,
                    excludeChats: shouldExcludeChats,
                    separateCharactersAndPresets: shouldSeparateCharactersAndPresets,
                })
                requiresFullEncoderReload.state = false
            }

            // Stage 3-3: changeTracker 복사 후 리셋
            const toSave = safeStructuredClone(changeTracker)

            // 다음 감지를 위해 현재 선택된 항목만 남기고 초기화
            // (사용자가 현재 보고 있는 항목은 계속 변경될 가능성이 높으므로 컨텍스트 유지)
            changeTracker.character = changeTracker.character.length === 0 ? [] : [changeTracker.character[0]]
            changeTracker.chat = changeTracker.chat.length === 0 ? [] : [changeTracker.chat[0]]
            changeTracker.botPreset = false
            changeTracker.modules = false

            // Stage 3-4: 다른 탭에서 저장 중이면 스킵
            if (tabSyncManager.isOtherTabSaving) {
                await sleep(1000)
                continue
            }
            tabSyncManager.notifySaving()

            // Stage 3-5: DB 유효성 검사
            const db = getDatabase()
            if (!db.characters) {
                await sleep(1000)
                continue
            }

            // Stage 3-6: 인코딩
            await encoder.set(db, toSave)
            const encoded = encoder.encode()
            if (!encoded) {
                await sleep(1000)
                continue
            }
            const dbData = new Uint8Array(encoded)

            // Stage 3-7: 백업 여부 결정
            const now = Date.now()
            const intervalMs = (db.dbBackupIntervalMinutes ?? 10) * 60 * 1000
            const shouldBackup = now - lastBackupTime >= intervalMs

            // Stage 3-8: 실제 파일 저장 (dbStorage로 위임)
            const result = await saveMainData({
                db,
                dbData,
                toSave,
                shouldExcludeChats,
                shouldSeparateCharactersAndPresets,
                shouldBackup,
                now,
            })

            if (result.backedUp) {
                lastBackupTime = now
                // 백업이 생성됐을 때만 오래된 백업 정리
                await getDbBackups()
            }

            // Stage 3-9: 후처리
            // Account mode delay
            if (forageStorage.isAccount) {
                await sleep(3000)
            }
            autoSaveErrorHandler.onSuccess()
            await saveDbKei()
            await sleep(500)
        } catch (error) {
            // Stage 3-10: 에러 처리
            const action = await autoSaveErrorHandler.onError(error)
            if (action === "completeFail") {
                // 완전 실패 시 더 긴 대기
                await sleep(5000)
            }
        }

        saving.state = false
    }
}
