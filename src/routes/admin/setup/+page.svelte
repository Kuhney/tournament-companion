<script lang="ts">
    import { onMount } from "svelte";
    import Emblem from "$lib/components/Emblem.svelte";
    import Toast from "$lib/components/Toast.svelte";
    import { fetchState, performAction } from "$lib/tournament/api";
    import {
        applyPreset,
        BRAND_COLORS,
        DEFAULT_CONFIG,
        FORMAT_LABELS,
        knockoutTeamCount,
        maxTeams,
        PRESETS,
        STRUCTURAL_FIELDS,
        TIEBREAKER_LABELS,
        type PresetId,
        type Tiebreaker,
        type TournamentConfig,
    } from "$lib/tournament/config";
    import { applyTheme } from "$lib/tournament/theme";
    import type { TournamentState } from "$lib/types/tournament";

    let tournament = $state<TournamentState | null>(null);
    let draft: TournamentConfig = $state({ ...DEFAULT_CONFIG });
    let busy = $state(false);
    let notice = $state("");
    let noticeNonce = $state(0);
    let failed = $state(false);
    function showNotice(text: string, isError = false) {
        notice = text;
        failed = isError;
        noticeNonce++;
    }

    let locked = $derived((tournament?.rounds.length ?? 0) > 0);
    let hasData = $derived(
        (tournament?.teams.length ?? 0) > 0 || (tournament?.groups.length ?? 0) > 0,
    );
    let bracketSize = $derived(knockoutTeamCount(draft));
    let capacity = $derived(maxTeams(draft));
    let bracketOk = $derived(
        draft.format === "groups" ||
            (bracketSize >= 2 && (bracketSize & (bracketSize - 1)) === 0 && bracketSize <= 32),
    );
    let availableTiebreakers = $derived(
        (Object.keys(TIEBREAKER_LABELS) as Tiebreaker[]).filter(
            (rule) => !draft.tiebreakers.includes(rule),
        ),
    );

    async function load() {
        tournament = await fetchState();
        draft = { ...tournament.config };
        applyTheme(tournament.config);
    }
    onMount(load);

    // Live preview of the accent colour while editing.
    $effect(() => {
        if (/^#[0-9a-fA-F]{6}$/.test(draft.accentColor))
            applyTheme({ ...draft });
    });

    function choosePreset(id: PresetId) {
        const next = applyPreset(draft, id);
        // Keep what the user typed for their own event.
        draft = { ...next, name: draft.name, subtitle: draft.subtitle, logo: draft.logo };
    }

    function moveTiebreaker(index: number, delta: number) {
        const target = index + delta;
        if (target < 0 || target >= draft.tiebreakers.length) return;
        const list = [...draft.tiebreakers];
        [list[index], list[target]] = [list[target], list[index]];
        draft.tiebreakers = list;
    }
    function removeTiebreaker(index: number) {
        draft.tiebreakers = draft.tiebreakers.filter((_, i) => i !== index);
    }
    function addTiebreaker(event: Event) {
        const select = event.currentTarget as HTMLSelectElement;
        if (select.value) draft.tiebreakers = [...draft.tiebreakers, select.value as Tiebreaker];
        select.value = "";
    }

    function onLogoChange(event: Event) {
        const file = (event.currentTarget as HTMLInputElement).files?.[0];
        if (!file) return;
        if (file.size > 300_000) {
            showNotice("Das Logo darf höchstens 300 KB groß sein.", true);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => (draft.logo = String(reader.result));
        reader.readAsDataURL(file);
    }

    async function save() {
        busy = true;
        notice = "";
        const result = await performAction({ action: "config.update", config: draft });
        busy = false;
        if (result.ok) {
            tournament = result.state;
            draft = { ...result.state.config };
            showNotice("Einstellungen gespeichert.");
        } else showNotice(result.error, true);
    }

    async function reset(scope: "schedule" | "all") {
        const question =
            scope === "all"
                ? "Wirklich ALLE Turnierdaten löschen (Teams, Gruppen, Runden, Spiele)?"
                : "Spielplan und alle Ergebnisse löschen? Teams und Gruppen bleiben erhalten.";
        if (!confirm(question)) return;
        busy = true;
        const result = await performAction({ action: "data.reset", scope });
        busy = false;
        if (result.ok) {
            tournament = result.state;
            showNotice(scope === "all" ? "Turnier zurückgesetzt." : "Spielplan gelöscht.");
        } else showNotice(result.error, true);
    }

    const structural = (field: keyof TournamentConfig) =>
        locked && STRUCTURAL_FIELDS.includes(field);
</script>

<svelte:head><title>{draft.name} · Einstellungen</title></svelte:head>
<main class="chalkboard min-h-screen text-zinc-100">
    <header
        class="sticky top-0 z-20 border-b-4 border-accent-700 bg-zinc-950/95 px-4 py-3 shadow-xl backdrop-blur-xl md:px-8"
    >
        <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <Emblem config={draft} class="h-14 w-14" />
                <div>
                    <p class="text-xs font-black uppercase tracking-[.28em] text-accent-500">
                        Einstellungen
                    </p>
                    <h1 class="text-lg font-black uppercase md:text-2xl">{draft.name}</h1>
                </div>
            </div>
            <div class="ml-auto flex gap-2 md:gap-3">
                <a class="btn" href="/">Start</a>
                <a class="btn" href="/admin/">Turnierleitung</a>
                <button class="btn primary" disabled={busy} onclick={save}>Speichern</button>
            </div>
        </div>
    </header>

    <Toast
        message={notice}
        error={failed}
        nonce={noticeNonce}
        onclose={() => (notice = "")}
    />

    {#if !tournament}
        <div class="grid min-h-[70vh] place-items-center text-xl font-black text-slate-500">
            DATEN WERDEN GELADEN …
        </div>
    {:else}
        <div class="mx-auto grid max-w-5xl gap-5 p-4 lg:p-6">
            {#if locked}
                <div
                    class="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-5 py-4 text-sm font-bold text-amber-200"
                >
                    Ein Spielplan existiert bereits. Format und Größen sind deshalb
                    gesperrt. Name, Aussehen, Wertung und Zeiten lassen sich weiterhin
                    ändern. Zum Umbauen unten den Spielplan zurücksetzen.
                </div>
            {/if}

            <section class="panel">
                <div class="section-head">
                    <div>
                        <span class="kicker">Schnellstart</span>
                        <h2>Turnierart</h2>
                    </div>
                </div>
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {#each PRESETS as preset}
                        <button
                            type="button"
                            class="preset"
                            class:active={draft.preset === preset.id}
                            disabled={locked && preset.id !== draft.preset}
                            onclick={() => choosePreset(preset.id)}
                        >
                            <strong>{preset.label}</strong>
                            <span>{preset.description}</span>
                        </button>
                    {/each}
                </div>
                <p class="mt-3 text-xs text-slate-500">
                    Eine Vorlage füllt nur die Felder unten vor. Alles bleibt anpassbar.
                </p>
            </section>

            <div class="grid gap-5 lg:grid-cols-2">
                <section class="panel">
                    <div class="section-head">
                        <div>
                            <span class="kicker">Aussehen</span>
                            <h2>Turnier</h2>
                        </div>
                    </div>
                    <div class="form-grid">
                        <label class="mini col-span-2">
                            Name des Turniers
                            <input class="field" bind:value={draft.name} maxlength="60" required />
                        </label>
                        <label class="mini col-span-2">
                            Untertitel (optional)
                            <input class="field" bind:value={draft.subtitle} maxlength="80" placeholder="z. B. Vereinsfest 2026" />
                        </label>
                        <label class="mini">
                            Sportart / Disziplin
                            <input class="field" bind:value={draft.sport} maxlength="40" />
                        </label>
                        <label class="mini">
                            Akzentfarbe
                            <span class="flex gap-2">
                                <input class="field" type="color" bind:value={draft.accentColor} />
                                <input class="field font-mono" bind:value={draft.accentColor} maxlength="7" />
                            </span>
                            <span class="swatches mt-1">
                                {#each BRAND_COLORS as color}
                                    <button
                                        type="button"
                                        class="swatch"
                                        class:active={draft.accentColor === color.hex}
                                        style:background={color.hex}
                                        title={color.name}
                                        aria-label={color.name}
                                        onclick={() => (draft.accentColor = color.hex)}
                                    ></button>
                                {/each}
                            </span>
                        </label>
                        <label class="mini col-span-2">
                            Logo (PNG, SVG oder JPG, max. 300 KB)
                            <span class="flex items-center gap-3">
                                <Emblem config={draft} class="h-14 w-14 shrink-0" />
                                <input class="field" type="file" accept="image/*" onchange={onLogoChange} />
                                {#if draft.logo}
                                    <button type="button" class="btn" onclick={() => (draft.logo = null)}>Entfernen</button>
                                {/if}
                            </span>
                        </label>
                    </div>
                </section>

                <section class="panel">
                    <div class="section-head">
                        <div>
                            <span class="kicker">Struktur</span>
                            <h2>Format</h2>
                        </div>
                        <span class="status">{capacity} {draft.participantLabelPlural}</span>
                    </div>
                    <div class="form-grid">
                        <label class="mini col-span-2">
                            Modus
                            <select class="field" bind:value={draft.format} disabled={structural("format")}>
                                {#each Object.entries(FORMAT_LABELS) as [value, label]}
                                    <option {value}>{label}</option>
                                {/each}
                            </select>
                        </label>
                        {#if draft.format !== "knockout"}
                            <label class="mini">
                                Anzahl Gruppen
                                <input class="field" type="number" min="1" max="16" bind:value={draft.groupCount} disabled={structural("groupCount")} />
                            </label>
                            <label class="mini">
                                {draft.participantLabelPlural} je Gruppe
                                <input class="field" type="number" min="2" max="16" bind:value={draft.groupSize} disabled={structural("groupSize")} />
                            </label>
                        {/if}
                        {#if draft.format === "groupsKnockout"}
                            <label class="mini">
                                Aufsteiger je Gruppe
                                <input class="field" type="number" min="1" max="8" bind:value={draft.advancingPerGroup} disabled={structural("advancingPerGroup")} />
                            </label>
                            <div class="mini">
                                KO-Teilnehmer
                                <span class="field {bracketOk ? '' : 'text-rose-300'}">
                                    {bracketSize}
                                    {bracketOk ? "" : "– erlaubt sind 2, 4, 8, 16, 32"}
                                </span>
                            </div>
                        {/if}
                        {#if draft.format === "knockout"}
                            <label class="mini">
                                Teilnehmer im KO-Baum
                                <select class="field" bind:value={draft.knockoutTeams} disabled={structural("knockoutTeams")}>
                                    {#each [2, 4, 8, 16, 32] as size}
                                        <option value={size}>{size}</option>
                                    {/each}
                                </select>
                            </label>
                        {/if}
                        {#if draft.format !== "groups"}
                            <label class="check col-span-2">
                                <input type="checkbox" bind:checked={draft.thirdPlaceMatch} disabled={structural("thirdPlaceMatch")} />
                                Spiel um Platz 3 austragen
                            </label>
                        {/if}
                        <label class="mini">
                            Spielflächen gleichzeitig
                            <input class="field" type="number" min="1" max="16" bind:value={draft.surfaceCount} disabled={structural("surfaceCount")} />
                        </label>
                        <label class="mini">
                            Bezeichnung der Spielfläche
                            <input class="field" bind:value={draft.surfaceLabel} maxlength="20" placeholder="Tisch, Platz, Bahn …" />
                        </label>
                        <label class="mini">
                            Teilnehmer (Einzahl)
                            <input class="field" bind:value={draft.participantLabel} maxlength="20" />
                        </label>
                        <label class="mini">
                            Teilnehmer (Mehrzahl)
                            <input class="field" bind:value={draft.participantLabelPlural} maxlength="20" />
                        </label>
                        <label class="check col-span-2">
                            <input type="checkbox" bind:checked={draft.showPlayers} />
                            Spielernamen je {draft.participantLabel} erfassen und anzeigen
                        </label>
                    </div>
                </section>

                <section class="panel">
                    <div class="section-head">
                        <div>
                            <span class="kicker">Regeln</span>
                            <h2>Wertung</h2>
                        </div>
                    </div>
                    <div class="form-grid">
                        <label class="mini col-span-2">
                            Zähleinheit (was wird gezählt?)
                            <input class="field" bind:value={draft.scoreLabel} maxlength="20" placeholder="Becher, Tore, Punkte, Legs …" />
                        </label>
                        <label class="check col-span-2">
                            <input type="checkbox" bind:checked={draft.allowDraws} />
                            Unentschieden in der Gruppenphase erlauben
                        </label>
                        <label class="mini">
                            Punkte je Sieg
                            <input class="field" type="number" min="0" max="10" bind:value={draft.pointsWin} />
                        </label>
                        <label class="mini">
                            Punkte je Unentschieden
                            <input class="field" type="number" min="0" max="10" bind:value={draft.pointsDraw} disabled={!draft.allowDraws} />
                        </label>
                        <label class="mini">
                            Punkte je Niederlage
                            <input class="field" type="number" min="0" max="10" bind:value={draft.pointsLoss} />
                        </label>
                        <div class="mini col-span-2">
                            Reihenfolge der Tabellenkriterien
                            <ol class="mt-1 space-y-1.5">
                                {#each draft.tiebreakers as rule, index}
                                    <li class="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-sm normal-case">
                                        <span class="w-5 font-black text-accent-500">{index + 1}.</span>
                                        <span class="flex-1 font-bold text-zinc-200">
                                            {rule === "scoreFor" ? `Erzielte ${draft.scoreLabel}` : TIEBREAKER_LABELS[rule]}
                                        </span>
                                        <button type="button" class="btn" onclick={() => moveTiebreaker(index, -1)} disabled={index === 0} title="Nach oben">↑</button>
                                        <button type="button" class="btn" onclick={() => moveTiebreaker(index, 1)} disabled={index === draft.tiebreakers.length - 1} title="Nach unten">↓</button>
                                        <button type="button" class="btn" onclick={() => removeTiebreaker(index)} disabled={draft.tiebreakers.length === 1} title="Entfernen">✕</button>
                                    </li>
                                {/each}
                            </ol>
                            {#if availableTiebreakers.length}
                                <select class="field mt-2" onchange={addTiebreaker}>
                                    <option value="">Kriterium hinzufügen …</option>
                                    {#each availableTiebreakers as rule}
                                        <option value={rule}>{rule === "scoreFor" ? `Erzielte ${draft.scoreLabel}` : TIEBREAKER_LABELS[rule]}</option>
                                    {/each}
                                </select>
                            {/if}
                            <p class="mt-2 text-xs normal-case text-slate-500">
                                Bei Gleichstand entscheidet immer der Name alphabetisch.
                            </p>
                        </div>
                    </div>
                </section>

                <section class="panel">
                    <div class="section-head">
                        <div>
                            <span class="kicker">Ablauf</span>
                            <h2>Zeiten</h2>
                        </div>
                    </div>
                    <div class="form-grid">
                        <label class="mini">
                            Spieldauer Gruppenphase (Min.)
                            <input class="field" type="number" min="1" max="180" bind:value={draft.groupMatchMinutes} />
                        </label>
                        <label class="mini">
                            Spieldauer KO-Phase (Min.)
                            <input class="field" type="number" min="1" max="180" bind:value={draft.knockoutMatchMinutes} />
                        </label>
                        <label class="mini col-span-2">
                            Pause zwischen zwei Zeitslots (Min.)
                            <input class="field" type="number" min="0" max="60" bind:value={draft.breakMinutes} />
                        </label>
                    </div>
                    <p class="mt-3 text-xs text-slate-500">
                        Die Spielplan-Generatoren nutzen diese Werte als Vorgabe. Jede Runde
                        lässt sich danach einzeln verschieben.
                    </p>
                </section>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.03] px-5 py-4">
                <p class="text-sm text-slate-400">
                    Änderungen werden erst mit „Speichern“ übernommen.
                </p>
                <button class="btn primary" disabled={busy} onclick={save}>Einstellungen speichern</button>
            </div>

            {#if hasData || locked}
                <section class="panel border-rose-500/20">
                    <div class="section-head">
                        <div>
                            <span class="kicker">Gefahrenzone</span>
                            <h2>Zurücksetzen</h2>
                        </div>
                    </div>
                    <div class="grid gap-3 sm:grid-cols-2">
                        <button class="btn danger" disabled={busy || !locked} onclick={() => reset("schedule")}>
                            Spielplan und Ergebnisse löschen
                        </button>
                        <button class="btn danger" disabled={busy} onclick={() => reset("all")}>
                            Komplettes Turnier löschen
                        </button>
                    </div>
                </section>
            {/if}
        </div>
    {/if}
</main>

<style>
    .preset {
        display: grid;
        gap: 0.3rem;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 1rem;
        background: rgb(255 255 255 / 0.04);
        padding: 0.9rem;
        text-align: left;
        transition: 0.15s;
    }
    .preset:hover:not(:disabled) {
        background: rgb(255 255 255 / 0.09);
    }
    .preset.active {
        border-color: var(--accent);
        background: color-mix(in oklab, var(--accent) 16%, transparent);
    }
    .preset strong {
        font-size: 0.95rem;
        text-transform: uppercase;
    }
    .preset span {
        color: #94a3b8;
        font-size: 0.72rem;
        line-height: 1.35;
    }
</style>
