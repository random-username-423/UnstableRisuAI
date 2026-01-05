<script lang="ts">
	import AlertContainer from "./AlertContainer.svelte"
	import Button from "../../UI/GUI/Button.svelte"
	import { alertClear } from "src/ts/alert.svelte"

	type Props = {
		msg: string
	}

	let { msg }: Props = $props()

	// Parse message
	// svelte-ignore state_referenced_locally - msg never changes in alert context
	const parts = msg.split("\n\n")
	const mainPart = parts[0]
	const confirmMessage = parts[1]
	const mainParts = mainPart.split("\n")
	const pluginName = mainParts[0]
	const warnings = mainParts.slice(1)
</script>

<AlertContainer title="Plugin Import" titleColor="green">
	<div class="plugin-confirm-content">
		<p class="plugin-name">{pluginName}</p>
		{#if warnings.length > 0}
			<ul class="warnings-list">
				{#each warnings as warning}
					<li class="warning-item">{warning}</li>
				{/each}
			</ul>
		{/if}
		<p class="confirm-message">{confirmMessage}</p>
	</div>

	<div class="flex gap-2 w-full mt-4">
		<Button className="grow" onclick={() => alertClear("yes")}>YES</Button>
		<Button className="grow" onclick={() => alertClear("no")}>NO</Button>
	</div>
</AlertContainer>

<style>
	.plugin-confirm-content .plugin-name {
		font-size: 1.25rem;
		font-weight: bold;
		color: white;
	}
	.plugin-confirm-content .warnings-list {
		list-style-type: disc;
		list-style-position: inside;
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
		padding-left: 1rem;
		color: #f87171; /* red-400 */
	}
	.plugin-confirm-content .warning-item {
		margin-bottom: 0.25rem;
	}
	.plugin-confirm-content .confirm-message {
		margin-top: 1rem;
		color: #d1d5db; /* gray-300 */
	}
</style>
