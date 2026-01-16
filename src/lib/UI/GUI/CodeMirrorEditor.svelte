<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
    import { EditorView, basicSetup } from 'codemirror'
    import { ViewPlugin, Decoration, type DecorationSet, type ViewUpdate } from '@codemirror/view'
    import { markdown } from '@codemirror/lang-markdown'
    import { html } from '@codemirror/lang-html'
    import { EditorState, RangeSetBuilder } from '@codemirror/state'
    import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
    import { tags } from '@lezer/highlight'

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
                const parsed = parseCBS(text)

                parsed.sort((a, b) => a.from - b.from)

                for (const item of parsed) {
                    const level = item.level % cbsColors.length
                    if (item.type === 'bracket') {
                        builder.add(item.from, item.to, cbsBracketDecos[level])
                    } else {
                        builder.add(item.from, item.to, cbsContentDecos[level])
                    }
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
        },
        '&.cm-focused': {
            outline: 'none',
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
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
        },
        '.cm-placeholder': {
            color: 'var(--risu-textcolor2)',
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
    })

    // Highlight style
    const customHighlight = HighlightStyle.define([
        { tag: tags.heading1, color: '#ff79c6', fontWeight: 'bold', fontSize: '1.4em' },
        { tag: tags.heading2, color: '#ff79c6', fontWeight: 'bold', fontSize: '1.2em' },
        { tag: tags.heading3, color: '#ff79c6', fontWeight: 'bold' },
        { tag: tags.emphasis, color: '#f1fa8c', fontStyle: 'italic' },
        { tag: tags.strong, color: '#ffb86c', fontWeight: 'bold' },
        { tag: tags.link, color: '#8be9fd', textDecoration: 'underline' },
        { tag: tags.url, color: '#8be9fd' },
        { tag: tags.tagName, color: '#ff79c6' },
        { tag: tags.attributeName, color: '#50fa7b' },
        { tag: tags.attributeValue, color: '#f1fa8c' },
        { tag: tags.string, color: '#f1fa8c' },
        { tag: tags.comment, color: '#6272a4', fontStyle: 'italic' },
        { tag: tags.keyword, color: '#ff79c6' },
        { tag: tags.operator, color: '#ff79c6' },
        { tag: tags.punctuation, color: '#f8f8f2' },
    ])

    const getLangExtension = () => {
        switch (lang) {
            case 'markdown':
                return markdown()
            case 'html':
                return html()
            default:
                return []
        }
    }

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
            basicSetup,
            customTheme,
            syntaxHighlighting(customHighlight),
            getLangExtension(),
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
        if (view && !isInternalUpdate) {
            const currentValue = view.state.doc.toString()
            if (value !== currentValue) {
                view.dispatch({
                    changes: { from: 0, to: currentValue.length, insert: value }
                })
            }
        }
    })

    // Recreate editor when lang changes
    $effect(() => {
        if (view && lang) {
            createEditor()
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
