import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const response = await fetch('/api/admin/tokens');
	const tokenSources = await response.json();

	return {
		tokenSources: tokenSources.tokenSources,
	};
};