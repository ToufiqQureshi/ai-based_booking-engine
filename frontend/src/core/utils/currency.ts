// Shared money formatter for the hotelier dashboard.
//
// Before the 2026-07-02 audit this Intl.NumberFormat call was re-implemented
// in ~8 components, every copy hardcoded to INR. The hotel's configured
// currency (hotel.settings.currency, default "INR") is registered once by
// AuthContext when the hotel loads; every component just calls
// formatCurrency(amount).
//
// Note: this formats in the hotel's own currency — it does NOT convert.
// Guest-facing FX display lives in GuestPreferencesContext.

const CURRENCY_LOCALES: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
};

// Currencies conventionally displayed without minor units. Everything else
// (USD/EUR/GBP…) keeps cents by default so amounts reconcile against charges.
const ZERO_DECIMAL_CURRENCIES = new Set(['INR', 'JPY']);

let activeCurrency = 'INR';

/** Called by AuthContext when the hotel profile loads/changes. */
export function setActiveCurrency(currency?: string | null): void {
  if (currency && typeof currency === 'string') {
    activeCurrency = currency.toUpperCase();
  }
}

export function getActiveCurrency(): string {
  return activeCurrency;
}

export function formatCurrency(
  amount: number,
  opts?: { currency?: string; maximumFractionDigits?: number },
): string {
  const currency = (opts?.currency || activeCurrency).toUpperCase();
  const locale = CURRENCY_LOCALES[currency] || 'en-IN';
  const defaultDigits = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: opts?.maximumFractionDigits ?? defaultDigits,
    }).format(amount);
  } catch {
    // Unknown currency code from a misconfigured hotel row — degrade, don't crash.
    return `${currency} ${Math.round(amount).toLocaleString(locale)}`;
  }
}
