<script lang="ts">
    import type { Match, Phase, TournamentState } from "$lib/types/tournament";
    import { KNOCKOUT_PHASES, PHASE_LABELS, knockoutTeamCount } from "$lib/tournament/config";
    import BracketMatch from "./BracketMatch.svelte";

    let { state }: { state: TournamentState } = $props();

    const byPhase = (phase: Phase) =>
        state.matches
            .filter((match) => match.phase === phase)
            .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.tableNumber - b.tableNumber);

    /** Every knockout round that has matches, in play order, without the endgames. */
    let stages = $derived(
        KNOCKOUT_PHASES.filter((phase) => phase !== "thirdPlace" && phase !== "final")
            .map((phase) => ({ phase, matches: byPhase(phase) }))
            .filter((stage) => stage.matches.length > 0),
    );
    let final = $derived(byPhase("final")[0] as Match | undefined);
    let thirdPlace = $derived(byPhase("thirdPlace")[0] as Match | undefined);
    let teamCount = $derived(knockoutTeamCount(state.config));
    let columns = $derived(stages.length + (final ? 1 : 0));
</script>

<div class="flex h-full min-h-0 flex-col">
    <header class="mb-5 flex items-end justify-between gap-8">
        <div>
            <p class="eyebrow">
                Die besten {teamCount} {state.config.participantLabelPlural}
            </p>
            <h1 class="display-title">KO-Phase</h1>
        </div>
        <div
            class="mb-1 flex items-center gap-5 rounded-full border border-white/10 bg-black/15 px-5 py-2 text-xs font-black uppercase tracking-[.16em] text-zinc-400"
        >
            <span class="flex items-center gap-2"
                ><i class="size-2 rounded-full bg-accent-500"></i> Live</span
            >
            <span class="flex items-center gap-2"
                ><i class="size-2 rounded-full bg-emerald-400"></i> Gewinner</span
            >
        </div>
    </header>

    {#if columns === 0}
        <div class="brand-panel grid min-h-0 flex-1 place-items-center rounded-3xl border border-dashed border-white/15 text-center">
            <div>
                <p class="eyebrow">Noch nicht ausgelost</p>
                <h2 class="display-title mt-2">KO-Phase folgt</h2>
            </div>
        </div>
    {:else}
        <div class="bracket-grid min-h-0 flex-1" style:--columns={columns}>
            {#each stages as stage, index}
                <section class="stage">
                    <div class="stage-heading">
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div>
                            <p>Runde der letzten {stage.matches.length * 2}</p>
                            <h2>{PHASE_LABELS[stage.phase]}</h2>
                        </div>
                        <strong>{stage.matches.length} Spiele</strong>
                    </div>
                    <div
                        class="stage-matches"
                        class:dense={stage.matches.length > 4}
                        style:--rows={stage.matches.length}
                    >
                        {#each stage.matches as match}
                            <div class="connector-wrap">
                                <BracketMatch
                                    {match}
                                    config={state.config}
                                    featured={stage.phase === "semifinal"}
                                    compact={stage.matches.length > 4}
                                />
                            </div>
                        {/each}
                    </div>
                </section>
            {/each}

            {#if final}
                <section class="stage end-stage">
                    <div class="stage-heading">
                        <span>{String(stages.length + 1).padStart(2, "0")}</span>
                        <div>
                            <p>Entscheidung</p>
                            <h2>{thirdPlace ? "Endspiele" : "Finale"}</h2>
                        </div>
                    </div>
                    <div class="final-grid">
                        <div>
                            <h3 class="final-label">Finale</h3>
                            <BracketMatch match={final} config={state.config} featured />
                        </div>
                        {#if thirdPlace}
                            <div>
                                <h3 class="placement-label">Spiel um Platz 3</h3>
                                <BracketMatch match={thirdPlace} config={state.config} />
                            </div>
                        {/if}
                    </div>
                </section>
            {/if}
        </div>
    {/if}
</div>

<style>
    .bracket-grid {
        --bracket-gap: clamp(1.5rem, 3vw, 4rem);
        display: grid;
        grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
        gap: var(--bracket-gap);
    }
    .stage {
        display: grid;
        min-width: 0;
        min-height: 0;
        grid-template-rows: auto 1fr;
    }
    .stage-heading {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 0.8rem;
        margin-bottom: 1rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid rgb(255 255 255 / 0.1);
    }
    .stage-heading > span {
        color: color-mix(in oklab, var(--accent) 45%, transparent);
        font-family: var(--font-sans);
        font-size: 1.6rem;
        font-weight: 900;
        font-style: italic;
    }
    .stage-heading div {
        min-width: 0;
        flex: 1;
    }
    .stage-heading p {
        color: #71717a;
        font-size: 0.62rem;
        font-weight: 900;
        letter-spacing: 0.18em;
        text-transform: uppercase;
    }
    .stage-heading h2 {
        font-size: clamp(1.05rem, 1.5vw, 1.45rem);
        font-weight: 900;
        text-transform: uppercase;
    }
    .stage-heading strong {
        color: #71717a;
        font-size: 0.68rem;
        text-transform: uppercase;
    }
    .stage-matches {
        display: grid;
        min-height: 0;
        grid-template-rows: repeat(var(--rows), minmax(0, 1fr));
        align-content: space-around;
        gap: 0.75rem;
    }
    .stage-matches.dense {
        gap: 0.4rem;
    }
    .final-grid {
        display: grid;
        min-height: 0;
        align-content: space-around;
        gap: 2rem;
    }
    .connector-wrap {
        position: relative;
        min-width: 0;
        min-height: 0;
        align-self: center;
    }
    .connector-wrap::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 100%;
        width: calc(var(--bracket-gap) - 4px);
        border-top: 4px solid color-mix(in oklab, var(--accent) 38%, transparent);
    }
    .end-stage .stage-heading {
        border-bottom-color: color-mix(in oklab, var(--accent) 30%, transparent);
    }
    .final-label,
    .placement-label {
        margin-bottom: 0.55rem;
        font-family: var(--font-sans);
        font-size: 1rem;
        font-weight: 900;
        font-style: italic;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }
    .final-label {
        color: var(--color-accent-400);
    }
    .placement-label {
        color: #a1a1aa;
    }
</style>
