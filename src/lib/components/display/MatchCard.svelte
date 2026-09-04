<script lang="ts">
    import TeamBadge from "./TeamBadge.svelte";
    import type { Match } from "$lib/types/tournament";
    import { PHASE_LABELS, type TournamentConfig } from "$lib/tournament/config";

    let {
        match,
        config,
        live = false,
        showPlayers = true,
        compact = false,
    }: {
        match: Match;
        config: TournamentConfig;
        live?: boolean;
        showPlayers?: boolean;
        compact?: boolean;
    } = $props();

    const matchTime = $derived(
        new Intl.DateTimeFormat("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(match.scheduledAt)),
    );
    const phaseName = $derived(
        match.phase === "group"
            ? (match.group?.name ?? PHASE_LABELS.group)
            : PHASE_LABELS[match.phase],
    );
    const players = $derived(showPlayers && config.showPlayers);
</script>

{#if live}
    <article
        class="brand-panel relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-accent-500/30 p-[clamp(1.1rem,1.6vw,1.7rem)] ring-1 ring-accent-500/25 {match.status ===
        'finished'
            ? 'bg-emerald-500/5'
            : ''}"
    >
        <header class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <span
                    class="accent-pill rounded-xl px-8 py-2 text-[clamp(1rem,1.5vw,1.45rem)] font-black uppercase"
                    >{config.surfaceLabel} {match.tableNumber}</span
                >
                <span
                    class="text-sm font-black uppercase tracking-[.18em] text-zinc-500"
                    >{phaseName}</span
                >
            </div>
            <span
                class="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em]"
                class:text-emerald-400={match.status === "finished"}
                class:text-accent-400={match.status !== "finished"}
            >
                <i
                    class="size-2 rounded-full"
                    class:animate-pulse={match.status !== "finished"}
                    class:bg-emerald-400={match.status === "finished"}
                    class:bg-accent-500={match.status !== "finished"}
                ></i>
                {match.status === "finished" ? "Ergebnis da" : "Live"}
            </span>
        </header>

        <div
            class="mt-8 grid min-h-0 flex-1 content-center gap-[clamp(.45rem,1vh,.8rem)] text-[clamp(1.35rem,2vw,2.15rem)]"
        >
            <TeamBadge team={match.teamA} showPlayers={players} />
            <div
                class="flex items-center gap-4 text-sm font-black uppercase tracking-[.3em] text-accent-500"
            >
                <span class="h-px flex-1 bg-accent-500/20"></span>
                gegen
                <span class="h-px flex-1 bg-accent-500/20"></span>
            </div>
            <TeamBadge team={match.teamB} showPlayers={players} />
        </div>

        <footer class="mt-3 flex shrink-0 justify-end pt-2">
            {#if match.status === "finished"}
                <strong
                    class="text-3xl font-black tabular-nums text-emerald-300"
                    >{match.scoreA} : {match.scoreB}</strong
                >
            {:else}
                <span class="brush-type text-sm text-accent-400"
                    >Jetzt spielen</span
                >
            {/if}
        </footer>
    </article>
{:else}
    <article
        class="brand-panel relative h-full overflow-hidden rounded-[1.3rem] border-l-[.45rem] border-l-accent-600 {compact
            ? 'p-3'
            : 'p-[clamp(1rem,2vw,2rem)]'}"
    >
        <div
            class="flex items-center justify-between font-black uppercase text-slate-400 {compact
                ? 'mb-2 text-[.62rem] tracking-[.14em]'
                : 'mb-5 text-[clamp(.7rem,1vw,1rem)] tracking-[.25em]'}"
        >
            <span>{matchTime} Uhr · {config.surfaceLabel} {match.tableNumber}</span>
            <span>{phaseName}</span>
        </div>
        <div class={compact ? "text-base" : "text-[clamp(1.3rem,2.1vw,2.4rem)]"}>
            <TeamBadge team={match.teamA} showPlayers={players} {compact} />
            <div class="text-center text-accent-500">VS</div>
            <TeamBadge team={match.teamB} showPlayers={players} {compact} />
        </div>
        {#if match.status === "finished"}
            <div
                class="absolute right-4 top-1/2 -translate-y-1/2 font-black tabular-nums {compact
                    ? 'text-2xl'
                    : 'text-4xl'}"
            >
                {match.scoreA} : {match.scoreB}
            </div>
        {/if}
    </article>
{/if}
