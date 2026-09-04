<script lang="ts">
    import type { TournamentState } from "$lib/types/tournament";
    import MatchCard from "./MatchCard.svelte";
    let { state }: { state: TournamentState } = $props();
</script>

<section class="h-full">
    <p class="eyebrow">Als Nächstes</p>
    <h1 class="display-title">Spielplan</h1>
    {#if state.nextMatches.length}
        <div class="mt-8 grid grid-cols-3 gap-5">
            {#each state.nextMatches as match}<MatchCard
                    {match}
                    config={state.config}
                    showPlayers={false}
                />{/each}
        </div>
    {:else}
        <div class="brand-panel mt-8 grid min-h-[40vh] place-items-center rounded-3xl border border-dashed border-white/15 text-center">
            <p class="brush-type text-3xl text-zinc-400">Noch keine Spiele geplant</p>
        </div>
    {/if}
</section>
