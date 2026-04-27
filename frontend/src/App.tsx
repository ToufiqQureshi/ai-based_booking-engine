import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

// Auth Pages
const LoginPage = lazy(() => import("@/pages/auth/Login"));
const SignupPage = lazy(() => import("@/pages/auth/Signup"));
const OnboardingPage = lazy(() => import("@/pages/auth/Onboarding"));
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
const ReportsPage = lazy(() => import("@/pages/finance/Reports"));
const AddonsPage = lazy(() => import("@/pages/marketing/Addons"));
const SettingsPage = lazy(() => import("@/pages/settings/Settings"));
const IntegrationPage = lazy(() => import("@/pages/settings/Integration"));
const ChannelSettings = lazy(() => import("@/pages/dashboard/ChannelSettings"));
const Amenities = lazy(() => import("@/pages/dashboard/Amenities"));
const RatesShopper = lazy(() => import("@/pages/marketing/RatesShopper"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AgentPage = lazy(() => import("@/pages/agent/AgentPage"));
const ProfilePage = lazy(() => import("@/pages/settings/Profile"));
const AnalyticsDashboard = lazy(() => import("@/pages/AnalyticsDashboard"));

const NotFound = lazy(() => import("@/pages/NotFound"));

// Public Booking
const PublicBookingLayout = lazy(() => import("@/layouts/PublicBookingLayout").then(m => ({ default: m.PublicBookingLayout })));
const BookingSelection = lazy(() => import("@/pages/public/BookingSelection"));
const BookingCheckout = lazy(() => import("@/pages/public/BookingCheckout"));
const BookingConfirmation = lazy(() => import("@/pages/public/BookingConfirmation"));
const BookingWidget = lazy(() => import("@/pages/public/BookingWidget"));
const ChatEmbed = lazy(() => import("@/pages/public/ChatEmbed"));

const PageLoader = () => (
  <div className="h-screen w-full flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading Staybooker...</p>
    </div>
  </div>
);

import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,     // Optimized: Cache data for 5 minutes to reduce API calls
      gcTime: 1000 * 60 * 15,       // Keep in memory for 15 minutes
      retry: 1,                      // Fail fast (1 retry only)
      refetchOnWindowFocus: false,   // Don't re-fetch on every tab switch
      refetchOnMount: false,         // Don't refetch if data is already fresh
    },
  },
});

const App = () => (
  <ErrorBoundary>
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
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />


              {/* Protected Dashboard Routes */}
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/rooms" element={<RoomsPage />} />
                <Route path="/rates" element={<RatesPage />} />
                <Route path="/availability" element={<AvailabilityPage />} />
                <Route path="/analytics" element={<AnalyticsDashboard />} />
                <Route path="/bookings" element={<BookingsPage />} />
                <Route path="/guests" element={<GuestsPage />} />
                <Route path="/rate-shopper" element={<RatesShopper />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/addons" element={<AddonsPage />} />
                <Route path="/amenities" element={<Amenities />} />
                <Route path="/channel-settings" element={<ChannelSettings />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/integration" element={<IntegrationPage />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/agent" element={<AgentPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>

              {/* Public Booking Engine Routes */}
              <Route path="/book/:hotelSlug" element={<PublicBookingLayout />}>
                <Route index element={<Navigate to="rooms" replace />} />
                <Route path="rooms" element={<BookingSelection />} />
                <Route path="checkout" element={<BookingCheckout />} />
                <Route path="confirmation" element={<BookingConfirmation />} />
              </Route>

              {/* Standalone Widget Route */}
              <Route path="/book/:hotelSlug/widget" element={<BookingWidget />} />
              <Route path="/book/:hotelSlug/chat" element={<ChatEmbed />} />

              {/* Redirects */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
