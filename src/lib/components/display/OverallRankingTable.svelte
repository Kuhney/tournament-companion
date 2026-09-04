<script lang="ts">
    import type { Standing, TournamentState } from "$lib/types/tournament";
    import { compareStandings } from "$lib/tournament/standings";
    import TeamBadge from "./TeamBadge.svelte";
    let { state: tournament }: { state: TournamentState } = $props();

    // Merge all groups' standings into one list, re-ranked with the same
    // configurable tiebreak order the group tables use.
    let ranking = $derived(
        (Object.values(tournament.standings).flat() as Standing[])
            .sort(compareStandings(tournament.config, tournament.matches))
            .map((row, index) => ({ ...row, position: index + 1 })),
    );
    let advancing = $derived(
        tournament.config.format === "groupsKnockout"
            ? tournament.config.advancingPerGroup * tournament.groups.length
            : 0,
    );
    let showDraws = $derived(tournament.config.allowDraws);

    // Split into two side-by-side columns so every team is visible at once
    // on a landscape TV — no matter how many teams there are, each column's
    // rows are sized with `1fr` so the whole list always fills the screen
    // height exactly, with no scrolling.
    let half = $derived(Math.ceil(ranking.length / 2));
    let columns = $derived(
        ranking.length > 8
            ? [ranking.slice(0, half), ranking.slice(half)]
            : [ranking],
    );

    let gridCols = $derived(
        showDraws
            ? "grid-cols-[3rem_1fr_2.5rem_2.5rem_2.5rem_2.5rem_4.5rem_3.5rem_3.5rem]"
            : "grid-cols-[3rem_1fr_2.5rem_2.5rem_2.5rem_4.5rem_3.5rem_3.5rem]",
    );
</script>

<section class="brand-panel flex h-full flex-col overflow-hidden rounded-[1.3rem]">
    <header
        class="flex items-center justify-between border-b-4 border-accent-600 bg-linear-to-r from-accent-700/40 to-transparent px-7 py-5"
    >
        <h2 class="text-[clamp(1.3rem,2vw,2rem)] font-black uppercase">
            Gesamtrangliste
        </h2>
        <span class="brush-type text-sm text-white">Alle Gruppen</span>
    </header>
    <div
        class="grid min-h-0 flex-1 divide-x divide-white/[.07]"
        style="grid-template-columns: repeat({columns.length}, minmax(0, 1fr));"
    >
        {#each columns as column}
            <div class="flex min-h-0 flex-col">
                <div
                    class="{gridCols} grid items-center px-5 py-2 text-[clamp(.55rem,1.4dvh,.75rem)] uppercase tracking-wider text-slate-500"
                >
                    <span>#</span><span>{tournament.config.participantLabel}</span>
                    <span class="text-center">SP</span
                    ><span class="text-center">S</span
                    >{#if showDraws}<span class="text-center">U</span>{/if}<span
                        class="text-center">N</span
                    ><span class="text-center">{tournament.config.scoreLabel}</span
                    ><span class="text-center">+/−</span
                    ><span class="pr-1 text-right">Pkt</span>
                </div>
                <div
                    class="grid min-h-0 flex-1"
                    style="grid-template-rows: repeat({column.length}, 1fr);"
                >
                    {#each column as row}
                        <div
                            class="{gridCols} grid min-h-0 items-center overflow-hidden border-t border-white/[.07] px-5 text-[clamp(.75rem,2.4dvh,1.15rem)] {row.position <=
                            advancing
                                ? 'bg-accent-600/10'
                                : ''}"
                        >
                            <span class="font-black text-accent-500"
                                >{row.position}</span
                            >
                            <span class="min-w-0 truncate"
                                ><TeamBadge team={row.team} compact /></span
                            >
                            <span class="text-center">{row.played}</span>
                            <span class="text-center">{row.won}</span>
                            {#if showDraws}<span class="text-center">{row.drawn}</span>{/if}
                            <span class="text-center">{row.lost}</span>
                            <span class="text-center tabular-nums"
                                >{row.scoreFor}:{row.scoreAgainst}</span
                            >
                            <span class="text-center tabular-nums"
                                >{row.scoreDiff > 0 ? "+" : ""}{row.scoreDiff}</span
                            >
                            <span
                                class="pr-1 text-right text-xl font-black tabular-nums"
                                >{row.points}</span
                            >
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
</section>
