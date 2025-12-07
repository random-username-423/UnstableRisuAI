import { alertConfirm } from "../../utils/alert"

/**
 * AutoSave 에러 처리 전담 클래스
 * 저장 실패 횟수를 추적하고, 임계치 도달 시 사용자에게 알림
 */
class AutoSaveErrorHandler {
    private failureCount = 0
    private readonly ALERT_THRESHOLD = 5

    /**
     * 저장 성공 시 호출: 실패 카운트 초기화
     */
    onSuccess() {
        if (this.failureCount > 0) {
            console.log("AutoSave recovered from failures.")
            this.failureCount = 0
        }
    }

    /**
     * 에러 발생 시 호출: 로깅 및 사용자 알림 결정
     * @returns 'retry' - 재시도, 'completeFail' - 완전 실패 (더 긴 대기)
     */
    async onError(error: unknown): Promise<'retry' | 'completeFail'> {
        this.failureCount++
        console.error(`AutoSave failed (${this.failureCount}/${this.ALERT_THRESHOLD}):`, error)

        if (this.failureCount >= this.ALERT_THRESHOLD) {
            const msg = error instanceof Error ? error.message : String(error)
            await alertConfirm(`DBSaveError: ${msg}. Please report to the developer.`)
            return 'completeFail'
        }
        return 'retry'
    }
}

export const autoSaveErrorHandler = new AutoSaveErrorHandler()
