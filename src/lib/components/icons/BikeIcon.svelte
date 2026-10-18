<script lang="ts">
	/** The Gira+ app's bike, in the current colour, sized like the Lucide icons beside it. */
	let { class: className = '', 'aria-label': label }: { class?: string; 'aria-label'?: string } = $props();
</script>

<svg class={className} viewBox="35 7.5 60 60" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
	<path d="M45.4573 45.2226L52.8736 39.5964C50.1583 35.9955 44.4686 37.0404 42 37.5C47.5 38.5 45.4573 45.2226 45.4573 45.2226Z" fill="currentColor" stroke="none" />
	<path d="M45.4573 45.2226L55.061 45.386C54.7269 42.877 53.9272 40.9937 52.8736 39.5964L45.4573 45.2226Z" fill="currentColor" stroke="none" />
	<path d="M62.1748 45.5071L57.8354 35.8323M62.1748 45.5071L76.0112 29.252M62.1748 45.5071L55.061 45.386M53.9583 27.2957H50.8994M53.9583 27.2957H58.2266M53.9583 27.2957L57.8354 35.8323M45.4573 45.2226C45.4573 45.2226 47.5 38.5 42 37.5M45.4573 45.2226L55.061 45.386M45.4573 45.2226L52.8736 39.5964M57.8354 35.8323L52.8736 39.5964M83.9431 45.2226L80.3862 40.7409L76.0112 29.252M76.0112 29.252L74.2683 24.0589L78.501 21L71.3872 21.3913M76.0112 29.252H80M42 37.5C44.4686 37.0404 50.1583 35.9955 52.8736 39.5964M42 37.5H37.5M55.061 45.386C54.7269 42.877 53.9272 40.9937 52.8736 39.5964" />
	<circle cx="45.9197" cy="45.0804" r="8.91971" />
	<circle cx="83.9075" cy="45.0804" r="8.91971" />
</svg>