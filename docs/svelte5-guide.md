# Svelte 5 Migration Guide

## Introduction

This guide provides an overview of migrating from Svelte 4 to Svelte 5, covering the major changes, new features, and step-by-step migration instructions.

## Key Changes in Svelte 5

### Runes

Svelte 5 introduces a new concept called "runes" which are compiler instructions that start with a dollar sign (`$`) and manage reactivity in a more consistent and interoperable way.

#### Why Runes?

- More consistent reactivity model that works across `.svelte`, `.js`, and `.ts` files
- Enables reactive state declarations outside of Svelte components
- Provides explicit declaration of reactive state (vs. implicit in Svelte 4)
- Improves interoperability and code sharing between components

#### Core Runes

| Rune | Purpose | Example | Replaces |
|------|---------|---------|----------|
| `$state` | Declare reactive state | `let count = $state(0)` | `let count = 0` (implicit reactivity) |
| `$derived` | Create derived values | `let doubled = $derived(count * 2)` | `$: doubled = count * 2` |
| `$effect` | Create side effects | `$effect(() => { console.log(count) })` | `$: { console.log(count) }` |
| `$props` | Define component props | `let { name = 'World' } = $props()` | `export let name = 'World'` |
| `$bindable` | Create two-way bindable values | `let value = $bindable(initialValue)` | New feature |

#### $derived.by

A variant of `$derived` is `$derived.by`, which allows you to specify a function that computes a derived value and the dependencies it should track:

```js
// Basic $derived automatically detects dependencies
let doubled = $derived(count * 2);

// $derived.by allows explicit specification of dependencies and computation
let userFullName = $derived.by(
  // Dependencies to track
  () => [user.firstName, user.lastName],
  // Computation function
  ([firstName, lastName]) => `${firstName} ${lastName}`
);
```

The `$derived.by` rune is useful when:
- You want to explicitly control which values should trigger recalculation
- You need to perform more complex derivations with specific dependency tracking
- You want to optimize performance by avoiding unnecessary recalculations

### Event Handling

Event directives are replaced with event attributes:

- **Old:** `<button on:click={handleClick}>Click me</button>`  
- **New:** `<button onclick={handleClick}>Click me</button>`

Event modifiers (like `preventDefault`) are now replaced with helper functions imported from `svelte/legacy`:
```js
import { preventDefault } from 'svelte/legacy';

<button onclick={preventDefault((event) => {
  // event already has preventDefault() called
  // Your handler code...
})}>Click me</button>
```

### Slots and Snippets

Slots are replaced with snippets, offering more flexibility and clearer semantics:

- **Old (named slots):** 
  ```html
  <div slot="header">Header content</div>
  ```

- **New (snippets):** 
  ```html
  {#snippet header()}
    <div>Header content</div>
  {/snippet}
  ```

- **Old (slot consumption):** 
  ```html
  <slot />
  <slot name="header" />
  ```

- **New (render tags):** 
  ```html
  {@render children()}
  {@render header?.()}
  ```

### Component Instantiation

Components are now functions rather than classes:

- **Old:** 
  ```js
  import App from './App.svelte';
  const app = new App({ target: document.getElementById("app") });
  ```

- **New:** 
  ```js
  import { mount } from 'svelte';
  import App from './App.svelte';
  const app = mount(App, { target: document.getElementById("app") });
  ```

## Automated Migration

Svelte provides an official migration script to handle most of the conversion automatically:

```bash
npx sv migrate svelte-5
```

This script will:
- Bump core dependencies in your package.json
- Migrate to runes (`let` → `$state`, etc.)
- Convert event directives to event attributes (`on:click` → `onclick`)
- Migrate slot usages to snippets and render tags (`<slot />` → `{@render children()}`)
- Convert slot elements to snippets (`<div slot="x">...</div>` → `{#snippet x()}<div>...</div>{/snippet}`)
- Migrate component instantiation (`new Component(...)` → `mount(Component, ...)`)

## Manual Migration Requirements

Not everything is automatically converted by the migration script:

### Event Dispatchers

The `createEventDispatcher` pattern needs to be manually updated:

```js
// In Svelte 4
import { createEventDispatcher } from 'svelte';
const dispatch = createEventDispatcher();
dispatch('message', { text: 'Hello!' });

// In Svelte 5 - manual update required
```

### Lifecycle Hooks

`beforeUpdate/afterUpdate` hooks need manual conversion. As a general rule:
- `beforeUpdate` → `$effect.pre`
- `afterUpdate` → A combination of `$effect` and `tick` (from svelte)

### Legacy Reactivity

Some reactive statements might be converted to use the `run` function from `svelte/legacy`:

```js
import { run } from 'svelte/legacy';
run(() => {
  // some side effect code
});
```

Consider converting these to `$effect` or `$derived` when appropriate.