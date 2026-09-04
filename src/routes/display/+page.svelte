<script lang="ts">
    import { onMount } from "svelte";
    import DisplaySwitcher from "$lib/components/display/DisplaySwitcher.svelte";
    import Emblem from "$lib/components/Emblem.svelte";
    import { fetchState, performAction } from "$lib/tournament/api";
    import { applyTheme } from "$lib/tournament/theme";
    import { toggleFullscreen } from "$lib/tauri/windows";
    import type { TournamentState } from "$lib/types/tournament";
    let state: TournamentState | null = null;
    let error = "";
    let hintUntil = 0;
    async function refresh() {
        try {
            state = await fetchState();
            applyTheme(state.config);
            error = "";
        } catch {
            error = "Turnierdaten konnten nicht gelesen werden …";
        }
    }
    onMount(() => {
        refresh();
        const timer = setInterval(refresh, 1500);
        return () => clearInterval(timer);
    });

    /** Keyboard tweaks right on the TV: F11 fullscreen, +/- scale, 0 reset, G guides. */
    async function onKeydown(event: KeyboardEvent) {
        if (!state) return;
        const config = state.config;
        const patch: Record<string, unknown> = {};
        if (event.key === "F11") {
            event.preventDefault();
            toggleFullscreen();
            return;
        } else if (event.key === "+" || event.key === "=")
            patch.displayScalePercent = Math.min(200, config.displayScalePercent + 5);
        else if (event.key === "-")
            patch.displayScalePercent = Math.max(50, config.displayScalePercent - 5);
        else if (event.key === "0") patch.displayScalePercent = 100;
        else if (event.key.toLowerCase() === "g")
            patch.displayShowGuides = !config.displayShowGuides;
        else if (event.key.toLowerCase() === "h")
            patch.displayShowHeader = !config.displayShowHeader;
        else return;
        event.preventDefault();
        hintUntil = Date.now() + 4000;
        const result = await performAction({
            action: "display.update",
            displayScalePercent: config.displayScalePercent,
            displayMarginPercent: config.displayMarginPercent,
            displayShowHeader: config.displayShowHeader,
            displayShowGuides: config.displayShowGuides,
            ...patch,
        });
        if (result.ok) {
            state = result.state;
            applyTheme(state.config);
        }
    }
    $: config = state?.config;
    $: styleVars = config
        ? `--display-scale:${config.displayScalePercent / 100};--display-margin:${config.displayMarginPercent}%;--display-header-space:${config.displayShowHeader ? "7rem" : "2.5rem"}`
        : "";
    $: showHint = config?.displayShowGuides || hintUntil > Date.now();
</script>

<svelte:window on:keydown={onKeydown} />
<svelte:head><title>{config?.name ?? "Turnier"} · Live</title></svelte:head>
<main class="chalkboard h-screen w-screen overflow-hidden text-white" style={styleVars}>
    <div class="display-root">
        {#if config?.displayShowHeader}
            <div class="display-header">
                <Emblem {config} class="h-20 w-20" />
                <div class="text-left">
                    <p class="eyebrow">{config.sport}</p>
                    <p class="brush-type text-2xl leading-none">{config.name}</p>
                </div>
            </div>
        {/if}

        <div class="display-content">
            {#if state}
                <DisplaySwitcher {state} />
            {:else}
                <div
                    class="brush-type grid h-full place-items-center text-3xl text-zinc-400"
                >
                    Turnier wird geladen …
                </div>
            {/if}
        </div>

        {#if config?.displayShowGuides}
            <div class="display-guides" aria-hidden="true"></div>
        {/if}
        {#if config && showHint}
            <div class="display-hint">
                Skalierung {config.displayScalePercent}% · Rand {config.displayMarginPercent}%
                &nbsp;·&nbsp; <kbd>F11</kbd> Vollbild <kbd>+</kbd><kbd>−</kbd> Größe
                <kbd>0</kbd> Zurücksetzen <kbd>G</kbd> Rahmen <kbd>H</kbd> Kopfzeile
            </div>
        {/if}

        {#if error}
            <div
                class="absolute bottom-6 right-8 z-20 rounded-full bg-accent-500/20 px-5 py-2 text-sm font-bold text-accent-300"
            >
                {error}
            </div>
        {/if}
    </div>
</main>
