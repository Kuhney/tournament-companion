<script lang="ts">
    import type { Match } from "$lib/types/tournament";
    import type { TournamentConfig } from "$lib/tournament/config";

    let {
        match,
        config,
        featured = false,
        compact = false,
    }: {
        match: Match;
        config: TournamentConfig;
        featured?: boolean;
        compact?: boolean;
    } = $props();

    const matchTime = $derived(
        new Intl.DateTimeFormat("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(match.scheduledAt)),
    );
    const winnerId = $derived(
        match.status === "finished" && match.scoreA !== match.scoreB
            ? (match.scoreA ?? 0) > (match.scoreB ?? 0)
                ? match.teamAId
                : match.teamBId
            : null,
    );
</script>

<article
    class="bracket-match brand-panel relative min-w-0 overflow-hidden rounded-2xl border {compact
        ? 'p-2.5'
        : 'p-4'} {featured
        ? 'border-accent-500/50 ring-1 ring-accent-500/25'
        : 'border-white/10'}"
>
    <header class="flex items-center justify-between gap-3 {compact ? 'mb-1.5' : 'mb-3'}">
        <span class="text-xs font-black uppercase tracking-[.18em] text-zinc-500">
            {matchTime} Uhr · {config.surfaceLabel} {match.tableNumber}
        </span>
        <span
            class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[.62rem] font-black uppercase tracking-wider {match.status === 'running'
                ? 'bg-accent-500/15 text-accent-300'
                : match.status === 'finished'
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : 'bg-white/5 text-zinc-400'}"
        >
            <i
                class="size-1.5 rounded-full"
                class:animate-pulse={match.status === "running"}
                class:bg-accent-400={match.status === "running"}
                class:bg-emerald-400={match.status === "finished"}
                class:bg-zinc-500={match.status === "scheduled"}
            ></i>
            {match.status === "running"
                ? "Live"
                : match.status === "finished"
                  ? "Beendet"
                  : "Geplant"}
        </span>
    </header>

    <div
        class="team-row"
        class:compact
        class:winner={winnerId !== null && winnerId === match.teamAId}
    >
        <i
            class="team-color"
            style:background={match.teamA?.color ?? "#52525b"}
        ></i>
        <span class="team-name">{match.teamA?.name ?? "Noch offen"}</span>
        <strong>{match.scoreA ?? "–"}</strong>
    </div>
    <div class="h-px bg-white/8 {compact ? 'my-1' : 'my-2'}"></div>
    <div
        class="team-row"
        class:compact
        class:winner={winnerId !== null && winnerId === match.teamBId}
    >
        <i
            class="team-color"
            style:background={match.teamB?.color ?? "#52525b"}
        ></i>
        <span class="team-name">{match.teamB?.name ?? "Noch offen"}</span>
        <strong>{match.scoreB ?? "–"}</strong>
    </div>
</article>

<style>
    .team-row {
        display: grid;
        min-width: 0;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.65rem;
        color: #d4d4d8;
    }
    .team-row.winner {
        color: white;
    }
    .team-color {
        width: 0.65rem;
        height: 0.65rem;
        border-radius: 999px;
        box-shadow: 0 0 0 3px rgb(255 255 255 / 0.06);
    }
    .team-name {
        overflow: hidden;
        font-size: clamp(0.9rem, 1.2vw, 1.2rem);
        font-weight: 800;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .compact .team-name {
        font-size: clamp(0.75rem, 0.95vw, 0.95rem);
    }
    strong {
        min-width: 1.5rem;
        color: #a1a1aa;
        font-size: clamp(1.1rem, 1.5vw, 1.5rem);
        font-weight: 900;
        text-align: right;
    }
    .compact strong {
        font-size: clamp(0.9rem, 1.1vw, 1.1rem);
    }
    .winner strong {
        color: #86efac;
    }
    .winner .team-name::after {
        content: "  ✓";
        color: #4ade80;
    }
</style>
