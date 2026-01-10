import { Buffer as BufferPolyfill } from 'buffer'
import { polyfill as dragPolyfill } from "mobile-drag-drop"
import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour'
import rfdc from 'rfdc'
import { isIOS } from "./platform"
/**
 * Polyfill for structuredClone.
 * Falls back to rfdc (Really Fast Deep Clone) if structuredClone throws an error.
 */

const rfdcClone = rfdc({
  circles: false,
})
function safeStructuredClone<T>(data: T): T {
  try {
    return structuredClone(data)
  } catch {
    return rfdcClone(data)
  }
}

const shouldPolyfillDragDrop = () => {
  const testEl = document.createElement('div')
  const hasDnD =
    'draggable' in testEl && 'ondragstart' in testEl && 'ondrop' in testEl
  return !hasDnD || isIOS()
}

if (shouldPolyfillDragDrop()) {
  dragPolyfill({
    dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
      // holdToDrag: 400,
    forceApply: isIOS(),
  })
}

globalThis.safeStructuredClone = safeStructuredClone
globalThis.Buffer = BufferPolyfill