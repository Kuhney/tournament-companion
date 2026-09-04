<script lang="ts">
    import type { Group, Standing } from "$lib/types/tournament";
    import type { TournamentConfig } from "$lib/tournament/config";
    import TeamBadge from "./TeamBadge.svelte";
    let {
        group,
        rows,
        config,
    }: { group: Group; rows: Standing[]; config: TournamentConfig } = $props();

    let advancing = $derived(
        config.format === "groupsKnockout" ? config.advancingPerGroup : 0,
    );
    let showDraws = $derived(config.allowDraws);
</script>

<section class="brand-panel overflow-hidden rounded-[1.3rem]">
    <header
        class="flex items-center justify-between border-b-4 border-accent-600 bg-linear-to-r from-accent-700/40 to-transparent px-7 py-5"
    >
        <h2 class="text-[clamp(1.3rem,2vw,2rem)] font-black uppercase">
            {group.name}
        </h2>
        <span class="brush-type text-sm text-white">Tabelle</span>
    </header>
    <table class="w-full text-[clamp(.8rem,1.15vw,1.15rem)]">
        <thead class="text-xs uppercase tracking-wider text-slate-500"
            ><tr
                ><th class="px-5 py-3 text-left">#</th><th
                    class="px-3 py-3 text-left">{config.participantLabel}</th
                ><th>SP</th><th>S</th>{#if showDraws}<th>U</th>{/if}<th>N</th><th
                    >{config.scoreLabel}</th
                ><th>+/−</th><th class="pr-5">Pkt</th></tr
            ></thead
        >
        <tbody
            >{#each rows as row}<tr
                    class="border-t border-white/[.07] {row.position <= advancing
                        ? 'bg-accent-600/10'
                        : ''}"
                    ><td class="px-5 py-3 font-black text-accent-500"
                        >{row.position}</td
                    ><td class="px-3 py-3"
                        ><TeamBadge team={row.team} compact /></td
                    ><td class="text-center">{row.played}</td><td
                        class="text-center">{row.won}</td
                    >{#if showDraws}<td class="text-center">{row.drawn}</td>{/if}<td
                        class="text-center">{row.lost}</td
                    ><td class="text-center tabular-nums"
                        >{row.scoreFor}:{row.scoreAgainst}</td
                    ><td class="text-center tabular-nums"
                        >{row.scoreDiff > 0 ? "+" : ""}{row.scoreDiff}</td
                    ><td class="pr-5 text-center text-xl font-black tabular-nums"
                        >{row.points}</td
                    ></tr
                >{/each}</tbody
        >
    </table>
</section>
