<script lang="ts">
    import { language } from "src/lang";
    import { alertConfirm, alertError, alertInput, alertNormal } from "src/ts/utils/alert.svelte";
    import { checkDriver } from "src/ts/data/drive/drive";
    import { syncManager } from "src/ts/data/drive/syncManager";
    import { isNodeServer, isTauri } from "src/ts/utils/env";
    import { DBState } from "src/ts/stores.svelte";
    import { onMount, onDestroy } from "svelte";
    import { CloudIcon, RefreshCwIcon, UploadIcon, DownloadIcon, InfoIcon } from "lucide-svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte";
    import Help from "src/lib/Others/Help.svelte";
    import { openURL } from "src/ts/utils/util";

    type SyncStatus = 'idle' | 'syncing' | 'error' | 'conflict' | 'rate_limited';
    let syncStatus = $state<SyncStatus>('idle');
    let unsubscribe: (() => void) | null = null;

    // Format date
    function formatDate(timestamp: number | undefined): string {
        if (!timestamp) return language.syncNever || 'Never';
        return new Date(timestamp).toLocaleString();
    }

    // Get status display text
    function getStatusText(status: SyncStatus): string {
        switch (status) {
            case 'idle': return language.syncStatusIdle || 'Idle';
            case 'syncing': return language.syncStatusSyncing || 'Syncing...';
            case 'error': return language.syncStatusError || 'Error';
            case 'conflict': return language.syncStatusConflict || 'Conflict Detected';
            case 'rate_limited': return 'Rate Limited (waiting...)';
        }
    }

    // Get status color class
    function getStatusColor(status: SyncStatus): string {
        switch (status) {
            case 'idle': return 'text-green-500';
            case 'syncing': return 'text-yellow-500';
            case 'error': return 'text-red-500';
            case 'conflict': return 'text-orange-500';
            case 'rate_limited': return 'text-yellow-500';
        }
    }

    // Toggle sync enabled
    function toggleSync() {
        if (DBState.db.syncEnabled) {
            syncManager.disable();
        } else {
            syncManager.enable();
        }
    }

    // Connect to Google Drive for sync
    async function connectDrive() {
        // For now, we use the same OAuth flow as backup
        // But we store the token in syncManager
        const CLIENT_ID = '580075990041-l26k2d3c0nemmqiu3d3aag01npfrkn76.apps.googleusercontent.com';
        const REDIRECT_URI = 'https://risuai.xyz/';
        const SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata';

        if (isTauri || isNodeServer) {
            // Tauri: open browser, get code manually
            const authorizationUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${SCOPE}&response_type=code&state=sync`;
            openURL(authorizationUrl);

            let code = await alertInput(language.pasteAuthCode);
            if (!code) return;

            if (code.includes(' ')) {
                code = code.substring(code.lastIndexOf(' ')).trim();
            }

            // Exchange code for token
            try {
                const res = await fetch(`/drive?code=${encodeURIComponent(code)}`);
                if (res.ok) {
                    const json = await res.json();
                    syncManager.setAccessToken(json.access_token);
                    alertNormal('Connected to Google Drive');
                } else {
                    alertError(await res.text());
                }
            } catch (e) {
                alertError(`Connection failed: ${e}`);
            }
        } else {
            // Web: redirect to OAuth
            const authorizationUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${SCOPE}&response_type=code&state=sync`;
            location.href = authorizationUrl;
        }
    }

    // Disconnect from Google Drive
    function disconnectDrive() {
        syncManager.clearAccessToken();
        alertNormal('Disconnected from Google Drive');
    }

    // Manual upload
    async function manualUpload() {
        if (!syncManager.hasAccessToken()) {
            alertError(language.syncNoToken || 'Not connected to Google Drive');
            return;
        }
        if (await alertConfirm(language.syncUploadConfirm || 'Upload local data to Google Drive?')) {
            await syncManager.forceSync('upload');
        }
    }

    // Manual download
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

<h2 class="mb-2 text-2xl font-bold mt-2">{language.files}</h2>

<!-- Google Drive Backup (Existing) -->
<div class="mb-6">
    <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
        <CloudIcon size={20} />
        Google Drive {language.savebackup?.split(' ')[0] || 'Backup'}
    </h3>

    <button
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
        }}
        class="drop-shadow-lg p-3 border-darkborderc border-solid mt-2 flex justify-center items-center ml-2 mr-2 border-1 hover:bg-selected text-sm w-full">
        {language.savebackup}
    </button>

    <button
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
        class="drop-shadow-lg p-3 border-darkborderc border-solid mt-2 flex justify-center items-center ml-2 mr-2 border-1 hover:bg-selected text-sm w-full">
        {language.loadbackup}
    </button>
</div>

<!-- Real-time Sync (New) -->
<div class="mt-6 border-t border-darkborderc pt-4">
    <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
        <RefreshCwIcon size={20} />
        {language.syncTitle || 'Real-time Sync'}
        <Help key="syncHelp" />
    </h3>

    <!-- Sync Enable Toggle -->
    <div class="mt-3">
        <CheckInput bind:check={DBState.db.syncEnabled} onChange={toggleSync} name={language.syncEnabled || 'Enable Real-time Sync'} />
    </div>

    {#if DBState.db.syncEnabled}
        <!-- Connection Status -->
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

        <!-- Connect/Disconnect Button -->
        <div class="mt-4">
            {#if syncManager.hasAccessToken()}
                <Button onclick={disconnectDrive} className="w-full">
                    {language.syncDisconnect || 'Disconnect'}
                </Button>
            {:else}
                <Button onclick={connectDrive} className="w-full">
                    <CloudIcon size={16} />
                    {language.syncConnectDrive || 'Connect Google Drive'}
                </Button>
            {/if}
        </div>

        <!-- Manual Sync Buttons -->
        {#if syncManager.hasAccessToken()}
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
        {/if}
    {/if}
</div>
