// Main Application Sidebar with all dashboard modules - Refined Ultra-Luxe Design
import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Bed,
  IndianRupee,
  Calendar,
  BookOpen,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Building2,
  Plug,
  Sparkles,
  Link2,
  Coffee,
  TrendingUp,
  Bot,
  LineChart,
  ChevronRight,
} from 'lucide-react';
import { NavLink } from '@/components/layout/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Navigation items for the dashboard with descriptive colors
const mainNavItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, color: 'text-blue-500' },
  { title: 'Analytics & Reports', url: '/analytics', icon: LineChart, color: 'text-emerald-500' },
  { title: 'AI Assistant', url: '/agent', icon: Bot, color: 'text-violet-500' },

  { title: 'Rooms', url: '/rooms', icon: Bed, color: 'text-indigo-500' },
  { title: 'Rates', url: '/rates', icon: IndianRupee, color: 'text-amber-500' },
  { title: 'Rate Shopper', url: '/rate-shopper', icon: TrendingUp, color: 'text-rose-500' },
  { title: 'Availability', url: '/availability', icon: Calendar, color: 'text-sky-500' },
  { title: 'Bookings', url: '/bookings', icon: BookOpen, color: 'text-cyan-500' },
  { title: 'Guests', url: '/guests', icon: Users, color: 'text-orange-500' },
  { title: 'Payments', url: '/payments', icon: CreditCard, color: 'text-slate-500' },
  { title: 'Amenities', url: '/amenities', icon: Coffee, color: 'text-brown-500' },
  { title: 'Add-ons', url: '/addons', icon: Sparkles, color: 'text-yellow-500' },
  { title: 'Channel Manager', url: '/channel-settings', icon: Link2, color: 'text-pink-500' },
];

const settingsNavItems = [
  { title: 'Integration', url: '/integration', icon: Plug, color: 'text-gray-500' },
  { title: 'Settings', url: '/settings', icon: Settings, color: 'text-slate-700' },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { user, hotel, logout } = useAuth();
  const collapsed = state === 'collapsed';

  const isActive = (path: string) => location.pathname === path;

  const userInitials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'TR';

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r border-indigo-100/30 bg-white/40 backdrop-blur-3xl"
    >
      {/* Hotel Logo & Name */}
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-[0_8px_20px_rgba(79,70,229,0.3)] overflow-hidden transition-all duration-300 group-hover:scale-105">
            {hotel?.logo_url ? (
              <img src={hotel.logo_url} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-6 w-6" />
            )}
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-lg font-black tracking-tight text-indigo-950">
                {hotel?.name || 'Staybooker'}
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="truncate text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                  {user?.role || 'Super Admin'}
                </span>
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Main Navigation */}
      <SidebarContent className="scrollbar-none px-3 pb-6">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
            {!collapsed && 'Main Menu'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {mainNavItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={collapsed ? item.title : undefined}
                      className={cn(
                        "h-12 rounded-[14px] transition-all duration-200 px-4",
                        active 
                          ? "bg-gradient-to-r from-indigo-600 to-violet-700 text-white shadow-[0_10px_20px_rgba(79,70,229,0.2)]" 
                          : "text-indigo-900/60 hover:bg-indigo-50/50 hover:text-indigo-900"
                      )}
                    >
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 w-full"
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300",
                          active ? "bg-white/20" : "bg-indigo-50/50 group-hover:bg-white"
                        )}>
                          <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : item.color)} />
                        </div>
                        {!collapsed && (
                          <span className={cn(
                            "flex-1 font-bold text-[13px] tracking-tight",
                            active ? "text-white" : "text-indigo-900/70"
                          )}>
                            {item.title}
                          </span>
                        )}
                        {active && !collapsed && <ChevronRight className="w-4 h-4 text-white/50" />}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-4 mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
            {!collapsed && 'System'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {settingsNavItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={collapsed ? item.title : undefined}
                      className={cn(
                        "h-12 rounded-[14px] transition-all duration-200 px-4",
                        active 
                          ? "bg-gradient-to-r from-indigo-950 to-slate-900 text-white shadow-lg" 
                          : "text-indigo-900/60 hover:bg-indigo-50/50 hover:text-indigo-900"
                      )}
                    >
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 w-full"
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300",
                          active ? "bg-white/10" : "bg-indigo-50/50"
                        )}>
                          <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : item.color)} />
                        </div>
                        {!collapsed && (
                          <span className="flex-1 font-bold text-[13px] tracking-tight">
                            {item.title}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User Footer */}
      <SidebarFooter className="p-6 bg-gradient-to-b from-transparent to-indigo-50/30 border-t border-indigo-100/20">
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-[20px] bg-white/60 border border-indigo-100/50 shadow-sm",
          collapsed ? "justify-center" : ""
        )}>
          <Avatar className="h-10 w-10 shrink-0 rounded-[14px] border-2 border-white shadow-sm">
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs font-black">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-black text-indigo-950 leading-tight">
                {user?.name || 'Toufiq Revmerito'}
              </span>
              <span className="truncate text-[10px] font-bold text-indigo-400 uppercase tracking-tight">
                {user?.email || 'tech.revmerito@gmail.com'}
              </span>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-indigo-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;
