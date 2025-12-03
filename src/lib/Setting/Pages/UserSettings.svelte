<script lang="ts">
    import { language } from "src/lang";
    import { hubURL } from "src/ts/character/characterCards";
    import { loadRisuAccountBackup, loadRisuAccountData, saveRisuAccountData } from "src/ts/data/drive/accounter";

    import { DBState } from 'src/ts/stores.svelte';
    import Check from "src/lib/UI/GUI/CheckInput.svelte";
    import { alertConfirm, alertError, alertInput, alertNormal } from "src/ts/alert";
    import { forageStorage, loadInternalBackup, openURL } from "src/ts/globalApi.svelte";
    import { isNodeServer } from "src/ts/env";
    import { isTauri } from "src/ts/env";
    import { unMigrationAccount } from "src/ts/data/storage/accountStorage";
    import { checkDriver } from "src/ts/data/drive/drive";
    import { LoadLocalBackup, SaveLocalBackup } from "src/ts/data/drive/backuplocal";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import { exportAsDataset } from "src/ts/data/storage/exportAsDataset";
    import { syncManager } from "src/ts/data/drive/syncManager";
    import { onMount, onDestroy } from "svelte";
    import { RefreshCwIcon, CloudIcon, UploadIcon, DownloadIcon } from "lucide-svelte";
    import Help from "src/lib/Others/Help.svelte";
    import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "src/ts/config/secrets";

    // Google Auth Plugin (Tauri only)
    let googleAuth: typeof import('@choochmeque/tauri-plugin-google-auth-api') | null = null;
    if (isTauri) {
        import('@choochmeque/tauri-plugin-google-auth-api').then(m => {
            googleAuth = m;
        });
    }

    let openIframe = $state(false)
    let openIframeURL = $state('')
    let popup:Window = null

    // Sync status
    type SyncStatus = 'idle' | 'syncing' | 'error' | 'conflict';
    let syncStatus = $state<SyncStatus>('idle');
    let unsubscribe: (() => void) | null = null;

    function formatDate(timestamp: number | undefined): string {
        if (!timestamp) return language.syncNever || 'Never';
        return new Date(timestamp).toLocaleString();
    }

    function getStatusText(status: SyncStatus): string {
        switch (status) {
            case 'idle': return language.syncStatusIdle || 'Idle';
            case 'syncing': return language.syncStatusSyncing || 'Syncing...';
            case 'error': return language.syncStatusError || 'Error';
            case 'conflict': return language.syncStatusConflict || 'Conflict Detected';
        }
    }

    function getStatusColor(status: SyncStatus): string {
        switch (status) {
            case 'idle': return 'text-green-500';
            case 'syncing': return 'text-yellow-500';
            case 'error': return 'text-red-500';
            case 'conflict': return 'text-orange-500';
        }
    }

    async function startSync() {
        try {
            if (isTauri && googleAuth) {
                // Use Tauri plugin for native OAuth
                const response = await googleAuth.signIn({
                    clientId: GOOGLE_CLIENT_ID,
                    clientSecret: GOOGLE_CLIENT_SECRET,
                    scopes: ['https://www.googleapis.com/auth/drive.appdata'],
                });

                if (response.accessToken) {
                    // expiresAt is Unix timestamp in seconds, convert to duration
                    const expiresIn = response.expiresAt
                        ? response.expiresAt - Math.floor(Date.now() / 1000)
                        : undefined;
                    syncManager.setTokens(
                        response.accessToken,
                        response.refreshToken,
                        expiresIn
                    );
                    syncManager.enable();
                    alertNormal(language.syncConnected || 'Connected! Sync started.');
                    // Trigger initial sync
                    syncManager.doInitialSync();
                } else {
                    alertError('No access token received');
                }
            } else {
                // Fallback for web: use existing OAuth flow
                const CLIENT_ID = '580075990041-l26k2d3c0nemmqiu3d3aag01npfrkn76.apps.googleusercontent.com';
                const REDIRECT_URI = 'https://risuai.xyz/';
                const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
                const authorizationUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPE)}&response_type=code&state=synctauri`;

                window.open(authorizationUrl);

                let code = await alertInput(language.pasteAuthCode);
                if (!code) return;

                if (code.includes(' ')) {
                    code = code.substring(code.lastIndexOf(' ')).trim();
                }

                // Exchange code for token
                const res = await fetch(`/drive?code=${encodeURIComponent(code)}`);
                if (res.ok) {
                    const json = await res.json();
                    syncManager.setTokens(json.access_token);
                    syncManager.enable();
                    alertNormal(language.syncConnected || 'Connected! Sync started.');
                    // Trigger initial sync
                    syncManager.doInitialSync();
                } else {
                    alertError(await res.text());
                }
            }
        } catch (e) {
            console.error(e);
            if (e?.toString().includes('USER_CANCELLED')) {
                // User cancelled, do nothing
                return;
            }
            alertError(`Connection failed: ${e}`);
        }
    }

    async function stopSync() {
        try {
            if (isTauri && googleAuth) {
                // signOut() without accessToken = local sign-out only (no server call)
                await googleAuth.signOut();
            }
        } catch (e) {
            console.error('Error during signOut:', e);
        }
        syncManager.disable();
        syncManager.clearTokens();
        alertNormal(language.syncDisconnected || 'Sync stopped.');
    }

    async function manualUpload() {
        if (!syncManager.hasAccessToken()) {
            alertError(language.syncNoToken || 'Not connected to Google Drive');
            return;
        }
        if (await alertConfirm(language.syncUploadConfirm || 'Upload local data to Google Drive?')) {
            await syncManager.forceSync('upload');
        }
    }

    async function manualDownload() {
        if (!syncManager.hasAccessToken()) {
            alertError(language.syncNoToken || 'Not connected to Google Drive');
            return;
        }
        if (await alertConfirm(language.syncDownloadConfirm || 'Download data from Google Drive?')) {
            await syncManager.forceSync('download');
        }
    }

    onMount(() => {
        syncStatus = syncManager.getStatus();
        unsubscribe = syncManager.onStatusChange((status) => {
            syncStatus = status;
        });
    });

    onDestroy(() => {
        if (unsubscribe) {
            unsubscribe();
        }
    });
</script>

<svelte:window onmessage={async (e) => {
    if(e.origin.startsWith("https://sv.risuai.xyz") || e.origin.startsWith("http://127.0.0.1") || e.origin === window.location.origin){
        if(e.data.msg?.type === 'drive'){
            await loadRisuAccountData()
            DBState.db.account.data.refresh_token = e.data.msg.data.refresh_token
            DBState.db.account.data.access_token = e.data.msg.data.access_token
            DBState.db.account.data.expires_in = (e.data.msg.data.expires_in * 700) + Date.now()
            await saveRisuAccountData()
            popup.close()
        }
        else if(e.data.msg?.data.vaild){
            openIframe = false
            DBState.db.account = {
                id: e.data.msg.id,
                token: e.data.msg.token,
                data: e.data.msg.data
            }
        }
    }
}}></svelte:window>


<h2 class="mb-2 text-2xl font-bold mt-2">{language.account} & {language.files}</h2>

<Button
    onclick={async () => {
        if(await alertConfirm(language.backupConfirm)){
            SaveLocalBackup()
        }
    }} className="mt-2">
    {language.saveBackupLocal}
</Button>

<Button
    onclick={async () => {
        if((await alertConfirm(language.backupLoadConfirm)) && (await alertConfirm(language.backupLoadConfirm2))){
            LoadLocalBackup()
        }
    }} className="mt-2">
    {language.loadBackupLocal}
</Button>

{#if !DBState.db.account}
    <Button
        onclick={async () => {
            if((await alertConfirm(language.backupLoadConfirm)) && (await alertConfirm(language.backupLoadConfirm2))){
                loadInternalBackup()
            }
        }} className="mt-2">
        {language.loadInternalBackup}
    </Button>
{:else}
    <Button
        onclick={async () => {
            loadRisuAccountBackup()
        }} className="mt-2">
        {language.loadAutoServerBackup}
    </Button>
{/if}

<Button
    onclick={async () => {
        if(await alertConfirm(language.backupConfirm)){
            localStorage.setItem('backup', 'save')
            
            if(isTauri || isNodeServer){
                checkDriver('savetauri')
            }
            else{
                checkDriver('save')
            }
        }
    }} className="mt-2">
    {language.savebackup}
</Button>

<Button
    onclick={async () => {
        if((await alertConfirm(language.backupLoadConfirm)) && (await alertConfirm(language.backupLoadConfirm2))){
            localStorage.setItem('backup', 'load')
            if(isTauri || isNodeServer){
                checkDriver('loadtauri')
            }
            else{
                checkDriver('load')
            }
        }
    }}
    className="mt-2">
    {language.loadbackup}
</Button>

<Button onclick={exportAsDataset} className="mt-2">
    {language.exportAsDataset}
</Button>
<div class="bg-darkbg p-3 rounded-md mb-2 flex flex-col items-start mt-2">
    <div class="w-full">
        <h1 class="text-3xl font-black min-w-0">Risu Account{#if DBState.db.account}
            <button class="bg-selected p-1 text-sm font-light rounded-md hover:bg-green-500 transition-colors float-right" onclick={async () => {
                if(DBState.db.account.useSync || forageStorage.isAccount){
                    unMigrationAccount()
                }
                
                DBState.db.account = undefined
            }}>{language.logout}</button>
        {/if}</h1>
    </div>
    {#if DBState.db.account}
        <span class="mb-4 text-textcolor2">ID: {DBState.db.account.id}</span>
        {#if !isTauri}
            <div class="flex items-center mt-2">
                {#if DBState.db.account.useSync || forageStorage.isAccount}
                    <Check check={true} name={language.SaveDataInAccount} onChange={(v) => {
                        if(v){
                            unMigrationAccount()
                        }
                    }}/>
                {:else}
                    <Check check={false} name={language.SaveDataInAccount} onChange={(v) => {
                        if(v){
                            localStorage.setItem('dosync', 'sync')
                            location.reload()
                        }
                    }}/>
                {/if}
            </div>
        {/if}
    {:else}
        <span>{language.notLoggedIn}</span>
        <button class="bg-selected p-2 rounded-md mt-2 hover:bg-green-500 transition-colors" onclick={() => {
            openIframeURL = hubURL + '/hub/login'
            openIframe = true
        }}>
            Login
        </button>
    {/if}
    <!-- <Button onclick={autoServerBackup}>Auto Server Backups</Button> -->

</div>
{#if openIframe}
    <div class="fixed top-0 left-0 bg-black bg-opacity-50 w-full h-full flex justify-center items-center">
        <iframe src={openIframeURL} title="login" class="w-full h-full">
        </iframe>
    </div>
{/if}

<!-- Real-time Sync -->
<div class="mt-6 border-t border-darkborderc pt-4">
    <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
        <RefreshCwIcon size={20} />
        {language.syncTitle || 'Real-time Sync'}
        <Help key="syncHelp" />
    </h3>

    {#if DBState.db.syncEnabled && syncManager.hasAccessToken()}
        <!-- Sync Active: Show status and controls -->
        <div class="mt-4 p-3 bg-darkbg rounded-lg">
            <div class="flex items-center justify-between">
                <span class="text-textcolor2">{language.syncStatus || 'Sync Status'}:</span>
                <span class={getStatusColor(syncStatus)}>
                    {#if syncStatus === 'syncing'}
                        <RefreshCwIcon class="inline animate-spin mr-1" size={14} />
                    {/if}
                    {getStatusText(syncStatus)}
                </span>
            </div>
            <div class="flex items-center justify-between mt-2">
                <span class="text-textcolor2">{language.syncLastSync || 'Last Sync'}:</span>
                <span>{formatDate(DBState.db.lastSyncTime)}</span>
            </div>
        </div>

        <!-- Manual Sync Buttons -->
        <div class="mt-4 flex gap-2">
            <Button onclick={manualUpload} className="flex-1">
                <UploadIcon size={16} />
                {language.syncUpload || 'Upload'}
            </Button>
            <Button onclick={manualDownload} className="flex-1">
                <DownloadIcon size={16} />
                {language.syncDownload || 'Download'}
            </Button>
        </div>

        <!-- Stop Sync Button -->
        <Button onclick={stopSync} className="mt-4 w-full">
            {language.syncStop || 'Stop Sync'}
        </Button>
    {:else}
        <!-- Sync Inactive: Show start button -->
        <Button onclick={startSync} className="mt-3 w-full">
            <CloudIcon size={16} />
            {language.syncStart || 'Start Real-time Sync'}
        </Button>
    {/if}
</div>