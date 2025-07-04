import { browser } from '$app/environment';

if (browser) {
	localStorage.setItem('admin', 'true');
}