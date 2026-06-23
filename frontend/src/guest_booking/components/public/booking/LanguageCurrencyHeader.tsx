import { useTranslation } from 'react-i18next';
import { useGuestPreferences, CurrencyCode, LanguageCode } from '@/core/contexts/GuestPreferencesContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from '@/components/ui/alert-dialog';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

const languages: { code: LanguageCode; label: string; flag: string }[] = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
];

const currencies: { code: CurrencyCode; symbol: string }[] = [
    { code: 'INR', symbol: '₹' },
    { code: 'USD', symbol: '$' },
    { code: 'EUR', symbol: '€' },
    { code: 'GBP', symbol: '£' },
];

export function LanguageCurrencyHeader() {
    const { i18n } = useTranslation();
    const { guestCurrency, setGuestCurrency, guestLanguage, setGuestLanguage, baseCurrency } = useGuestPreferences();
    const [showCurrencyWarning, setShowCurrencyWarning] = useState(false);
    const [pendingCurrency, setPendingCurrency] = useState<CurrencyCode | null>(null);

    const currentLang = languages.find(l => l.code === guestLanguage) || languages[0];

    const handleLanguageChange = (code: LanguageCode) => {
        setGuestLanguage(code);
        i18n.changeLanguage(code);
    };

    const handleCurrencySelect = (code: CurrencyCode) => {
        if (code !== baseCurrency) {
            setPendingCurrency(code);
            setShowCurrencyWarning(true);
        } else {
            setGuestCurrency(code);
        }
    };

    const confirmCurrencyChange = () => {
        if (pendingCurrency) {
            setGuestCurrency(pendingCurrency);
        }
        setShowCurrencyWarning(false);
    };

    return (
        <div className="flex items-center gap-4 text-sm font-medium text-slate-700">
            {/* Language Selector */}
            <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 hover:text-slate-900 transition-colors focus:outline-none">
                    <span className="text-lg">{currentLang.flag}</span>
                    <span>{currentLang.label}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[120px]">
                    {languages.map((lang) => (
                        <DropdownMenuItem 
                            key={lang.code} 
                            onSelect={() => handleLanguageChange(lang.code)}
                            className="flex items-center gap-2 cursor-pointer"
                        >
                            <span className="text-base">{lang.flag}</span>
                            <span>{lang.label}</span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Currency Selector */}
            <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 hover:text-slate-900 transition-colors focus:outline-none">
                    <span>{guestCurrency}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[100px]">
                    {currencies.map((curr) => (
                        <DropdownMenuItem 
                            key={curr.code} 
                            onSelect={() => handleCurrencySelect(curr.code)}
                            className="flex items-center justify-between cursor-pointer"
                        >
                            <span>{curr.code}</span>
                            <span className="text-slate-500">{curr.symbol}</span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Currency Warning Dialog */}
            <AlertDialog open={showCurrencyWarning} onOpenChange={setShowCurrencyWarning}>
                <AlertDialogContent className="max-w-md bg-white rounded-2xl">
                    <AlertDialogHeader className="bg-amber-50 -mx-6 -mt-6 px-6 py-4 border-b border-amber-100 rounded-t-2xl mb-4">
                        <AlertDialogTitle className="flex items-center gap-2 text-amber-800">
                            <AlertTriangle className="w-5 h-5" />
                            Currency Conversion Warning
                        </AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogDescription className="text-slate-600 mb-2 leading-relaxed">
                        Currency conversion is provided for indicative pricing only and is based on the exchange rate at this time.
                        <br/><br/>
                        When you progress to the final stages of your booking, all prices will be shown in <strong>{baseCurrency}</strong> and any payments made will be in <strong>{baseCurrency}</strong>.
                    </AlertDialogDescription>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogAction onClick={confirmCurrencyChange} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl">
                            Understood
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
