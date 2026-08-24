import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * GitHub serves avatars at full resolution (typically 460px) unless asked otherwise.
 * Request the size we actually render at, accounting for high density displays.
 */
export function avatarUrl(url: string, renderedSize: number) {
	try {
		const parsed = new URL(url);
		if (!parsed.hostname.endsWith('githubusercontent.com')) return url;
		parsed.searchParams.set('s', String(renderedSize * 2));
		return parsed.toString();
	} catch {
		return url;
	}
}