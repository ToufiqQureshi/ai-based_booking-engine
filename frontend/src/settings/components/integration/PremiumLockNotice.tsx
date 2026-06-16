import { Sparkles, CheckCircle2 } from 'lucide-react';

interface PremiumLockNoticeProps {
    title: string;
    description: string;
    /** Optional list of what unlocking this feature provides. */
    bullets?: string[];
}

/**
 * A clear, intentional "this is a premium feature" panel.
 *
 * Replaces the old pattern of an absolute, blurred overlay sitting on top of
 * real controls — that looked like a rendering bug to hoteliers ("the page is
 * broken / blurry") rather than a deliberate upgrade prompt. This panel reads
 * as a designed upsell, not a glitch.
 */
export const PremiumLockNotice = ({ title, description, bullets }: PremiumLockNoticeProps) => (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/40 dark:to-slate-950 p-6 text-center">
        <div className="mx-auto w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h4 className="text-sm font-black text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">{description}</p>
        {bullets && bullets.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-left max-w-xs mx-auto">
                {bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-foreground/80">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> {b}
                    </li>
                ))}
            </ul>
        )}
        <span className="inline-block mt-4 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 px-3 py-1 rounded-full">
            Available on a higher plan
        </span>
    </div>
);
