import type { Config } from '@react-router/dev/config';

export default {
	appDirectory: './src/app',
	ssr: true,
	// Disable prerender - requires DATABASE_URL at build time
	prerender: [],
} satisfies Config;
