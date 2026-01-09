import "./ts/polyfill";
import "core-js/actual"
import "./ts/storage/database.svelte"
import App from "./App.svelte";
import { loadData } from "./ts/bootstrap.svelte";
import { initHotkey } from "./ts/hotkey.svelte";
import { preLoadCheck } from "./preload";
import { mount } from "svelte";

preLoadCheck()
const app = mount(App, {
    target: document.getElementById("app"),
});
loadData()
initHotkey()
document.getElementById('preloading').remove()

export default app;