import { v4 } from "uuid"
import { alertNormalWait } from "../../utils/alert.svelte"
import { language } from "src/lang"

/**
 * 탭 간 저장 동기화 관리자
 * BroadcastChannel을 사용하여 여러 탭에서 동시 저장을 방지합니다.
 */
class TabSyncManager {
    private channel: BroadcastChannel | null = null
    private sessionID: string
    private _isOtherTabSaving: boolean = false

    constructor() {
        this.sessionID = v4()
    }

    /**
     * 탭 동기화 초기화
     * 다른 탭에서 저장 시 알림을 표시하고 페이지를 새로고침합니다.
     */
    init(): void {
        if (!window.BroadcastChannel) {
            return
        }

        this.channel = new BroadcastChannel("risu-db")
        this.channel.onmessage = async (ev) => {
            // 자신의 메시지는 무시
            if (ev.data === this.sessionID) {
                return
            }
            // 다른 탭에서 저장 감지
            if (!this._isOtherTabSaving) {
                this._isOtherTabSaving = true
                alertNormalWait(language.activeTabChange).then(() => {
                    location.reload()
                })
            }
        }
    }

    /**
     * 다른 탭에서 저장 중인지 확인
     */
    get isOtherTabSaving(): boolean {
        return this._isOtherTabSaving
    }

    /**
     * 다른 탭에 저장 시작을 알림
     */
    notifySaving(): void {
        if (this.channel) {
            this.channel.postMessage(this.sessionID)
        }
    }

    /**
     * 채널 정리
     */
    destroy(): void {
        if (this.channel) {
            this.channel.close()
            this.channel = null
        }
    }
}

export const tabSyncManager = new TabSyncManager()
