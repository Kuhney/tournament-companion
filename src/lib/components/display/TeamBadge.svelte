<script lang="ts">
    import type { Team } from "$lib/types/tournament";
    let {
        team,
        compact = false,
        showPlayers = true,
    }: {
        team: Team | null;
        compact?: boolean;
        showPlayers?: boolean;
    } = $props();
</script>

<div class="flex min-w-0 items-center gap-[.65em]">
    <span
        class="grid shrink-0 place-items-center rounded-full border-2 border-white/70 font-black text-zinc-950 shadow-md text-[0.6em]"
        class:size-9={compact}
        class:size-14={!compact}
        style:background={team?.color ?? "#d4d4d4"}
        >{team?.shortName?.slice(0, 2) ?? "?"}</span
    >
    <span class="min-w-0">
        <span class="block truncate font-extrabold"
            >{team?.name ?? "Noch offen"}</span
        >
        {#if team?.players && !compact && showPlayers}
            <span
                class="mt-0.5 block truncate text-[0.52em] font-medium text-slate-400"
                >{team.players}</span
            >
        {/if}
    </span>
</div>
