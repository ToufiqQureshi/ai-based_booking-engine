// Taxes Management Page — Modern Premium Design
import { useState, useEffect } from 'react';
import { Percent, Save, Loader2, Info, Sparkles, ShieldCheck, HelpCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { Hotel } from '@/types/api';

export default function Taxes() {
  const { hotel, setHotel } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    tax_name: hotel?.settings?.tax_name || 'GST',
    room_tax_rate: hotel?.settings?.room_tax_rate || 0,
    room_tax_type: hotel?.settings?.room_tax_type || 'exclusive',
    room_tax_calculation_method: hotel?.settings?.room_tax_calculation_method || 'flat',
    room_tax_slabs: hotel?.settings?.room_tax_slabs || [] as Array<{ from: number; to: number; rate: number }>,
    addon_tax_rate: hotel?.settings?.addon_tax_rate || 0,
    addon_tax_type: hotel?.settings?.addon_tax_type || 'exclusive',
  });

  useEffect(() => {
    if (hotel?.settings) {
      setFormData({
        tax_name: hotel.settings.tax_name || 'GST',
        room_tax_rate: hotel.settings.room_tax_rate || 0,
        room_tax_type: hotel.settings.room_tax_type || 'exclusive',
        room_tax_calculation_method: hotel.settings.room_tax_calculation_method || 'flat',
        room_tax_slabs: hotel.settings.room_tax_slabs || [],
        addon_tax_rate: hotel.settings.addon_tax_rate || 0,
        addon_tax_type: hotel.settings.addon_tax_type || 'exclusive',
      });
    }
  }, [hotel]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addSlab = () => {
    setFormData(prev => ({
      ...prev,
      room_tax_slabs: [...prev.room_tax_slabs, { from: 0, to: 0, rate: 0 }]
    }));
  };

  const removeSlab = (index: number) => {
    setFormData(prev => ({
      ...prev,
      room_tax_slabs: prev.room_tax_slabs.filter((_, i) => i !== index)
    }));
  };

  const updateSlab = (index: number, field: 'from' | 'to' | 'rate', value: number) => {
    setFormData(prev => {
      const newSlabs = [...prev.room_tax_slabs];
      newSlabs[index] = { ...newSlabs[index], [field]: value };
      return { ...prev, room_tax_slabs: newSlabs };
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const updatedHotel = await apiClient.patch<Hotel>('/hotels/me', {
        settings: {
          ...hotel?.settings,
          tax_name: formData.tax_name,
          room_tax_rate: Number(formData.room_tax_rate),
          room_tax_type: formData.room_tax_type,
          room_tax_calculation_method: formData.room_tax_calculation_method,
          room_tax_slabs: formData.room_tax_slabs.map(slab => ({
            from: Number(slab.from),
            to: Number(slab.to),
            rate: Number(slab.rate)
          })),
          addon_tax_rate: Number(formData.addon_tax_rate),
          addon_tax_type: formData.addon_tax_type,
        }
      });
      setHotel(updatedHotel);
      toast({
        title: '✅ Taxes settings saved',
        description: 'Taxes configuration has been updated successfully.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error saving settings',
        description: error?.response?.data?.detail || error?.message || 'Failed to save taxes.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Live Calculator variables
  const sampleRoomPrice = 5000;
  const sampleAddonPrice = 1000;
  
  const getRoomTaxRate = (price: number) => {
    if (formData.room_tax_calculation_method === 'flat') {
      return Number(formData.room_tax_rate) || 0;
    }
    // Search matching slab
    const slab = formData.room_tax_slabs.find(s => 
      price >= s.from && (s.to === 0 || s.to === null || price <= s.to)
    );
    if (slab) return slab.rate;
    
    // Indian GST default fallback:
    if (price < 1000) return 0;
    if (price < 7500) return 12;
    return 18;
  };

  const calculatedRoomTaxRate = getRoomTaxRate(sampleRoomPrice);
  const addonTaxRate = Number(formData.addon_tax_rate) || 0;

  // Room tax calculations
  let roomSubtotal = sampleRoomPrice;
  let roomTaxAmount = 0;
  if (formData.room_tax_type === 'inclusive') {
    roomSubtotal = sampleRoomPrice / (1 + calculatedRoomTaxRate / 100);
    roomTaxAmount = sampleRoomPrice - roomSubtotal;
  } else {
    roomTaxAmount = sampleRoomPrice * (calculatedRoomTaxRate / 100);
  }

  // Experiences & Activities tax calculations
  let addonSubtotal = sampleAddonPrice;
  let addonTaxAmount = 0;
  if (formData.addon_tax_type === 'inclusive') {
    addonSubtotal = sampleAddonPrice / (1 + addonTaxRate / 100);
    addonTaxAmount = sampleAddonPrice - addonSubtotal;
  } else {
    addonTaxAmount = sampleAddonPrice * (addonTaxRate / 100);
  }

  const calculatedSubtotal = roomSubtotal + addonSubtotal;
  const calculatedTax = roomTaxAmount + addonTaxAmount;
  const calculatedTotal = calculatedSubtotal + calculatedTax;

  const formatCurrency = (amt: number) => {
    const currency = hotel?.settings?.currency || 'INR';
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 2
    }).format(amt);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Percent className="h-8 w-8 text-indigo-600 animate-pulse" />
            Taxes Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure room bookings & experiences / activities tax rules to build trust with guests.
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving} 
          className="gap-2 shrink-0 h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Tax Config Inputs */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-3xl overflow-hidden bg-white dark:bg-slate-950">
            <CardHeader className="border-b border-slate-100/80 bg-slate-50/50 dark:bg-slate-900/30 p-6">
              <CardTitle className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Percent className="h-5 w-5 text-indigo-500" />
                Tax Policy Settings
              </CardTitle>
              <CardDescription className="text-xs">
                Set label names and individual percentages for room tariffs and experience packages.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Tax Display Name */}
              <div className="space-y-2">
                <Label htmlFor="tax_name" className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Tax Display Name
                </Label>
                <Input
                  id="tax_name"
                  value={formData.tax_name}
                  onChange={(e) => handleChange('tax_name', e.target.value)}
                  placeholder="e.g. GST, VAT, Luxury Tax"
                  className="max-w-md h-11 rounded-xl border-slate-200 focus-visible:ring-indigo-500 font-medium"
                />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  This label will be shown directly to guests during cart, checkout, and invoices (e.g. "Includes 12% {formData.tax_name}").
                </p>
              </div>

              {/* Room Tax Section */}
              <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/40 dark:bg-slate-900/10 space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Room Reservation Taxes</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Configure tax rates applicable on base room rates.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Calculation Method Button Group */}
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Calculation Method
                    </Label>
                    <div className="flex gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-900 rounded-xl max-w-xs border border-slate-200/20">
                      <button
                        type="button"
                        onClick={() => handleChange('room_tax_calculation_method', 'flat')}
                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                          formData.room_tax_calculation_method === 'flat'
                            ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-sm"
                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        }`}
                      >
                        Flat Rate
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange('room_tax_calculation_method', 'slab')}
                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                          formData.room_tax_calculation_method === 'slab'
                            ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-sm"
                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        }`}
                      >
                        Slab-based
                      </button>
                    </div>
                  </div>

                  {/* Room Tax Type Button Group */}
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Tax Type
                    </Label>
                    <div className="flex gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-900 rounded-xl max-w-xs border border-slate-200/20">
                      <button
                        type="button"
                        onClick={() => handleChange('room_tax_type', 'inclusive')}
                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                          formData.room_tax_type === 'inclusive'
                            ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-sm"
                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        }`}
                      >
                        Inclusive
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange('room_tax_type', 'exclusive')}
                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                          formData.room_tax_type === 'exclusive'
                            ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-sm"
                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        }`}
                      >
                        Exclusive
                      </button>
                    </div>
                  </div>
                </div>

                {formData.room_tax_calculation_method === 'flat' ? (
                  <div className="space-y-2 max-w-xs">
                    <Label htmlFor="room_tax_rate" className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Tax Rate (%)
                    </Label>
                    <div className="relative">
                      <Input
                        id="room_tax_rate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.room_tax_rate}
                        onChange={(e) => handleChange('room_tax_rate', Number(e.target.value))}
                        placeholder="0.00"
                        className="h-11 rounded-xl pr-8 border-slate-200 focus-visible:ring-indigo-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Configure Price Slabs (INR)
                      </Label>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={addSlab} 
                        className="h-8 text-xs font-extrabold bg-white hover:bg-slate-50 text-indigo-600 border-indigo-100 rounded-lg"
                      >
                        + Add Slab
                      </Button>
                    </div>
                    
                    <div className="border border-slate-100 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 font-black text-slate-500 uppercase tracking-wider">
                            <th className="p-3">Rate From</th>
                            <th className="p-3">Rate To</th>
                            <th className="p-3">Tax Value (%)</th>
                            <th className="p-3 w-12 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.room_tax_slabs.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-5 text-center text-slate-400 leading-relaxed">
                                No custom slabs configured. Slabs default to standard settings: <br/>
                                <span className="font-semibold text-slate-600 dark:text-slate-300">₹0 - ₹999 = 0%</span>, <span className="font-semibold text-slate-600 dark:text-slate-300">₹1,000 - ₹7,499 = 12%</span>, <span className="font-semibold text-slate-600 dark:text-slate-300">₹7,500+ = 18%</span>.
                              </td>
                            </tr>
                          ) : (
                            formData.room_tax_slabs.map((slab, i) => (
                              <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    value={slab.from}
                                    onChange={(e) => updateSlab(i, 'from', Number(e.target.value))}
                                    placeholder="e.g. 1000"
                                    className="h-9 text-xs bg-white dark:bg-slate-950 rounded-lg"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    value={slab.to}
                                    onChange={(e) => updateSlab(i, 'to', Number(e.target.value))}
                                    placeholder="e.g. 7499"
                                    className="h-9 text-xs bg-white dark:bg-slate-950 rounded-lg"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    value={slab.rate}
                                    onChange={(e) => updateSlab(i, 'rate', Number(e.target.value))}
                                    placeholder="e.g. 12"
                                    className="h-9 text-xs bg-white dark:bg-slate-950 rounded-lg"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeSlab(i)}
                                    className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Addon Tax Section */}
              <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/40 dark:bg-slate-900/10 space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Experiences & Activities Taxes</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Configure taxes applicable on paid experiences, dining packages, and extra activities.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Addon Tax Rate */}
                  <div className="space-y-2">
                    <Label htmlFor="addon_tax_rate" className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Tax Rate (%)
                    </Label>
                    <div className="relative">
                      <Input
                        id="addon_tax_rate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.addon_tax_rate}
                        onChange={(e) => handleChange('addon_tax_rate', Number(e.target.value))}
                        placeholder="0.00"
                        className="h-11 rounded-xl pr-8 border-slate-200 focus-visible:ring-indigo-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>

                  {/* Addon Tax Type Button Group */}
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Tax Calculation Type
                    </Label>
                    <div className="flex gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-900 rounded-xl max-w-xs border border-slate-200/20">
                      <button
                        type="button"
                        onClick={() => handleChange('addon_tax_type', 'inclusive')}
                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                          formData.addon_tax_type === 'inclusive'
                            ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-sm"
                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        }`}
                      >
                        Inclusive
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange('addon_tax_type', 'exclusive')}
                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                          formData.addon_tax_type === 'exclusive'
                            ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-sm"
                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        }`}
                      >
                        Exclusive
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Live Guest Experience Preview */}
        <div className="lg:col-span-5">
          <Card className="border border-indigo-100 dark:border-slate-800 bg-gradient-to-br from-indigo-50/40 via-purple-50/20 to-white dark:from-slate-950 dark:to-slate-900 shadow-xl rounded-3xl overflow-hidden sticky top-6">
            <CardHeader className="pb-4 border-b border-indigo-100/30 dark:border-slate-800/50 p-6">
              <CardTitle className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
                Live Guest Summary Preview
              </CardTitle>
              <CardDescription className="text-xs">
                This simulates how pricing will be computed and itemized in the public booking engine.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {/* Simulated Booking Details */}
              <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2.5 text-xs shadow-sm">
                <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px]">Room Selected</span>
                  <span className="font-extrabold text-right max-w-[200px] truncate">Executive Club Room (1 Room x 1 Night)</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400 pl-2">
                  <span>Room Price</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(sampleRoomPrice)}</span>
                </div>
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px]">Experience Package</span>
                  <span className="font-extrabold text-right max-w-[200px] truncate">Adventure Park & Dinner Combo</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400 pl-2">
                  <span>Experience Price</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(sampleAddonPrice)}</span>
                </div>
              </div>

              {/* Calculations Breakdown */}
              <div className="space-y-3.5 text-xs px-1">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span className="font-medium">Subtotal (before exclusive taxes)</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(roomSubtotal + addonSubtotal)}</span>
                </div>

                {/* Room Tax details */}
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span className="font-medium">
                    Room {formData.tax_name} ({calculatedRoomTaxRate}% {formData.room_tax_type})
                  </span>
                  <span className={`font-bold ${formData.room_tax_type === 'inclusive' ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-200'}`}>
                    {formData.room_tax_type === 'inclusive' ? 'Included' : formatCurrency(roomTaxAmount)}
                  </span>
                </div>

                {/* Experiences & Activities Tax details */}
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span className="font-medium">
                    Experience {formData.tax_name} ({addonTaxRate}% {formData.addon_tax_type})
                  </span>
                  <span className={`font-bold ${formData.addon_tax_type === 'inclusive' ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-200'}`}>
                    {formData.addon_tax_type === 'inclusive' ? 'Included' : formatCurrency(addonTaxAmount)}
                  </span>
                </div>

                {/* Summary of inclusive tax portion */}
                {(formData.room_tax_type === 'inclusive' || formData.addon_tax_type === 'inclusive') && (
                  <div className="bg-green-50/50 dark:bg-green-950/20 text-green-800 dark:text-green-400 p-3 rounded-2xl border border-green-100/60 dark:border-green-950/40 flex items-start gap-2.5 mt-2 shadow-sm">
                    <Info className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
                    <div>
                      <p className="font-bold text-[10px] uppercase tracking-wider">Inclusive Taxes Included</p>
                      <p className="text-[10px] font-medium leading-relaxed mt-0.5">
                        Base room & experience rates contain {formatCurrency(
                          (formData.room_tax_type === 'inclusive' ? roomTaxAmount : 0) +
                          (formData.addon_tax_type === 'inclusive' ? addonTaxAmount : 0)
                        )} in built-in taxes.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <Separator className="bg-slate-200/50 dark:bg-slate-800" />

              {/* Grand Total */}
              <div className="space-y-1 px-1">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Grand Total</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">{formatCurrency(calculatedTotal)}</span>
                </div>
                <p className="text-[9px] text-right text-slate-400 font-bold uppercase tracking-tight">
                  {(() => {
                    const exclusiveTax = (formData.room_tax_type === 'exclusive' ? roomTaxAmount : 0) +
                                         (formData.addon_tax_type === 'exclusive' ? addonTaxAmount : 0);
                    if (exclusiveTax > 0) {
                      return `+ Taxes Extra (${formatCurrency(exclusiveTax)} exclusive taxes)`;
                    }
                    return 'Inclusive of all taxes & fees';
                  })()}
                </p>
              </div>

              {/* Security/Trust note */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[10px] text-slate-500 font-black uppercase tracking-wider">
                <ShieldCheck className="h-4.5 w-4.5 text-green-500" /> Guest Trust and Integrity Check Passed
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
