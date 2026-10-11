import { json } from '@sveltejs/kit';
import { getOverview } from '$lib/server/overview';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json(await getOverview());