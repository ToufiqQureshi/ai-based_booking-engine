import { Bell, ChevronDown, Menu, Search, HelpCircle, Mail, Phone, MessageSquare, Plus, Building2, ShieldCheck, Zap, Globe, Sparkles, User, Settings as SettingsIcon, LogOut, Moon, Sun } from 'lucide-react';
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
import { useTheme } from '@/contexts/ThemeContext';

export function AppHeader() {
  const { user, hotel, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-background dark:bg-slate-900 px-6 border-b border-border dark:border-slate-800">
      
      {/* Sidebar Trigger */}
      <SidebarTrigger className="-ml-2 h-9 w-9 rounded-lg hover:bg-muted/30 transition-colors">
        <Menu className="h-5 w-5 text-muted-foreground" />
      </SidebarTrigger>

      {/* Property Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 px-3 gap-3 rounded-lg hover:bg-muted/30 border border-transparent hover:border-border transition-all group">
            <div className="h-7 w-7 rounded-md bg-blue-600 flex items-center justify-center shadow-sm">
                <Building2 className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col items-start">
                <span className="text-xs font-bold text-foreground leading-none mb-1">{hotel?.name || 'Select Hotel'}</span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none">Main Branch</span>
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-blue-600 transition-colors" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 p-1.5 rounded-xl border-border shadow-xl bg-popover">
          <div className="px-3 py-2 mb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your Properties</p>
          </div>
          <DropdownMenuSeparator className="bg-muted" />

          <div className="max-h-[300px] overflow-y-auto space-y-0.5 my-1">
            {properties.map(p => (
                <DropdownMenuItem key={p.id} className={cn(
                    "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all",
                    p.is_current ? "bg-blue-50 text-blue-700" : "hover:bg-muted/30 text-muted-foreground"
                )} onClick={() => handleSwitchProperty(p.id)}>
                <div className={cn(
                    "h-7 w-7 rounded-md flex items-center justify-center font-bold text-xs",
                    p.is_current ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"
                )}>
                    {p.name[0]}
                </div>
                <div className="flex flex-col">
                    <span className="font-semibold text-sm">{p.name}</span>
                    {p.is_current && <span className="text-[9px] font-bold uppercase text-blue-500">Current</span>}
                </div>
                </DropdownMenuItem>
            ))}
          </div>

          <DropdownMenuSeparator className="bg-muted" />
          <DropdownMenuItem className="p-2.5 rounded-lg text-blue-600 font-bold text-xs cursor-pointer hover:bg-blue-600 hover:text-white transition-all gap-2" onSelect={(e) => { e.preventDefault(); setIsAddPropertyOpen(true); }}>
            <Plus className="h-4 w-4" />
            Add New Property
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Global Search */}
      <div className="hidden flex-1 md:flex md:max-w-md mx-4">
        <div className="relative w-full group">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-600 transition-colors" />
          <Input
            type="search"
            placeholder="Search bookings, rooms, guests..."
            className="w-full h-10 pl-11 bg-muted/30/50 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-blue-600/10 focus-visible:bg-background transition-all text-sm font-medium text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Control Cluster */}
      <div className="ml-auto flex items-center gap-2">
        {/* Dark Mode Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-slate-200 hover:bg-muted dark:hover:bg-slate-800 transition-all"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark'
            ? <Sun className="h-4 w-4" />
            : <Moon className="h-4 w-4" />
          }
        </Button>

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-muted/30 dark:hover:bg-slate-800 transition-all" onClick={() => setIsHelpOpen(true)}>
            <HelpCircle className="h-5 w-5" />
        </Button>
        <NotificationPopover />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 pl-1 pr-2 gap-2 rounded-lg hover:bg-muted/30 border border-transparent transition-all">
              <Avatar className="h-8 w-8 rounded-lg shadow-sm">
                <AvatarFallback className="bg-blue-600 text-white text-[10px] font-bold uppercase">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start text-left md:flex">
                <span className="text-xs font-bold text-foreground leading-none mb-1">{user?.name || 'User'}</span>
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider leading-none">{user?.role || 'Staff'}</span>
              </div>
              <ChevronDown className="h-3 w-3 text-slate-300" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl border-border shadow-xl bg-popover">
            <DropdownMenuLabel className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-muted" />
            <DropdownMenuItem className="p-2.5 rounded-lg cursor-pointer hover:bg-muted/30 text-foreground font-semibold text-sm gap-2.5" onSelect={() => navigate('/profile')}>
              <User className="h-4 w-4 text-muted-foreground" /> My Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="p-2.5 rounded-lg cursor-pointer hover:bg-muted/30 text-foreground font-semibold text-sm gap-2.5" onSelect={() => navigate('/settings?tab=notifications')}>
              <Bell className="h-4 w-4 text-muted-foreground" /> Notifications
            </DropdownMenuItem>
            <DropdownMenuItem className="p-2.5 rounded-lg cursor-pointer hover:bg-muted/30 text-foreground font-semibold text-sm gap-2.5" onSelect={() => setIsHelpOpen(true)}>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-muted" />
            <DropdownMenuItem
              className="p-2.5 rounded-lg cursor-pointer hover:bg-rose-50 text-rose-600 font-bold text-xs uppercase tracking-wider gap-2.5"
              onSelect={logout}
            >
              <LogOut className="h-4 w-4" /> Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialogs */}
      <Dialog open={isAddPropertyOpen} onOpenChange={setIsAddPropertyOpen}>
        <DialogContent className="rounded-2xl p-0 overflow-hidden bg-background border-none shadow-2xl max-w-md">
            <div className="bg-blue-600 p-8 text-white">
                <DialogTitle className="text-xl font-bold mb-1">Add New Property</DialogTitle>
                <DialogDescription className="text-blue-100 text-sm">Fill in the details below to add another hotel to your account.</DialogDescription>
            </div>
            <div className="p-8 space-y-6">
                <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Property Name</Label>
                    <Input className="h-11 rounded-lg border-border bg-muted/30/50 font-medium text-foreground" value={newPropName} onChange={(e) => {
                        setNewPropName(e.target.value);
                        setNewPropSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }} placeholder="e.g. The Grand Plaza" />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Property URL Slug</Label>
                    <Input className="h-11 rounded-lg border-border bg-muted/30/50 font-medium text-muted-foreground" value={newPropSlug} onChange={(e) => setNewPropSlug(e.target.value)} placeholder="e.g. grand-plaza" />
                </div>
            </div>
            <DialogFooter className="p-6 bg-muted/50 flex gap-3">
                <Button variant="ghost" className="rounded-lg font-bold text-muted-foreground" onClick={() => setIsAddPropertyOpen(false)}>Cancel</Button>
                <Button className="rounded-lg bg-blue-600 hover:bg-blue-700 h-11 px-8 font-bold text-sm shadow-sm" onClick={handleAddProperty} disabled={isCreating}>
                    {isCreating ? 'Saving...' : 'Add Property'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="rounded-2xl p-0 overflow-hidden bg-background border-none shadow-2xl max-w-md">
            <div className="bg-slate-900 p-8 text-white">
                <DialogTitle className="text-xl font-bold mb-1">Help & Support</DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm">Need help? Our team is available 24/7 to assist you.</DialogDescription>
            </div>
            <div className="p-6 space-y-3">
                {[
                    { icon: Phone, label: 'Call Support', val: '+91 98765 43210' },
                    { icon: Mail, label: 'Email Support', val: 'support@staybooker.ai' },
                ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                        <div className="h-10 w-10 rounded-lg bg-background shadow-sm flex items-center justify-center text-blue-600 border border-border">
                            <item.icon className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">{item.label}</p>
                            <p className="font-bold text-foreground text-sm">{item.val}</p>
                        </div>
                    </div>
                ))}

                <button 
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all mt-2 group text-left"
                    onClick={() => { setIsHelpOpen(false); setIsChatOpen(true); }}
                >
                    <div className="h-10 w-10 rounded-lg bg-background/10 flex items-center justify-center">
                        <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200 mb-0.5">Live Chat</p>
                        <p className="font-bold text-white text-sm">Start a Conversation</p>
                    </div>
                </button>
            </div>
            <div className="p-4 text-center border-t border-border">
                <Button variant="ghost" className="text-xs font-bold text-muted-foreground hover:text-blue-600" onClick={() => setIsHelpOpen(false)}>Close</Button>
            </div>
        </DialogContent>
      </Dialog>

      <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </header>
  );
}

export default AppHeader;
