// Main Application Sidebar with all dashboard modules - Human & Professional Design
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

// Navigation items for the dashboard - Professional Colors
const mainNavItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Analytics', url: '/analytics', icon: LineChart },
  { title: 'AI Assistant', url: '/agent', icon: Bot },
  { title: 'Rooms', url: '/rooms', icon: Bed },
  { title: 'Rates', url: '/rates', icon: IndianRupee },
  { title: 'Rate Shopper', url: '/rate-shopper', icon: TrendingUp },
  { title: 'Availability', url: '/availability', icon: Calendar },
  { title: 'Bookings', url: '/bookings', icon: BookOpen },
  { title: 'Guests', url: '/guests', icon: Users },
  { title: 'Payments', url: '/payments', icon: CreditCard },
  { title: 'Amenities', url: '/amenities', icon: Coffee },
  { title: 'Add-ons', url: '/addons', icon: Sparkles },
  { title: 'Channel Manager', url: '/channel-settings', icon: Link2 },
];

const settingsNavItems = [
  { title: 'Integration', url: '/integration', icon: Plug },
  { title: 'Settings', url: '/settings', icon: Settings },
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
      className="border-r border-slate-200 bg-white"
    >
      {/* Hotel Logo & Name */}
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm overflow-hidden">
            {hotel?.logo_url ? (
              <img src={hotel.logo_url} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-base font-semibold text-slate-900">
                {hotel?.name || 'Staybooker'}
              </span>
              <span className="truncate text-xs font-medium text-slate-500">
                {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : user?.role || 'Admin'}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Main Navigation */}
      <SidebarContent className="px-3 pb-6 scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {!collapsed && 'Main Menu'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {mainNavItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={collapsed ? item.title : undefined}
                      className={cn(
                        "h-10 rounded-md transition-colors px-3",
                        active 
                          ? "bg-blue-50 text-blue-700 font-medium" 
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 w-full"
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-blue-600" : "text-slate-400")} />
                        {!collapsed && (
                          <span className="flex-1 text-sm">
                            {item.title}
                          </span>
                        )}
                        {active && !collapsed && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {!collapsed && 'System'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {settingsNavItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={collapsed ? item.title : undefined}
                      className={cn(
                        "h-10 rounded-md transition-colors px-3",
                        active 
                          ? "bg-slate-100 text-slate-900 font-medium" 
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 w-full"
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-slate-900" : "text-slate-400")} />
                        {!collapsed && (
                          <span className="flex-1 text-sm font-medium">
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
      <SidebarFooter className="p-4 border-t border-slate-100">
        <div className={cn(
          "flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors",
          collapsed ? "justify-center" : ""
        )}>
          <Avatar className="h-8 w-8 shrink-0 rounded-md">
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback className="bg-slate-200 text-slate-600 text-xs font-bold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-semibold text-slate-900">
                {user?.name || 'Toufiq Revmerito'}
              </span>
              <span className="truncate text-[11px] text-slate-500">
                {user?.email || 'tech.revmerito@gmail.com'}
              </span>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
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
