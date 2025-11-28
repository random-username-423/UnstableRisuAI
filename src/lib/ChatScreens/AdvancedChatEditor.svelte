<script>
    import { onMount, createEventDispatcher, onDestroy } from 'svelte';
    import { EditIcon, LanguagesIcon } from "lucide-svelte";

    import { DBState } from 'src/ts/stores.svelte';

    // CodeMirror 6 imports
    import { EditorView, lineNumbers, keymap, Decoration } from "@codemirror/view";
    import { EditorState, StateField, StateEffect } from "@codemirror/state";
    import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";

    /** @type {{value: any, translate: any}} */
    let { value = $bindable(), translate = $bindable() } = $props();

    const dispatch = createEventDispatcher();
    let toggleTranslate = $state(!DBState.db.useAutoTranslateInput);
    let velement = $state(), veditor = $state();
    let telement = $state(), teditor = $state();
    let _value = $state(value);
    let _translate = $state(translate);

    const markdowns = [
        {
            regex: /["""](.*?)(["""]|$)/gs,
            className: "ci-quote",
        },
        {
            regex: /`([^`]+)`/gs,
            className: "ci-backtick",
        },
        {
            regex: /\*\*\*([^*]+)(\*\*\*|$)/gs,
            className: "ci-asterisk3",
        },
        {
            regex: /(?<!\*)\*\*([^*]+)(\*\*(?!\*)|$)/gs,
            className: "ci-asterisk2",
        },
        {
            regex: /(?<!\*)\*([^*]+)(\*(?!\*)|$)/gs,
            className: "ci-asterisk1",
        },
    ];

    // StateEffect for updating decorations
    const setDecorations = StateEffect.define();

    // StateField to hold decorations
    const decorationsField = StateField.define({
        create() { return Decoration.none; },
        update(value, tr) {
            value = value.map(tr.changes);
            for (let effect of tr.effects) {
                if (effect.is(setDecorations)) {
                    value = effect.value;
                }
            }
            return value;
        },
        provide: f => EditorView.decorations.from(f)
    });

    function createDecorations(doc) {
        const text = doc.toString();
        const decorations = [];

        for (const markdown of markdowns) {
            // Reset regex lastIndex for global regex
            markdown.regex.lastIndex = 0;
            for (const match of text.matchAll(markdown.regex)) {
                const from = match.index;
                const to = match.index + match[0].length;
                if (from < to) {
                    decorations.push(
                        Decoration.mark({ class: markdown.className }).range(from, to)
                    );
                }
            }
        }

        // Sort by position (required by CM6)
        decorations.sort((a, b) => a.from - b.from || a.to - b.to);
        return Decoration.set(decorations);
    }

    // Custom theme to match original styling
    const editorTheme = EditorView.theme({
        "&": {
            minHeight: "2em",
            height: "auto",
            backgroundColor: "var(--risu-theme-bgcolor)",
            color: "#DD0"
        },
        "&.cm-focused": {
            backgroundColor: "var(--risu-theme-textcolor2)",
            outline: "none"
        },
        ".cm-gutters": {
            backgroundColor: "var(--risu-theme-selected)",
            borderLeftColor: "var(--risu-theme-borderc)",
            borderRight: "none"
        },
        ".cm-content": {
            caretColor: "#DD0"
        },
        ".cm-scroller": {
            overflow: "auto"
        }
    });

    function initEditor(element, initialValue, onChange) {
        const updateListener = EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                // Update decorations
                const decorations = createDecorations(update.state.doc);
                update.view.dispatch({
                    effects: setDecorations.of(decorations)
                });
                // Call onChange callback
                onChange(update.view);
            }
        });

        const state = EditorState.create({
            doc: initialValue ?? '',
            extensions: [
                lineNumbers(),
                history(),
                keymap.of([...defaultKeymap, ...historyKeymap]),
                decorationsField,
                updateListener,
                editorTheme,
                EditorView.lineWrapping
            ]
        });

        const view = new EditorView({
            state,
            parent: element
        });

        // Initial decoration
        const decorations = createDecorations(view.state.doc);
        view.dispatch({ effects: setDecorations.of(decorations) });

        return view;
    }

    // Helper to get value from editor
    function getValue(editor, lineSep = '\r\n') {
        if (!editor) return '';
        const text = editor.state.doc.toString();
        // Replace \n with custom line separator if needed
        return lineSep === '\n' ? text : text.replace(/\n/g, lineSep);
    }

    // Helper to set value in editor
    function setValue(editor, text) {
        if (!editor) return;
        const currentText = editor.state.doc.toString();
        if (currentText !== text) {
            editor.dispatch({
                changes: { from: 0, to: editor.state.doc.length, insert: text ?? '' }
            });
        }
    }

    onMount(() => {
        veditor = initEditor(velement, value, (view) => {
            if (!toggleTranslate) {
                const input = getValue(view);
                if (input !== value) {
                    value = _value = input;
                    dispatch('change', { translate: false, value: input });
                }
            }
        });

        teditor = initEditor(telement, translate, (view) => {
            if (toggleTranslate) {
                const input = getValue(view);
                if (input !== translate) {
                    translate = _translate = input;
                    dispatch('change', { translate: true, value: input });
                }
            }
        });

        toggleTranslateText();
    });

    onDestroy(() => {
        veditor?.destroy();
        teditor?.destroy();
    });

    $effect.pre(() => {
        if (value !== _value && veditor) {
            _value = value;
            setValue(veditor, value);
        }
    });
    $effect.pre(() => {
        if (translate !== _translate && teditor) {
            _translate = translate;
            setValue(teditor, translate);
        }
    });

    function toggleTranslateText() {
        toggleTranslate = !toggleTranslate;
        if (toggleTranslate) {
            velement.style.display = "none";
            telement.style.display = null;
            // CM6 doesn't need refresh, but requestMeasure ensures layout
            teditor?.requestMeasure();
        } else {
            velement.style.display = null;
            telement.style.display = "none";
            veditor?.requestMeasure();
        }
    }
</script>

<div class="flex flex-1 items-end ml-2 mr-2">
    {#if DBState.db.useAutoTranslateInput}
        <button
            onclick={toggleTranslateText}
            class="mr-2 bg-textcolor2 flex justify-center items-center text-gray-100 w-12 h-12 rounded-md hover:bg-green-500 transition-colors">
        {#if toggleTranslate}
            <LanguagesIcon />
        {:else}
            <EditIcon />
        {/if}
        </button>
    {/if}
    <div class="flex-1">
        <div class="chatEditor" bind:this={velement}></div>
        <div class="chatEditor" hidden bind:this={telement}></div>
    </div>
</div>
<style>
    .chatEditor {
        display: table;
        table-layout: fixed;
        width: 100%;
    }
    .chatEditor :global(.cm-editor) {
        min-height: 2em;
        height: auto;
    }
    .chatEditor :global(.ci-quote) {
        color: #FFF;
    }
    .chatEditor :global(.ci-backtick) {
        color: #6AC;
    }
    .chatEditor :global(.ci-asterisk3) {
        font-weight: bold;
        font-style: italic;
        color: #E22;
    }
    .chatEditor :global(.ci-asterisk2) {
        font-style: italic;
        color: #E84;
    }
    .chatEditor :global(.ci-asterisk1) {
        font-style: italic;
        color: #990;
    }
</style>
