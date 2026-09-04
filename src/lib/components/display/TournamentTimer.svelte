<script lang="ts">
    import { onMount } from "svelte";
    import type { TournamentRound } from "$lib/types/tournament";

    let { round }: { round: TournamentRound } = $props();
    let clock = $state(Date.now());

    onMount(() => {
        const timer = window.setInterval(() => (clock = Date.now()), 250);
        return () => clearInterval(timer);
    });

    let seconds = $derived(
        round.status === "running" && round.endTime
            ? Math.max(0, Math.ceil((Date.parse(round.endTime) - clock) / 1000))
            : Math.max(0, round.remainingSeconds ?? round.durationSeconds),
    );
    let label = $derived(
        `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`,
    );
    let progress = $derived(
        round.durationSeconds > 0
            ? Math.min(100, Math.max(0, (seconds / round.durationSeconds) * 100))
            : 0,
    );
    let plannedStart = $derived(
        round.scheduledStart
            ? new Intl.DateTimeFormat("de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
              }).format(new Date(round.scheduledStart))
            : null,
    );
</script>

<section
    class="brand-panel relative overflow-hidden rounded-2xl border-l-4 border-l-accent-600 px-7 py-4"
    class:border-l-amber-400={round.status === "paused"}
    class:text-accent-300={seconds > 0 && seconds <= 60}
>
    <div class="flex items-center justify-between gap-8">
        <div class="min-w-0">
            <div class="mb-1 flex items-center gap-3">
                <span
                    class="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[.22em] text-accent-400"
                >
                    <i class="size-2 animate-pulse rounded-full bg-accent-500"></i>
                    {round.status === "paused" ? "Pausiert" : "Laufende Runde"}
                </span>
                {#if plannedStart}
                    <span class="text-sm font-bold text-zinc-500"
                        >Start {plannedStart} Uhr</span
                    >
                {/if}
            </div>
            <h1 class="truncate text-[clamp(1.6rem,2.5vw,2.8rem)] font-black uppercase">
                {round.name}
            </h1>
        </div>

        {#if seconds === 0}
            <div class="brush-type shrink-0 animate-pulse text-[clamp(2rem,4vw,4.5rem)] leading-none text-accent-500">
                Zeit abgelaufen
            </div>
        {:else}
            <div
                class="shrink-0 font-mono text-[clamp(4rem,7vw,7.5rem)] font-black leading-none tabular-nums tracking-[-.08em]"
            >
                {label}
            </div>
        {/if}
    </div>

    <div class="absolute inset-x-0 bottom-0 h-1.5 bg-white/5">
        <div
            class="h-full bg-accent-600 transition-[width] duration-300"
            class:bg-amber-400={round.status === "paused"}
            style:width={`${progress}%`}
        ></div>
    </div>
</section>
