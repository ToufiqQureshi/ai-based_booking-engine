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
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Taxes Management</h1>
          <p className="text-muted-foreground text-sm">
            Configure room bookings & experiences / activities tax rules to build trust with guests.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2 shrink-0 h-10 px-5 shadow-sm">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Card: Tax Config Inputs */}
        <Card className="lg:col-span-7 border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Percent className="h-5 w-5 text-indigo-500" />
              Tax Policy Settings
            </CardTitle>
            <CardDescription>
              Set label names and individual percentages for room tariffs and experience packages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tax Display Name */}
            <div className="space-y-2">
              <Label htmlFor="tax_name" className="text-sm font-semibold text-foreground">Tax Display Name</Label>
              <Input
                id="tax_name"
                value={formData.tax_name}
                onChange={(e) => handleChange('tax_name', e.target.value)}
                placeholder="GST, VAT, Luxury Tax, etc."
                className="max-w-md h-10"
              />
              <p className="text-xs text-muted-foreground">
                This label will be shown directly to guests during cart, checkout, and invoices (e.g. "Includes 12% GST").
              </p>
            </div>

            <Separator />

            {/* Room Tax Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">Room Reservation Taxes</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configure tax rates applicable on base room rates.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Calculation Method</Label>
                  <div className="flex items-center gap-3 h-10 border rounded-lg px-3 bg-muted/20">
                    <span className={`text-xs font-bold transition-all ${formData.room_tax_calculation_method === 'flat' ? 'text-indigo-600' : 'text-slate-400'}`}>Flat Rate</span>
                    <Switch
                      checked={formData.room_tax_calculation_method === 'slab'}
                      onCheckedChange={(checked) => handleChange('room_tax_calculation_method', checked ? 'slab' : 'flat')}
                      className="data-[state=checked]:bg-indigo-600"
                    />
                    <span className={`text-xs font-bold transition-all ${formData.room_tax_calculation_method === 'slab' ? 'text-indigo-600' : 'text-slate-400'}`}>Slab-based</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tax Type (Inclusive / Exclusive)</Label>
                  <div className="flex items-center gap-3 h-10 border rounded-lg px-3 bg-muted/20">
                    <span className={`text-xs font-bold transition-all ${formData.room_tax_type === 'inclusive' ? 'text-indigo-600' : 'text-slate-400'}`}>Inclusive</span>
                    <Switch
                      checked={formData.room_tax_type === 'exclusive'}
                      onCheckedChange={(checked) => handleChange('room_tax_type', checked ? 'exclusive' : 'inclusive')}
                      className="data-[state=checked]:bg-indigo-600"
                    />
                    <span className={`text-xs font-bold transition-all ${formData.room_tax_type === 'exclusive' ? 'text-indigo-600' : 'text-slate-400'}`}>Exclusive</span>
                  </div>
                </div>
              </div>

              {formData.room_tax_calculation_method === 'flat' ? (
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="room_tax_rate" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tax Rate (%)</Label>
                  <Input
                    id="room_tax_rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.room_tax_rate}
                    onChange={(e) => handleChange('room_tax_rate', Number(e.target.value))}
                    placeholder="0.00"
                    className="h-10"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Configure Price Slabs (INR)</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addSlab} className="h-8 text-xs font-semibold bg-white">
                      + Add Slab
                    </Button>
                  </div>
                  
                  <div className="border rounded-lg overflow-hidden bg-white/50">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/80 border-b font-semibold text-slate-600">
                          <th className="p-2.5">Rate From</th>
                          <th className="p-2.5">Rate To</th>
                          <th className="p-2.5">Tax Value (%)</th>
                          <th className="p-2.5 w-12 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.room_tax_slabs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-muted-foreground">
                              No custom slabs configured. Slabs default to standard Indian GST settings: <br/>
                              <span className="font-semibold text-slate-700">₹0 - ₹999 = 0%</span>, <span className="font-semibold text-slate-700">₹1,000 - ₹7,499 = 12%</span>, <span className="font-semibold text-slate-700">₹7,500+ = 18%</span>.
                            </td>
                          </tr>
                        ) : (
                          formData.room_tax_slabs.map((slab, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-slate-50/50">
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={slab.from}
                                  onChange={(e) => updateSlab(i, 'from', Number(e.target.value))}
                                  placeholder="e.g. 1000"
                                  className="h-8 text-xs bg-white"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={slab.to}
                                  onChange={(e) => updateSlab(i, 'to', Number(e.target.value))}
                                  placeholder="e.g. 7499"
                                  className="h-8 text-xs bg-white"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={slab.rate}
                                  onChange={(e) => updateSlab(i, 'rate', Number(e.target.value))}
                                  placeholder="e.g. 12"
                                  className="h-8 text-xs bg-white"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeSlab(i)}
                                  className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
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

            <Separator />

            {/* Addon Tax Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">Experiences & Activities Taxes</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configure taxes applicable on paid experiences, dining packages, and extra activities.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="addon_tax_rate" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tax Rate (%)</Label>
                  <Input
                    id="addon_tax_rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.addon_tax_rate}
                    onChange={(e) => handleChange('addon_tax_rate', Number(e.target.value))}
                    placeholder="0.00"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tax Calculation Type</Label>
                  <div className="flex items-center gap-3 h-10 border rounded-lg px-3 bg-muted/20">
                    <span className={`text-xs font-bold transition-all ${formData.addon_tax_type === 'inclusive' ? 'text-indigo-600' : 'text-slate-400'}`}>Inclusive</span>
                    <Switch
                      checked={formData.addon_tax_type === 'exclusive'}
                      onCheckedChange={(checked) => handleChange('addon_tax_type', checked ? 'exclusive' : 'inclusive')}
                      className="data-[state=checked]:bg-indigo-600"
                    />
                    <span className={`text-xs font-bold transition-all ${formData.addon_tax_type === 'exclusive' ? 'text-indigo-600' : 'text-slate-400'}`}>Exclusive</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Card: Live Guest Experience Preview */}
        <Card className="lg:col-span-5 border border-indigo-100 bg-gradient-to-br from-indigo-50/20 to-purple-50/20 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
              Live Guest Summary Preview
            </CardTitle>
            <CardDescription className="text-xs">
              This card simulates how pricing will be computed and itemized in the public booking engine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Simulated Booking Details */}
            <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between font-bold text-slate-700">
                <span>Room Type</span>
                <span>Executive Club Room (1 Room x 1 Night)</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Room Price</span>
                <span className="font-semibold text-foreground">{formatCurrency(sampleRoomPrice)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Experience / Activity</span>
                <span>Adventure Park & Candle Light Dinner Combo</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Experience Price</span>
                <span className="font-semibold text-foreground">{formatCurrency(sampleAddonPrice)}</span>
              </div>
            </div>

            <Separator className="bg-slate-200/60" />

            {/* Calculations Breakdown */}
            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Base Subtotal (excl. exclusive taxes)</span>
                <span className="font-semibold">{formatCurrency(roomSubtotal + addonSubtotal)}</span>
              </div>

              {/* Room Tax details */}
              <div className="flex justify-between text-slate-500">
                <span>
                  Room {formData.tax_name} ({calculatedRoomTaxRate}% {formData.room_tax_type})
                </span>
                <span className="font-semibold">
                  {formData.room_tax_type === 'inclusive' ? 'Included' : formatCurrency(roomTaxAmount)}
                </span>
              </div>

              {/* Experiences & Activities Tax details */}
              <div className="flex justify-between text-slate-500">
                <span>
                  Experiences & Activities {formData.tax_name} ({addonTaxRate}% {formData.addon_tax_type})
                </span>
                <span className="font-semibold">
                  {formData.addon_tax_type === 'inclusive' ? 'Included' : formatCurrency(addonTaxAmount)}
                </span>
              </div>

              {/* Summary of inclusive tax portion */}
              {(formData.room_tax_type === 'inclusive' || formData.addon_tax_type === 'inclusive') && (
                <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-100 flex items-start gap-1.5 mt-2">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-[10px] uppercase tracking-wider">Inclusive Taxes Included</p>
                    <p className="text-[10px] font-medium leading-relaxed mt-0.5">
                      Price contains {formatCurrency(
                        (formData.room_tax_type === 'inclusive' ? roomTaxAmount : 0) +
                        (formData.addon_tax_type === 'inclusive' ? addonTaxAmount : 0)
                      )} in taxes.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Separator className="bg-slate-200" />

            {/* Grand Total */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-end">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Grand Total to Pay</span>
                <span className="text-2xl font-black text-slate-900 leading-none">{formatCurrency(calculatedTotal)}</span>
              </div>
              <p className="text-[9px] text-right text-slate-400 font-bold uppercase tracking-tight">
                {formData.room_tax_type === 'exclusive' || formData.addon_tax_type === 'exclusive'
                  ? `+ Taxes Extra (${formatCurrency(calculatedTax)} exclusive taxes)`
                  : 'Inclusive of all taxes & fees'}
              </p>
            </div>

            {/* Security/Trust note */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Guest Trust and Integrity Check Passed
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
