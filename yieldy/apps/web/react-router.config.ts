import type { Config } from '@react-router/dev/config';

export default {
	appDirectory: './src/app',
	// Disable SSR for Cloudflare Pages (static deployment)
	// For SSR, use Cloudflare Workers instead
	ssr: process.env.CLOUDFLARE_PAGES === 'true' ? false : true,
} satisfies Config;
