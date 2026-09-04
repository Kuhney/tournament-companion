// Tauri has no Node.js server, so the app runs as a single page application:
// adapter-static with an index.html fallback.
// See: https://svelte.dev/docs/kit/single-page-apps
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
export const ssr = false;
// Each route also gets its own HTML shell as `<route>/index.html`, so the TV
// window can be opened straight at /display/ from the bundled assets.
export const prerender = true;
export const trailingSlash = "always";
