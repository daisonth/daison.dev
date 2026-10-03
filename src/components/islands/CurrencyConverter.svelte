<script lang="ts">
  /**
   * Two modes sharing one rates cache keyed by base currency:
   *  - "pair": pick two currencies, convert one amount between them.
   *  - "grid": pick one currency + an amount, see it converted into every
   *    other currency at once, revealed progressively on scroll.
   *
   * A single `/rates?base=X` call returns every other currency's rate —
   * there's no per-pair endpoint — so both modes reuse the exact same
   * fetch+cache, just reading it differently.
   *
   * Pinned currencies (grid view) are a separate, always-visible section
   * above the scroll-revealed list — the whole point of pinning is not
   * having to scroll to find them. Pins also float to the top of both
   * pair-mode selects, since "favorite currencies" is the same concept in
   * both views.
   */
  import { onMount } from "svelte";
  import { fetchCurrencies, fetchRates, type CurrencyInfo, type RatesResult } from "../../lib/currency";
  import CurrencySelect from "./CurrencySelect.svelte";

  interface HistoryEntry {
    id: string;
    from: string;
    to: string;
    amount: number;
    rate: number;
    result: number;
    date: string;
  }

  const HISTORY_KEY = "daison:tools:currency-converter:history";
  const PINNED_KEY = "daison:tools:currency-converter:pinned";
  const HISTORY_LIMIT = 50;
  const GRID_PAGE_SIZE = 24;

  let mode: "pair" | "grid" = $state("pair");
  let currencies: CurrencyInfo[] = $state([]);
  let currenciesError: string | null = $state(null);
  let pinned: string[] = $state([]);

  let fromCurrency = $state("INR");
  let toCurrency = $state("USD");
  let amount = $state("1");

  let gridCurrency = $state("INR");
  let gridAmount = $state("1");
  let gridSearch = $state("");
  let visibleCount = $state(GRID_PAGE_SIZE);

  let loading = $state(false);
  let error: string | null = $state(null);
  let history: HistoryEntry[] = $state([]);

  let sentinelEl: HTMLDivElement | undefined = $state();

  // Plain cache, not $state — it's a side-table keyed by currency code,
  // not something a template reads directly. `currentRates` (below) is
  // the reactive view into whichever entry is relevant right now.
  const ratesCache: Record<string, RatesResult> = {};
  let currentRates: RatesResult | null = $state(null);
  let requestToken = 0;

  const currencyByCode = $derived(new Map(currencies.map((c) => [c.code, c])));
  const orderedCurrencies = $derived(
    [...currencies].sort((a, b) => {
      const aPinned = pinned.includes(a.code);
      const bPinned = pinned.includes(b.code);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return a.code.localeCompare(b.code);
    }),
  );

  const parsedAmount = $derived(Number(amount) || 0);
  const parsedGridAmount = $derived(Number(gridAmount) || 0);

  const rate = $derived(
    currentRates && currentRates.base === fromCurrency ? (currentRates.rates[toCurrency] ?? null) : null,
  );
  const result = $derived(rate !== null ? parsedAmount * rate : null);

  const gridEntries = $derived(
    currentRates && currentRates.base === gridCurrency
      ? Object.entries(currentRates.rates).filter(([code]) => code !== gridCurrency)
      : [],
  );
  const filteredGridEntries = $derived(
    gridSearch.trim()
      ? gridEntries.filter(([code]) => {
          const q = gridSearch.trim().toLowerCase();
          const name = currencyByCode.get(code)?.name ?? "";
          return code.toLowerCase().includes(q) || name.toLowerCase().includes(q);
        })
      : gridEntries,
  );
  const pinnedGridEntries = $derived(
    filteredGridEntries.filter(([code]) => pinned.includes(code)).sort(([a], [b]) => a.localeCompare(b)),
  );
  const unpinnedGridEntries = $derived(
    filteredGridEntries.filter(([code]) => !pinned.includes(code)).sort(([a], [b]) => a.localeCompare(b)),
  );
  const visibleUnpinnedEntries = $derived(unpinnedGridEntries.slice(0, visibleCount));

  function symbolFor(code: string): string {
    return currencyByCode.get(code)?.symbol ?? "";
  }

  function formatNumber(value: number): string {
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }

  function persistPinned() {
    try {
      localStorage.setItem(PINNED_KEY, JSON.stringify(pinned));
    } catch {
      // Storage unavailable — pins just won't persist this session.
    }
  }

  function togglePin(code: string) {
    pinned = pinned.includes(code) ? pinned.filter((c) => c !== code) : [...pinned, code];
    persistPinned();
  }

  async function loadRatesFor(base: string) {
    if (ratesCache[base]) {
      currentRates = ratesCache[base];
      return;
    }
    const token = ++requestToken;
    loading = true;
    error = null;
    try {
      const fetched = await fetchRates(base);
      ratesCache[base] = fetched;
      if (token === requestToken) currentRates = fetched;
    } catch (err) {
      if (token === requestToken) {
        error = err instanceof Error ? err.message : "Couldn't load exchange rates.";
      }
    } finally {
      if (token === requestToken) loading = false;
    }
  }

  function persistHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Storage unavailable — history just won't persist this session.
    }
  }

  function logHistoryIfReady() {
    const info = ratesCache[fromCurrency];
    const pairRate = info?.rates[toCurrency];
    if (pairRate === undefined || !parsedAmount) return;

    const last = history[0];
    if (last && last.from === fromCurrency && last.to === toCurrency && last.amount === parsedAmount) return;

    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      from: fromCurrency,
      to: toCurrency,
      amount: parsedAmount,
      rate: pairRate,
      result: parsedAmount * pairRate,
      date: info.date,
    };
    history = [entry, ...history].slice(0, HISTORY_LIMIT);
    persistHistory();
  }

  async function selectFromCurrency(code: string) {
    fromCurrency = code;
    await loadRatesFor(code);
    logHistoryIfReady();
  }

  function selectToCurrency(code: string) {
    toCurrency = code;
    logHistoryIfReady();
  }

  async function swapDirection() {
    [fromCurrency, toCurrency] = [toCurrency, fromCurrency];
    await loadRatesFor(fromCurrency);
    logHistoryIfReady();
  }

  function commitAmount() {
    logHistoryIfReady();
  }

  function useHistoryEntry(entry: HistoryEntry) {
    mode = "pair";
    fromCurrency = entry.from;
    toCurrency = entry.to;
    amount = String(entry.amount);
    loadRatesFor(entry.from);
  }

  function clearHistory() {
    history = [];
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // See persistHistory.
    }
  }

  async function selectGridCurrency(code: string) {
    gridCurrency = code;
    visibleCount = GRID_PAGE_SIZE;
    await loadRatesFor(code);
  }

  function handleGridSearchInput() {
    visibleCount = GRID_PAGE_SIZE;
  }

  function switchMode(next: "pair" | "grid") {
    mode = next;
    if (next === "grid") loadRatesFor(gridCurrency);
    else loadRatesFor(fromCurrency);
  }

  // Reveals more grid tiles as the sentinel at the bottom scrolls into
  // view — all ~165 rates are already in memory from one fetch, so this
  // is progressive rendering, not additional network requests. Only the
  // unpinned list scrolls; pinned entries are always fully shown.
  $effect(() => {
    if (mode !== "grid" || !sentinelEl) return;
    const target = sentinelEl;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          visibleCount = Math.min(visibleCount + GRID_PAGE_SIZE, unpinnedGridEntries.length || visibleCount);
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(target);
    return () => obs.disconnect();
  });

  onMount(() => {
    try {
      const storedHistory = localStorage.getItem(HISTORY_KEY);
      if (storedHistory) history = JSON.parse(storedHistory);
    } catch {
      // Corrupt or inaccessible storage — start with empty history.
    }

    try {
      const storedPinned = localStorage.getItem(PINNED_KEY);
      if (storedPinned) pinned = JSON.parse(storedPinned);
    } catch {
      // Corrupt or inaccessible storage — start with no pins.
    }

    fetchCurrencies()
      .then((list) => (currencies = list))
      .catch((err) => {
        currenciesError = err instanceof Error ? err.message : "Couldn't load the currency list.";
      });

    loadRatesFor(fromCurrency);
  });
</script>

{#snippet money(code: string, value: number)}
  {@const symbol = symbolFor(code)}
  {#if symbol}
    <!--
      <bdi> isolates the symbol's own bidi directionality from the number
      next to it. Without it, an RTL symbol (Arabic dirham/dinar marks,
      the Afghani sign) gets visually reordered to the END of the number
      by the browser's bidi algorithm instead of staying in front of it —
      not a font problem, a text-direction one.
    -->
    <bdi>{symbol}</bdi>&nbsp;{formatNumber(value)}
  {:else}
    {formatNumber(value)}
  {/if}
{/snippet}

{#snippet gridTile(code: string, converted: number)}
  <div class="relative bg-paper p-3">
    <button
      type="button"
      onclick={() => togglePin(code)}
      aria-label={pinned.includes(code) ? `unpin ${code}` : `pin ${code}`}
      class={`absolute top-1 right-1 text-sm leading-none ${pinned.includes(code) ? "text-red" : "text-ink/20 hover:text-ink/50"}`}
    >
      {pinned.includes(code) ? "★" : "☆"}
    </button>
    <p class="pr-4 text-xs text-ink/50">{code}</p>
    <p class="truncate font-mono text-sm font-semibold" title={currencyByCode.get(code)?.name}>
      {@render money(code, converted)}
    </p>
  </div>
{/snippet}

<div class="mx-auto max-w-xl">
  <div class="flex gap-1 border-b border-ink/30">
    <button
      type="button"
      onclick={() => switchMode("pair")}
      class={`border-b-2 px-3 py-2 text-sm transition-colors ${mode === "pair" ? "border-red text-red" : "border-transparent text-ink/60 hover:text-ink"}`}
    >
      pair
    </button>
    <button
      type="button"
      onclick={() => switchMode("grid")}
      class={`border-b-2 px-3 py-2 text-sm transition-colors ${mode === "grid" ? "border-red text-red" : "border-transparent text-ink/60 hover:text-ink"}`}
    >
      all currencies
    </button>
  </div>

  {#if currenciesError}
    <p class="mt-4 text-xs text-red">{currenciesError}</p>
  {/if}

  {#if mode === "pair"}
    <div class="mt-6">
      <div class="relative">
        <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink/40">
          {symbolFor(fromCurrency)}
        </span>
        <input
          type="text"
          inputmode="decimal"
          bind:value={amount}
          onblur={commitAmount}
          onkeydown={(e) => e.key === "Enter" && commitAmount()}
          class="w-full border border-ink/30 bg-transparent p-3 pl-8 text-right font-mono text-2xl outline-none focus:border-ink"
        />
      </div>

      <div class="mt-3 flex items-center gap-2">
        <CurrencySelect
          currencies={orderedCurrencies}
          value={fromCurrency}
          onselect={selectFromCurrency}
          ariaLabel="source currency"
        />
        <button
          type="button"
          onclick={swapDirection}
          aria-label="swap direction"
          class="shrink-0 border border-ink/30 px-3 py-2 text-ink/60 transition-colors hover:border-red hover:text-red"
        >
          ⇄
        </button>
        <CurrencySelect
          currencies={orderedCurrencies}
          value={toCurrency}
          onselect={selectToCurrency}
          ariaLabel="target currency"
        />
      </div>

      <div class="mt-6 border border-ink/30 p-4">
        {#if loading && !currentRates}
          <p class="text-sm text-ink/50">Loading rates…</p>
        {:else if error}
          <p class="text-sm text-red">{error}</p>
        {:else if result !== null}
          <p class="font-mono text-2xl font-bold">
            {@render money(toCurrency, result)}
            <span class="text-base font-normal text-ink/50">{toCurrency}</span>
          </p>
          <p class="mt-1 text-xs text-ink/50">
            1 {fromCurrency} = {@render money(toCurrency, rate ?? 0)} · as of {currentRates?.date}
          </p>
        {/if}
      </div>

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
              <li>
                <button
                  type="button"
                  onclick={() => useHistoryEntry(entry)}
                  class="flex w-full items-center justify-between px-1 py-2 text-left text-sm transition-colors hover:bg-ink/5"
                >
                  <span class="text-ink/70">
                    {@render money(entry.from, entry.amount)} → {entry.to}
                  </span>
                  <span class="font-mono font-semibold">
                    {@render money(entry.to, entry.result)}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {:else}
    <div class="mt-6">
      <div class="flex items-center gap-2">
        <div class="relative w-28 shrink-0">
          <span class="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-ink/40">
            {symbolFor(gridCurrency)}
          </span>
          <input
            type="text"
            inputmode="decimal"
            bind:value={gridAmount}
            class="w-full border border-ink/30 bg-transparent p-2 pl-6 text-right font-mono text-lg outline-none focus:border-ink"
          />
        </div>
        <CurrencySelect
          currencies={orderedCurrencies}
          value={gridCurrency}
          onselect={selectGridCurrency}
          ariaLabel="currency"
        />
      </div>

      <input
        type="text"
        bind:value={gridSearch}
        oninput={handleGridSearchInput}
        placeholder="search currencies…"
        aria-label="search all currencies"
        class="mt-3 w-full border border-ink/30 bg-transparent p-2 text-sm outline-none focus:border-ink"
      />

      {#if loading && !currentRates}
        <p class="mt-6 text-sm text-ink/50">Loading rates…</p>
      {:else if error}
        <p class="mt-6 text-sm text-red">{error}</p>
      {:else if pinnedGridEntries.length === 0 && unpinnedGridEntries.length === 0}
        <p class="mt-6 text-sm text-ink/50">No matching currencies.</p>
      {:else}
        {#if pinnedGridEntries.length > 0}
          <p class="mt-6 text-xs tracking-wide text-ink/50 uppercase">pinned</p>
          <div class="mt-2 grid grid-cols-2 gap-px border border-ink/15 bg-ink/15 sm:grid-cols-3">
            {#each pinnedGridEntries as [code, r] (code)}
              {@render gridTile(code, parsedGridAmount * r)}
            {/each}
          </div>
        {/if}

        {#if unpinnedGridEntries.length > 0}
          <p class="mt-6 text-xs tracking-wide text-ink/50 uppercase">all currencies</p>
          <div class="mt-2 grid grid-cols-2 gap-px border border-ink/15 bg-ink/15 sm:grid-cols-3">
            {#each visibleUnpinnedEntries as [code, r] (code)}
              {@render gridTile(code, parsedGridAmount * r)}
            {/each}
          </div>
          {#if visibleUnpinnedEntries.length < unpinnedGridEntries.length}
            <div bind:this={sentinelEl} class="h-4"></div>
          {/if}
        {/if}
      {/if}
    </div>
  {/if}
</div>
