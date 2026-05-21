import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

interface BookingStepperProps {
    currentStep: 1 | 2 | 3 | 4;
    primaryColor?: string;
}

const PURPLE = '#7c3aed';

export function BookingStepper({ currentStep, primaryColor }: BookingStepperProps) {
    const { hotelSlug } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';

    const steps = [
        { id: 1, label: 'Search',       shortLabel: 'Search',   path: `/book/${hotelSlug}/rooms${queryString}` },
        { id: 2, label: 'Select Rooms', shortLabel: 'Rooms',    path: `/book/${hotelSlug}/rooms${queryString}` },
        { id: 3, label: 'Enhance Stay', shortLabel: 'Extras',   path: null },
        { id: 4, label: 'Guest Info',   shortLabel: 'Details',  path: `/book/${hotelSlug}/checkout${queryString}` },
    ];

    const activeColor = PURPLE;

    return (
        <div className="w-full bg-white border-b border-slate-200 shadow-sm">
            <div className="max-w-7xl mx-auto">
                {/* Mobile: compact pill stepper */}
                <div className="flex sm:hidden items-center justify-center gap-1 px-4 py-3">
                    {steps.map((step, idx) => {
                        const isActive = step.id === currentStep;
                        const isCompleted = step.id < currentStep;
                        const isClickable = isCompleted && step.path;
                        return (
                            <div key={step.id} className="flex items-center gap-1">
                                <button
                                    onClick={() => isClickable && step.path && navigate(step.path)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all",
                                        isActive
                                            ? "text-white shadow-sm"
                                            : isCompleted
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "bg-slate-100 text-slate-400",
                                        isClickable ? "cursor-pointer" : "cursor-default"
                                    )}
                                    style={isActive ? { backgroundColor: activeColor } : {}}
                                    disabled={!isClickable}
                                >
                                    <span className={cn(
                                        "flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black",
                                        isActive ? "bg-white/25" : isCompleted ? "bg-emerald-500 text-white" : "bg-slate-300 text-slate-500"
                                    )}>
                                        {isCompleted ? <Check className="w-2.5 h-2.5 text-white" /> : step.id}
                                    </span>
                                    {isActive && <span>{step.shortLabel}</span>}
                                </button>
                                {idx < steps.length - 1 && (
                                    <div className={cn("w-4 h-px", step.id < currentStep ? "bg-emerald-300" : "bg-slate-200")} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Desktop: full stepper */}
                <div className="hidden sm:grid grid-cols-4 divide-x divide-slate-100">
                    {steps.map((step) => {
                        const isActive = step.id === currentStep;
                        const isCompleted = step.id < currentStep;
                        const isClickable = isCompleted && step.path;

                        return (
                            <div
                                key={step.id}
                                className={cn(
                                    "relative flex items-center justify-center p-4 text-sm font-medium transition-all select-none border-b-2",
                                    isActive ? "bg-violet-50/60 border-b-violet-600" : "bg-white border-transparent",
                                    isClickable ? "cursor-pointer hover:bg-slate-50" : "cursor-default"
                                )}
                                onClick={() => {
                                    if (isClickable && step.path) navigate(step.path);
                                }}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div
                                        className={cn(
                                            "flex items-center justify-center w-7 h-7 rounded-full text-xs font-black border-2 transition-all",
                                            isActive ? "text-white border-violet-600"
                                                : isCompleted ? "border-emerald-500 bg-emerald-500 text-white"
                                                    : "border-slate-200 bg-white text-slate-400"
                                        )}
                                        style={isActive ? { backgroundColor: activeColor, borderColor: activeColor } : {}}
                                    >
                                        {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                                    </div>
                                    <span className={cn(
                                        "text-[13px] tracking-wide",
                                        isActive ? "font-bold text-violet-700" : isCompleted ? "font-semibold text-slate-600" : "font-medium text-slate-400"
                                    )}>
                                        {step.label}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
