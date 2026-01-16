<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
    import { minimalSetup } from 'codemirror'
    import { EditorView, ViewPlugin, Decoration, type DecorationSet, type ViewUpdate } from '@codemirror/view'
    import { EditorState, RangeSetBuilder } from '@codemirror/state'
    import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'

    interface Props {
        value?: string
        lang?: 'markdown' | 'html' | 'plain'
        placeholder?: string
        class?: string
        onchange?: (value: string) => void
    }

    let {
        value = $bindable(''),
        lang = 'markdown',
        placeholder = '',
        class: className = '',
        onchange
    }: Props = $props()

    let editorEl: HTMLDivElement
    let view: EditorView | null = null
    let isInternalUpdate = false

    // CBS nesting level colors
    const cbsColors = [
        '#8be9fd', // level 0 - cyan
        '#50fa7b', // level 1 - green
        '#ffb86c', // level 2 - orange
        '#ff79c6', // level 3 - pink
        '#bd93f9', // level 4 - purple
    ]

    // CBS highlighting decoration classes
    const cbsBracketDecos = cbsColors.map((_, i) =>
        Decoration.mark({ class: `cm-cbs-bracket-${i}` })
    )
    const cbsContentDecos = cbsColors.map((_, i) =>
        Decoration.mark({ class: `cm-cbs-content-${i}` })
    )

    // CBS parsing
    function parseCBS(text: string): { from: number; to: number; type: 'bracket' | 'content'; level: number }[] {
        const results: { from: number; to: number; type: 'bracket' | 'content'; level: number }[] = []
        let depth = 0
        let i = 0
        const stack: number[] = []

        while (i < text.length) {
            if (text[i] === '{' && text[i + 1] === '{') {
                results.push({ from: i, to: i + 2, type: 'bracket', level: depth })
                stack.push(i + 2)
                depth++
                i += 2
            } else if (text[i] === '}' && text[i + 1] === '}' && depth > 0) {
                depth--
                const contentStart = stack.pop()!
                if (i > contentStart) {
                    results.push({ from: contentStart, to: i, type: 'content', level: depth })
                }
                results.push({ from: i, to: i + 2, type: 'bracket', level: depth })
                i += 2
            } else {
                i++
            }
        }

        return results
    }

    // Markdown decoration classes
    const mdHeading1Deco = Decoration.mark({ class: 'cm-md-h1' })
    const mdHeading2Deco = Decoration.mark({ class: 'cm-md-h2' })
    const mdHeading3Deco = Decoration.mark({ class: 'cm-md-h3' })
    const mdHeadingDeco = Decoration.mark({ class: 'cm-md-heading' }) // h4-h6
    const mdBoldDeco = Decoration.mark({ class: 'cm-md-bold' })
    const mdItalicDeco = Decoration.mark({ class: 'cm-md-italic' })
    const mdBoldItalicDeco = Decoration.mark({ class: 'cm-md-bold-italic' })
    const mdStrikeDeco = Decoration.mark({ class: 'cm-md-strike' })
    const mdCodeDeco = Decoration.mark({ class: 'cm-md-code' })
    const xmlTagDeco = Decoration.mark({ class: 'cm-xml-tag' })

    // Markdown parsing (regex-based for universal highlighting)
    type MarkdownMatch = { from: number; to: number; type: 'h1' | 'h2' | 'h3' | 'heading' | 'bold' | 'italic' | 'bolditalic' | 'strike' | 'code' | 'xmltag' }

    function parseMarkdown(text: string): MarkdownMatch[] {
        const results: MarkdownMatch[] = []

        // Headings: # at line start (up to 6 levels)
        const headingRegex = /^(#{1,6})\s+.+$/gm
        let match
        while ((match = headingRegex.exec(text)) !== null) {
            const level = match[1].length
            let type: 'h1' | 'h2' | 'h3' | 'heading' = 'heading'
            if (level === 1) type = 'h1'
            else if (level === 2) type = 'h2'
            else if (level === 3) type = 'h3'
            results.push({ from: match.index, to: match.index + match[0].length, type })
        }

        // Bold+Italic: ***text*** or ___text___
        const boldItalicRegex = /(\*\*\*|___)(?!\s)([^\*_]+?)(?<!\s)\1/g
        while ((match = boldItalicRegex.exec(text)) !== null) {
            results.push({ from: match.index, to: match.index + match[0].length, type: 'bolditalic' })
        }

        // Bold: **text** or __text__ (but not ***)
        const boldRegex = /(?<!\*)(\*\*)(?!\*)(?!\s)([^\*]+?)(?<!\s)(?<!\*)\1(?!\*)|(?<!_)(__)(?!_)(?!\s)([^_]+?)(?<!\s)(?<!_)\1(?!_)/g
        while ((match = boldRegex.exec(text)) !== null) {
            results.push({ from: match.index, to: match.index + match[0].length, type: 'bold' })
        }

        // Italic: *text* or _text_ (but not ** or __)
        const italicRegex = /(?<!\*)(\*)(?!\*)(?!\s)([^\*]+?)(?<!\s)(?<!\*)\1(?!\*)|(?<!_)(_)(?!_)(?!\s)([^_]+?)(?<!\s)(?<!_)\1(?!_)/g
        while ((match = italicRegex.exec(text)) !== null) {
            results.push({ from: match.index, to: match.index + match[0].length, type: 'italic' })
        }

        // Strikethrough: ~~text~~
        const strikeRegex = /~~(?!\s)(.+?)(?<!\s)~~/g
        while ((match = strikeRegex.exec(text)) !== null) {
            results.push({ from: match.index, to: match.index + match[0].length, type: 'strike' })
        }

        // Inline code: `code`
        const codeRegex = /`([^`\n]+)`/g
        while ((match = codeRegex.exec(text)) !== null) {
            results.push({ from: match.index, to: match.index + match[0].length, type: 'code' })
        }

        // XML/HTML tags: <tag>, </tag>, <tag />, <tag attr="value">
        const xmlTagRegex = /<\/?[a-zA-Z_][\w\-]*(?:\s+[^>]*)?\s*\/?>/g
        while ((match = xmlTagRegex.exec(text)) !== null) {
            results.push({ from: match.index, to: match.index + match[0].length, type: 'xmltag' })
        }

        return results
    }

    // CBS autocompletion
    const cbsCompletions = [
        // Basic variables
        { label: 'char', detail: 'Character name' },
        { label: 'user', detail: 'User name' },
        { label: 'persona', detail: 'Persona description' },
        { label: 'main_char', detail: 'Main character name' },
        // Control flow
        { label: '#if ', detail: 'Conditional block start' },
        { label: '/if', detail: 'Conditional block end' },
        { label: '#each ', detail: 'Loop block start' },
        { label: '/each', detail: 'Loop block end' },
        { label: 'else', detail: 'Else clause' },
        // Variables
        { label: 'getvar::', detail: 'Get variable value' },
        { label: 'setvar::', detail: 'Set variable value' },
        { label: 'addvar::', detail: 'Add to variable' },
        { label: 'getglobalvar::', detail: 'Get global variable' },
        { label: 'setglobalvar::', detail: 'Set global variable' },
        // Utility
        { label: 'random::', detail: 'Random number' },
        { label: 'pick::', detail: 'Pick random item' },
        { label: 'roll::', detail: 'Dice roll' },
        { label: 'idle::', detail: 'Idle time check' },
        { label: 'equal::', detail: 'Equality check' },
        { label: 'greater::', detail: 'Greater than check' },
        { label: 'less::', detail: 'Less than check' },
        // Special
        { label: 'none', detail: 'No output' },
        { label: 'newline', detail: 'Line break' },
        { label: 'time', detail: 'Current time' },
        { label: 'date', detail: 'Current date' },
    ]

    function cbsCompletionSource(context: CompletionContext): CompletionResult | null {
        // Find {{ before cursor
        const line = context.state.doc.lineAt(context.pos)
        const textBefore = line.text.slice(0, context.pos - line.from)

        // Check for {{ pattern
        const match = textBefore.match(/\{\{([a-zA-Z_#\/]*)$/)
        if (!match) return null

        const from = context.pos - match[1].length
        const typed = match[1].toLowerCase()

        return {
            from,
            options: cbsCompletions
                .filter(c => c.label.toLowerCase().startsWith(typed))
                .map(c => ({
                    label: c.label,
                    detail: c.detail,
                    type: c.label.startsWith('#') || c.label.startsWith('/') ? 'keyword' : 'variable'
                }))
        }
    }

    // CBS ViewPlugin
    const cbsHighlighter = ViewPlugin.fromClass(
        class {
            decorations: DecorationSet

            constructor(view: EditorView) {
                this.decorations = this.buildDecorations(view)
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged) {
                    this.decorations = this.buildDecorations(update.view)
                }
            }

            buildDecorations(view: EditorView): DecorationSet {
                const builder = new RangeSetBuilder<Decoration>()
                const text = view.state.doc.toString()

                // Collect all decorations
                type DecoItem = { from: number; to: number; deco: Decoration; priority: number }
                const decos: DecoItem[] = []

                // CBS decorations (highest priority)
                const cbsParsed = parseCBS(text)
                for (const item of cbsParsed) {
                    const level = item.level % cbsColors.length
                    if (item.type === 'bracket') {
                        decos.push({ from: item.from, to: item.to, deco: cbsBracketDecos[level], priority: 2 })
                    } else {
                        decos.push({ from: item.from, to: item.to, deco: cbsContentDecos[level], priority: 2 })
                    }
                }

                // Markdown decorations (lower priority than CBS)
                const mdParsed = parseMarkdown(text)
                for (const item of mdParsed) {
                    let deco: Decoration
                    switch (item.type) {
                        case 'h1': deco = mdHeading1Deco; break
                        case 'h2': deco = mdHeading2Deco; break
                        case 'h3': deco = mdHeading3Deco; break
                        case 'heading': deco = mdHeadingDeco; break
                        case 'bold': deco = mdBoldDeco; break
                        case 'italic': deco = mdItalicDeco; break
                        case 'bolditalic': deco = mdBoldItalicDeco; break
                        case 'strike': deco = mdStrikeDeco; break
                        case 'code': deco = mdCodeDeco; break
                        case 'xmltag': deco = xmlTagDeco; break
                    }
                    decos.push({ from: item.from, to: item.to, deco, priority: 1 })
                }

                // Sort by position (required by RangeSetBuilder)
                decos.sort((a, b) => a.from - b.from || b.priority - a.priority)

                for (const item of decos) {
                    builder.add(item.from, item.to, item.deco)
                }

                return builder.finish()
            }
        },
        {
            decorations: (v) => v.decorations,
        }
    )

    // Theme
    const customTheme = EditorView.theme({
        '&': {
            backgroundColor: 'var(--risu-darkbg)',
            color: 'var(--risu-textcolor)',
            fontSize: '14px',
            borderRadius: '0.375rem',
            height: '100%',
        },
        '&.cm-focused': {
            outline: 'none',
        },
        '.cm-scroller': {
            overflow: 'auto',
            height: '100%',
        },
        '.cm-content': {
            caretColor: 'var(--risu-textcolor)',
            fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
            padding: '8px',
        },
        '.cm-cursor': {
            borderLeftColor: 'var(--risu-textcolor)',
        },
        '.cm-selectionBackground, ::selection': {
            backgroundColor: 'rgba(255, 255, 255, 0.2) !important',
        },
        '.cm-gutters': {
            display: 'none',
        },
        '.cm-activeLine': {
            backgroundColor: 'transparent',
        },
        '.cm-placeholder': {
            color: 'var(--risu-textcolor2)',
        },
        // Autocomplete dropdown styles
        '.cm-tooltip': {
            backgroundColor: 'var(--risu-bgcolor)',
            border: '1px solid var(--risu-borderc)',
            borderRadius: '0.375rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        },
        '.cm-tooltip-autocomplete': {
            '& > ul': {
                fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
                fontSize: '13px',
            },
            '& > ul > li': {
                padding: '4px 8px',
                color: 'var(--risu-textcolor)',
            },
            '& > ul > li[aria-selected]': {
                backgroundColor: 'var(--risu-selected)',
                color: 'var(--risu-textcolor)',
            },
        },
        '.cm-completionLabel': {
            color: 'var(--risu-textcolor)',
        },
        '.cm-completionDetail': {
            color: 'var(--risu-textcolor2)',
            marginLeft: '8px',
            fontStyle: 'italic',
        },
        '.cm-completionIcon': {
            opacity: 0.7,
        },
        // CBS styles
        '.cm-cbs-bracket-0': { color: '#8be9fd', fontWeight: 'bold' },
        '.cm-cbs-bracket-1': { color: '#50fa7b', fontWeight: 'bold' },
        '.cm-cbs-bracket-2': { color: '#ffb86c', fontWeight: 'bold' },
        '.cm-cbs-bracket-3': { color: '#ff79c6', fontWeight: 'bold' },
        '.cm-cbs-bracket-4': { color: '#bd93f9', fontWeight: 'bold' },
        '.cm-cbs-content-0': { color: '#8be9fd' },
        '.cm-cbs-content-1': { color: '#50fa7b' },
        '.cm-cbs-content-2': { color: '#ffb86c' },
        '.cm-cbs-content-3': { color: '#ff79c6' },
        '.cm-cbs-content-4': { color: '#bd93f9' },
        // Markdown styles (regex-based)
        '.cm-md-h1': { color: '#ffd700', fontWeight: 'bold', fontSize: '1.4em' },
        '.cm-md-h2': { color: '#ffd700', fontWeight: 'bold', fontSize: '1.2em' },
        '.cm-md-h3': { color: '#ffd700', fontWeight: 'bold', fontSize: '1.1em' },
        '.cm-md-heading': { color: '#ffd700', fontWeight: 'bold' }, // h4-h6
        '.cm-md-bold': { color: '#ffb86c', fontWeight: 'bold' },
        '.cm-md-italic': { color: '#f1fa8c', fontStyle: 'italic' },
        '.cm-md-bold-italic': { color: '#ffb86c', fontWeight: 'bold', fontStyle: 'italic' },
        '.cm-md-strike': { color: '#6272a4', textDecoration: 'line-through' },
        '.cm-md-code': { color: '#50fa7b', backgroundColor: 'rgba(80, 250, 123, 0.1)' },
        // XML tag styles
        '.cm-xml-tag': { color: '#ff79c6' },
    })

    // Value change listener
    const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
            isInternalUpdate = true
            value = update.state.doc.toString()
            onchange?.(value)
            isInternalUpdate = false
        }
    })

    const createEditor = () => {
        if (view) {
            view.destroy()
        }

        const extensions = [
            minimalSetup,
            autocompletion({
                override: [cbsCompletionSource],
                activateOnTyping: true,
            }),
            customTheme,
            cbsHighlighter,
            EditorView.lineWrapping,
            updateListener,
            placeholder ? EditorView.contentAttributes.of({ 'aria-placeholder': placeholder }) : [],
        ]

        view = new EditorView({
            state: EditorState.create({
                doc: value,
                extensions,
            }),
            parent: editorEl,
        })
    }

    // Update editor when value changes externally
    $effect(() => {
        // Track value explicitly
        const newValue = value

        if (view && !isInternalUpdate) {
            const currentValue = view.state.doc.toString()
            if (newValue !== currentValue) {
                view.dispatch({
                    changes: { from: 0, to: currentValue.length, insert: newValue }
                })
            }
        }
    })

    onMount(() => {
        createEditor()
    })

    onDestroy(() => {
        if (view) {
            view.destroy()
        }
    })
</script>

<div
    bind:this={editorEl}
    class="w-full border border-selected rounded-md overflow-hidden {className}"
></div>
