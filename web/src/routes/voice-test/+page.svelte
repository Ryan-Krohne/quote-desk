<!-- #14 check page: open on the demo laptop, on the live HTTPS URL, in the demo browser. -->
<script>
	import VoiceInput from '#lib/VoiceInput.svelte';

	const api = globalThis.SpeechRecognition
		? 'SpeechRecognition'
		: globalThis.webkitSpeechRecognition
			? 'webkitSpeechRecognition'
			: 'none';

	/** @type {string[]} */
	let sent = $state([]);
</script>

<svelte:head>
	<title>Voice test · Quote Desk</title>
</svelte:head>

<h1 class="mb-2 text-3xl font-bold">Voice input test</h1>
<p class="mb-6">Say: “Gas tank swaps start at 1,400 dollars. Add 300 if the venting needs work.”</p>

<dl class="mb-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
	<dt class="font-semibold">Speech API</dt>
	<dd>{api}</dd>
	<dt class="font-semibold">Secure context (HTTPS)</dt>
	<dd>{globalThis.isSecureContext ? 'Yes' : 'No: the microphone will not work'}</dd>
</dl>

<section class="card max-w-2xl bg-base-200">
	<div class="card-body">
		<VoiceInput label="Pricing rule" submitLabel="Save rule" onsubmit={text => (sent = [text, ...sent])} />
	</div>
</section>

{#if sent.length}
	<h2 class="mt-6 mb-2 text-xl font-semibold">Sent</h2>
	<ol class="list-decimal pl-6">
		{#each sent as item}
			<li>{item}</li>
		{/each}
	</ol>
{/if}
