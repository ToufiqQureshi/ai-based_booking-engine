import { Check, MapPin, Calendar as CalendarIcon, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

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

            {/* Property Context Bar - Clean & Informative */}
            {currentStep > 1 && (
                <div className="bg-slate-50/80 border-b border-slate-200 py-3">
                    <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                        <div className="flex items-center gap-6 overflow-hidden">
                            <div className="flex items-center text-xs font-bold text-slate-900 uppercase tracking-widest whitespace-nowrap">
                                <MapPin className="w-4 h-4 mr-2 text-blue-600" />
                                {hotelSlug?.replace(/-/g, ' ') || 'Staybooker'}
                            </div>
                            
                            <div className="hidden md:flex items-center gap-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                <div className="flex items-center gap-2 border-l border-slate-200 pl-6">
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    <span>{searchParams.get('check_in') || '---'} — {searchParams.get('check_out') || '---'}</span>
                                </div>
                                <div className="flex items-center gap-2 border-l border-slate-200 pl-6">
                                    <User className="w-3.5 h-3.5" />
                                    <span>{searchParams.get('adults') || '2'} Adults, {searchParams.get('children') || '0'} Children</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-4">
                            <button 
                                className="text-blue-600 text-[11px] font-black uppercase tracking-widest hover:text-blue-700 transition-colors" 
                                onClick={() => document.getElementById('search-bar')?.scrollIntoView({ behavior: 'smooth' })}
                            >
                                Modify Search
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
