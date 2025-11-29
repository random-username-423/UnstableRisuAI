import "./ts/polyfill";
import "core-js/actual"

// Note: "Access to storage is not allowed" errors during startup are normal.
// This happens because multiple modules try to access IndexedDB simultaneously.
// LocalForage retries automatically, so the app works fine despite these errors.
console.info('[RisuAI] Initializing...')

import "./ts/storage/database.svelte"
import {declareTest} from "./test/runTest"
import App from "./App.svelte";
import { loadData } from "./ts/init";
import { initHotkey } from "./ts/hotkey/hotkey";
import { preLoadCheck } from "./preload";
import { mount } from "svelte";

preLoadCheck()
let app = mount(App, {
    target: document.getElementById("app"),
});
loadData()
initHotkey()
declareTest()
document.getElementById('preloading').remove()

export default app;