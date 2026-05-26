// Main Application Sidebar — Professional Light Design with Dark Mode
import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Bed, IndianRupee, Calendar, BookOpen,
  Users, CreditCard, Settings, LogOut, Building2, Plug,
  Sparkles, Link2, Coffee, TrendingUp, Bot, LineChart, Percent,
} from 'lucide-react';
import { NavLink } from '@/components/layout/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

const mainNavItems = [
  { title: 'Dashboard',       url: '/dashboard',        icon: LayoutDashboard },
  { title: 'Analytics',       url: '/analytics',        icon: LineChart },
  { title: 'AI Assistant',    url: '/agent',            icon: Bot },
  { title: 'Rooms',           url: '/rooms',            icon: Bed },
  { title: 'Rate Plans',      url: '/rates',            icon: IndianRupee },
  { title: 'Rate Shopper',    url: '/rate-shopper',     icon: TrendingUp },
  { title: 'Calendar',        url: '/availability',     icon: Calendar },
  { title: 'Bookings',        url: '/bookings',         icon: BookOpen },
  { title: 'Taxes',           url: '/taxes',            icon: Percent },
  { title: 'Guests',          url: '/guests',           icon: Users },
  { title: 'Payments',        url: '/payments',         icon: CreditCard },
  { title: 'Add-ons',         url: '/addons',           icon: Sparkles },
  { title: 'Channel Manager', url: '/channel-settings', icon: Link2 },
];

const settingsNavItems = [
  { title: 'Integration', url: '/integration', icon: Plug },
  { title: 'Settings',    url: '/settings',    icon: Settings },
];

const DEFAULT_ROLE_PERMISSIONS = {
  OWNER: [
    "/dashboard", "/analytics", "/agent", "/rooms", "/rates", "/rate-shopper", 
    "/availability", "/bookings", "/taxes", "/guests", "/payments", "/addons",
    "/channel-settings", "/integration", "/settings"
  ],
  MANAGER: [
    "/dashboard", "/analytics", "/rooms", "/rates", "/taxes",
    "/availability", "/bookings", "/guests", "/payments", "/settings"
  ],
  STAFF: [
    "/availability", "/bookings", "/guests"
  ]
};

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
    .slice(0, 2) || 'U';

  // Role based permission checks
  const permissions = (hotel?.settings as any)?.role_permissions?.[user?.role || ''] || 
    (DEFAULT_ROLE_PERMISSIONS as any)[user?.role || 'STAFF'] || [];

  const isItemAllowed = (item: typeof mainNavItems[0]) => {
    // Super admins can view all items
    if (user?.role === 'SUPER_ADMIN') return true;

    // Check custom role permissions
    if (!permissions.includes(item.url)) return false;

    // Check hotel specific feature locks
    if (item.url === '/agent' && !hotel?.feature_ai_agent) return false;
    if (item.url === '/rate-shopper' && !hotel?.feature_rate_shopper) return false;

    return true;
  };

  const allowedMainNavItems = mainNavItems.filter(isItemAllowed);
  const allowedSettingsNavItems = settingsNavItems.filter(isItemAllowed);

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border dark:border-slate-800 bg-background dark:bg-slate-900"
    >
      {/* Hotel Logo & Name */}
      <SidebarHeader className="px-4 py-4 border-b border-border dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm overflow-hidden">
            {hotel?.logo_url ? (
              <img src={hotel.logo_url} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-4 w-4" />
            )}
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-semibold text-foreground dark:text-white leading-none mb-0.5">
                {hotel?.name || 'Staybooker'}
              </span>
              <span className="truncate text-[10px] font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : user?.role || 'Admin'}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Main Navigation */}
      <SidebarContent className="px-2 py-3 scrollbar-thin overflow-y-auto">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-2 mb-1 text-[10px] font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-widest">
              Main Menu
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {allowedMainNavItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={collapsed ? item.title : undefined}
                      className={cn(
                        'h-9 rounded-lg transition-all px-2.5 group',
                        active
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400'
                          : 'text-muted-foreground dark:text-muted-foreground hover:bg-muted/30 dark:hover:bg-slate-800 hover:text-foreground dark:hover:text-slate-200'
                      )}
                    >
                      <NavLink to={item.url} className="flex items-center gap-2.5 w-full">
                        <item.icon
                          className={cn(
                            'h-4 w-4 shrink-0 transition-colors',
                            active
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : 'text-muted-foreground dark:text-muted-foreground group-hover:text-muted-foreground dark:group-hover:text-slate-300'
                          )}
                        />
                        {!collapsed && (
                          <span className="flex-1 text-sm font-medium">{item.title}</span>
                        )}
                        {active && !collapsed && (
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-2">
          {!collapsed && (
            <SidebarGroupLabel className="px-2 mb-1 text-[10px] font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-widest">
              System
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {allowedSettingsNavItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={collapsed ? item.title : undefined}
                      className={cn(
                        'h-9 rounded-lg transition-all px-2.5 group',
                        active
                          ? 'bg-muted dark:bg-slate-800 text-foreground dark:text-white'
                          : 'text-muted-foreground dark:text-muted-foreground hover:bg-muted/30 dark:hover:bg-slate-800 hover:text-foreground dark:hover:text-slate-200'
                      )}
                    >
                      <NavLink to={item.url} className="flex items-center gap-2.5 w-full">
                        <item.icon
                          className={cn(
                            'h-4 w-4 shrink-0',
                            active ? 'text-foreground dark:text-slate-200' : 'text-muted-foreground dark:text-muted-foreground'
                          )}
                        />
                        {!collapsed && (
                          <span className="flex-1 text-sm font-medium">{item.title}</span>
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
      <SidebarFooter className="p-3 border-t border-border dark:border-slate-800">
        <div className={cn(
          'flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/30 dark:hover:bg-slate-800 transition-colors',
          collapsed ? 'justify-center' : ''
        )}>
          <Avatar className="h-7 w-7 shrink-0 rounded-lg">
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded-lg">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex flex-1 flex-col overflow-hidden min-w-0">
                <span className="truncate text-xs font-semibold text-foreground dark:text-white">
                  {user?.name || 'User'}
                </span>
                <span className="truncate text-[10px] text-muted-foreground dark:text-muted-foreground">
                  {user?.email || ''}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                onClick={logout}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;
