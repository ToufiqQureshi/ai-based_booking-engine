import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

interface BookingStepperProps {
    currentStep: 1 | 2 | 3 | 4;
}

export function BookingStepper({ currentStep }: BookingStepperProps) {
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
                                    isActive ? "border-blue-600 bg-blue-50/30 text-blue-700" : "bg-white text-slate-400 border-transparent",
                                    isClickable ? "cursor-pointer hover:bg-slate-50" : "cursor-default"
                                )}
                                onClick={() => {
                                    if (isClickable && step.path) {
                                        navigate(step.path);
                                    }
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all border",
                                        isActive ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-100" :
                                            isCompleted ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 bg-slate-50 text-slate-400"
                                    )}>
                                        {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                                    </div>
                                    <span className={cn("hidden md:inline text-[13px] tracking-wide", isActive ? "font-bold text-slate-900" : "font-semibold")}>
                                        {step.label}
                                    </span>
                                </div>

                                {/* Active indicator for desktop */}
                                {isActive && (
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 hidden md:block" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

