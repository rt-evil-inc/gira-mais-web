import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const [tokenSourcesResponse, tokenStatsResponse, errorDataResponse] = await Promise.all([
		fetch('/api/admin/tokens'),
		fetch('/api/token/stats'),
		fetch('/api/admin/errors'),
	]);

	const tokenSources = await tokenSourcesResponse.json();
	const tokenStats = await tokenStatsResponse.json();
	const errorData:{
    errorCount: number;
    errors: {
        id: number;
        deviceId: string;
        timestamp: string;
        errorCode: string;
        errorMessage: string | null;
        userAgent: string | null;
    }[];
} = await errorDataResponse.json();

	return {
		tokenSources: tokenSources.tokenSources,
		tokenStats,
		errorData,
	};
};