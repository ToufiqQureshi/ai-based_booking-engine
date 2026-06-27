import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/core/contexts/AuthContext";
import { ThemeProvider } from "@/core/contexts/ThemeContext";
import { Suspense, lazy } from "react";
import "./i18n";
import { GuestPreferencesProvider } from "@/core/contexts/GuestPreferencesContext";

// Auth Pages
const LoginPage = lazy(() => import("@/auth/Login"));
const RequestAccessPage = lazy(() => import("@/auth/RequestAccess"));
const ForgotPasswordPage = lazy(() => import("@/auth/ForgotPassword"));
const ResetPasswordPage = lazy(() => import("@/auth/ResetPassword"));

// Dashboard Layout & Pages
const DashboardLayout = lazy(() => import("@/components/layout/DashboardLayout"));
const DashboardPage = lazy(() => import("@/dashboard/Dashboard"));
const RoomsPage = lazy(() => import("@/rooms/Rooms"));
const RatesPage = lazy(() => import("@/finance/Rates"));
const AvailabilityPage = lazy(() => import("@/rooms/Availability"));
const BookingsPage = lazy(() => import("@/bookings/Bookings"));
const GuestsPage = lazy(() => import("@/bookings/Guests"));
const PaymentsPage = lazy(() => import("@/finance/Payments"));
const AddonsPage = lazy(() => import("@/marketing/Addons"));
const SettingsPage = lazy(() => import("@/settings/Settings"));
const IntegrationPage = lazy(() => import("@/settings/Integration"));
const ChannelSettings = lazy(() => import("@/dashboard/ChannelSettings"));
const TaxesPage = lazy(() => import("@/finance/Taxes"));
const AdminDashboard = lazy(() => import("@/admin/AdminDashboard"));
const AgentPage = lazy(() => import("@/agent/AgentPage").then(m => ({ default: m.default })));
const ProfilePage = lazy(() => import("@/settings/Profile"));
const AnalyticsDashboard = lazy(() => import("@/analytics/AnalyticsDashboard"));
const PublicReport = lazy(() => import("@/analytics/PublicReport"));
const HotelReport = lazy(() => import("@/reports/HotelReport"));
const RateShopperPage = lazy(() => import("@/dashboard/RateShopper"));
const SuperAdminDashboard = lazy(() => import("@/superadmin/SuperAdminDashboard"));
const GoogleReviewsPage = lazy(() => import("@/marketing/GoogleReviews"));
const LoyaltyProgramPage = lazy(() => import("@/marketing/LoyaltyProgram"));
const DynamicPricingPage = lazy(() => import("@/revenue/DynamicPricing"));
const GuestRecoveryPage = lazy(() => import("@/revenue/GuestRecovery"));
const ChainDashboard = lazy(() => import("@/chain/ChainDashboard"));

const NotFound = lazy(() => import("@/NotFound"));

// Public Booking
const PublicBookingLayout = lazy(() => import("@/layouts/PublicBookingLayout").then(m => ({ default: m.PublicBookingLayout })));
const BookingSelection = lazy(() => import("@/guest_booking/BookingSelection"));
const BookingCheckout = lazy(() => import("@/guest_booking/BookingCheckout"));
const BookingConfirmation = lazy(() => import("@/guest_booking/BookingConfirmation"));
const BookingCancel = lazy(() => import("@/guest_booking/BookingCancel"));
const BookingWidget = lazy(() => import("@/guest_booking/BookingWidget"));
const ChainBookingWidget = lazy(() => import("@/guest_booking/ChainBookingWidget"));
const ChatEmbed = lazy(() => import("@/guest_booking/ChatEmbed"));

// Slim top progress bar — does NOT block the whole screen
const PageLoader = () => <div className="page-progress" />;

import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,     // 2 min fresh window — reduces API calls while keeping UI snappy
      gcTime: 1000 * 60 * 15,       // Keep in memory for 15 minutes
      retry: 1,                      // Fail fast (1 retry only)
      refetchOnWindowFocus: false,   // Don't re-fetch on every tab switch
      // refetchOnMount defaults to true — ensures stale data refetches when navigating between pages
    },
  },
});

import { isSuperAdminSubdomain } from "@/core/utils/subdomain";

const App = () => {
  const isSuperAdmin = isSuperAdminSubdomain();

  return (
    <ErrorBoundary>
    <ThemeProvider>
    <GuestPreferencesProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public Auth Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/request-access" element={<RequestAccessPage />} />
                {/* /signup redirects to /request-access — self-serve signup is not available */}
                <Route path="/signup" element={<Navigate to="/request-access" replace />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Super Admin Specialized Routing */}
                {isSuperAdmin ? (
                  <Route path="/">
                    {/* Only login is allowed on superadmin subdomain — no public signup */}
                    <Route path="login" element={<LoginPage />} />
                    <Route index element={<Navigate to="/overview" replace />} />
                    <Route path=":section" element={<SuperAdminDashboard />} />
                    {/* Everything else (including /signup) redirects to superadmin panel */}
                    <Route path="*" element={<Navigate to="/overview" replace />} />
                  </Route>
                ) : (
                  <>
                    {/* Protected Dashboard Routes */}
                    <Route element={<DashboardLayout />}>
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/rooms" element={<RoomsPage />} />
                      <Route path="/rates" element={<RatesPage />} />
                      <Route path="/rate-shopper" element={<RateShopperPage />} />
                      <Route path="/availability" element={<AvailabilityPage />} />
                      <Route path="/analytics" element={<AnalyticsDashboard />} />
                      <Route path="/analytics/:tab" element={<AnalyticsDashboard />} />
                      <Route path="/reports" element={<HotelReport />} />
                      <Route path="/bookings" element={<BookingsPage />} />
                      <Route path="/guests" element={<GuestsPage />} />
                      <Route path="/payments" element={<PaymentsPage />} />
                      <Route path="/addons" element={<AddonsPage />} />
                      <Route path="/taxes" element={<TaxesPage />} />
                      <Route path="/channel-settings" element={<ChannelSettings />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/settings/:tab" element={<SettingsPage />} />
                      <Route path="/integration" element={<IntegrationPage />} />
                      <Route path="/integration/:tab" element={<IntegrationPage />} />
                      <Route path="/admin" element={<AdminDashboard />} />
                      <Route path="/admin/:section" element={<AdminDashboard />} />
                      <Route path="/reviews" element={<GoogleReviewsPage />} />
                      <Route path="/loyalty" element={<LoyaltyProgramPage />} />
                      <Route path="/revenue/pricing" element={<DynamicPricingPage />} />
                      <Route path="/revenue/recovery" element={<GuestRecoveryPage />} />
                      <Route path="/agent" element={<AgentPage />} />
                      <Route path="/settings/profile" element={<ProfilePage />} />
                      <Route path="/chain/dashboard" element={<ChainDashboard />} />
                    
                    {/* Note: /superadmin is only available on the admin subdomain above */}
                  </Route>

                    {/* Public Booking Engine Routes */}
                    <Route path="/book/:hotelSlug" element={<PublicBookingLayout />}>
                      <Route index element={<Navigate to="rooms" replace />} />
                      <Route path="rooms" element={<BookingSelection />} />
                      <Route path="checkout" element={<BookingCheckout />} />
                      <Route path="confirmation" element={<BookingConfirmation />} />
                      <Route path="cancel" element={<BookingCancel />} />
                    </Route>

                    {/* Standalone Widget Routes */}
                    {/* Chain widget must be before :hotelSlug to avoid slug matching "chain" */}
                    <Route path="/book/chain/:chainSlug/widget" element={<ChainBookingWidget />} />
                    <Route path="/book/:hotelSlug/widget" element={<BookingWidget />} />
                    <Route path="/book/:hotelSlug/chat" element={<ChatEmbed />} />

                    {/* Public shared analytics report (no login) */}
                    <Route path="/r/:token" element={<PublicReport />} />

                    {/* Redirect root to dashboard */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />

                    {/* 404 */}
                    <Route path="*" element={<NotFound />} />
                  </>
                )}
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
    </GuestPreferencesProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;




