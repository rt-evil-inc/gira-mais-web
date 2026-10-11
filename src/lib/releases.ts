/** The app's GitHub releases, fetched once per page load and shared by every chart that marks them. */
let releases: Promise<{ tag_name: string; published_at: string }[]> | null = null;

export function getReleases() {
	releases ??= fetch('https://api.github.com/repos/rt-evil-inc/gira-mais/releases')
		.then(response => response.ok ? response.json() : [])
		.catch(() => []);
	return releases;
}