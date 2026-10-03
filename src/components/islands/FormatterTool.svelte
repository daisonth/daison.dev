<script lang="ts">
  /**
   * Shared textarea + format/minify/copy/clear UI for the JSON and XML
   * formatter tools. Takes its parsing logic as props so the two tools
   * don't duplicate this entire component. Only ever used nested inside
   * another Svelte component (JsonFormatter/XmlFormatter) — never hydrated
   * directly by Astro — so function props are fine here even though Astro
   * itself can't serialize functions across the server/client boundary.
   *
   * Fullscreen is an in-page overlay (fixed, covers the site chrome
   * visually) rather than the browser Fullscreen API — deliberately, so it
   * works identically everywhere with no permission prompt and no
   * OS-chrome side effects. It's local to this component on purpose: only
   * the formatter tools need it, so it doesn't live as a page-level
   * pattern other tools would have to opt out of.
   *
   * Tree view is read-only by design — editing happens in the plain
   * textarea. Trying to make a collapsible view directly editable (hiding
   * folded line ranges from a live textarea) isn't really possible with a
   * plain <textarea>, and a contenteditable-based alternative brings its
   * own pile of quirks; a separate view for exploring structure is simpler
   * and avoids both.
   */
  import type { FoldableNode } from "../../lib/formatters/foldTree";
  import { collectFoldableIds, flattenTree } from "../../lib/formatters/foldTree";
  import { SvelteSet } from "svelte/reactivity";
  import { createFullscreen } from "../../lib/fullscreen.svelte";

  interface Props {
    label: string;
    placeholder: string;
    format: (input: string) => string;
    minify: (input: string) => string;
    validate: (input: string) => string | null;
    buildTree: (input: string) => FoldableNode;
  }

  let { label, placeholder, format, minify, validate, buildTree }: Props = $props();

  const fullscreen = createFullscreen();

  let text = $state("");
  let copied = $state(false);
  let viewMode: "text" | "tree" = $state("text");
  // SvelteSet, not a plain Set: $state only deep-reactively proxies plain
  // objects/arrays — mutating methods on a built-in Set/Map (.add/.delete)
  // don't trigger reactivity unless it's one of Svelte's own reactive
  // wrappers. A plain `$state(new Set())` here silently does nothing on
  // `.add`/`.delete`.
  let collapsed: Set<string> = $state(new SvelteSet());
  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let gutterEl: HTMLDivElement | undefined = $state();

  const trimmed = $derived(text.trim());
  const validationError = $derived(trimmed ? validate(text) : null);
  const isValid = $derived(trimmed.length === 0 || validationError === null);
  // Line numbers only mean something against unwrapped lines (one logical
  // line = one visual row) — the textarea disables wrapping in fullscreen
  // specifically so this stays accurate.
  const lineNumbers = $derived(
    Array.from({ length: Math.max(1, text.split("\n").length) }, (_, i) => i + 1),
  );

  const tree = $derived.by(() => {
    if (viewMode !== "tree" || !trimmed || validationError) return null;
    try {
      return buildTree(text);
    } catch {
      return null;
    }
  });
  // Flattened to a plain row list — collapsing hides whole subtrees, so a
  // row's line number only makes sense computed from what's *currently*
  // visible, not from the static tree shape.
  const rows = $derived(tree ? flattenTree(tree, 0, collapsed) : []);

  function runFormat() {
    if (!trimmed || validationError) return;
    text = format(text);
  }

  function runMinify() {
    if (!trimmed || validationError) return;
    text = minify(text);
  }

  function clearText() {
    text = "";
    // Always land back on the editable textarea — an empty tree pane
    // serves no purpose, and clear is meant to give you a fresh start.
    viewMode = "text";
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => (copied = false), 1200);
    } catch {
      // Clipboard API unavailable or denied — silently do nothing.
    }
  }

  function toggleViewMode() {
    viewMode = viewMode === "tree" ? "text" : "tree";
  }

  function toggleNode(id: string) {
    if (collapsed.has(id)) collapsed.delete(id);
    else collapsed.add(id);
  }

  function expandAll() {
    collapsed.clear();
  }

  function collapseAll() {
    if (!tree) return;
    for (const id of collectFoldableIds(tree)) collapsed.add(id);
  }

  function syncGutterScroll() {
    if (gutterEl && textareaEl) gutterEl.scrollTop = textareaEl.scrollTop;
  }
</script>

{#snippet emptyState()}
  <p class="p-3 text-sm text-ink/50">Paste {label} to get started.</p>
{/snippet}

{#snippet treeView()}
  {#if tree}
    <div class="flex">
      <div
        aria-hidden="true"
        class="w-12 shrink-0 border-r border-ink/15 py-3 text-right font-mono text-sm leading-6 text-ink/40"
      >
        {#each rows as row, i (row.id)}
          <div class="px-2">{i + 1}</div>
        {/each}
      </div>
      <div class="flex-1 overflow-x-auto py-3 font-mono text-sm leading-6">
        {#each rows as row (row.id)}
          <div class="flex whitespace-pre" style={`padding-left: ${row.depth * 1.25}rem`}>
            {#if row.isFoldable}
              <button
                type="button"
                onclick={() => toggleNode(row.id)}
                aria-label={row.isCollapsed ? "expand" : "collapse"}
                class="mr-1 inline-block w-3 shrink-0 text-ink/40 hover:text-red"
              >{row.isCollapsed ? "▸" : "▾"}</button>
            {:else}
              <span class="mr-1 inline-block w-3 shrink-0"></span>
            {/if}
            <span>{row.text}</span>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    {@render emptyState()}
  {/if}
{/snippet}

{#snippet toolbar()}
  <p class="min-h-4 text-xs {validationError ? 'text-red' : 'text-ink/50'}">
    {#if !trimmed}
      Paste {label} to get started.
    {:else if validationError}
      invalid {label} — {validationError}
    {:else}
      valid {label} · {text.length} chars
    {/if}
  </p>

  <div class="flex flex-wrap gap-2 text-sm">
    <button
      type="button"
      onclick={runFormat}
      disabled={!isValid || !trimmed}
      class="border border-ink px-4 py-2 transition-colors hover:border-red hover:text-red disabled:pointer-events-none disabled:opacity-30"
    >
      format
    </button>
    <button
      type="button"
      onclick={runMinify}
      disabled={!isValid || !trimmed}
      class="border border-ink px-4 py-2 transition-colors hover:border-red hover:text-red disabled:pointer-events-none disabled:opacity-30"
    >
      minify
    </button>
    <button
      type="button"
      onclick={copyText}
      disabled={!trimmed}
      class="border border-ink px-4 py-2 transition-colors hover:border-red hover:text-red disabled:pointer-events-none disabled:opacity-30"
    >
      {copied ? "copied" : "copy"}
    </button>
    <button
      type="button"
      onclick={clearText}
      disabled={!trimmed}
      class="border border-ink/30 px-4 py-2 text-ink/50 transition-colors hover:border-red hover:text-red disabled:pointer-events-none disabled:opacity-30"
    >
      clear
    </button>
    <button
      type="button"
      onclick={toggleViewMode}
      disabled={viewMode === "text" && (!isValid || !trimmed)}
      class="border border-ink/30 px-4 py-2 text-ink/50 transition-colors hover:border-red hover:text-red disabled:pointer-events-none disabled:opacity-30"
    >
      {viewMode === "tree" ? "text view" : "tree view"}
    </button>
    {#if viewMode === "tree"}
      <button
        type="button"
        onclick={expandAll}
        class="border border-ink/30 px-4 py-2 text-ink/50 transition-colors hover:border-red hover:text-red"
      >
        expand all
      </button>
      <button
        type="button"
        onclick={collapseAll}
        class="border border-ink/30 px-4 py-2 text-ink/50 transition-colors hover:border-red hover:text-red"
      >
        collapse all
      </button>
    {/if}
    <button
      type="button"
      onclick={() => fullscreen.toggle()}
      class="ml-auto border border-ink/30 px-4 py-2 text-ink/50 transition-colors hover:border-red hover:text-red"
    >
      {fullscreen.isFullscreen ? "exit fullscreen" : "fullscreen"}
    </button>
  </div>
{/snippet}

{#if fullscreen.isFullscreen}
  <div use:fullscreen.portal class="paper fixed inset-0 z-50 flex flex-col gap-2 bg-paper p-3">
    <div class="flex items-center justify-between border-b border-ink/15 pb-2">
      <h2 class="font-mono text-sm font-bold tracking-wide text-ink/70 uppercase">
        {label} formatter
      </h2>
    </div>

    <div class="flex flex-1 overflow-hidden border border-ink/30">
      {#if viewMode === "tree"}
        <div class="flex-1 overflow-auto">
          {@render treeView()}
        </div>
      {:else}
        <div
          bind:this={gutterEl}
          aria-hidden="true"
          class="w-12 shrink-0 overflow-hidden border-r border-ink/15 py-3 text-right font-mono text-sm leading-6 text-ink/40"
        >
          {#each lineNumbers as n (n)}
            <div class="px-2">{n}</div>
          {/each}
        </div>
        <textarea
          bind:this={textareaEl}
          bind:value={text}
          {placeholder}
          spellcheck="false"
          onscroll={syncGutterScroll}
          class="flex-1 resize-none overflow-auto border-0 bg-transparent p-3 font-mono text-sm leading-6 whitespace-pre outline-none"
        ></textarea>
      {/if}
    </div>

    {@render toolbar()}
  </div>
{:else}
  <div class="mx-auto max-w-2xl">
    {#if viewMode === "tree"}
      <div class="max-h-[21rem] overflow-auto border border-ink/30">
        {@render treeView()}
      </div>
    {:else}
      <textarea
        bind:value={text}
        {placeholder}
        spellcheck="false"
        rows="14"
        class="w-full resize-y border border-ink/30 bg-transparent p-3 font-mono text-sm leading-6 outline-none focus:border-ink"
      ></textarea>
    {/if}

    {@render toolbar()}
  </div>
{/if}
