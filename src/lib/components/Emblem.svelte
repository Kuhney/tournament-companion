<script lang="ts">
    import type { TournamentConfig } from "$lib/tournament/config";

    let { config, class: className = "" }: { config: TournamentConfig; class?: string } =
        $props();

    // Two initials from the tournament name, e.g. "Cup Night" -> "CN".
    let initials = $derived(
        config.name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((word) => word[0]?.toUpperCase() ?? "")
            .join("") || "T",
    );
</script>

{#if config.logo}
    <img class="object-contain {className}" src={config.logo} alt={config.name} />
{:else}
    <div
        class="emblem grid aspect-square place-items-center rounded-full border-[0.18em] border-white/80 {className}"
        aria-label={config.name}
    >
        <span class="brush-type leading-none">{initials}</span>
    </div>
{/if}

<style>
    .emblem {
        container-type: inline-size;
        background: radial-gradient(
            circle at 35% 30%,
            color-mix(in oklab, var(--accent) 70%, white),
            var(--accent) 55%,
            color-mix(in oklab, var(--accent) 70%, black)
        );
        box-shadow:
            0 0.4em 1.2em rgb(0 0 0 / 0.45),
            inset 0 0.1em 0.3em rgb(255 255 255 / 0.35);
    }
    .emblem span {
        color: var(--accent-contrast);
        font-size: 42cqw;
        text-shadow: 0 0.06em 0.02em rgb(0 0 0 / 0.55);
    }
</style>
