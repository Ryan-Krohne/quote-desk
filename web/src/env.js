import { defineEnvVars } from '@sveltejs/kit/env';

// static: Vercel sets these at build time, and the client-only app has no server to send them at runtime.
export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: { public: true, static: true, description: 'Supabase project URL' },
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: { public: true, static: true, description: 'Supabase publishable (anon) key' }
});
