import { writable } from "svelte/store";
import { getDatabase } from "../data/storage/database.svelte";

export const textAreaSize = writable(0)
export const sideBarSize = writable(0)
export const textAreaTextSize = writable(0)

export function updateGuisize(){
    const db = getDatabase()
    const root = document.querySelector(':root') as HTMLElement;
    if(!root){
        return
    }
    textAreaSize.set(db.textAreaSize)
    sideBarSize.set(db.sideBarSize)
    textAreaTextSize.set(db.textAreaTextSize)
    root.style.setProperty('--sidebar-size', (24 + (4 * db.sideBarSize)) + 'rem')
}

export function guiSizeText(num:number){
    switch(num){
        case 0:
            return 'Default'
        case 1:
            return 'Big'
        case 2:
            return 'Bigger'
        case 3:
            return 'Huge'
        case 4:
            return 'Huger'
        case 5:
            return 'Hugest'
        case -1:
            return 'Small'
        case -2:
            return 'Smaller'
        case -3:
            return 'Tiny'
        case -4:
            return 'Tinier'
        case -5:
            return 'Tiniest'
        default:
            return 'Default'
    }
}

/**
 * Updates the height mode of the document based on the value stored in the database.
 *
 * The height mode can be one of the following values: 'auto', 'vh', 'dvh', 'lvh', 'svh', or 'percent'.
 * The corresponding CSS variable '--risu-height-size' is set accordingly.
 */
export function updateHeightMode(){
    const db = getDatabase()
    const root = document.querySelector(':root') as HTMLElement;
    switch(db.heightMode){
        case 'auto':
            root.style.setProperty('--risu-height-size', '100%');
            break
        case 'vh':
            root.style.setProperty('--risu-height-size', '100vh');
            break
        case 'dvh':
            root.style.setProperty('--risu-height-size', '100dvh');
            break
        case 'lvh':
            root.style.setProperty('--risu-height-size', '100lvh');
            break
        case 'svh':
            root.style.setProperty('--risu-height-size', '100svh');
            break
        case 'percent':
            root.style.setProperty('--risu-height-size', '100%');
            break
    }
}