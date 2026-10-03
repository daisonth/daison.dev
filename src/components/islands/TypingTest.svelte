<script lang="ts">
  /**
   * The passage is plain text rendered as one <span> per character, styled
   * by comparing index-for-index against what's typed so far — correct,
   * incorrect, or "this is the next one" (a block cursor). Typing itself
   * happens in a visually-hidden <input> layered over the passage, so the
   * user's eyes stay on the text instead of bouncing to a separate box —
   * same pattern real typing-test sites use.
   *
   * The passage viewport is a fixed height with the cursor auto-scrolled
   * into view, rather than growing to show the whole generated word bank —
   * both because a wall of 200+ words is unpleasant to look at, and
   * because it's what was pushing the results panel below the fold after
   * finishing. Results render *above* the passage once a test finishes,
   * for the same "don't make someone scroll to see their own score" reason.
   *
   * The timer only starts on the first keystroke, not on page load/mount.
   */
  import { onMount } from "svelte";
  import { TYPING_WORDS } from "../../lib/typingWords";
  import { createFullscreen } from "../../lib/fullscreen.svelte";

  interface HistoryEntry {
    id: string;
    wpm: number;
    accuracy: number;
    duration: number;
    date: string;
  }

  const DURATIONS = [15, 30, 60] as const;
  const HISTORY_KEY = "daison:tools:typing-test:history";
  const HISTORY_LIMIT = 50;
  // Once the untyped buffer gets this short, more words get appended — a
  // fast typist should never be able to run out of text mid-test.
  const MIN_BUFFER_CHARS = 60;

  function generateWords(count: number): string {
    const words: string[] = [];
    for (let i = 0; i < count; i++) {
      words.push(TYPING_WORDS[Math.floor(Math.random() * TYPING_WORDS.length)]);
    }
    return words.join(" ");
  }

  const fullscreen = createFullscreen();

  let duration: number = $state(30);
  let targetText = $state(generateWords(220));
  let typed = $state("");
  let status: "idle" | "running" | "finished" = $state("idle");
  let remaining = $state(duration);
  let history: HistoryEntry[] = $state([]);

  let inputEl: HTMLInputElement | undefined = $state();
  let passageEl: HTMLDivElement | undefined = $state();
  let timerHandle: ReturnType<typeof setInterval> | null = null;

  const correctChars = $derived(
    [...typed].reduce((count, ch, i) => count + (ch === targetText[i] ? 1 : 0), 0),
  );
  const accuracy = $derived(typed.length > 0 ? Math.round((correctChars / typed.length) * 100) : 100);
  const elapsedSeconds = $derived(duration - remaining);
  const wpm = $derived(elapsedSeconds > 0 ? Math.round(correctChars / 5 / (elapsedSeconds / 60)) : 0);

  function charClass(i: number): string {
    if (i < typed.length) {
      return typed[i] === targetText[i] ? "text-ink" : "bg-red/20 text-red underline decoration-2";
    }
    if (i === typed.length && status !== "finished") return "bg-ink text-paper";
    return "text-ink/30";
  }

  function startTest() {
    status = "running";
    remaining = duration;
    timerHandle = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) finishTest();
    }, 1000);
  }

  function finishTest() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
    remaining = 0;
    status = "finished";
    logHistory();
  }

  function persistHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Storage unavailable — history just won't persist this session.
    }
  }

  function logHistory() {
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      wpm,
      accuracy,
      duration,
      date: new Date().toISOString(),
    };
    history = [entry, ...history].slice(0, HISTORY_LIMIT);
    persistHistory();
  }

  function clearHistory() {
    history = [];
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // See persistHistory.
    }
  }

  function restart() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
    status = "idle";
    typed = "";
    remaining = duration;
    targetText = generateWords(220);
    inputEl?.focus();
  }

  function selectDuration(next: number) {
    duration = next;
    restart();
  }

  function handleInput() {
    if (status === "finished") return;
    if (status === "idle" && typed.length > 0) startTest();

    if (targetText.length - typed.length < MIN_BUFFER_CHARS) {
      targetText += " " + generateWords(60);
    }
  }

  function focusInput() {
    inputEl?.focus();
  }

  // Keeps the current cursor position scrolled into view within the
  // fixed-height passage viewport as you type, instead of showing the
  // entire (potentially very long) generated text at once.
  $effect(() => {
    void typed.length;
    passageEl?.querySelector('[data-cursor="true"]')?.scrollIntoView({ block: "center" });
  });

  onMount(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) history = JSON.parse(stored);
    } catch {
      // Corrupt or inaccessible storage — start with empty history.
    }

    inputEl?.focus();

    return () => {
      if (timerHandle) clearInterval(timerHandle);
    };
  });
</script>

{#snippet controls()}
  <div class="flex gap-1 border-b border-ink/30">
    {#each DURATIONS as d (d)}
      <button
        type="button"
        onclick={() => selectDuration(d)}
        class={`border-b-2 px-3 py-2 text-sm transition-colors ${
          duration === d ? "border-red text-red" : "border-transparent text-ink/60 hover:text-ink"
        }`}
      >
        {d}s
      </button>
    {/each}
  </div>

  <div class="flex items-center gap-4 text-sm">
    {#if status === "running"}
      <p class="font-mono text-ink/60">{remaining}s</p>
    {/if}
    <button type="button" onclick={restart} class="text-ink/50 hover:text-red">restart</button>
    <button
      type="button"
      onclick={() => fullscreen.toggle()}
      class="text-ink/50 hover:text-red"
    >
      {fullscreen.isFullscreen ? "exit fullscreen" : "fullscreen"}
    </button>
  </div>
{/snippet}

{#snippet results()}
  <div class="border border-ink/30 p-4">
    <div class="flex gap-8">
      <div>
        <p class="text-xs tracking-wide text-ink/50 uppercase">wpm</p>
        <p class="font-mono text-3xl font-bold">{wpm}</p>
      </div>
      <div>
        <p class="text-xs tracking-wide text-ink/50 uppercase">accuracy</p>
        <p class="font-mono text-3xl font-bold">{accuracy}%</p>
      </div>
    </div>
    <button
      type="button"
      onclick={restart}
      class="mt-4 border border-ink px-4 py-2 text-sm transition-colors hover:border-red hover:text-red"
    >
      try again
    </button>
  </div>
{/snippet}

{#snippet passageContent()}
  {#each [...targetText] as char, i (i)}
    <span data-cursor={i === typed.length ? "true" : undefined} class={charClass(i)}>{char}</span>
  {/each}
  <input
    bind:this={inputEl}
    bind:value={typed}
    oninput={handleInput}
    onpaste={(e) => e.preventDefault()}
    type="text"
    autocomplete="off"
    autocapitalize="off"
    autocorrect="off"
    spellcheck="false"
    disabled={status === "finished"}
    aria-label="typing test input — type the text above"
    class="absolute inset-0 h-0 w-0 opacity-0"
  />
{/snippet}

{#snippet historyList()}
  {#if history.length > 0}
    <div class="mt-6">
      <div class="flex items-center justify-between">
        <h2 class="text-xs tracking-wide text-ink/50 uppercase">history</h2>
        <button type="button" onclick={clearHistory} class="text-xs text-ink/50 hover:text-red">
          clear
        </button>
      </div>
      <ul class="mt-2 divide-y divide-ink/15 border-t border-b border-ink/15">
        {#each history as entry (entry.id)}
          <li class="flex items-center justify-between px-1 py-2 text-sm">
            <span class="text-ink/70">
              {entry.duration}s · {new Date(entry.date).toLocaleDateString()}
            </span>
            <span class="font-mono font-semibold">{entry.wpm} wpm · {entry.accuracy}%</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
{/snippet}

{#if fullscreen.isFullscreen}
  <div use:fullscreen.portal class="paper fixed inset-0 z-50 flex flex-col gap-2 bg-paper p-3">
    <div class="flex items-center justify-between border-b border-ink/15 pb-2">
      <h2 class="font-mono text-sm font-bold tracking-wide text-ink/70 uppercase">typing test</h2>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2">
      {@render controls()}
    </div>

    {#if status === "finished"}
      {@render results()}
    {/if}

    <div
      bind:this={passageEl}
      onclick={focusInput}
      class="relative flex-1 overflow-hidden border border-ink/30 p-4 font-mono text-lg leading-relaxed whitespace-pre-wrap"
    >
      {@render passageContent()}
    </div>

    {#if status !== "finished"}
      <p class="text-xs text-ink/50">
        {status === "idle" ? "Start typing to begin." : `${wpm} wpm · ${accuracy}% accuracy so far`}
      </p>
    {/if}

    <div class="overflow-y-auto">
      {@render historyList()}
    </div>
  </div>
{:else}
  <div class="mx-auto max-w-2xl">
    <div class="flex flex-wrap items-center justify-between gap-2">
      {@render controls()}
    </div>

    {#if status === "finished"}
      <div class="mt-6">
        {@render results()}
      </div>
    {/if}

    <div
      bind:this={passageEl}
      onclick={focusInput}
      class="relative mt-6 h-32 overflow-hidden border border-ink/30 p-4 font-mono text-lg leading-relaxed whitespace-pre-wrap"
    >
      {@render passageContent()}
    </div>

    {#if status !== "finished"}
      <p class="mt-3 text-xs text-ink/50">
        {status === "idle" ? "Start typing to begin." : `${wpm} wpm · ${accuracy}% accuracy so far`}
      </p>
    {/if}

    {@render historyList()}
  </div>
{/if}
