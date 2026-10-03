<script lang="ts">
  /**
   * Custom searchable dropdown — deliberately not a native <select>, since
   * with ~165 currencies a plain select is painful to scan and has no
   * search. Reused across both pair-mode selects and the grid-mode one;
   * `currencies` is passed in already ordered (pinned first) by the
   * parent, this component doesn't know anything about pinning itself.
   */
  import type { CurrencyInfo } from "../../lib/currency";

  interface Props {
    currencies: CurrencyInfo[];
    value: string;
    onselect: (code: string) => void;
    ariaLabel: string;
  }

  let { currencies, value, onselect, ariaLabel }: Props = $props();

  let open = $state(false);
  let query = $state("");
  let highlightedIndex = $state(0);
  let rootEl: HTMLDivElement | undefined = $state();
  let triggerEl: HTMLButtonElement | undefined = $state();
  let searchInputEl: HTMLInputElement | undefined = $state();
  let listEl: HTMLUListElement | undefined = $state();

  const selected = $derived(currencies.find((c) => c.code === value));
  const filtered = $derived(
    query.trim()
      ? currencies.filter((c) => {
          const q = query.trim().toLowerCase();
          return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
        })
      : currencies,
  );

  function openDropdown() {
    open = true;
    query = "";
    highlightedIndex = Math.max(
      0,
      currencies.findIndex((c) => c.code === value),
    );
  }

  function closeDropdown() {
    open = false;
    triggerEl?.focus();
  }

  function choose(code: string) {
    onselect(code);
    closeDropdown();
  }

  function scrollHighlightedIntoView() {
    listEl?.querySelector(`[data-index="${highlightedIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      highlightedIndex = Math.min(highlightedIndex + 1, filtered.length - 1);
      scrollHighlightedIntoView();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, 0);
      scrollHighlightedIntoView();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const picked = filtered[highlightedIndex];
      if (picked) choose(picked.code);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
    }
  }

  $effect(() => {
    if (open) searchInputEl?.focus();
  });

  $effect(() => {
    if (!open) return;
    function handleOutsideClick(event: MouseEvent) {
      if (rootEl && !rootEl.contains(event.target as Node)) closeDropdown();
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  });
</script>

<div bind:this={rootEl} class="relative min-w-0 flex-1">
  <button
    bind:this={triggerEl}
    type="button"
    onclick={() => (open ? closeDropdown() : openDropdown())}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={ariaLabel}
    class="flex w-full items-center justify-between gap-2 border border-ink/30 bg-paper p-2 font-mono text-sm outline-none hover:border-ink focus:border-ink"
  >
    <span class="min-w-0 truncate">
      {selected ? `${selected.symbol} ${selected.code} — ${selected.name}` : "Select currency"}
    </span>
    <span class="shrink-0 text-ink/40">▾</span>
  </button>

  {#if open}
    <div class="absolute top-full right-0 left-0 z-20 mt-1 border border-ink bg-paper">
      <input
        bind:this={searchInputEl}
        bind:value={query}
        type="text"
        placeholder="search currencies…"
        aria-label={`search ${ariaLabel}`}
        onkeydown={handleSearchKeydown}
        oninput={() => (highlightedIndex = 0)}
        class="w-full border-b border-ink/15 bg-transparent p-2 text-sm outline-none"
      />
      <ul bind:this={listEl} role="listbox" aria-label={ariaLabel} class="max-h-60 overflow-y-auto">
        {#if filtered.length === 0}
          <li class="p-2 text-sm text-ink/50">No matches.</li>
        {:else}
          {#each filtered as c, i (c.code)}
            <li role="option" aria-selected={c.code === value} data-index={i}>
              <button
                type="button"
                onclick={() => choose(c.code)}
                onmouseenter={() => (highlightedIndex = i)}
                class={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors ${
                  i === highlightedIndex ? "bg-ink/10" : ""
                } ${c.code === value ? "text-red" : ""}`}
              >
                <span class="w-5 shrink-0 text-ink/50">{c.symbol}</span>
                <span class="w-10 shrink-0 font-semibold">{c.code}</span>
                <span class="min-w-0 flex-1 truncate text-ink/70">{c.name}</span>
              </button>
            </li>
          {/each}
        {/if}
      </ul>
    </div>
  {/if}
</div>
