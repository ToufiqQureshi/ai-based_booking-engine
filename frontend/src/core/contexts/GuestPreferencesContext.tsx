import React, { createContext, useContext, useState, useEffect } from 'react';

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';
export type LanguageCode = 'en' | 'hi';

interface GuestPreferencesContextType {
  guestCurrency: CurrencyCode;
  setGuestCurrency: (currency: CurrencyCode) => void;
  guestLanguage: LanguageCode;
  setGuestLanguage: (language: LanguageCode) => void;
  exchangeRates: Record<string, number> | null;
  baseCurrency: CurrencyCode;
  setBaseCurrency: (currency: CurrencyCode) => void;
}

const GuestPreferencesContext = createContext<GuestPreferencesContextType | undefined>(undefined);

export const GuestPreferencesProvider = ({ children }: { children: React.ReactNode }) => {
  const [guestCurrency, setGuestCurrency] = useState<CurrencyCode>(() => {
    return (localStorage.getItem('guestCurrency') as CurrencyCode) || 'INR';
  });
  
  const [guestLanguage, setGuestLanguage] = useState<LanguageCode>(() => {
    return (localStorage.getItem('guestLanguage') as LanguageCode) || 'en';
  });

  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('INR');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(null);

  // Sync with local storage
  useEffect(() => {
    localStorage.setItem('guestCurrency', guestCurrency);
  }, [guestCurrency]);

  useEffect(() => {
    localStorage.setItem('guestLanguage', guestLanguage);
  }, [guestLanguage]);

  // Fetch exchange rates when baseCurrency changes. Third-party, unauthenticated
  // API: bound it with a timeout and degrade silently — when it fails, rates
  // stay empty and amounts render in the hotel's base currency, which is
  // always correct (FX display is a convenience, never load-bearing).
  useEffect(() => {
    // 'cancelled' guards against out-of-order responses: if baseCurrency
    // changes again before this fetch resolves, the stale response must not
    // overwrite rates keyed for the wrong base.
    let cancelled = false;
    const fetchRates = async () => {
      try {
        const response = await fetch(
          `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data && data.rates) {
          setExchangeRates(data.rates);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Exchange-rate fetch failed; showing base currency only:', error);
        }
      }
    };
    fetchRates();
    return () => { cancelled = true; };
  }, [baseCurrency]);

  return (
    <GuestPreferencesContext.Provider
      value={{
        guestCurrency,
        setGuestCurrency,
        guestLanguage,
        setGuestLanguage,
        exchangeRates,
        baseCurrency,
        setBaseCurrency
      }}
    >
      {children}
    </GuestPreferencesContext.Provider>
  );
};

export const useGuestPreferences = () => {
  const context = useContext(GuestPreferencesContext);
  if (context === undefined) {
    throw new Error('useGuestPreferences must be used within a GuestPreferencesProvider');
  }
  return context;
};

// Hook for converting prices
export const useCurrencyConverter = () => {
    const { guestCurrency, exchangeRates, baseCurrency } = useGuestPreferences();
    
    const convert = (amount: number, fromCurrency?: string): number => {
        if (!exchangeRates) return amount; 
        
        // Note: Currently assumes fromCurrency is the baseCurrency of the hotel.
        const startCurrency = fromCurrency || baseCurrency;
        if (startCurrency === guestCurrency) return amount;
        
        const rate = exchangeRates[guestCurrency];
        if (!rate) return amount;
        
        return amount * rate;
    }
    
    const format = (amount: number | null | undefined, fromCurrency?: string) => {
        if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
        const converted = convert(amount, fromCurrency);
        const formatOptions: Intl.NumberFormatOptions = {
            style: 'currency',
            currency: guestCurrency,
            maximumFractionDigits: 0
        };
        
        if (guestCurrency === 'INR') {
             return `₹${Math.round(converted).toLocaleString('en-IN')}`;
        }
        
        return new Intl.NumberFormat('en-US', formatOptions).format(converted);
    }

    const formatBaseCurrency = (amount: number | null | undefined) => {
        if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
        const formatOptions: Intl.NumberFormatOptions = {
            style: 'currency',
            currency: baseCurrency,
            maximumFractionDigits: 0
        };
        if (baseCurrency === 'INR') {
             return `₹${Math.round(amount).toLocaleString('en-IN')}`;
        }
        return new Intl.NumberFormat('en-US', formatOptions).format(amount);
    }
    
    return { convert, format, formatBaseCurrency, guestCurrency, baseCurrency };
}
