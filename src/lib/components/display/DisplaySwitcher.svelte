<script lang="ts">
    import { onMount } from "svelte";
    import { fade, fly } from "svelte/transition";
    import type { TournamentState } from "$lib/types/tournament";
    import ScheduleView from "./ScheduleView.svelte";
    import CurrentMatchesView from "./CurrentMatchesView.svelte";
    import StandingsTable from "./StandingsTable.svelte";
    import OverallRankingTable from "./OverallRankingTable.svelte";
    import BracketView from "./BracketView.svelte";
    let { state: tournament }: { state: TournamentState } = $props();
    let tick = $state(0);
    onMount(() => {
        const timer = setInterval(() => tick++, 1000);
        return () => clearInterval(timer);
    });
    let hasGroups = $derived(tournament.groups.length > 0);
    let hasBracket = $derived(
        tournament.matches.some((match) => match.phase !== "group"),
    );
    let groupMatchesOpen = $derived(
        tournament.matches.some(
            (match) => match.phase === "group" && match.status === "scheduled",
        ),
    );
    let rotation = $derived(
        Math.floor(tick / tournament.settings.displayRotationSeconds) % 2 === 0,
    );
    let autoMode = $derived(
        tournament.currentRound &&
            ["running", "paused"].includes(tournament.currentRound.status)
            ? "matches"
            : tournament.settings.currentPhase !== "group" || !hasGroups
              ? hasBracket
                  ? "bracket"
                  : "schedule"
              : groupMatchesOpen
                ? rotation
                    ? "schedule"
                    : "standings"
                : hasBracket
                  ? rotation
                      ? "standings"
                      : "bracket"
                  : "standings",
    );
    let mode = $derived(
        tournament.settings.displayMode === "auto"
            ? autoMode
            : tournament.settings.displayMode,
    );
    // Wide tables need more room; lay groups out in as many columns as fit.
    let groupColumns = $derived(
        tournament.groups.length <= 1 ? 1 : tournament.groups.length <= 4 ? 2 : 3,
    );
</script>

{#key mode}<div
        class="h-full"
        in:fly={{ y: 18, duration: 450 }}
        out:fade={{ duration: 220 }}
    >
        {#if mode === "matches"}<CurrentMatchesView state={tournament} />
        {:else if mode === "schedule"}<ScheduleView state={tournament} />
        {:else if mode === "ranking"}<div class="h-full">
                <OverallRankingTable state={tournament} />
            </div>
        {:else if mode === "bracket"}<BracketView state={tournament} />
        {:else}<div
                class="grid h-full content-center gap-8"
                style="grid-template-columns: repeat({groupColumns}, minmax(0, 1fr));"
            >
                {#each tournament.groups as group}<StandingsTable
                        {group}
                        rows={tournament.standings[group.id] ?? []}
                        config={tournament.config}
                    />{/each}
            </div>{/if}
    </div>{/key}
