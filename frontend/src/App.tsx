import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Suspense, lazy } from "react";

// Auth Pages
const LoginPage = lazy(() => import("@/pages/auth/Login"));
const SignupPage = lazy(() => import("@/pages/auth/Signup"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPassword"));
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPassword"));

// Dashboard Layout & Pages
const DashboardLayout = lazy(() => import("@/components/layout/DashboardLayout"));
const DashboardPage = lazy(() => import("@/pages/dashboard/Dashboard"));
const RoomsPage = lazy(() => import("@/pages/rooms/Rooms"));
const RatesPage = lazy(() => import("@/pages/finance/Rates"));
const AvailabilityPage = lazy(() => import("@/pages/rooms/Availability"));
const BookingsPage = lazy(() => import("@/pages/bookings/Bookings"));
const GuestsPage = lazy(() => import("@/pages/bookings/Guests"));
const PaymentsPage = lazy(() => import("@/pages/finance/Payments"));
const AddonsPage = lazy(() => import("@/pages/marketing/Addons"));
const SettingsPage = lazy(() => import("@/pages/settings/Settings"));
const IntegrationPage = lazy(() => import("@/pages/settings/Integration"));
const ChannelSettings = lazy(() => import("@/pages/dashboard/ChannelSettings"));
const TaxesPage = lazy(() => import("@/pages/finance/Taxes"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AgentPage = lazy(() => import("@/pages/agent/AgentPage").then(m => ({ default: m.default })));
const ProfilePage = lazy(() => import("@/pages/settings/Profile"));
const AnalyticsDashboard = lazy(() => import("@/pages/AnalyticsDashboard"));
const RateShopperPage = lazy(() => import("@/pages/dashboard/RateShopper"));
const SuperAdminDashboard = lazy(() => import("@/pages/superadmin/SuperAdminDashboard"));
const GoogleReviewsPage = lazy(() => import("@/pages/marketing/GoogleReviews"));
const LoyaltyProgramPage = lazy(() => import("@/pages/marketing/LoyaltyProgram"));
const ChainDashboard = lazy(() => import("@/pages/chain/ChainDashboard"));

const NotFound = lazy(() => import("@/pages/NotFound"));

// Public Booking
const PublicBookingLayout = lazy(() => import("@/layouts/PublicBookingLayout").then(m => ({ default: m.PublicBookingLayout })));
const BookingSelection = lazy(() => import("@/pages/public/BookingSelection"));
const BookingCheckout = lazy(() => import("@/pages/public/BookingCheckout"));
const BookingConfirmation = lazy(() => import("@/pages/public/BookingConfirmation"));
const BookingCancel = lazy(() => import("@/pages/public/BookingCancel"));
const BookingWidget = lazy(() => import("@/pages/public/BookingWidget"));
const ChainBookingWidget = lazy(() => import("@/pages/public/ChainBookingWidget"));
const ChatEmbed = lazy(() => import("@/pages/public/ChatEmbed"));
const LandingPage = lazy(() => import("@/pages/public/LandingPage"));

// Public Legal Pages
const PrivacyPolicy = lazy(() => import("@/pages/public/legal/PrivacyPolicy"));
const TermsOfService = lazy(() => import("@/pages/public/legal/TermsOfService"));
const DataDeletion = lazy(() => import("@/pages/public/legal/DataDeletion"));
const RefundPolicy = lazy(() => import("@/pages/public/legal/RefundPolicy"));
const CookiePolicy = lazy(() => import("@/pages/public/legal/CookiePolicy"));
const ContactUs = lazy(() => import("@/pages/public/legal/ContactUs"));

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

import { isSuperAdminSubdomain } from "@/utils/subdomain";

const App = () => {
  const isSuperAdmin = isSuperAdminSubdomain();

  return (
    <ErrorBoundary>
    <ThemeProvider>
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
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Super Admin Specialized Routing */}
                {isSuperAdmin ? (
                  <Route path="/">
                    {/* Only login is allowed on superadmin subdomain — no public signup */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/" element={<SuperAdminDashboard />} />
                    <Route path="/:section" element={<SuperAdminDashboard />} />
                    <Route index element={<Navigate to="/" replace />} />
                    {/* Everything else (including /signup) redirects to superadmin panel */}
                    <Route path="*" element={<Navigate to="/" replace />} />
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

                    {/* Public Legal Routes */}
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/terms-of-service" element={<TermsOfService />} />
                    <Route path="/data-deletion" element={<DataDeletion />} />
                    <Route path="/refund-policy" element={<RefundPolicy />} />
                    <Route path="/cookie-policy" element={<CookiePolicy />} />
                    <Route path="/contact-us" element={<ContactUs />} />
                    <Route path="/contact" element={<Navigate to="/contact-us" replace />} />

                    {/* Redirects */}
                    <Route 
                      path="/" 
                      element={
                        window.location.hostname.startsWith('app.') ? (
                          <Navigate to="/dashboard" replace />
                        ) : (
                          <LandingPage />
                        )
                      } 
                    />

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
    </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
