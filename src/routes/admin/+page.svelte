<script lang="ts">
    import { onMount } from "svelte";
    import Emblem from "$lib/components/Emblem.svelte";
    import Toast from "$lib/components/Toast.svelte";
    import { fetchState, performAction } from "$lib/tournament/api";
    import {
        BRAND_COLORS,
        knockoutTeamCount,
        maxTeams,
        PHASE_LABELS,
        usesGroups,
        usesKnockout,
    } from "$lib/tournament/config";
    import { applyTheme } from "$lib/tournament/theme";
    import { openDisplayWindow } from "$lib/tauri/windows";
    import type { TournamentState } from "$lib/types/tournament";
    let state: TournamentState | null = null;
    let busy = false;
    let notice = "";
    let noticeNonce = 0;
    let failed = false;
    function showNotice(text: string, isError = false) {
        notice = text;
        failed = isError;
        noticeNonce++;
    }
    type MatchFilter = "current" | "next" | "finished" | "all";
    let matchFilter: MatchFilter = "next";
    const matchFilters: MatchFilter[] = ["current", "next", "finished", "all"];
    function setMatchFilter(filter: MatchFilter) {
        matchFilter = filter;
        localStorage.setItem("admin.matchFilter", filter);
    }
    const field = "field";
    type Tab = "live" | "plan" | "display" | "help";
    const tabs: { key: Tab; label: string }[] = [
        { key: "live", label: "Leiten" },
        { key: "plan", label: "Planen" },
        { key: "display", label: "Anzeige" },
        { key: "help", label: "Hilfe" },
    ];
    let tab: Tab | null = null;
    function setTab(next: Tab) {
        tab = next;
        localStorage.setItem("admin.tab", next);
    }
    async function refresh(initial = false) {
        state = await fetchState();
        applyTheme(state.config);
        if (initial) {
            const savedTab = localStorage.getItem("admin.tab") as Tab | null;
            tab =
                savedTab && tabs.some((item) => item.key === savedTab)
                    ? savedTab
                    : state.rounds.length
                      ? "live"
                      : "plan";
            const saved = localStorage.getItem(
                "admin.matchFilter",
            ) as MatchFilter | null;
            matchFilter =
                saved && matchFilters.includes(saved)
                    ? saved
                    : state?.currentRound
                      ? "current"
                      : "next";
        }
    }
    async function call(
        body: Record<string, unknown>,
        success = "Gespeichert.",
    ) {
        busy = true;
        notice = "";
        try {
            const result = await performAction(body);
            if (!result.ok) throw new Error(result.error);
            state = result.state;
            if (body.action === "round.start") setMatchFilter("current");
            showNotice(success);
        } catch (error) {
            showNotice(
                error instanceof Error
                    ? error.message
                    : "Aktion fehlgeschlagen.",
                true,
            );
        } finally {
            busy = false;
        }
    }
    function submit(event: SubmitEvent, action: string, success?: string) {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        call(
            { action, ...Object.fromEntries(new FormData(form)) },
            success,
        ).then(() => {
            if (!failed && action.endsWith(".create")) form.reset();
        });
    }
    /** Writes a brand colour into the colour input of the surrounding form. */
    function pickColor(event: MouseEvent, hex: string) {
        const input = (event.currentTarget as HTMLElement)
            .closest("form")
            ?.querySelector<HTMLInputElement>('input[name="color"]');
        if (input) input.value = hex;
    }
    // The screen controls keep their own values so dragging a slider never
    // fights with the polled state, and saves are debounced and silent.
    let display = {
        scale: 100,
        margin: 2,
        header: true,
        guides: false,
    };
    let displayDirty = false;
    let displayTimer: ReturnType<typeof setTimeout> | undefined;
    $: if (config && !displayDirty)
        display = {
            scale: config.displayScalePercent,
            margin: config.displayMarginPercent,
            header: config.displayShowHeader,
            guides: config.displayShowGuides,
        };
    function scheduleDisplaySave() {
        displayDirty = true;
        clearTimeout(displayTimer);
        displayTimer = setTimeout(saveDisplay, 200);
    }
    async function saveDisplay() {
        const result = await performAction({
            action: "display.update",
            displayScalePercent: display.scale,
            displayMarginPercent: display.margin,
            displayShowHeader: display.header,
            displayShowGuides: display.guides,
        });
        displayDirty = false;
        if (result.ok) state = result.state;
        else showNotice(result.error, true);
    }
    function resetDisplay() {
        display = { scale: 100, margin: 2, header: true, guides: false };
        scheduleDisplaySave();
    }
    function confirmCall(
        message: string,
        body: Record<string, unknown>,
        success: string,
    ) {
        if (confirm(message)) call(body, success);
    }
    const localDate = (iso: string | null) =>
        iso
            ? new Date(iso).toLocaleString("de-DE", {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
              })
            : "Ohne Startzeit";
    const localTimeInput = (iso: string | null) =>
        iso
            ? new Date(iso).toLocaleTimeString("de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
              })
            : "";
    const timerText = (seconds: number | null | undefined) =>
        `${String(Math.floor((seconds ?? 0) / 60)).padStart(2, "0")}:${String((seconds ?? 0) % 60).padStart(2, "0")}`;
    const statusText = (status: string) =>
        ({
            scheduled: "Geplant",
            running: "Läuft",
            paused: "Pausiert",
            finished: "Beendet",
        })[status] ?? status;
    $: config = state?.config;
    $: currentRound = state?.currentRound ?? null;
    $: currentRoundMatches = (state?.matches ?? []).filter(
        (match) => match.roundId === currentRound?.id,
    );
    $: missingCurrentResults = currentRoundMatches.filter(
        (match) => match.scoreA === null || match.scoreB === null,
    ).length;
    $: canFinishCurrentRound =
        currentRoundMatches.length > 0 && missingCurrentResults === 0;
    $: nextSlotTime = (state?.matches ?? []).find(
        (match) => match.status === "scheduled",
    )?.scheduledAt;
    $: groupScheduleGenerated = (state?.rounds ?? []).some(
        (r) => r.phase === "group",
    );
    $: knockoutGenerated = (state?.rounds ?? []).some(
        (r) => r.phase !== "group",
    );
    $: finishedMatches = (state?.matches ?? []).filter(
        (m) => m.status === "finished",
    ).length;
    $: scheduleDone =
        !!config &&
        (!usesGroups(config) || groupScheduleGenerated) &&
        (!usesKnockout(config) || knockoutGenerated);
    $: steps =
        state && config
            ? [
                  {
                      label: "Einrichten",
                      detail: config.setupDone ? config.sport : "Turnierart wählen",
                      done: config.setupDone,
                      href: "/admin/setup/",
                  },
                  {
                      label: config.participantLabelPlural,
                      detail: `${state.teams.length} von ${maxTeams(config)}`,
                      done: state.teams.length === maxTeams(config),
                      tab: "plan" as Tab,
                  },
                  {
                      label: "Spielplan",
                      detail: [
                          usesGroups(config)
                              ? groupScheduleGenerated
                                  ? "Gruppen ✓"
                                  : "Gruppen offen"
                              : null,
                          usesKnockout(config)
                              ? knockoutGenerated
                                  ? "KO ✓"
                                  : "KO offen"
                              : null,
                      ]
                          .filter(Boolean)
                          .join(" · "),
                      done: scheduleDone,
                      tab: "plan" as Tab,
                  },
                  {
                      label: "Leiten",
                      detail: state.matches.length
                          ? `${finishedMatches} von ${state.matches.length} Spielen`
                          : "Noch keine Spiele",
                      done:
                          state.matches.length > 0 &&
                          finishedMatches === state.matches.length,
                      tab: "live" as Tab,
                  },
                  {
                      label: "TV-Anzeige",
                      detail: "Fenster öffnen",
                      done: false,
                      tab: "display" as Tab,
                  },
              ]
            : [];
    $: filteredMatches = (state?.matches ?? [])
        .filter((match) =>
            matchFilter === "all"
                ? true
                : matchFilter === "current"
                  ? match.roundId === state?.currentRound?.id
                  : matchFilter === "next"
                    ? match.status === "scheduled" &&
                      match.scheduledAt === nextSlotTime
                    : match.status === "finished",
        )
        .sort(
            (a, b) =>
                Number(b.status === "running") - Number(a.status === "running"),
        );
    onMount(() => {
        refresh(true);
        const timer = setInterval(() => refresh(), 3000);
        return () => clearInterval(timer);
    });
</script>

<svelte:head><title>{config?.name ?? "Turnier"} · Turnierleitung</title></svelte:head>
<main class="chalkboard min-h-screen text-zinc-100">
    <header
        class="sticky top-0 z-20 border-b-4 border-accent-700 bg-zinc-950/95 px-4 py-3 shadow-xl backdrop-blur-xl md:px-8"
    >
        <div
            class="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3"
        >
            <div class="flex items-center gap-3">
                {#if config}<Emblem {config} class="h-14 w-14 shrink-0 md:h-16 md:w-16" />{/if}
                <div>
                    <p
                        class="text-xs font-black uppercase tracking-[.28em] text-accent-500"
                    >
                        Turnierleitung · {config?.sport ?? ""}
                    </p>
                    <h1 class="text-lg font-black uppercase md:text-2xl">
                        {config?.name ?? "Turnier"}
                    </h1>
                </div>
            </div>
            <div class="ml-auto flex gap-2 md:gap-3">
                <a
                    class="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold hover:bg-white/5 md:px-4 md:text-sm"
                    href="/">Start</a
                ><a
                    class="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold hover:bg-white/5 md:px-4 md:text-sm"
                    href="/admin/setup/">Einstellungen</a
                ><button
                    class="accent-pill rounded-xl px-3 py-2 text-xs font-black uppercase text-white md:px-4 md:text-sm"
                    onclick={() => openDisplayWindow()}>TV-Anzeige ↗</button
                >
            </div>
        </div>
    </header>
    <Toast
        message={notice}
        error={failed}
        nonce={noticeNonce}
        onclose={() => (notice = "")}
    />
    {#if state && !state.config.setupDone}
        <div class="mx-auto max-w-[1680px] px-4 pt-4 lg:px-6">
            <a
                class="block rounded-2xl border border-amber-400/25 bg-amber-400/10 px-5 py-4 text-sm font-bold text-amber-200 hover:bg-amber-400/15"
                href="/admin/setup/"
            >
                Das Turnier ist noch nicht eingerichtet. Hier Turnierart, Format
                und Wertung festlegen →
            </a>
        </div>
    {/if}
    {#if !state}<div
            class="grid min-h-[70vh] place-items-center text-xl font-black text-slate-500"
        >
            DATEN WERDEN GELADEN …
        </div>{:else}
        <div class="mx-auto max-w-[1680px] space-y-5 p-4 lg:p-6">
            <nav class="steps" aria-label="Ablauf">
                {#each steps as step, index}
                    {#if step.href}
                        <a class="step" class:done={step.done} href={step.href}>
                            <span class="step-index">{step.done ? "✓" : index + 1}</span>
                            <span class="min-w-0">
                                <strong>{step.label}</strong>
                                <small>{step.detail}</small>
                            </span>
                        </a>
                    {:else}
                        <button
                            type="button"
                            class="step"
                            class:done={step.done}
                            onclick={() => {
                                setTab(step.tab!);
                                if (step.tab === "display") openDisplayWindow();
                            }}
                        >
                            <span class="step-index">{step.done ? "✓" : index + 1}</span>
                            <span class="min-w-0">
                                <strong>{step.label}</strong>
                                <small>{step.detail}</small>
                            </span>
                        </button>
                    {/if}
                {/each}
            </nav>

            <div class="tabs" role="tablist">
                {#each tabs as item}
                    <button
                        type="button"
                        role="tab"
                        class="tab-btn"
                        class:active={tab === item.key}
                        aria-selected={tab === item.key}
                        onclick={() => setTab(item.key)}>{item.label}</button
                    >
                {/each}
            </div>

            {#if tab === "live"}
                <div class="grid gap-5 xl:grid-cols-[minmax(24rem,.9fr)_minmax(0,1.5fr)]">
                    <div class="space-y-5">
                <section
                    class="panel admin-live border-accent-500/30 bg-linear-to-br from-accent-600/12 to-transparent"
                >
                    <div class="section-head">
                        <div>
                            <span class="kicker">Live-Steuerung</span>
                            <h2>Aktuelle Runde</h2>
                        </div>
                        <span
                            class="status {currentRound?.status === 'running'
                                ? 'bg-accent-600/30'
                                : ''}"
                            >{currentRound
                                ? statusText(currentRound.status)
                                : "Keine"}</span
                        >
                    </div>
                    <p class="panel-help">Steuert die laufende Runde: Timer pausieren oder anpassen und die Runde beenden, sobald alle Ergebnisse eingetragen sind. Der Timer läuft auf dem Fernseher mit.</p>
                    {#if currentRound}
                        <div
                            class="my-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div>
                                <strong class="text-2xl"
                                    >{currentRound.name}</strong
                                >
                                <p class="mt-1 text-zinc-400">
                                    {localDate(currentRound.scheduledStart)}
                                </p>
                            </div>
                            <div
                                class="font-mono text-4xl font-black tabular-nums text-accent-400 sm:text-5xl"
                            >
                                {timerText(currentRound.remainingSeconds)}
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                            <button
                                class="btn primary col-span-2"
                                disabled={busy}
                                onclick={() =>
                                    call(
                                        {
                                            action:
                                                currentRound.status === "paused"
                                                    ? "round.resume"
                                                    : "round.pause",
                                            roundId: currentRound.id,
                                        },
                                        currentRound.status === "paused"
                                            ? "Timer fortgesetzt."
                                            : "Timer pausiert.",
                                    )}
                                >{currentRound.status === "paused"
                                    ? "▶ Fortsetzen"
                                    : "Ⅱ Pausieren"}</button
                            ><button
                                class="btn"
                                onclick={() =>
                                    call(
                                        {
                                            action: "round.adjust",
                                            roundId: currentRound.id,
                                            seconds: 60,
                                        },
                                        "Minute hinzugefügt.",
                                    )}>+1 Min</button
                            ><button
                                class="btn"
                                onclick={() =>
                                    call(
                                        {
                                            action: "round.adjust",
                                            roundId: currentRound.id,
                                            seconds: -60,
                                        },
                                        "Minute abgezogen.",
                                    )}>−1 Min</button
                            ><button
                                class="btn danger col-span-2"
                                disabled={busy || !canFinishCurrentRound}
                                title={!canFinishCurrentRound
                                    ? `${missingCurrentResults} Ergebnisse fehlen noch`
                                    : "Runde beenden"}
                                onclick={() =>
                                    confirmCall(
                                        "Runde wirklich beenden?",
                                        {
                                            action: "round.finish",
                                            roundId: currentRound.id,
                                        },
                                        "Runde beendet.",
                                    )}>Runde beenden</button
                            >
                        </div>
                        {#if !canFinishCurrentRound}
                            <button
                                type="button"
                                class="mt-3 flex w-full items-center justify-between rounded-xl border border-amber-400/20 bg-amber-400/8 px-4 py-3 text-left text-sm font-bold text-amber-200"
                                onclick={() => setMatchFilter("current")}
                            >
                                <span>
                                    {missingCurrentResults === 1
                                        ? "Noch 1 Spielergebnis eintragen"
                                        : `Noch ${missingCurrentResults} Spielergebnisse eintragen`}
                                </span>
                                <span aria-hidden="true">↓</span>
                            </button>
                        {/if}
                    {:else}<p class="my-6 text-slate-400">
                            Wähle unten eine geplante Runde und starte sie.
                        </p>{/if}
                </section>
                <section class="panel admin-rounds">
                    <div class="section-head">
                        <div>
                            <span class="kicker">Planung</span>
                            <h2>Runden</h2>
                        </div>
                    </div>
                    <p class="panel-help">Jede Runde ist ein Zeitslot mit eigenem Timer. Hier Runden starten, Startzeit und Dauer verschieben oder Runden löschen. Für Sonderfälle lassen sich Runden auch von Hand anlegen.</p>
                    <div class="space-y-3">
                        {#each state.rounds as round}<div
                                class="rounded-xl border border-white/10 bg-white/[.035] p-3"
                            >
                                <div
                                    class="flex items-center justify-between gap-3"
                                >
                                    <div>
                                        <strong>{round.name}</strong>
                                        <p class="text-sm text-slate-500">
                                            {localDate(round.scheduledStart)} · {Math.round(
                                                round.durationSeconds / 60,
                                            )} Min.
                                        </p>
                                    </div>
                                    <div class="flex gap-2">
                                        {#if round.status === "scheduled"}<button
                                                class="btn primary"
                                                disabled={busy ||
                                                    currentRound !== null}
                                                title={currentRound
                                                    ? `${currentRound.name} läuft bereits`
                                                    : "Runde starten"}
                                                onclick={() =>
                                                    call(
                                                        {
                                                            action: "round.start",
                                                            roundId: round.id,
                                                            durationSeconds:
                                                                round.durationSeconds,
                                                        },
                                                        `${round.name} läuft.`,
                                                    )}>Starten</button
                                            >{:else if round.status === "finished"}<button
                                                class="btn"
                                                onclick={() =>
                                                    confirmCall(
                                                        "Runde und Spielstatus zurücksetzen?",
                                                        {
                                                            action: "round.reset",
                                                            roundId: round.id,
                                                        },
                                                        "Runde zurückgesetzt.",
                                                    )}>Reset</button
                                            >{/if}
                                        <button
                                            type="button"
                                            class="btn danger"
                                            disabled={busy ||
                                                round.status === "running" ||
                                                round.status === "paused"}
                                            title={round.status === "running" ||
                                            round.status === "paused"
                                                ? "Aktive Runden können nicht gelöscht werden"
                                                : "Runde löschen"}
                                            onclick={() =>
                                                confirmCall(
                                                    `„${round.name}“ und alle zugehörigen Spiele wirklich löschen?`,
                                                    {
                                                        action: "round.delete",
                                                        id: round.id,
                                                    },
                                                    "Runde gelöscht.",
                                                )}>Löschen</button
                                        >
                                    </div>
                                </div>
                                <details
                                    class="mt-3 border-t border-white/8 pt-3"
                                >
                                    <summary>Zeit und Dauer bearbeiten</summary>
                                    <form
                                        class="round-time-grid mt-3"
                                        onsubmit={(event) =>
                                            submit(
                                                event,
                                                "round.update",
                                                "Rundenzeit aktualisiert.",
                                            )}
                                    >
                                        <input
                                            type="hidden"
                                            name="id"
                                            value={round.id}
                                        />
                                        <label class="mini">
                                            Geplanter Start
                                            <input
                                                class={field}
                                                name="scheduledStart"
                                                type="time"
                                                value={localTimeInput(
                                                    round.scheduledStart,
                                                )}
                                                required
                                            />
                                        </label>
                                        <label class="mini">
                                            Minuten
                                            <input
                                                class={field}
                                                name="durationMinutes"
                                                type="number"
                                                min="1"
                                                value={Math.round(
                                                    round.durationSeconds / 60,
                                                )}
                                                required
                                            />
                                        </label>
                                        <button
                                            class="btn self-end"
                                            disabled={busy}
                                            >Zeit übernehmen</button
                                        >
                                    </form>
                                </details>
                            </div>{/each}
                    </div>
                    <details class="mt-4">
                        <summary>Neue Runde anlegen</summary>
                        <form
                            class="form-grid mt-4"
                            onsubmit={(event) =>
                                submit(
                                    event,
                                    "round.create",
                                    "Runde angelegt.",
                                )}
                        >
                            <input
                                class={field}
                                name="name"
                                placeholder="Name"
                                required
                            /><input
                                class={field}
                                name="roundNumber"
                                type="number"
                                min="1"
                                placeholder="Nr."
                                required
                            /><select class={field} name="phase"
                                >{#each Object.entries(PHASE_LABELS) as [value, label]}<option
                                        {value}>{label}</option
                                    >{/each}</select
                            ><label class="mini">
                                Spieldauer in Minuten
                                <input
                                    class={field}
                                    name="durationMinutes"
                                    type="number"
                                    min="1"
                                    value="10"
                                    required
                                />
                            </label><label class="mini">
                                Geplanter Start
                                <input
                                    class={field}
                                    name="scheduledStart"
                                    type="time"
                                    required
                                />
                            </label><button
                                class="btn primary col-span-2"
                                disabled={busy}>Runde speichern</button
                            >
                        </form>
                    </details>
                </section>
                    </div>
                    <div class="space-y-5">
                <section class="panel admin-matches">
                    <div class="section-head">
                        <div>
                            <span class="kicker">Schnelleingabe</span>
                            <h2>Spiele & Ergebnisse</h2>
                        </div>
                        <span class="text-sm text-slate-500"
                            >{state.matches.filter(
                                (m) => m.status === "finished",
                            ).length}/{state.matches.length} beendet</span
                        >
                    </div>
                    <p class="panel-help">Ergebnisse direkt am Spiel eintragen und speichern. Der Filter „Aktuelle Runde“ zeigt nur, was gerade gespielt wird. Tabellen, Rangliste und KO-Baum aktualisieren sich sofort, Sieger rücken automatisch weiter.</p>
                    <div
                        class="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-black/20 p-1.5 sm:grid-cols-4"
                    >
                        {#each [{ key: "current", label: "Aktuelle Runde", count: state.matches.filter((m) => m.roundId === currentRound?.id).length }, { key: "next", label: "Nächste", count: state.matches.filter((m) => m.status === "scheduled" && m.scheduledAt === nextSlotTime).length }, { key: "finished", label: "Beendet", count: state.matches.filter((m) => m.status === "finished").length }, { key: "all", label: "Alle", count: state.matches.length }] as filter}
                            <button
                                type="button"
                                class="filter-btn"
                                class:active={matchFilter === filter.key}
                                onclick={() =>
                                    setMatchFilter(filter.key as MatchFilter)}
                            >
                                {filter.label}<span>{filter.count}</span>
                            </button>
                        {/each}
                    </div>
                    <div class="space-y-3">
                        {#each filteredMatches as match}<article
                                class="rounded-2xl border p-4 {match.status ===
                                'running'
                                    ? 'border-accent-500/40 bg-accent-600/8'
                                    : 'border-white/10'}"
                            >
                                <div
                                    class="flex items-center justify-between gap-4"
                                >
                                    <div class="min-w-0">
                                        <p
                                            class="mb-1 text-xs font-black uppercase tracking-widest text-zinc-500"
                                        >
                                            {localDate(match.scheduledAt)} · {config?.surfaceLabel}
                                            {match.tableNumber} · {match.group
                                                ?.name ?? PHASE_LABELS[match.phase]}
                                        </p>
                                        <h3 class="truncate text-lg font-black">
                                            {match.teamA?.name ?? "Offen"}
                                            <span
                                                class="brush-type mx-2 text-accent-500"
                                                >vs</span
                                            >
                                            {match.teamB?.name ?? "Offen"}
                                        </h3>
                                    </div>
                                    <span class="status status-{match.status}"
                                        >{statusText(match.status)}</span
                                    >
                                </div>
                                <form
                                    class="result-grid mt-3"
                                    onsubmit={(event) =>
                                        submit(
                                            event,
                                            "match.result",
                                            "Ergebnis gespeichert.",
                                        )}
                                >
                                    <input
                                        type="hidden"
                                        name="id"
                                        value={match.id}
                                    /><label class="mini"
                                        >{match.teamA?.name ?? "Team A"}<input
                                            class={field}
                                            name="scoreA"
                                            type="number"
                                            min="0"
                                            value={match.scoreA ?? ""}
                                            placeholder="0"
                                            inputmode="numeric"
                                            onfocus={(event) =>
                                                event.currentTarget.select()}
                                            required
                                            title="In diesem Spiel erzielte {config?.scoreLabel}"
                                        /></label
                                    ><label class="mini"
                                        >{match.teamB?.name ?? "Team B"}<input
                                            class={field}
                                            name="scoreB"
                                            type="number"
                                            min="0"
                                            value={match.scoreB ?? ""}
                                            placeholder="0"
                                            inputmode="numeric"
                                            onfocus={(event) =>
                                                event.currentTarget.select()}
                                            required
                                            title="In diesem Spiel erzielte {config?.scoreLabel}"
                                        /></label
                                    ><button
                                        class="btn primary self-end"
                                        disabled={busy}
                                        >Ergebnis speichern</button
                                    >
                                </form>
                                <div class="mt-2 text-right">
                                    <button
                                        class="text-xs font-bold text-rose-400 hover:text-rose-300"
                                        onclick={() =>
                                            confirmCall(
                                                "Spiel wirklich löschen?",
                                                {
                                                    action: "match.delete",
                                                    id: match.id,
                                                },
                                                "Spiel gelöscht.",
                                            )}>Spiel löschen</button
                                    >
                                </div>
                            </article>{/each}
                        {#if filteredMatches.length === 0}
                            <div class="empty-state">
                                Keine Spiele in diesem Bereich.
                            </div>
                        {/if}
                    </div>
                    <details class="mt-4">
                        <summary>Spiel manuell anlegen</summary>
                        <form
                            class="form-grid mt-4"
                            onsubmit={(event) =>
                                submit(
                                    event,
                                    "match.create",
                                    "Spiel angelegt.",
                                )}
                        >
                            <select class={field} name="roundId" required
                                ><option value="">Runde wählen</option
                                >{#each state.rounds as round}<option
                                        value={round.id}>{round.name}</option
                                    >{/each}</select
                            ><select class={field} name="groupId"
                                ><option value="">Keine Gruppe / KO</option
                                >{#each state.groups as group}<option
                                        value={group.id}>{group.name}</option
                                    >{/each}</select
                            ><select class={field} name="teamAId" required
                                ><option value="">Team A</option
                                >{#each state.teams as team}<option
                                        value={team.id}>{team.name}</option
                                    >{/each}</select
                            ><select class={field} name="teamBId" required
                                ><option value="">Team B</option
                                >{#each state.teams as team}<option
                                        value={team.id}>{team.name}</option
                                    >{/each}</select
                            ><label class="mini">
                                {config?.surfaceLabel}
                                <input
                                    class={field}
                                    name="tableNumber"
                                    type="number"
                                    min="1"
                                    max={config?.surfaceCount ?? 1}
                                    value="1"
                                    required
                                />
                            </label><label class="mini">
                                Spielzeit
                                <input
                                    class={field}
                                    name="scheduledAt"
                                    type="time"
                                    required
                                />
                            </label><button class="btn primary col-span-2"
                                >Spiel anlegen</button
                            >
                        </form>
                    </details>
                </section>
                    </div>
                </div>
            {:else if tab === "plan"}
                <div class="grid gap-5 xl:grid-cols-2">
                    <div class="space-y-5">
                <section class="panel admin-teams">
                    <div class="section-head">
                        <div>
                            <span class="kicker">Teilnehmer</span>
                            <h2>
                                {config?.participantLabelPlural}{#if config && usesGroups(config)}
                                    & Gruppen{/if}
                            </h2>
                        </div>
                        <span class="text-sm text-slate-500"
                            >{state.teams.length}/{config ? maxTeams(config) : 0}</span
                        >
                        {#if config && usesGroups(config)}<button
                            type="button"
                            class="btn danger"
                            disabled={busy || groupScheduleGenerated}
                            title={groupScheduleGenerated
                                ? "Gruppen können nach Erstellung des Spielplans nicht mehr neu ausgelost werden."
                                : "Teams zufällig auf die Gruppen verteilen"}
                            onclick={() =>
                                confirmCall(
                                    "Teams wirklich neu auf die Gruppen auslosen? Bestehende Zuordnungen gehen verloren.",
                                    { action: "group.shuffle" },
                                    "Gruppen neu ausgelost.",
                                )}>🎲 Gruppen auslosen</button
                        >{/if}
                    </div>
                    <p class="panel-help">Teilnehmer anlegen und Gruppen zuordnen. Die Gruppen entstehen beim Speichern der Einstellungen automatisch; „Auslosen“ verteilt alle Teilnehmer zufällig und gleichmäßig. Bis zur Erzeugung des Spielplans ist alles änderbar.</p>
                    {#if config && usesGroups(config)}
                    <div class="grid gap-3 sm:grid-cols-2">
                        {#each state.groups as group}<div
                                class="rounded-2xl border border-white/10 p-4"
                            >
                                <form
                                    class="flex gap-2"
                                    onsubmit={(event) =>
                                        submit(
                                            event,
                                            "group.update",
                                            "Gruppe umbenannt.",
                                        )}
                                >
                                    <input
                                        type="hidden"
                                        name="id"
                                        value={group.id}
                                    /><input
                                        class={`${field} min-w-0 flex-1 font-bold`}
                                        name="name"
                                        value={group.name}
                                    /><button class="btn">✓</button>
                                </form>
                                <div class="mt-3 flex items-center justify-between text-sm text-slate-400">
                                    <span>
                                        {state.teams.filter(
                                            (team) => team.groupId === group.id,
                                        ).length}/{config.groupSize}
                                        {config.participantLabelPlural}
                                    </span>
                                    {#if !groupScheduleGenerated}
                                        <button
                                            type="button"
                                            class="text-xs font-bold text-rose-400 hover:text-rose-300"
                                            onclick={() =>
                                                confirmCall(
                                                    `Gruppe „${group.name}“ löschen?`,
                                                    { action: "group.delete", id: group.id },
                                                    "Gruppe gelöscht.",
                                                )}>Löschen</button
                                        >
                                    {/if}
                                </div>
                            </div>{/each}
                    </div>
                    {#if state.groups.length < config.groupCount}
                        <form
                            class="mt-4 flex gap-2"
                            onsubmit={(event) =>
                                submit(event, "group.create", "Gruppe angelegt.")}
                        >
                            <input
                                class={`${field} flex-1`}
                                name="name"
                                placeholder="Neue Gruppe"
                                required
                            /><button class="btn primary">Hinzufügen</button>
                        </form>
                    {/if}
                    {/if}
                    <div class="mt-6 space-y-2">
                        {#each state.teams as team}<details
                                class="rounded-2xl border border-white/10 bg-white/2.5 p-4"
                            >
                                <summary
                                    class="flex items-center justify-between"
                                    ><span
                                        class="flex items-center gap-3 font-bold"
                                        ><i
                                            class="size-3 rounded-full"
                                            style:background={team.color ??
                                                "#94a3b8"}
                                        ></i><span>
                                            {team.name}
                                            {#if config?.showPlayers && team.players}<small
                                                    class="block font-normal text-slate-500"
                                                    >{team.players}</small
                                                >{/if}
                                        </span></span
                                    >{#if config && usesGroups(config)}<span class="text-xs text-slate-500"
                                            >{state.groups.find(
                                                (g) => g.id === team.groupId,
                                            )?.name ?? "Ohne Gruppe"}</span
                                        >{/if}</summary
                                >
                                <form
                                    class="form-grid mt-4"
                                    onsubmit={(event) =>
                                        submit(
                                            event,
                                            "team.update",
                                            "Team aktualisiert.",
                                        )}
                                >
                                    <input
                                        type="hidden"
                                        name="id"
                                        value={team.id}
                                    /><input
                                        class={field}
                                        name="name"
                                        value={team.name}
                                        required
                                    />{#if config?.showPlayers}<input
                                            class={field}
                                            name="players"
                                            value={team.players}
                                            placeholder="Spieler, z. B. Marie & Olli"
                                        />{/if}<input
                                        class={field}
                                        name="shortName"
                                        value={team.shortName ?? ""}
                                        placeholder="Kürzel"
                                    /><input
                                        class={field}
                                        name="color"
                                        type="color"
                                        value={team.color ?? BRAND_COLORS[0].hex}
                                    /><span class="swatches col-span-2">
                                        {#each BRAND_COLORS as color}<button
                                                type="button"
                                                class="swatch"
                                                style:background={color.hex}
                                                title={color.name}
                                                aria-label={color.name}
                                                onclick={(event) => pickColor(event, color.hex)}
                                            ></button>{/each}
                                    </span>{#if config && usesGroups(config)}<select class={field} name="groupId"
                                            ><option value="">Ohne Gruppe</option
                                            >{#each state.groups as group}<option
                                                    value={group.id}
                                                    selected={team.groupId ===
                                                        group.id}
                                                    >{group.name}</option
                                                >{/each}</select
                                        >{/if}<button class="btn primary"
                                        >Speichern</button
                                    ><button
                                        type="button"
                                        class="btn danger"
                                        onclick={() =>
                                            confirmCall(
                                                `Team „${team.name}“ wirklich löschen?`,
                                                {
                                                    action: "team.delete",
                                                    id: team.id,
                                                },
                                                "Team gelöscht.",
                                            )}>Löschen</button
                                    >
                                </form>
                            </details>{/each}
                    </div>
                    <details class="mt-4">
                        <summary>{config?.participantLabel} hinzufügen</summary>
                        <form
                            class="form-grid mt-4"
                            onsubmit={(event) =>
                                submit(
                                    event,
                                    "team.create",
                                    "Team hinzugefügt.",
                                )}
                        >
                            <input
                                class={field}
                                name="name"
                                placeholder="Name"
                                required
                            />{#if config?.showPlayers}<input
                                    class={field}
                                    name="players"
                                    placeholder="Spieler, z. B. Marie & Olli"
                                />{/if}<input
                                class={field}
                                name="shortName"
                                maxlength="5"
                                placeholder="Kürzel"
                            /><input
                                class={field}
                                name="color"
                                type="color"
                                value={BRAND_COLORS[0].hex}
                            /><span class="swatches col-span-2">
                                        {#each BRAND_COLORS as color}<button
                                                type="button"
                                                class="swatch"
                                                style:background={color.hex}
                                                title={color.name}
                                                aria-label={color.name}
                                                onclick={(event) => pickColor(event, color.hex)}
                                            ></button>{/each}
                                    </span>{#if config && usesGroups(config)}<select class={field} name="groupId"
                                    ><option value="">Ohne Gruppe</option
                                    >{#each state.groups as group}<option
                                            value={group.id}>{group.name}</option
                                        >{/each}</select
                                >{/if}<button class="btn primary col-span-2"
                                >{config?.participantLabel} hinzufügen</button
                            >
                        </form>
                    </details>
                </section>
                    </div>
                    <div class="space-y-5">
                <section class="panel admin-generators">
                    <div class="section-head">
                        <div>
                            <span class="kicker">Automatik</span>
                            <h2>Spielplan-Generatoren</h2>
                        </div>
                    </div>
                    <p class="panel-help">Erzeugt den Spielplan aus den Einstellungen: zuerst die Gruppenphase, nach deren Abschluss die KO-Phase. Erzeugte Runden lassen sich danach im Bereich „Runden“ zeitlich verschieben.</p>
                    {#if config && usesGroups(config)}
                        <p class="mb-4 text-sm leading-relaxed text-slate-400">
                            Erzeugt den Gruppenspielplan: {config.groupCount}
                            {config.groupCount === 1 ? "Gruppe" : "Gruppen"} mit bis zu
                            {config.groupSize} {config.participantLabelPlural}, jeder gegen
                            jeden, verteilt auf {config.surfaceCount}
                            Spielflächen je Zeitslot. Die Startzeit gilt für den ersten
                            Zeitslot; alle weiteren folgen nach Spieldauer plus
                            {config.breakMinutes} Minuten Pause.
                        </p>
                        <form
                            class="form-grid"
                            onsubmit={(event) =>
                                submit(
                                    event,
                                    "schedule.roundRobin",
                                    "Spielplan erzeugt.",
                                )}
                        >
                            <label class="mini">
                                Spieldauer in Minuten
                                <input
                                    class={field}
                                    name="durationMinutes"
                                    type="number"
                                    min="1"
                                    value={config.groupMatchMinutes}
                                    required
                                />
                            </label><label class="mini">
                                Start des ersten Zeitslots
                                <input
                                    class={field}
                                    name="scheduledStart"
                                    type="time"
                                    value="19:00"
                                    required
                                />
                            </label><button
                                class="btn primary col-span-2"
                                disabled={busy || groupScheduleGenerated}
                                title={groupScheduleGenerated
                                    ? "Der Gruppenspielplan existiert bereits"
                                    : ""}>Gruppenphase erzeugen</button
                            >
                        </form>
                    {/if}
                    {#if config && usesKnockout(config)}
                        {#if usesGroups(config)}
                            <div class="my-5 border-t border-white/10"></div>
                        {/if}
                        <p class="mb-4 text-sm leading-relaxed text-slate-400">
                            {#if config.format === "groupsKnockout"}
                                Die besten {config.advancingPerGroup} jeder Gruppe
                                erreichen die KO-Phase mit {knockoutTeamCount(config)}
                                {config.participantLabelPlural}. Gruppensieger werden so
                                gesetzt, dass sie sich erst spät begegnen.
                            {:else}
                                Lost {knockoutTeamCount(config)}
                                {config.participantLabelPlural} in einen KO-Baum aus.
                            {/if}
                            Die weiteren Runden folgen nach Spieldauer plus
                            {config.breakMinutes} Minuten Pause. Alle Zeiten lassen sich
                            oben im Bereich „Runden“ verschieben. Gewinner
                            {#if config.thirdPlaceMatch}und Verlierer der Halbfinals{/if}
                            werden automatisch weitergereicht.
                        </p>
                        <form
                            class="form-grid"
                            onsubmit={(event) =>
                                submit(
                                    event,
                                    "schedule.knockout",
                                    "KO-Phase erzeugt.",
                                )}
                        >
                            <label class="mini">
                                Start der ersten KO-Runde
                                <input
                                    class={field}
                                    name="scheduledStart"
                                    type="time"
                                    value="21:00"
                                    required
                                />
                            </label><label class="mini">
                                Spieldauer der KO-Spiele in Minuten
                                <input
                                    class={field}
                                    name="durationMinutes"
                                    type="number"
                                    min="1"
                                    value={config.knockoutMatchMinutes}
                                    required
                                />
                            </label><button
                                class="btn col-span-2"
                                disabled={busy || knockoutGenerated}
                                title={knockoutGenerated
                                    ? "Die KO-Phase existiert bereits"
                                    : ""}>KO-Phase erzeugen</button
                            >
                        </form>
                    {/if}
                    <div class="my-5 border-t border-white/10"></div>
                    <p class="mb-4 text-sm leading-relaxed text-slate-400">
                        Lädt ein Beispielturnier passend zur aktuellen
                        Konfiguration mit {config ? maxTeams(config) : 0}
                        {config?.participantLabelPlural} und fertigem Spielplan.
                        Der komplette Datenbestand wird dabei ersetzt. Während
                        eines laufenden Turniers darf diese Aktion nicht benutzt
                        werden.
                    </p>
                    <button
                        class="btn danger w-full"
                        disabled={busy}
                        onclick={() =>
                            confirmCall(
                                "Alle Turnierdaten werden gelöscht und durch das Beispielturnier ersetzt. Fortfahren?",
                                { action: "data.seed" },
                                "Beispieldaten geladen.",
                            )}>Beispieldaten laden</button
                    >
                </section>
                    </div>
                </div>
            {:else if tab === "display"}
                <div class="mx-auto max-w-3xl">
                <section class="panel admin-display">
                    <div class="section-head">
                        <div>
                            <span class="kicker">Fernseher</span>
                            <h2>Display-Steuerung</h2>
                        </div>
                        <span class="status text-accent-300"
                            >{state.settings.displayMode}</span
                        >
                    </div>
                    <p class="panel-help">Steuert das TV-Fenster: Ansicht wählen, Wechselzeit setzen und den Bildschirm an den Fernseher anpassen. Änderungen erscheinen innerhalb von zwei Sekunden auf dem Fernseher.</p>
                    <button
                        class="btn primary mb-4 w-full"
                        onclick={() => openDisplayWindow()}
                        >TV-Anzeige in eigenem Fenster öffnen</button
                    >
                    <p class="mb-4 text-sm leading-relaxed text-slate-400">
                        Das Fenster auf den Fernseher schieben und dort mit
                        <kbd class="rounded bg-white/10 px-1.5 py-0.5">F11</kbd>
                        in den Vollbildmodus wechseln. Auf dem Fernseher selbst
                        lässt sich mit
                        <kbd class="rounded bg-white/10 px-1.5 py-0.5">+</kbd>
                        <kbd class="rounded bg-white/10 px-1.5 py-0.5">−</kbd>
                        skalieren, mit
                        <kbd class="rounded bg-white/10 px-1.5 py-0.5">G</kbd>
                        der Prüfrahmen einblenden.
                    </p>
                    <form
                        class="form-grid"
                        onsubmit={(event) =>
                            submit(
                                event,
                                "settings.update",
                                "Anzeige aktualisiert.",
                            )}
                    >
                        <label class="mini"
                            >Modus<select
                                class={field}
                                name="displayMode"
                                value={state.settings.displayMode}
                                ><option value="auto">Automatisch</option
                                ><option value="schedule">Spielplan</option
                                ><option value="standings">Tabellen</option
                                ><option value="matches">Aktuelle Spiele</option
                                ><option value="bracket">KO-Baum</option><option
                                    value="ranking">Overall-Ranking</option
                                ></select
                            ></label
                        ><label class="mini"
                            >Wechsel alle (Sek.)<input
                                class={field}
                                name="displayRotationSeconds"
                                type="number"
                                min="3"
                                value={state.settings.displayRotationSeconds}
                            /></label
                        ><button class="btn primary col-span-2"
                            >Anzeige übernehmen</button
                        >
                    </form>

                    <div class="my-5 border-t border-white/10"></div>
                    <p class="mb-3 text-sm leading-relaxed text-slate-400">
                        Bildschirm anpassen: Änderungen erscheinen sofort auf dem
                        Fernseher. Mit dem Prüfrahmen lässt sich kontrollieren, ob
                        der Rand des Bildes abgeschnitten wird.
                    </p>
                    {#if config}
                        <div class="form-grid">
                            <label class="mini col-span-2">
                                <span class="flex justify-between">
                                    <span>Skalierung</span>
                                    <span class="text-zinc-200">{display.scale} %</span>
                                </span>
                                <input
                                    type="range"
                                    min="50"
                                    max="200"
                                    step="5"
                                    bind:value={display.scale}
                                    oninput={scheduleDisplaySave}
                                />
                            </label>
                            <label class="mini col-span-2">
                                <span class="flex justify-between">
                                    <span>Sicherheitsrand (gegen Overscan)</span>
                                    <span class="text-zinc-200">{display.margin} %</span>
                                </span>
                                <input
                                    type="range"
                                    min="0"
                                    max="15"
                                    step="1"
                                    bind:value={display.margin}
                                    oninput={scheduleDisplaySave}
                                />
                            </label>
                            <label class="check">
                                <input
                                    type="checkbox"
                                    bind:checked={display.header}
                                    onchange={scheduleDisplaySave}
                                />
                                Kopfzeile mit Logo und Name
                            </label>
                            <label class="check">
                                <input
                                    type="checkbox"
                                    bind:checked={display.guides}
                                    onchange={scheduleDisplaySave}
                                />
                                Prüfrahmen einblenden
                            </label>
                            <button type="button" class="btn col-span-2" onclick={resetDisplay}
                                >Auf Standard zurücksetzen</button
                            >
                        </div>
                    {/if}
                </section>
                </div>
            {:else}
                <section class="panel help mx-auto max-w-4xl">
                    <div class="section-head">
                        <div>
                            <span class="kicker">Handbuch</span>
                            <h2>So funktioniert die Turnierleitung</h2>
                        </div>
                    </div>

                    <h3>1. Einrichten</h3>
                    <p>
                        Unter <a href="/admin/setup/">Einstellungen</a> wird das Turnier beschrieben:
                        Name und Aussehen, das Format (Gruppen + KO, nur Gruppen als Liga oder nur KO),
                        die Größen, die Wertung und die Spieldauern. Vorlagen für Bierpong, Tischkicker,
                        Fußball und Darts füllen alle Felder sinnvoll vor. Format und Größen sind
                        gesperrt, sobald ein Spielplan existiert; alles andere bleibt jederzeit änderbar.
                    </p>

                    <h3>2. Teilnehmer und Gruppen</h3>
                    <p>
                        Im Reiter „Planen“ werden die Teilnehmer angelegt. Die Gruppen werden beim
                        Speichern der Einstellungen automatisch angelegt und können umbenannt werden.
                        „Gruppen auslosen“ verteilt alle Teilnehmer zufällig und gleichmäßig. Ein
                        Kürzel und eine Farbe machen ein Team auf dem Fernseher schneller erkennbar.
                    </p>

                    <h3>3. Spielplan erzeugen</h3>
                    <p>
                        „Gruppenphase erzeugen“ plant jeder gegen jeden innerhalb jeder Gruppe und
                        verteilt die Spiele so auf die Spielflächen, dass kein Team zweimal im selben
                        Zeitslot spielt. Jeder Zeitslot wird zu einer Runde mit eigenem Timer.
                        „KO-Phase erzeugen“ ist erst möglich, wenn alle Gruppenspiele beendet sind. Die
                        Bestplatzierten jeder Gruppe werden so gesetzt, dass Gruppensieger sich erst
                        spät begegnen. Runden werden automatisch benannt (Achtelfinale, Viertelfinale …)
                        und bei mehr Spielen als Spielflächen auf mehrere Zeitslots verteilt.
                    </p>

                    <h3>4. Turnier leiten</h3>
                    <p>
                        Im Reiter „Leiten“ wird eine Runde gestartet; alle ihre Spiele gelten dann als
                        laufend, und der Timer erscheint auf dem Fernseher. Der Timer speichert einen
                        festen Endzeitpunkt, deshalb ändern Neuladen oder ein kurz geschlossenes
                        Fenster die Restzeit nicht. „Pausieren“ friert die Restzeit ein, „+1 Min“ und
                        „−1 Min“ verschieben sie. Eine Runde lässt sich erst beenden, wenn alle
                        Ergebnisse eingetragen sind. „Reset“ setzt eine beendete Runde samt Spielstatus
                        zurück; Ergebnisse bleiben erhalten und können überschrieben werden.
                    </p>
                    <p>
                        Ergebnisse werden in der eingestellten Zähleinheit erfasst. Tabellen werden nie
                        gespeichert, sondern bei jedem Aufruf aus den beendeten Spielen nach der
                        eingestellten Wertung berechnet. In der KO-Phase rückt der Sieger automatisch in
                        das nächste Spiel, die Verlierer der Halbfinals ins Spiel um Platz 3.
                        Unentschieden sind nur in der Gruppenphase möglich und nur, wenn die Einstellungen
                        es erlauben.
                    </p>

                    <h3>5. TV-Anzeige</h3>
                    <p>
                        „TV-Anzeige“ öffnet ein zweites Fenster ohne Bedienelemente. Es wird auf den
                        Fernseher geschoben und dort mit <kbd>F11</kbd> in den Vollbildmodus geschaltet.
                        Im Modus „Automatisch“ zeigt es während einer laufenden Runde die aktuellen
                        Spiele, sonst wechselt es zwischen Spielplan und Tabellen beziehungsweise KO-Baum.
                        Im Reiter „Anzeige“ lassen sich Skalierung und Sicherheitsrand einstellen, damit
                        auf jedem Fernseher alles sichtbar ist. Der Prüfrahmen zeigt die sichtbare Fläche.
                        Direkt am Fernseher funktionieren <kbd>+</kbd> und <kbd>−</kbd> für die Größe,
                        <kbd>0</kbd> zum Zurücksetzen, <kbd>G</kbd> für den Rahmen und <kbd>H</kbd> für
                        die Kopfzeile.
                    </p>

                    <h3>Daten, Sicherung und Zurücksetzen</h3>
                    <p>
                        Alle Daten liegen in einer SQLite-Datei im Datenverzeichnis der Anwendung (unter
                        Linux <code>~/.local/share/de.niclaskuhn.tournament-companion/</code>, unter
                        Windows <code>%APPDATA%\de.niclaskuhn.tournament-companion\</code>). Für eine
                        Sicherung die Anwendung beenden und die Dateien <code>tournament.db*</code>
                        kopieren. In der Gefahrenzone der Einstellungen lässt sich der Spielplan oder
                        das ganze Turnier zurücksetzen. „Beispieldaten laden“ ersetzt alle Daten durch ein
                        Beispielturnier und ist nur zum Ausprobieren gedacht.
                    </p>

                    <h3>Empfehlungen für den Turniertag</h3>
                    <ul>
                        <li>Vorab einen Probelauf mit beiden Fenstern und dem Fernseher machen.</li>
                        <li>Automatische Updates und Ruhezustand des Laptops ausschalten, Netzteil anschließen.</li>
                        <li>Vor dem Start eine Sicherung der Datenbank anlegen.</li>
                        <li>Ergebnisse direkt nach jedem Spiel eintragen, dann stimmen Tabellen und Timer immer.</li>
                    </ul>
                </section>
            {/if}
        </div>{/if}
</main>

<style>
    .steps {
        display: grid;
        gap: 0.6rem;
        grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    }
    .step {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 0.7rem;
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 1rem;
        background: rgb(255 255 255 / 0.04);
        padding: 0.65rem 0.85rem;
        text-align: left;
        transition: 0.15s;
    }
    .step:hover {
        background: rgb(255 255 255 / 0.08);
    }
    .step.done {
        border-color: rgb(52 211 153 / 0.35);
    }
    .step-index {
        display: grid;
        flex-shrink: 0;
        width: 1.9rem;
        height: 1.9rem;
        place-items: center;
        border-radius: 999px;
        background: color-mix(in oklab, var(--accent) 22%, transparent);
        color: var(--color-accent-300);
        font-size: 0.8rem;
        font-weight: 900;
    }
    .step.done .step-index {
        background: rgb(52 211 153 / 0.2);
        color: #6ee7b7;
    }
    .step strong {
        display: block;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }
    .step small {
        display: block;
        overflow: hidden;
        color: #94a3b8;
        font-size: 0.72rem;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .tabs {
        display: flex;
        gap: 0.35rem;
        border-radius: 1rem;
        background: rgb(0 0 0 / 0.25);
        padding: 0.35rem;
    }
    .tab-btn {
        flex: 1;
        border-radius: 0.75rem;
        padding: 0.7rem 1rem;
        color: #94a3b8;
        font-size: 0.85rem;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        transition: 0.15s;
    }
    .tab-btn:hover {
        color: white;
    }
    .tab-btn.active {
        background: linear-gradient(var(--accent), var(--accent-dark));
        color: var(--accent-contrast);
        box-shadow: 0 0.2rem 0 var(--accent-shadow);
    }
    .panel-help {
        margin: -0.3rem 0 1rem;
        color: #94a3b8;
        font-size: 0.82rem;
        line-height: 1.5;
    }
    .help h3 {
        margin: 1.4rem 0 0.4rem;
        color: var(--color-accent-300);
        font-size: 0.95rem;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }
    .help p,
    .help li {
        color: #cbd5e1;
        font-size: 0.9rem;
        line-height: 1.6;
    }
    .help p + p {
        margin-top: 0.6rem;
    }
    .help ul {
        margin-top: 0.4rem;
        padding-left: 1.2rem;
        list-style: disc;
    }
    .help a {
        color: var(--color-accent-300);
        text-decoration: underline;
    }
    .help kbd,
    .help code {
        border-radius: 0.3rem;
        background: rgb(255 255 255 / 0.1);
        padding: 0.05rem 0.4rem;
        font-size: 0.85em;
    }
</style>
