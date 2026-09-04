<script lang="ts">
    import { fly } from "svelte/transition";

    let {
        message,
        error = false,
        nonce = 0,
        onclose,
    }: {
        message: string;
        error?: boolean;
        /** Bump to restart the timer when the same message is shown again. */
        nonce?: number;
        onclose: () => void;
    } = $props();

    // Success notes vanish quickly; errors stay long enough to be read.
    $effect(() => {
        void nonce;
        if (!message) return;
        const timer = setTimeout(onclose, error ? 7000 : 2500);
        return () => clearTimeout(timer);
    });
</script>

{#if message}
    <div
        role={error ? "alert" : "status"}
        aria-live="polite"
        transition:fly={{ y: 16, duration: 200 }}
        class="fixed bottom-5 left-4 right-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl border px-5 py-3 font-bold shadow-2xl backdrop-blur md:left-auto md:right-6 {error
            ? 'border-rose-400/30 bg-rose-950/90 text-rose-200'
            : 'border-emerald-400/30 bg-emerald-950/90 text-emerald-200'}"
    >
        <span class="flex-1">{message}</span>
        <button
            type="button"
            class="-mr-1 rounded-lg px-1.5 text-lg leading-none opacity-70 hover:opacity-100"
            aria-label="Schließen"
            onclick={onclose}>✕</button
        >
    </div>
{/if}
