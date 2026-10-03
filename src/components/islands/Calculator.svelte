<script lang="ts">
  import { onMount } from "svelte";

  type Operator = "+" | "-" | "×" | "÷";

  interface HistoryEntry {
    id: string;
    expression: string;
    result: string;
  }

  const HISTORY_KEY = "daison:tools:calculator:history";
  const HISTORY_LIMIT = 50;

  let display = $state("0");
  let previousValue = $state<number | null>(null);
  let operator = $state<Operator | null>(null);
  let overwrite = $state(true);
  let history = $state<HistoryEntry[]>([]);
  let showHistory = $state(false);
  let copied = $state(false);

  const expressionPreview = $derived(
    operator !== null && previousValue !== null
      ? `${formatNumber(previousValue)} ${operator}`
      : "",
  );

  // Floats like 0.1 + 0.2 produce trailing noise — round to 10 significant
  // digits so the display never shows 0.30000000000000004.
  function formatNumber(value: number): string {
    if (!Number.isFinite(value)) return "Error";
    const rounded = Number(value.toPrecision(10));
    return rounded.toString();
  }

  function compute(a: number, b: number, op: Operator): number {
    switch (op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "×":
        return a * b;
      case "÷":
        return b === 0 ? NaN : a / b;
    }
  }

  function inputDigit(digit: string) {
    if (overwrite) {
      display = digit === "." ? "0." : digit;
      overwrite = false;
      return;
    }
    if (digit === "." && display.includes(".")) return;
    display = display === "0" && digit !== "." ? digit : display + digit;
  }

  function chooseOperator(op: Operator) {
    const current = Number(display);
    if (operator !== null && !overwrite) {
      previousValue = compute(previousValue ?? 0, current, operator);
      display = formatNumber(previousValue);
    } else {
      previousValue = current;
    }
    operator = op;
    overwrite = true;
  }

  function percent() {
    const current = Number(display);
    const value =
      operator !== null && previousValue !== null ? (previousValue * current) / 100 : current / 100;
    display = formatNumber(value);
    overwrite = true;
  }

  function backspace() {
    if (overwrite) return;
    display = display.length > 1 ? display.slice(0, -1) : "0";
    if (display === "-") display = "0";
  }

  function clearAll() {
    display = "0";
    previousValue = null;
    operator = null;
    overwrite = true;
  }

  function equals() {
    if (operator === null || previousValue === null) return;
    const current = Number(display);
    const result = compute(previousValue, current, operator);
    const expression = `${formatNumber(previousValue)} ${operator} ${formatNumber(current)}`;
    const resultText = formatNumber(result);

    pushHistory(expression, resultText);

    display = resultText;
    previousValue = null;
    operator = null;
    overwrite = true;
  }

  function pushHistory(expression: string, result: string) {
    const entry: HistoryEntry = { id: crypto.randomUUID(), expression, result };
    history = [entry, ...history].slice(0, HISTORY_LIMIT);
    persistHistory();
  }

  function persistHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Storage unavailable (private mode, quota, disabled) — history just
      // won't persist this session. Not worth surfacing to the user.
    }
  }

  function useHistoryEntry(entry: HistoryEntry) {
    display = entry.result;
    previousValue = null;
    operator = null;
    overwrite = true;
  }

  function clearHistory() {
    history = [];
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // See persistHistory.
    }
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(display);
      copied = true;
      setTimeout(() => (copied = false), 1200);
    } catch {
      // Clipboard API unavailable or denied — silently do nothing.
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key >= "0" && event.key <= "9") {
      inputDigit(event.key);
    } else if (event.key === ".") {
      inputDigit(".");
    } else if (event.key === "+" || event.key === "-") {
      chooseOperator(event.key);
    } else if (event.key === "*") {
      chooseOperator("×");
    } else if (event.key === "/") {
      event.preventDefault();
      chooseOperator("÷");
    } else if (event.key === "%") {
      percent();
    } else if (event.key === "Enter" || event.key === "=") {
      event.preventDefault();
      equals();
    } else if (event.key === "Backspace") {
      backspace();
    } else if (event.key === "Escape") {
      clearAll();
    }
  }

  onMount(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) history = JSON.parse(stored);
    } catch {
      // Corrupt or inaccessible storage — start with empty history.
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });
</script>

<div class="mx-auto max-w-xs">
  <div class="border border-ink/30">
    <div class="px-4 pt-4 pb-3">
      <p class="h-5 text-right font-mono text-sm text-ink/50">{expressionPreview}&nbsp;</p>
      <p class="overflow-x-auto text-right font-mono text-4xl font-bold break-all">{display}</p>
    </div>

    <div class="grid grid-cols-4 gap-px border-t border-ink/30 bg-ink/15">
      <button
        type="button"
        onclick={clearAll}
        aria-label="all clear"
        class="aspect-square bg-paper text-sm text-ink/60 transition-colors hover:bg-ink hover:text-paper"
      >
        AC
      </button>
      <button
        type="button"
        onclick={backspace}
        aria-label="backspace"
        class="aspect-square bg-paper text-sm text-ink/60 transition-colors hover:bg-ink hover:text-paper"
      >
        &#9003;
      </button>
      <button
        type="button"
        onclick={percent}
        aria-label="percent"
        class="aspect-square bg-paper text-lg text-ink/60 transition-colors hover:bg-ink hover:text-paper"
      >
        %
      </button>
      <button
        type="button"
        onclick={() => chooseOperator("÷")}
        aria-label="divide"
        class="aspect-square bg-paper text-lg text-red transition-colors hover:bg-red hover:text-paper"
      >
        &#247;
      </button>

      {#each [["7", "8", "9"], ["4", "5", "6"], ["1", "2", "3"]] as row}
        {#each row as digit}
          <button
            type="button"
            onclick={() => inputDigit(digit)}
            class="aspect-square bg-paper text-lg transition-colors hover:bg-ink hover:text-paper"
          >
            {digit}
          </button>
        {/each}
        <button
          type="button"
          onclick={() => chooseOperator(row[0] === "7" ? "×" : row[0] === "4" ? "-" : "+")}
          aria-label={row[0] === "7" ? "multiply" : row[0] === "4" ? "subtract" : "add"}
          class="aspect-square bg-paper text-lg text-red transition-colors hover:bg-red hover:text-paper"
        >
          {row[0] === "7" ? "×" : row[0] === "4" ? "−" : "+"}
        </button>
      {/each}

      <button
        type="button"
        onclick={() => inputDigit("0")}
        class="col-span-2 bg-paper text-lg transition-colors hover:bg-ink hover:text-paper"
      >
        0
      </button>
      <button
        type="button"
        onclick={() => inputDigit(".")}
        aria-label="decimal point"
        class="aspect-square bg-paper text-lg transition-colors hover:bg-ink hover:text-paper"
      >
        .
      </button>
      <button
        type="button"
        onclick={equals}
        aria-label="equals"
        class="aspect-square bg-ink text-lg text-paper transition-colors hover:bg-red"
      >
        =
      </button>
    </div>
  </div>

  <div class="mt-4 flex items-center justify-between text-sm">
    <button type="button" onclick={copyResult} class="text-ink/60 hover:text-red">
      {copied ? "copied" : "copy result"}
    </button>
    <button type="button" onclick={() => (showHistory = !showHistory)} class="text-ink/60 hover:text-red">
      history ({history.length}) {showHistory ? "−" : "+"}
    </button>
  </div>

  {#if showHistory}
    <div class="mt-3 border border-ink/15">
      {#if history.length === 0}
        <p class="p-4 text-sm text-ink/50">No calculations yet.</p>
      {:else}
        <ul class="max-h-64 divide-y divide-ink/15 overflow-y-auto">
          {#each history as entry (entry.id)}
            <li>
              <button
                type="button"
                onclick={() => useHistoryEntry(entry)}
                class="flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-ink/5"
              >
                <span class="min-w-0 flex-1 truncate font-mono text-xs text-ink/50">{entry.expression}</span>
                <span class="shrink-0 font-mono text-sm font-semibold">{entry.result}</span>
              </button>
            </li>
          {/each}
        </ul>
        <button
          type="button"
          onclick={clearHistory}
          class="w-full border-t border-ink/15 py-2 text-xs text-ink/50 hover:text-red"
        >
          clear history
        </button>
      {/if}
    </div>
  {/if}
</div>
