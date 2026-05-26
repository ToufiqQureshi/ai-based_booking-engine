import { SlidersHorizontal, Search, Hotel as HotelIcon, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RoomFiltersSortProps {
    priceRange: [number, number];
    setPriceRange: (range: [number, number]) => void;
    selectedMealPlans: string[];
    setSelectedMealPlans: (plans: string[]) => void;
    sortBy: 'price_asc' | 'price_desc' | 'recommended';
    setSortBy: (val: 'price_asc' | 'price_desc' | 'recommended') => void;
    searchType: 'room' | 'package';
    filteredRoomsCount: number;
    isFilterOpen: boolean;
    setIsFilterOpen: (val: boolean) => void;
    themeColor: string;
}

export function RoomFiltersSort({
    priceRange,
    setPriceRange,
    selectedMealPlans,
    setSelectedMealPlans,
    sortBy,
    setSortBy,
    searchType,
    filteredRoomsCount,
    isFilterOpen,
    setIsFilterOpen,
    themeColor,
}: RoomFiltersSortProps) {
    return (
        <>
            {/* Mobile Filter Toggle */}
            <div className="flex items-center justify-between mb-4 lg:hidden">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.15em]">Available Rooms</h2>
                <button
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:border-current transition-colors"
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                    {(selectedMealPlans.length > 0 || priceRange[1] < 20000) && (
                        <span className="w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center" style={{ backgroundColor: themeColor }}>
                            {selectedMealPlans.length + (priceRange[1] < 20000 ? 1 : 0)}
                        </span>
                    )}
                </button>
            </div>

            {/* Filters Card (rendered on left sidebar on desktop, toggled on mobile) */}
            <div className={`lg:col-span-3 space-y-4 ${isFilterOpen ? 'block' : 'hidden'} lg:block`}>
                <Card className="p-5 border-slate-200 shadow-sm rounded-xl bg-white sticky top-24">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Search className="w-4 h-4" style={{ color: themeColor }} /> Filter Rooms
                    </h3>
                    
                    <div className="space-y-6">
                        {/* Price Filter */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Price Range</label>
                            <div className="px-2">
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="20000" 
                                    step="500"
                                    value={priceRange[1]}
                                    onChange={(e) => setPriceRange([0, parseInt(e.target.value)])}
                                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                    style={{ accentColor: themeColor }}
                                />
                                <div className="flex justify-between mt-2 text-xs font-bold text-slate-600">
                                    <span>₹0</span>
                                    <span>Up to ₹{priceRange[1].toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Meal Plan Filter */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Meal Plan</label>
                            <div className="space-y-2">
                                {['EP', 'CP', 'MAP', 'AP'].map(plan => (
                                    <label key={plan} className="flex items-center gap-3 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedMealPlans.includes(plan)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedMealPlans([...selectedMealPlans, plan]);
                                                else setSelectedMealPlans(selectedMealPlans.filter(p => p !== plan));
                                            }}
                                            className="w-4 h-4 rounded border-slate-300 focus:ring-0"
                                            style={{ accentColor: themeColor }}
                                        />
                                        <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800 transition-colors">
                                            {plan === 'EP' ? 'Room Only (EP)' : 
                                             plan === 'CP' ? 'With Breakfast (CP)' :
                                             plan === 'MAP' ? 'Half Board (MAP)' : 'Full Board (AP)'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <Button 
                        variant="ghost" 
                        className="w-full mt-6 text-xs font-bold text-slate-400 hover:text-red-500"
                        onClick={() => {
                            setPriceRange([0, 20000]);
                            setSelectedMealPlans([]);
                        }}
                    >
                        Reset All Filters
                    </Button>
                </Card>
            </div>

        </>
    );
}
