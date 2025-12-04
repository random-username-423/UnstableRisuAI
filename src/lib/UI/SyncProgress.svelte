<script lang="ts">
    import { syncManager, type SyncProgress } from "src/ts/data/drive/syncManager";
    import { onMount, onDestroy } from "svelte";
    import { RefreshCwIcon } from "lucide-svelte";

    let progress = $state<SyncProgress | null>(null);
    let status = $state<'idle' | 'syncing' | 'error' | 'conflict'>('idle');
    let unsubProgress: (() => void) | null = null;
    let unsubStatus: (() => void) | null = null;

    // Drag state
    let isDragging = $state(false);
    let posX = $state<number | null>(null);  // null = use default (centered)
    let posY = $state(16);  // top offset in px
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let widgetEl = $state<HTMLDivElement | null>(null);

    const WIDGET_WIDTH = 200;  // min-w-[200px]
    const WIDGET_HEIGHT = 80;  // approximate height

    onMount(() => {
        status = syncManager.getStatus();
        progress = syncManager.getProgress();

        unsubStatus = syncManager.onStatusChange((s) => {
            status = s;
        });
        unsubProgress = syncManager.onProgressChange((p) => {
            progress = p;
        });
    });

    onDestroy(() => {
        if (unsubStatus) unsubStatus();
        if (unsubProgress) unsubProgress();
    });

    function getPhaseLabel(phase: string): string {
        switch (phase) {
            case 'characters': return 'Characters';
            case 'chats': return 'Chats';
            case 'assets': return 'Assets';
            case 'settings': return 'Settings';
            case 'downloading': return 'Downloading';
            case 'deleting': return 'Deleting';
            default: return phase;
        }
    }

    function clampPosition(x: number, y: number): { x: number; y: number } {
        const w = widgetEl?.offsetWidth || WIDGET_WIDTH;
        const h = widgetEl?.offsetHeight || WIDGET_HEIGHT;
        const maxX = window.innerWidth - w;
        const maxY = window.innerHeight - h;
        return {
            x: Math.max(0, Math.min(x, maxX)),
            y: Math.max(0, Math.min(y, maxY))
        };
    }

    function onMouseDown(e: MouseEvent) {
        isDragging = true;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;

        // If first drag, initialize posX from current position
        if (posX === null) {
            posX = rect.left;
        }
    }

    function onMouseMove(e: MouseEvent) {
        if (!isDragging) return;
        const clamped = clampPosition(e.clientX - dragOffsetX, e.clientY - dragOffsetY);
        posX = clamped.x;
        posY = clamped.y;
    }

    function onMouseUp() {
        isDragging = false;
    }

    function onResize() {
        if (posX !== null) {
            const clamped = clampPosition(posX, posY);
            posX = clamped.x;
            posY = clamped.y;
        }
    }
</script>

<svelte:window onmousemove={onMouseMove} onmouseup={onMouseUp} onresize={onResize} />

{#if status === 'syncing'}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        bind:this={widgetEl}
        class="fixed bg-darkbg border border-darkborderc rounded-lg shadow-lg p-3 z-50 min-w-[200px] cursor-move select-none"
        style={posX === null
            ? `top: ${posY}px; left: 50%; transform: translateX(-50%);`
            : `top: ${posY}px; left: ${posX}px;`}
        onmousedown={onMouseDown}
    >
        <div class="flex items-center gap-2 mb-2">
            <RefreshCwIcon class="animate-spin text-green-500" size={16} />
            <span class="text-sm font-medium">Syncing...</span>
        </div>
        {#if progress}
            <div class="text-xs text-textcolor2 mb-1">
                {getPhaseLabel(progress.phase)}: {progress.current} / {progress.total}
            </div>
            <div class="w-full bg-darkbg2 rounded-full h-1.5">
                <div
                    class="bg-green-500 h-1.5 rounded-full transition-all duration-200"
                    style="width: {progress.total > 0 ? (progress.current / progress.total * 100) : 0}%"
                ></div>
            </div>
        {:else}
            <div class="text-xs text-textcolor2">
                Preparing...
            </div>
        {/if}
    </div>
{/if}
