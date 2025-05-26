import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const [tokenSourcesResponse, tokenStatsResponse] = await Promise.all([
		fetch('/api/admin/tokens'),
		fetch('/api/token/stats'),
	]);

	const tokenSources = await tokenSourcesResponse.json();
	const tokenStats = await tokenStatsResponse.json();

	return {
		tokenSources: tokenSources.tokenSources,
		tokenStats,
	};
};