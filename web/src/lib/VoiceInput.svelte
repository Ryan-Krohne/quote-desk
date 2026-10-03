<script>
	import { onDestroy } from 'svelte';

	/**
	 * @type {{
	 *   label: string,
	 *   placeholder?: string,
	 *   submitLabel?: string,
	 *   busy?: boolean,
	 *   onsubmit: (text: string) => void | Promise<void>
	 * }}
	 */
	let { label, placeholder = 'Speak or type…', submitLabel = 'Send', busy = false, onsubmit } = $props();

	const Recognition = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition;
	const errorMessages = {
		'not-allowed': 'Microphone access is blocked. Allow it in the browser address bar, or type instead.',
		'service-not-allowed': 'Microphone access is blocked. Allow it in the browser address bar, or type instead.',
		'no-speech': 'No speech heard. Try again closer to the microphone.',
		'audio-capture': 'No microphone found. Type instead.',
		network: 'The speech service is not reachable. Type instead.'
	};

	const id = $props.id();
	let text = $state('');
	let listening = $state(false);
	let message = $state('');
	/** @type {any} */
	let recognition;

	const startListening = () => {
		message = '';
		// Speech is added after anything already typed, so the owner can mix typing and speaking.
		const typed = text.trim();
		recognition = new Recognition();
		recognition.lang = 'en-US';
		recognition.continuous = true;
		recognition.interimResults = true;
		// Rebuild from every result each time: interim results are replaced, not added to.
		recognition.onresult = event => {
			const spoken = Array.from(event.results, result => result[0].transcript).join(' ');
			text = `${typed} ${spoken}`.replace(/\s+/g, ' ').trim();
		};
		recognition.onerror = event => {
			if (event.error !== 'aborted') message = errorMessages[event.error] ?? `Voice input stopped (${event.error}). Type instead.`;
		};
		recognition.onend = () => (listening = false);
		recognition.start();
		listening = true;
	};

	const stopListening = () => recognition?.stop();

	/** @param {SubmitEvent} event */
	const submit = async event => {
		event.preventDefault();
		recognition?.abort();
		const value = text.trim();
		if (!value) return;
		await onsubmit(value);
		text = '';
	};

	onDestroy(() => recognition?.abort());
</script>

<form class="flex flex-col gap-3" onsubmit={submit}>
	<label class="font-semibold" for="{id}-text">{label}</label>
	<textarea
		id="{id}-text"
		class="textarea w-full text-lg"
		class:textarea-primary={listening}
		rows="3"
		{placeholder}
		readonly={listening}
		bind:value={text}
	></textarea>

	<p class="min-h-6 text-sm" role="status">
		{#if listening}
			<span class="inline-flex items-center gap-2 font-semibold text-primary">
				<span class="status status-primary motion-safe:animate-pulse"></span> Listening… click Stop when you finish.
			</span>
		{:else if message}
			<span class="text-error">{message}</span>
		{:else if !Recognition}
			Voice input is not available in this browser. Type instead.
		{/if}
	</p>

	<div class="flex flex-wrap gap-2">
		{#if Recognition}
			<button
				type="button"
				class="btn"
				class:btn-error={listening}
				aria-pressed={listening}
				disabled={busy}
				onclick={listening ? stopListening : startListening}
			>
				{listening ? '■ Stop' : '🎤 Speak'}
			</button>
		{/if}
		<button class="btn btn-primary" disabled={busy || !text.trim()}>
			{#if busy}<span class="loading loading-spinner"></span>{/if}
			{submitLabel}
		</button>
	</div>
</form>
