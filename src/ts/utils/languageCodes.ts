/**
 * Generates a list of valid ISO 639-1 language codes with their display names.
 * @param displayLanguage - The language to display names in (e.g., 'en', 'ko')
 */
export function getLanguageCodes(displayLanguage: string) {
    let languageCodes: {
        code: string
        name: string
    }[] = []

    // Generate all 2-letter combinations (AA-ZZ)
    for (let i = 0x41; i <= 0x5a; i++) {
        for (let j = 0x41; j <= 0x5a; j++) {
            languageCodes.push({
                code: String.fromCharCode(i) + String.fromCharCode(j),
                name: ''
            })
        }
    }

    // Convert to lowercase and get display names, filtering out invalid codes
    languageCodes = languageCodes
        .map((v) => {
            return {
                code: v.code.toLocaleLowerCase(),
                name: new Intl.DisplayNames([displayLanguage === 'cn' ? 'zh' : displayLanguage], {
                    type: 'language',
                    fallback: 'none'
                }).of(v.code)
            }
        })
        .filter((a) => {
            return a.name
        })
        .sort((a, b) => a.name.localeCompare(b.name))

    return languageCodes
}
