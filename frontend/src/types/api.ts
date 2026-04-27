// API Types for Hotel Dashboard
// These types mirror the FastAPI backend contracts

// ============== Auth Types ==============
export type UserRole = 'OWNER' | 'MANAGER' | 'STAFF';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  hotel_id: string;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  hotel_name: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// ============== Hotel Types ==============
export interface Hotel {
  id: string;
  name: string;
  slug: string;
  description?: string;
  star_rating?: number;
  logo_url?: string;
  primary_color?: string;
  address: Address;
  contact: ContactInfo;
  settings: HotelSettings;
  created_at: string;
  updated_at: string;
}

export interface Address {
  street?: string;
  city: string;
  state?: string;
  country: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
}

export interface Property extends Hotel {
  role: string;
  is_current: boolean;
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  website?: string;
}

export interface HotelSettings {
  currency: string;
  timezone: string;
  check_in_time: string;
  check_out_time: string;
  cancellation_policy?: string;
  payment_policy?: string;
  child_policy?: string;
  privacy_policy?: string;
  important_info?: string;
  notify_new_booking?: boolean;
  notify_cancellation?: boolean;
}

// ============== Room Types ==============
export interface RoomType {
  id: string;
  hotel_id: string;
  name: string;
  description?: string;
  base_occupancy: number;
  max_occupancy: number;
  max_children: number;
  extra_bed_allowed: boolean;
  base_price: number;
  total_inventory: number;
  bed_type?: string;
  room_size?: number;
  extra_person_price?: number;
  extra_adult_price?: number;
  extra_child_price?: number;
  photos: RoomPhoto[];
  amenities: Amenity[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoomPhoto {
  id?: string;
  url: string;
  caption?: string;
  is_primary: boolean;
  order: number;
}

export interface Amenity {
  id: string;
  name: string;
  icon_slug: string;
  category: string;
  scope: 'room' | 'hotel';
  description?: string;
  is_featured: boolean;
}

// ============== Rate Types ==============
export interface RatePlan {
  id: string;
  hotel_id: string;
  name: string;
  description?: string;
  meal_plan: MealPlan;
  price_adjustment?: number;
  is_refundable: boolean;
  cancellation_hours?: number;
  is_active: boolean;
  min_los?: number;
  advance_purchase_days?: number;
  inclusions?: string[];
  created_at: string;
}

export type MealPlan = 'EP' | 'CP' | 'MAP' | 'AP';

export interface RoomRate {
  id: string;
  room_type_id: string;
  rate_plan_id: string;
  date_from: string;
  date_to: string;
  price: number;
  weekend_price?: number;
}

export interface Promotion {
  id: string;
  hotel_id: string;
  code: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_nights?: number;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
}

// ============== Availability Types ==============
export interface RoomAvailability {
  id: string;
  hotel_id: string;
  room_type_id: string;
  date: string;
  total_rooms: number;
  booked_rooms: number;
  available_rooms: number;
  is_blocked: boolean;
}

export interface AvailabilityUpdate {
  room_type_id: string;
  date_from: string;
  date_to: string;
  action: 'set' | 'add' | 'block' | 'unblock';
  value?: number;
}

// ============== Booking Types ==============
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'checked_in' | 'checked_out';

export interface Booking {
  id: string;
  hotel_id: string;
  booking_number: string;
  guest: Guest;
  check_in: string;
  check_out: string;
  status: BookingStatus;
  rooms: BookingRoom[];
  total_amount: number;
  paid_amount: number;
  special_requests?: string;
  promo_code?: string;
  source: 'direct' | 'booking_engine' | 'manual';
  created_at: string;
  updated_at: string;
}

export interface BookingRoom {
  id: string;
  room_type_id: string;
  room_type_name: string;
  rate_plan_id: string;
  rate_plan_name: string;
  guests: number;
  children: number;
  price_per_night: number;
  total_price: number;
}

export interface Guest {
  id: string;
  hotel_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  nationality?: string;
  id_type?: string;
  id_number?: string;
  address?: string;
  created_at: string;
}

// ============== Payment Types ==============
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'partial_refund';

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method?: string;
  gateway_reference?: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  booking_id: string;
  invoice_number: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: 'draft' | 'issued' | 'paid';
  issued_at?: string;
  pdf_url?: string;
}

// ============== Report Types ==============
export interface OccupancyReport {
  date: string;
  total_rooms: number;
  occupied_rooms: number;
  occupancy_rate: number;
}

export interface RevenueReport {
  date: string;
  revenue: number;
  bookings_count: number;
  avg_daily_rate: number;
}

export interface DashboardStats {
  today_arrivals: number;
  today_departures: number;
  current_occupancy: number;
  today_revenue: number;
  pending_bookings: number;
  total_rooms: number;
  trends?: {
    arrivals: number;
    occupancy: number;
    revenue: number;
  };
}

// ============== API Response Wrappers ==============
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ApiError {
  detail: string;
  code?: string;
  field?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
}

export interface AddOn {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category: string;
  is_active: boolean;
}

export interface RateOption {
  id: string;
  name: string;
  meal_plan_code: string;
  price_per_night: number;
  total_price: number;
  inclusions: string[];
  savings_text?: string;
}

export interface PublicRoomSearchResult extends RoomType {
  available_rooms: number;
  price_starting_at: number;
  rate_options: RateOption[];
}
