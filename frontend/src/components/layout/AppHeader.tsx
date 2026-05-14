import { Bell, ChevronDown, Menu, Search, HelpCircle, Mail, Phone, MessageSquare, Plus, Building2, ShieldCheck, Zap, Globe, Sparkles, User, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import React, { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { NotificationPopover } from '@/components/notifications/NotificationPopover';
import { ChatWidget } from '@/components/support/ChatWidget';
import { cn } from '@/lib/utils';

export function AppHeader() {
  const { user, hotel, logout } = useAuth();
  const [properties, setProperties] = React.useState<any[]>([]);
  const [isAddPropertyOpen, setIsAddPropertyOpen] = React.useState(false);
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [newPropName, setNewPropName] = React.useState('');
  const [newPropSlug, setNewPropSlug] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) {
      import('@/api/client').then(({ apiClient }) => {
        apiClient.get('/properties')
          .then((data: any) => setProperties(data))
          .catch(err => console.error("Failed to fetch properties", err));
      });
    }
  }, [user]);

  const handleSwitchProperty = async (hotelId: string) => {
    try {
      const { apiClient } = await import('@/api/client');
      await apiClient.post(`/properties/switch/${hotelId}`, {});
      window.location.reload();
    } catch (error) {
      console.error("Failed to switch property", error);
    }
  };

  const handleAddProperty = async () => {
    if (!newPropName || !newPropSlug) return;
    setIsCreating(true);
    try {
      const { apiClient } = await import('@/api/client');
      await apiClient.post('/properties', {
        name: newPropName,
        slug: newPropSlug
      });
      window.location.reload();
    } catch (error) {
      setIsCreating(false);
    }
  };

  const userInitials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <header className="sticky top-0 z-40 flex h-20 items-center gap-4 bg-white/60 backdrop-blur-2xl px-8 border-b border-indigo-100/30">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-violet-500/5 pointer-events-none" />
      
      {/* Sidebar Trigger - Premium Styled */}
      <SidebarTrigger className="-ml-2 h-10 w-10 rounded-xl hover:bg-indigo-50 transition-colors">
        <Menu className="h-5 w-5 text-indigo-950" />
      </SidebarTrigger>

      {/* Property Architecture Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-12 px-5 gap-3 rounded-2xl hover:bg-white/80 border border-transparent hover:border-indigo-100/50 transition-all group">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                <Building2 className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col items-start">
                <span className="text-xs font-black text-indigo-950 tracking-tight leading-none mb-1 uppercase">{hotel?.name || 'Select Entity'}</span>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest leading-none">Global Node</span>
            </div>
            <ChevronDown className="h-4 w-4 text-indigo-300 group-hover:text-indigo-600 transition-colors" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 p-2 rounded-3xl border-indigo-100 shadow-2xl bg-white/95 backdrop-blur-xl">
          <div className="px-4 py-3 mb-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Infrastructure Management</p>
            <p className="text-xs font-bold text-indigo-950">Switch Active Property</p>
          </div>
          <DropdownMenuSeparator className="bg-indigo-50" />

          <div className="max-h-[300px] overflow-y-auto space-y-1 my-2 pr-1">
            {properties.map(p => (
                <DropdownMenuItem key={p.id} className={cn(
                    "flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all",
                    p.is_current ? "bg-indigo-50 text-indigo-950" : "hover:bg-indigo-50/50 text-slate-600"
                )} onClick={() => handleSwitchProperty(p.id)}>
                <div className={cn(
                    "h-8 w-8 rounded-xl flex items-center justify-center font-black text-xs",
                    p.is_current ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" : "bg-indigo-100 text-indigo-600"
                )}>
                    {p.name[0]}
                </div>
                <div className="flex flex-col">
                    <span className="font-bold text-sm tracking-tight">{p.name}</span>
                    {p.is_current && <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Current Node</span>}
                </div>
                {p.is_current && <div className="ml-auto h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />}
                </DropdownMenuItem>
            ))}
          </div>

          <DropdownMenuSeparator className="bg-indigo-50" />
          <DropdownMenuItem className="p-3 rounded-2xl text-indigo-600 font-black uppercase tracking-widest text-[10px] cursor-pointer hover:bg-indigo-600 hover:text-white transition-all gap-3" onSelect={(e) => { e.preventDefault(); setIsAddPropertyOpen(true); }}>
            <div className="h-6 w-6 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-white group-hover:text-indigo-600">
                <Plus className="h-4 w-4" />
            </div>
            Initialize New Entity
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Global Intelligence Search */}
      <div className="hidden flex-1 md:flex md:max-w-xl mx-4">
        <div className="relative w-full group">
          <div className="absolute inset-0 bg-indigo-500/5 rounded-2xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-300 group-focus-within:text-indigo-600 transition-colors" />
          <Input
            type="search"
            placeholder="Search bookings, neural patterns, guest IDs..."
            className="w-full h-12 pl-14 bg-white/50 border border-indigo-50/50 rounded-2xl focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:bg-white transition-all font-bold text-indigo-950 placeholder:text-indigo-200 placeholder:font-medium"
          />
          <div className="absolute right-5 top-1/2 -translate-y-1/2 flex gap-1">
             <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-indigo-100 bg-white px-1.5 font-mono text-[10px] font-black text-indigo-300 uppercase opacity-100">
                <span className="text-xs">⌘</span>K
             </kbd>
          </div>
        </div>
      </div>

      {/* Control Cluster */}
      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center bg-white/80 rounded-2xl p-1 border border-indigo-50/50 shadow-sm">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all" onClick={() => setIsHelpOpen(true)}>
                <HelpCircle className="h-5 w-5" />
            </Button>
            <div className="w-[1px] h-4 bg-indigo-50" />
            <NotificationPopover />
        </div>

        {/* User Identity Module */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-12 pl-2 pr-4 gap-3 rounded-2xl hover:bg-white/80 border border-transparent hover:border-indigo-100/50 transition-all">
              <Avatar className="h-9 w-9 rounded-xl border-2 border-white shadow-lg shadow-indigo-500/10 transition-transform hover:scale-105">
                <AvatarFallback className="bg-indigo-600 text-white text-[10px] font-black uppercase">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start text-left md:flex">
                <span className="text-xs font-black text-indigo-950 tracking-tight leading-none mb-1 uppercase">{user?.name || 'Authorized User'}</span>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest leading-none">{user?.role || 'Manager'}</span>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-indigo-200" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-2 rounded-3xl border-indigo-100 shadow-2xl bg-white/95 backdrop-blur-xl">
            <DropdownMenuLabel className="px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">System Identity</p>
                <p className="text-xs font-bold text-indigo-950">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-indigo-50" />
            <DropdownMenuItem className="p-3 rounded-2xl cursor-pointer hover:bg-indigo-50 text-slate-700 font-bold text-sm gap-3 transition-all" onSelect={() => navigate('/profile')}>
              <User className="h-4 w-4 text-indigo-400" /> Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="p-3 rounded-2xl cursor-pointer hover:bg-indigo-50 text-slate-700 font-bold text-sm gap-3 transition-all" onSelect={() => navigate('/settings?tab=notifications')}>
              <Bell className="h-4 w-4 text-indigo-400" /> Notifications
            </DropdownMenuItem>
            <DropdownMenuItem className="p-3 rounded-2xl cursor-pointer hover:bg-indigo-50 text-slate-700 font-bold text-sm gap-3 transition-all" onSelect={() => setIsHelpOpen(true)}>
              <ShieldCheck className="h-4 w-4 text-indigo-400" /> Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-indigo-50" />
            <DropdownMenuItem
              className="p-3 rounded-2xl cursor-pointer hover:bg-rose-50 text-rose-600 font-black uppercase tracking-widest text-[10px] gap-3 transition-all"
              onSelect={logout}
            >
              <LogOut className="h-4 w-4" /> Terminate Session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Premium Dialogs */}
      <Dialog open={isAddPropertyOpen} onOpenChange={setIsAddPropertyOpen}>
        <DialogContent className="rounded-[40px] p-0 overflow-hidden bg-white/95 backdrop-blur-2xl border-none shadow-2xl max-w-md">
            <div className="bg-indigo-600 p-8 text-white relative">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Building2 className="h-20 w-20" /></div>
                <DialogTitle className="text-2xl font-black tracking-tight mb-2">Initialize Entity</DialogTitle>
                <DialogDescription className="text-indigo-100 font-medium opacity-80">Expand your hospitality infrastructure with a new node.</DialogDescription>
            </div>
            <div className="p-8 space-y-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Property Name</Label>
                    <Input className="h-12 rounded-2xl border-indigo-100 bg-indigo-50/30 font-bold text-indigo-950" value={newPropName} onChange={(e) => {
                        setNewPropName(e.target.value);
                        setNewPropSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }} placeholder="e.g. The Grand Plaza" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Neural Slug (URL)</Label>
                    <Input className="h-12 rounded-2xl border-indigo-100 bg-indigo-50/30 font-bold text-indigo-400" value={newPropSlug} onChange={(e) => setNewPropSlug(e.target.value)} placeholder="e.g. grand-plaza" />
                </div>
            </div>
            <DialogFooter className="p-8 bg-indigo-50/50 flex gap-3">
                <Button variant="ghost" className="rounded-2xl font-bold text-indigo-400" onClick={() => setIsAddPropertyOpen(false)}>Cancel</Button>
                <Button className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 h-12 px-8 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-500/20" onClick={handleAddProperty} disabled={isCreating}>
                    {isCreating ? 'Deploying...' : 'Deploy Entity'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="rounded-[40px] p-0 overflow-hidden bg-white/95 backdrop-blur-2xl border-none shadow-2xl max-w-md">
            <div className="bg-indigo-950 p-8 text-white relative">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Zap className="h-20 w-20 text-indigo-500" /></div>
                <DialogTitle className="text-2xl font-black tracking-tight mb-2">Protocol Assistance</DialogTitle>
                <DialogDescription className="text-indigo-200/50 font-medium">Neural support nodes active 24/7 for system integrity.</DialogDescription>
            </div>
            <div className="p-8 space-y-4">
                {[
                    { icon: Phone, label: 'Voice Support', val: '+91 98765 43210', color: 'indigo' },
                    { icon: Mail, label: 'Email Protocol', val: 'ops@staybooker.ai', color: 'violet' },
                ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-5 rounded-[24px] bg-indigo-50/30 border border-indigo-100/50 group hover:bg-white transition-all">
                        <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-600">
                            <item.icon className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-0.5">{item.label}</p>
                            <p className="font-bold text-indigo-950">{item.val}</p>
                        </div>
                    </div>
                ))}

                <button 
                    className="w-full flex items-center gap-4 p-5 rounded-[24px] bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all mt-4 group text-left"
                    onClick={() => { setIsHelpOpen(false); setIsChatOpen(true); }}
                >
                    <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-0.5">Neural Chat</p>
                        <p className="font-bold text-white">Initialize Live Support</p>
                    </div>
                    <Sparkles className="ml-auto h-5 w-5 text-indigo-300 opacity-50 group-hover:opacity-100 group-hover:animate-pulse" />
                </button>
            </div>
            <div className="p-6 text-center">
                <Button variant="ghost" className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 hover:text-indigo-600" onClick={() => setIsHelpOpen(false)}>Close Assistance</Button>
            </div>
        </DialogContent>
      </Dialog>

      <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </header>
  );
}

export default AppHeader;
