<script lang="ts">
    import type { TournamentState } from "$lib/types/tournament";
    import MatchCard from "./MatchCard.svelte";
    import TournamentTimer from "./TournamentTimer.svelte";

    let { state }: { state: TournamentState } = $props();
    let roundMatches = $derived(
        state.matches
            .filter((match) => match.roundId === state.currentRound?.id)
            .sort((a, b) => a.tableNumber - b.tableNumber),
    );
    let completed = $derived(
        roundMatches.filter((match) => match.status === "finished").length,
    );
    // Fill the screen with the matches of this round: 1 → 1x1, 2 → 2x1,
    // 3-4 → 2x2, 5-6 → 3x2, more → 4 columns.
    let columns = $derived(
        roundMatches.length <= 1
            ? 1
            : roundMatches.length <= 4
              ? 2
              : roundMatches.length <= 6
                ? 3
                : 4,
    );
    let rows = $derived(Math.max(1, Math.ceil(roundMatches.length / columns)));
</script>

<div class="grid h-full min-h-0 grid-rows-[auto_1fr] gap-5">
    {#if state.currentRound}
        <div>
            <TournamentTimer round={state.currentRound} />
            <div class="mt-2 text-right text-xs font-black uppercase tracking-[.18em] text-zinc-500">
                {completed} von {roundMatches.length} Ergebnissen eingetragen
            </div>
        </div>
    {/if}

    {#if roundMatches.length}
        <div
            class="grid min-h-0 gap-5"
            style="grid-template-columns: repeat({columns}, minmax(0, 1fr)); grid-template-rows: repeat({rows}, minmax(0, 1fr));"
        >
            {#each roundMatches as match}
                <MatchCard {match} config={state.config} live />
            {/each}
        </div>
    {:else}
        <div class="brand-panel grid min-h-0 place-items-center rounded-3xl border border-dashed border-white/15 text-center">
            <div>
                <p class="eyebrow">Keine laufenden Spiele</p>
                <h1 class="display-title mt-2">Nächste Runde folgt</h1>
            </div>
        </div>
    {/if}
</div>
