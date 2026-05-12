// Main Application Sidebar with all dashboard modules
import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Bed,
  IndianRupee,
  Calendar,
  BookOpen,
  Users,
  CreditCard,
  BarChart3,
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
  ShieldCheck,
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

// Navigation items for the dashboard
const mainNavItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Analytics & Reports', url: '/analytics', icon: LineChart },
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
    .slice(0, 2) || 'U';

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Hotel Logo & Name */}
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground overflow-hidden">
            {hotel?.logo_url ? (
              <img src={hotel.logo_url} alt="Logo" className="h-full w-full object-contain bg-white" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                {hotel?.name || 'Hotel Dashboard'}
              </span>
              <span className="truncate text-xs text-sidebar-muted">
                {user?.role || 'Manager'}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Main Navigation */}
      <SidebarContent className="scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted">
            {!collapsed && 'Main Menu'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted">
            {!collapsed && 'System'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user?.role === 'SUPER_ADMIN' && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-indigo-500 font-bold">
              {!collapsed && 'Super Admin'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/superadmin')}
                    tooltip={collapsed ? 'Admin Panel' : undefined}
                  >
                    <NavLink
                      to="/superadmin"
                      className="flex items-center gap-3 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                      activeClassName="bg-indigo-100 text-indigo-700"
                    >
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Master Control</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* User Footer */}
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {user?.name || 'User'}
              </span>
              <span className="truncate text-xs text-sidebar-muted">
                {user?.email || 'user@email.com'}
              </span>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
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
