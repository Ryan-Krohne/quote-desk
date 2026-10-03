<script>
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Quote Desk</title>
</svelte:head>

<header class="navbar bg-base-200 px-4">
	<a href="/" class="text-xl font-bold">Quote Desk</a>
	<nav class="ml-auto">
		<ul class="menu menu-horizontal">
			<li><a href="/dashboard">Owner dashboard</a></li>
			<li><a href="/board">Quote board</a></li>
		</ul>
	</nav>
</header>

<main class="mx-auto max-w-6xl p-6">
	{@render children()}
</main>
