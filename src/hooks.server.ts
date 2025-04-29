import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';

// Check if admin credentials are set
if (!env.ADMIN_LOGIN) {
	console.warn('⚠️ WARNING: ADMIN_LOGIN environment variable is not set. The message update endpoint will not work without it.');
}

// Add any other hook handlers as needed
export async function handle({
	event,
	resolve,
}: Parameters<Handle>[0]): Promise<ReturnType<Handle>> {
	const url = new URL(event.request.url);

	if (url.pathname.includes('/admin')) {
		const auth = event.request.headers.get('Authorization');

		if (auth !== `Basic ${btoa(env.ADMIN_LOGIN)}`) {
			return new Response('Not authorized', {
				status: 401,
				headers: {
					'WWW-Authenticate':
                        'Basic realm="User Visible Realm", charset="UTF-8"',
				},
			});
		}
	}

	return resolve(event);
}