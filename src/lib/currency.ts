/**
 * Frankfurter v2 (api.frankfurter.dev/v2) — not v1 (api.frankfurter.app):
 * v1 carries an HTTP `Deprecation` header dated 2026-05-18, already past,
 * pointing to v2 as the successor. v2 also covers far more currencies
 * (~165 vs v1's ~30 ECB-only set), which is what makes the "scroll for
 * more" grid view actually meaningful.
 *
 * `/rates?base=X` returns every other currency's rate against X in one
 * request — there's no server-side single-pair endpoint in v2 (its `to`
 * parameter is a date, not a currency), so a single fetch per base code
 * serves both the pair view (look up one entry) and the grid view (use
 * them all). Only the base currency code is ever sent — never the amount
 * or the target currency.
 */
const API_BASE = "https://api.frankfurter.dev/v2";

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

export interface RatesResult {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export async function fetchCurrencies(): Promise<CurrencyInfo[]> {
  const res = await fetch(`${API_BASE}/currencies`);
  if (!res.ok) throw new Error(`Couldn't load the currency list (${res.status}).`);
  const data: { iso_code: string; name: string; symbol: string }[] = await res.json();
  return data
    .map((entry) => ({ code: entry.iso_code, name: entry.name, symbol: entry.symbol }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export async function fetchRates(base: string): Promise<RatesResult> {
  const res = await fetch(`${API_BASE}/rates?base=${encodeURIComponent(base)}`);
  if (!res.ok) throw new Error(`Couldn't load exchange rates for ${base} (${res.status}).`);
  const data: { date: string; quote: string; rate: number }[] = await res.json();

  const rates: Record<string, number> = {};
  let date = "";
  for (const entry of data) {
    rates[entry.quote] = entry.rate;
    date = entry.date;
  }
  return { base, date, rates };
}
