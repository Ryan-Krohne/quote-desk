<script>
	import { page } from '$app/state';
	import { supabase } from '#lib/supabase.js';

	const authorizationId = page.url.searchParams.get('authorization_id');

	/** @type {'loading' | 'sign-in' | 'consent' | 'redirecting' | 'error'} */
	let view = $state('loading');
	let errorMessage = $state('');
	/** @type {import('@supabase/supabase-js').OAuthAuthorizationDetails | null} */
	let details = $state(null);
	let busy = $state(false);

	const showError = message => {
		errorMessage = message;
		view = 'error';
	};

	const loadDetails = async () => {
		view = 'loading';
		const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
		if (error) return showError(error.message);
		// No authorization_id means the user already consented to this client.
		if (!('authorization_id' in data)) {
			view = 'redirecting';
			window.location.href = data.redirect_url;
			return;
		}
		details = data;
		view = 'consent';
	};

	const start = async () => {
		if (!authorizationId) return showError('This link is missing its authorization ID. Start the connection again from Claude.');
		const { data } = await supabase.auth.getSession();
		if (data.session) await loadDetails();
		else view = 'sign-in';
	};

	/** @param {SubmitEvent} event */
	const signIn = async event => {
		event.preventDefault();
		const form = new FormData(/** @type {HTMLFormElement} */ (event.currentTarget));
		busy = true;
		errorMessage = '';
		const { error } = await supabase.auth.signInWithPassword({
			email: String(form.get('email')),
			password: String(form.get('password'))
		});
		busy = false;
		if (error) errorMessage = error.message;
		else await loadDetails();
	};

	// The dashboard shares this browser session, so an owner can be signed in when the homeowner needs to connect.
	const switchAccount = async () => {
		await supabase.auth.signOut();
		details = null;
		view = 'sign-in';
	};

	/** @param {'approve' | 'deny'} decision */
	const decide = async decision => {
		busy = true;
		const { error } =
			decision === 'approve'
				? await supabase.auth.oauth.approveAuthorization(authorizationId)
				: await supabase.auth.oauth.denyAuthorization(authorizationId);
		if (error) {
			busy = false;
			return showError(error.message);
		}
		view = 'redirecting';
	};

	start();
</script>

<svelte:head>
	<title>Connect to Quote Desk</title>
</svelte:head>

<section class="card mx-auto max-w-md bg-base-200">
	<div class="card-body gap-4">
		{#if view === 'loading'}
			<h1 class="card-title text-2xl">Connect to Quote Desk</h1>
			<p><span class="loading loading-spinner"></span> Loading…</p>
		{:else if view === 'sign-in'}
			<h1 class="card-title text-2xl">Sign in to connect</h1>
			<p>Sign in to let Claude request quotes for you.</p>
			<form class="flex flex-col gap-3" onsubmit={signIn}>
				<label class="floating-label">
					<span>Email</span>
					<input class="input w-full" type="email" name="email" placeholder="Email" autocomplete="email" required />
				</label>
				<label class="floating-label">
					<span>Password</span>
					<input
						class="input w-full"
						type="password"
						name="password"
						placeholder="Password"
						autocomplete="current-password"
						required
					/>
				</label>
				{#if errorMessage}
					<p class="text-error" role="alert">{errorMessage}</p>
				{/if}
				<button class="btn btn-primary" disabled={busy}>
					{#if busy}<span class="loading loading-spinner"></span>{/if}
					Sign in
				</button>
			</form>
		{:else if view === 'consent' && details}
			<h1 class="card-title text-2xl">Allow {details.client.name}?</h1>
			<p>
				<strong>{details.client.name}</strong> wants to use Quote Desk for you: submit jobs, request quotes, and book a
				quote.
			</p>
			<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
				<dt class="font-semibold">Signed in as</dt>
				<dd>{details.user.email}</dd>
				<dt class="font-semibold">Access</dt>
				<dd>{details.scope || 'Default'}</dd>
				<dt class="font-semibold">Returns to</dt>
				<dd class="break-all">{details.redirect_uri}</dd>
			</dl>
			<div class="card-actions justify-end">
				<button class="btn btn-ghost" disabled={busy} onclick={() => decide('deny')}>Deny</button>
				<button class="btn btn-primary" disabled={busy} onclick={() => decide('approve')}>
					{#if busy}<span class="loading loading-spinner"></span>{/if}
					Allow
				</button>
			</div>
			<button class="link text-sm" disabled={busy} onclick={switchAccount}>Use a different account</button>
		{:else if view === 'redirecting'}
			<h1 class="card-title text-2xl">Returning to Claude…</h1>
			<p><span class="loading loading-spinner"></span> You can close this tab if it does not close by itself.</p>
		{:else}
			<h1 class="card-title text-2xl">Cannot connect</h1>
			<p class="text-error" role="alert">{errorMessage}</p>
		{/if}
	</div>
</section>
