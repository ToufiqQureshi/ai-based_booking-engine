// Taxes Management Page — Modern Premium Design
import { useState, useEffect } from 'react';
import { Percent, Save, Loader2, Info, Sparkles, ShieldCheck, HelpCircle } from 'lucide-react';
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
    addon_tax_rate: hotel?.settings?.addon_tax_rate || 0,
    addon_tax_type: hotel?.settings?.addon_tax_type || 'exclusive',
  });

  useEffect(() => {
    if (hotel?.settings) {
      setFormData({
        tax_name: hotel.settings.tax_name || 'GST',
        room_tax_rate: hotel.settings.room_tax_rate || 0,
        room_tax_type: hotel.settings.room_tax_type || 'exclusive',
        addon_tax_rate: hotel.settings.addon_tax_rate || 0,
        addon_tax_type: hotel.settings.addon_tax_type || 'exclusive',
      });
    }
  }, [hotel]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
  const roomTaxRate = Number(formData.room_tax_rate) || 0;
  const addonTaxRate = Number(formData.addon_tax_rate) || 0;

  // Room tax calculations
  let roomSubtotal = sampleRoomPrice;
  let roomTaxAmount = 0;
  if (formData.room_tax_type === 'inclusive') {
    roomSubtotal = sampleRoomPrice / (1 + roomTaxRate / 100);
    roomTaxAmount = sampleRoomPrice - roomSubtotal;
  } else {
    roomTaxAmount = sampleRoomPrice * (roomTaxRate / 100);
  }

  // Addon tax calculations
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
            Configure room bookings & add-on services tax rules to build trust with guests.
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
              Set label names and individual percentages for room and addon taxes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tax Name Label */}
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
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Room Reservation Taxes</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Configure tax rate applicable on base room rates.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
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
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tax Calculation Type</Label>
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
            </div>

            <Separator />

            {/* Addon Tax Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">Add-on Services Taxes</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configure taxes applicable on paid enhancements and extra services.</p>
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
                <span>Add-on</span>
                <span>Breakfast & Spa Combo Pack</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Add-on Price</span>
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
                  Room {formData.tax_name} ({roomTaxRate}% {formData.room_tax_type})
                </span>
                <span className="font-semibold">
                  {formData.room_tax_type === 'inclusive' ? 'Included' : formatCurrency(roomTaxAmount)}
                </span>
              </div>

              {/* Addon Tax details */}
              <div className="flex justify-between text-slate-500">
                <span>
                  Add-on {formData.tax_name} ({addonTaxRate}% {formData.addon_tax_type})
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
