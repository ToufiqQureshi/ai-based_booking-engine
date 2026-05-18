import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

interface BookingStepperProps {
    currentStep: 1 | 2 | 3 | 4;
    primaryColor?: string;
}

export function BookingStepper({ currentStep, primaryColor }: BookingStepperProps) {
    const { hotelSlug } = useParams();
    const navigate = useNavigate();

    // Helper to get search params from location to preserve state when clicking back
    const [searchParams] = useSearchParams();
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';

    const steps = [
        { id: 1, label: 'Search', path: `/book/${hotelSlug}/rooms${queryString}` }, 
        { id: 2, label: 'Select Rooms', path: `/book/${hotelSlug}/rooms${queryString}` },
        { id: 3, label: 'Enhance Stay', path: null },
        { id: 4, label: 'Guest Info', path: `/book/${hotelSlug}/checkout${queryString}` },
    ];

    const getNormalizedColor = (col?: string | null) => {
        if (!col || ['#3b82f6', '#ef4444', '#2563eb', '#0f172a'].includes(col.toLowerCase())) {
            return '#7c3aed';
        }
        return col;
    };
    const activeColor = getNormalizedColor(primaryColor);

    return (
        <div className="w-full bg-white border-b border-slate-200 shadow-sm mb-0">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between md:grid md:grid-cols-4 md:divide-x divide-slate-100">
                    {steps.map((step) => {
                        const isActive = step.id === currentStep;
                        const isCompleted = step.id < currentStep;
                        const isClickable = isCompleted && step.path;

                        return (
                            <div
                                key={step.id}
                                className={cn(
                                    "relative flex-1 flex items-center justify-center p-4 md:p-5 text-sm font-medium transition-all select-none border-b-2 md:border-b-0",
                                    isActive ? "bg-slate-50/50 text-slate-900" : "bg-white text-slate-400 border-transparent",
                                    isClickable ? "cursor-pointer hover:bg-slate-50" : "cursor-default"
                                )}
                                style={isActive && primaryColor ? { borderColor: activeColor, color: activeColor } : {}}
                                onClick={() => {
                                    if (isClickable && step.path) {
                                        navigate(step.path);
                                    }
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div 
                                        className={cn(
                                            "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all border",
                                            isActive ? "text-white shadow-md" :
                                                isCompleted ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 bg-slate-50 text-slate-400"
                                        )}
                                        style={isActive ? { backgroundColor: activeColor, borderColor: activeColor } : {}}
                                    >
                                        {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                                    </div>
                                    <span className={cn("hidden md:inline text-[13px] tracking-wide", isActive ? "font-bold text-slate-900" : "font-semibold")} style={isActive && primaryColor ? { color: activeColor } : {}}>
                                        {step.label}
                                    </span>
                                </div>

                                {/* Active indicator for desktop */}
                                {isActive && (
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 hidden md:block" style={{ backgroundColor: activeColor }} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

