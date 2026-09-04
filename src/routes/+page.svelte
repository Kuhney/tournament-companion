<script lang="ts">
    import { onMount } from "svelte";
    import Emblem from "$lib/components/Emblem.svelte";
    import { fetchState } from "$lib/tournament/api";
    import { applyTheme } from "$lib/tournament/theme";
    import { openDisplayWindow } from "$lib/tauri/windows";
    import type { TournamentState } from "$lib/types/tournament";

    let state: TournamentState | null = null;
    onMount(async () => {
        state = await fetchState();
        applyTheme(state.config);
    });
</script>

<svelte:head><title>{state?.config.name ?? "Turnier"}</title></svelte:head>
<main
    class="chalkboard relative grid min-h-screen place-items-center overflow-hidden p-6"
>
    {#if state}
        <section
            class="brand-panel relative z-10 w-full max-w-3xl rounded-4xl p-10 text-center"
        >
            <Emblem config={state.config} class="mx-auto h-44 w-44" />
            <p
                class="mt-5 text-lg font-black uppercase tracking-[.18em] text-accent-500"
            >
                {state.config.sport}
            </p>
            <h1 class="brush-type text-6xl leading-none">{state.config.name}</h1>
            {#if state.config.subtitle}
                <p class="mt-3 text-xl font-bold text-zinc-300">{state.config.subtitle}</p>
            {/if}
            <p class="mx-auto mt-5 max-w-xl text-zinc-300">
                Turnierleitung und Live-Anzeige laufen gemeinsam auf diesem Laptop.
            </p>
            {#if !state.config.setupDone}
                <a
                    class="accent-pill mt-9 block rounded-2xl px-6 py-5 text-lg font-black uppercase tracking-wide text-white transition hover:brightness-110"
                    href="/admin/setup/">Turnier einrichten</a
                >
                <p class="mt-3 text-sm text-zinc-400">
                    Turnierart, Format, Wertung und Aussehen festlegen.
                </p>
            {:else}
                <div class="mt-9 grid gap-4 sm:grid-cols-2">
                    <a
                        class="accent-pill rounded-2xl px-6 py-5 text-lg font-black uppercase tracking-wide text-white transition hover:brightness-110"
                        href="/admin/">Turnierleitung</a
                    >
                    <button
                        class="rounded-2xl border-2 border-white/80 bg-white px-6 py-5 text-lg font-black uppercase tracking-wide text-zinc-950 transition hover:bg-zinc-200"
                        onclick={() => openDisplayWindow()}>TV-Anzeige öffnen</button
                    >
                </div>
                <a class="mt-5 inline-block text-sm font-bold text-zinc-400 hover:text-white" href="/admin/setup/"
                    >Einstellungen</a
                >
            {/if}
        </section>
    {/if}
</main>
