import { ReadableStream, WritableStream, TransformStream } from "web-streams-polyfill";
import { Buffer as BufferPolyfill } from 'buffer'
import { polyfill as dragPolyfill} from "mobile-drag-drop"
import {scrollBehaviourDragImageTranslateOverride} from 'mobile-drag-drop/scroll-behaviour'
import rfdc from 'rfdc'
/**
 * Safe variant of structuredClone for svelte 5 states
 * if structuredClone is not available, it will use JSON.parse(JSON.stringify(data)) instead
*/

const rfdcClone = rfdc({
  circles:false,
})
function safeStructuredClone<T>(data:T):T{
  try {
      return structuredClone(data)
  } catch (error) {
      return rfdcClone(data)
  }
}

try {
    const testDom = document.createElement('div');
    const supports  = ('draggable' in testDom) || ('ondragstart' in testDom && 'ondrop' in testDom);
    const isIos = navigator.userAgent ? (!!navigator.userAgent.match('iPhone OS') || !!navigator.userAgent.match('iPad')) : false
    testDom.remove()
    
    if((!supports) || isIos){
      globalThis.polyfilledDragDrop = true
      dragPolyfill({
        // use this to make use of the scroll behaviour
        dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
        // holdToDrag: 400,
        forceApply: true
      });
    }
} catch { /* ignore - mobile DnD not supported */ }

globalThis.safeStructuredClone = safeStructuredClone

globalThis.Buffer = BufferPolyfill
const globalWithStreams = globalThis as any
globalWithStreams.WritableStream = globalWithStreams.WritableStream ?? WritableStream
globalWithStreams.ReadableStream = globalWithStreams.ReadableStream ?? ReadableStream
globalWithStreams.TransformStream = globalWithStreams.TransformStream ?? TransformStream
