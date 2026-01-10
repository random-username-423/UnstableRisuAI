/**
 * Encodes a multilingual string object into a formatted string.
 *
 * The "xx" key is treated specially: it represents untagged text and is placed
 * at the beginning without a language header. Other keys become "# `langCode`" sections.
 *
 * @param data - Object with language codes as keys and translations as values.
 * @returns The encoded multilingual string.
 */
export function encodeMultilangString(data: Record<string, string>): string {
    let result = data.xx ?? ''
    for (const key in data) {
        if (key === 'xx') continue
        result += `\n# \`${key}\`\n${data[key]}`
    }
    return result
}

/**
 * Parses a formatted multilingual string into a language code object.
 *
 * Input format: Each language section starts with "# `langCode`" header followed by content.
 * Output format: Object with language codes as keys (e.g., "en", "ko") and their content as values.
 * The "xx" key contains any text that doesn't belong to a language section.
 *
 * @param data - The encoded multilingual string.
 * @returns Object with language codes as keys and translations as values.
 */
export function parseMultilangString(data: string): Record<string, string> {
    const regex = /# `(.+?)`\n([\s\S]+?)(?=\n# `|$)/g
    const matches = [...data.matchAll(regex)]
    return {
        ...Object.fromEntries(matches.map(m => [m[1], m[2]])),
        xx: data.replace(regex, '')
    }
}

/**
 * Converts a language code to its display name.
 * @param code - The ISO language code.
 * @returns The localized language name.
 */
export const toLangName = (code: string): string => {
    if (code === 'xx') {
        return 'Unknown Language'
    }

    try {
        return new Intl.DisplayNames([code, 'en'], { type: 'language' }).of(code) ?? code
    } catch {
        return code
    }
}

/**
 * Capitalizes the first character of a string.
 * @param s - The string to capitalize.
 * @returns The string with the first character capitalized.
 */
export const capitalize = (s:string) => {
    return s.charAt(0).toUpperCase() + s.slice(1)
}

export const languageCodes = ["af","ak","am","an","ar","as","ay","az","be","bg","bh","bm","bn","br","bs","ca","co","cs","cy","da","de","dv","ee","el","en","eo","es","et","eu","fa","fi","fo","fr","fy","ga","gd","gl","gn","gu","ha","he","hi","hr","ht","hu","hy","ia","id","ig","is","it","iu","ja","jv","ka","kk","km","kn","ko","ku","ky","la","lb","lg","ln","lo","lt","lv","mg","mi","mk","ml","mn","mr","ms","mt","my","nb","ne","nl","nn","no","ny","oc","om","or","pa","pl","ps","pt","qu","rm","ro","ru","rw","sa","sd","si","sk","sl","sm","sn","so","sq","sr","st","su","sv","sw","ta","te","tg","th","ti","tk","tl","tn","to","tr","ts","tt","tw","ug","uk","ur","uz","vi","wa","wo","xh","yi","yo","zh","zu"]

/**
 * Checks if the last character of a string is a punctuation mark.
 * @param s - The string to check.
 * @returns True if the last character is punctuation, false otherwise.
 */
export function isLastCharPunctuation(s:string){
    const lastChar = s.trim().at(-1)
    const punctuation = [
        '.', '!', '?', '。', '！', '？', '…', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '+', '=', '{', '}', '[', ']', '|', '\\', ':', ';', '<', '>', ',', '.', '/', '~', '`', ' ',
        '¡', '¿', '‽', '⁉', "'", '"'
    ]
    if(lastChar && !(punctuation.indexOf(lastChar) !== -1
        //spacing modifier letters
        || (lastChar.charCodeAt(0) >= 0x02B0 && lastChar.charCodeAt(0) <= 0x02FF)
        //combining diacritical marks
        || (lastChar.charCodeAt(0) >= 0x0300 && lastChar.charCodeAt(0) <= 0x036F)
        //hebrew punctuation
        || (lastChar.charCodeAt(0) >= 0x0590 && lastChar.charCodeAt(0) <= 0x05CF)
        //CJK symbols and punctuation
        || (lastChar.charCodeAt(0) >= 0x3000 && lastChar.charCodeAt(0) <= 0x303F)
    )){
        return false
    }
    return true
}

/**
 * Trims characters from the end of a string until a punctuation mark is reached.
 * @param s - The string to trim.
 * @returns The trimmed string ending with punctuation.
 */
export function trimUntilPunctuation(s:string){
    let result = s
    while(result.length > 0 && !isLastCharPunctuation(result)){
        result = result.slice(0, -1)
    }
    return result
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/**
 * Splits a string into an array of grapheme clusters.
 * @param str - The string to split.
 * @returns An array of grapheme clusters.
 */
export function toGraphemes(str: string): string[] {
    return [...graphemeSegmenter.segment(str)].map(s => s.segment)
}

/**
 * Generates a list of valid ISO 639-1 language codes with localized display names.
 * Iterates through all possible two-letter combinations (AA-ZZ),
 * uses the browser's Intl.DisplayNames API to filter only valid language codes,
 * and returns them with names displayed in the specified UI language.
 * @param uiLanguage - The UI language code to display language names in (e.g., 'en', 'ko', 'cn').
 * @returns An array of language objects sorted by localized name.
 */
export function getLanguageCodes(uiLanguage: string) {
    let languageCodes: {
        code: string;
        name: string;
    }[] = [];

    for (let i = 0x41; i <= 0x5A; i++) {
        for (let j = 0x41; j <= 0x5A; j++) {
            languageCodes.push({
                code: String.fromCharCode(i) + String.fromCharCode(j),
                name: ''
            });
        }
    }

    languageCodes = languageCodes.map(v => {
        return {
            code: v.code.toLocaleLowerCase(),
            name: new Intl.DisplayNames([
                uiLanguage === 'cn' ? 'zh' : uiLanguage
            ], {
                type: 'language',
                fallback: 'none'
            }).of(v.code) ?? ''
        };
    }).filter((a) => {
        return a.name;
    }).sort((a, b) => a.name.localeCompare(b.name));

    return languageCodes;
}
