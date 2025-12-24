export interface loreBook {
    key: string
    secondkey: string
    insertorder: number
    comment: string
    content: string
    mode: "multiple" | "constant" | "normal" | "child" | "folder"
    alwaysActive: boolean
    selective: boolean
    extentions?: {
        risu_case_sensitive: boolean
    }
    activationPercent?: number
    loreCache?: {
        key: string
        data: string[]
    }
    useRegex?: boolean
    bookVersion?: number
    id?: string
    folder?: string
}

export interface loreSettings {
    tokenBudget: number
    scanDepth: number
    recursiveScanning: boolean
    fullWordMatching?: boolean
}
