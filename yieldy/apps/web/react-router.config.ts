import type { Config } from '@react-router/dev/config';

// Check if building for Cloudflare Pages (SPA mode)
const isCloudflarePages = process.env.CLOUDFLARE_PAGES === 'true';

export default {
	appDirectory: './src/app',
	// Disable SSR for Cloudflare Pages (static SPA deployment)
	// Set CLOUDFLARE_PAGES=true in build command for SPA mode
	ssr: !isCloudflarePages,
	// Pre-render only the main routes for SPA mode
	...(isCloudflarePages && {
		prerender: false,
	}),
} satisfies Config;
