<script lang="ts">
    import type { Message } from 'src/ts/storage/types/chat';
    import type { character, groupChat } from 'src/ts/storage/types/character';
    import Chat from './Chat.svelte';
    import { getCharImage } from 'src/ts/characters.svelte';
    import { createSimpleCharacter, DBState, ReloadChatPointer, selectedCharID } from 'src/ts/stores.svelte';
    import { chatFoldedStateMessageIndex } from 'src/ts/globalApi.svelte';
    import { get } from 'svelte/store';
    import { tick, untrack } from 'svelte';

    // Get current chat room ID to detect chat switches
    const getCurrentChatRoomId = () => {
        const charId = get(selectedCharID);
        if (charId < 0) return null;
        const char = DBState.db.characters[charId];
        if (!char) return null;
        return char.chats?.[char.chatPage]?.id ?? null;
    };

    interface VisibleMessage {
        message: Message;
        idx: number;
        reloadPointer: number;
    }

    let {
        messages,
        currentCharacter,
        onReroll,
        unReroll,
        currentUsername,
        userIcon,
        loadPages,
        userIconPortrait,
        hasNewUnreadMessage = $bindable(false)
    }:{
        messages: Message[]
        currentCharacter: character|groupChat
        onReroll: () => void
        unReroll: () => void
        currentUsername: string
        userIcon: string
        loadPages: number
        userIconPortrait?: boolean
        hasNewUnreadMessage?: boolean
    } = $props();

    let chatBody: HTMLDivElement;

    // Derived values for rendering
    const charImage = $derived(getCharImage(currentCharacter.image, 'css'));
    const userImage = $derived(getCharImage(userIcon, 'css'));
    const simpleChar = $derived(createSimpleCharacter(currentCharacter));
    const userLargePortrait = $derived(userIconPortrait ?? false);
    const charLargePortrait = $derived((currentCharacter as character).largePortrait ?? false);

    // Calculate visible messages based on loadPages and foldedState
    // Data is stored in chronological order (oldest at index 0, newest at end)
    // Returns messages in display order (oldest first, newest last)
    const visibleMessages = $derived.by(() => {
        const reloadPointerMap = get(ReloadChatPointer);

        let loadStart: number;
        let loadEnd: number;

        if (chatFoldedStateMessageIndex.index !== -1) {
            // Folded state - show from fold point to end
            loadStart = chatFoldedStateMessageIndex.index;
            loadEnd = messages.length - 1;
        } else {
            // Normal state - load most recent N messages (from end of array)
            loadStart = Math.max(0, messages.length - loadPages);
            loadEnd = messages.length - 1;
        }

        const result: VisibleMessage[] = [];
        // Iterate in chronological order (oldest to newest)
        for (let i = loadStart; i <= loadEnd; i++) {
            const message = messages[i];
            if (!message) continue;
            result.push({
                message,
                idx: i,
                reloadPointer: reloadPointerMap[i] ?? 0
            });
        }
        return result;
    });

    // Generate unique key for each message to trigger re-render when needed
    function getMessageKey(item: VisibleMessage): string {
        const { message, idx, reloadPointer } = item;
        const largePortrait = message.role === 'user' ? userLargePortrait : charLargePortrait;
        return `${message.chatId ?? ''}-${idx}-${largePortrait}-${message.disabled ?? false}-${reloadPointer}`;
    }

    export const scrollToLatestMessage = () => {
        if (!chatBody) return;
        hasNewUnreadMessage = false;
        const element = chatBody.lastElementChild;
        if (element) {
            element.scrollIntoView({ behavior: 'instant', block: 'end' });
        }
    }

    // Check if user is scrolled to bottom
    function checkIfAtBottom(): boolean {
        if (!chatBody || !chatBody.parentElement) return true;
        const scrollContainer = chatBody.parentElement;
        const lastEl = chatBody.lastElementChild;
        if (!lastEl) return true;
        const rect = lastEl.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        return rect.bottom <= containerRect.bottom + 100;
    }

    // Track state for auto-scroll
    let previousLength = 0;
    let previousChatRoomId: string | null = null;

    // Auto-scroll when new messages arrive
    // Tracked: messages.length (triggers effect on new messages)
    // Untracked: settings, chat room ID, DOM checks (read-only, shouldn't trigger)
    $effect(() => {
        const currentLength = messages.length; // <-- TRACKED: triggers on message count change

        untrack(() => {
            const currentChatRoomId = getCurrentChatRoomId();
            const isSameChat = currentChatRoomId === previousChatRoomId;

            // Only auto-scroll if same chat and new messages were added
            if (isSameChat && currentLength > previousLength) {
                const lastMsg = messages.at(-1);
                if (lastMsg && lastMsg.role === 'char' && DBState.db.autoScrollToNewMessage) {
                    const wasAtBottom = checkIfAtBottom();
                    if (wasAtBottom || DBState.db.alwaysScrollToNewMessage) {
                        tick().then(() => {
                            setTimeout(() => {
                                scrollToLatestMessage();
                            }, 100);
                        });
                    } else {
                        hasNewUnreadMessage = true;
                    }
                }
            }

            previousLength = currentLength;
            previousChatRoomId = currentChatRoomId;
        });
    });
</script>

<div class="flex flex-col" bind:this={chatBody}>
    {#each visibleMessages as item (getMessageKey(item))}
        {@const message = item.message}
        {@const idx = item.idx}
        {@const isUser = message.role === 'user'}
        <div class="chat-message-container" data-chat-index={idx}>
            <Chat
                message={message.data}
                isLastMemory={false}
                {idx}
                totalLength={messages.length}
                img={isUser ? userImage : charImage}
                {onReroll}
                {unReroll}
                rerollIcon="dynamic"
                character={simpleChar}
                largePortrait={isUser ? userLargePortrait : charLargePortrait}
                messageGenerationInfo={message.generationInfo}
                role={message.role}
                name={isUser ? currentUsername : currentCharacter.name}
                isComment={message.isComment ?? false}
                disabled={message.disabled ?? false}
            />
        </div>
    {/each}
</div>