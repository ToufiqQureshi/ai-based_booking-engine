-- =============================================================================
-- Staybooker — Row Level Security (RLS) Policies
-- =============================================================================
-- Apply this via Supabase Dashboard > SQL Editor, or psql.
-- These policies enforce hotel_id isolation at the DB layer as defense-in-depth
-- alongside the existing app-level CurrentUser.hotel_id filtering.
--
-- HOW IT WORKS WITH THE FASTAPI STACK
-- ------------------------------------
-- FastAPI connects with the service role (bypasses RLS by design).
-- These policies activate for direct DB access: Supabase Studio, psql,
-- PostgREST with anon/authenticated key, and Supabase Realtime subscriptions.
--
-- CHAIN HOTELS
-- ------------
-- Chain-level tables (loyalty_programs, guest_loyalty, promo_codes) use
-- chain_id isolation. Super-admin bypasses all policies via service role.
--
-- RE-RUNNABLE
-- -----------
-- All CREATE POLICY statements are guarded with DROP POLICY IF EXISTS first,
-- so this script can be safely re-applied after a partial run.
-- =============================================================================

-- =============================================================================
-- HELPER FUNCTIONS  (public schema — auth schema is Supabase-managed)
-- =============================================================================

-- Reads hotel_id from the JWT claim injected by PostgREST / SET LOCAL.
CREATE OR REPLACE FUNCTION public.current_hotel_id() RETURNS text AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json->>'hotel_id', '')
$$ LANGUAGE sql STABLE;

-- Reads chain_id from the JWT claim.
CREATE OR REPLACE FUNCTION public.current_chain_id() RETURNS text AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json->>'chain_id', '')
$$ LANGUAGE sql STABLE;

-- Grant execute to the roles that PostgREST uses
GRANT EXECUTE ON FUNCTION public.current_hotel_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_chain_id() TO anon, authenticated, service_role;


-- =============================================================================
-- CORE TENANT TABLES
-- =============================================================================

ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hotels_tenant_isolation" ON hotels;
CREATE POLICY "hotels_tenant_isolation" ON hotels
  USING (id = public.current_hotel_id())
  WITH CHECK (id = public.current_hotel_id());

ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "room_types_tenant_isolation" ON room_types;
CREATE POLICY "room_types_tenant_isolation" ON room_types
  USING (hotel_id = public.current_hotel_id())
  WITH CHECK (hotel_id = public.current_hotel_id());

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bookings_tenant_isolation" ON bookings;
CREATE POLICY "bookings_tenant_isolation" ON bookings
  USING (hotel_id = public.current_hotel_id())
  WITH CHECK (hotel_id = public.current_hotel_id());

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guests_tenant_isolation" ON guests;
CREATE POLICY "guests_tenant_isolation" ON guests
  USING (hotel_id = public.current_hotel_id())
  WITH CHECK (hotel_id = public.current_hotel_id());

ALTER TABLE rate_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rate_plans_tenant_isolation" ON rate_plans;
CREATE POLICY "rate_plans_tenant_isolation" ON rate_plans
  USING (hotel_id = public.current_hotel_id())
  WITH CHECK (hotel_id = public.current_hotel_id());

ALTER TABLE room_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "room_rates_tenant_isolation" ON room_rates;
CREATE POLICY "room_rates_tenant_isolation" ON room_rates
  USING (hotel_id = public.current_hotel_id())
  WITH CHECK (hotel_id = public.current_hotel_id());

ALTER TABLE room_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "room_blocks_tenant_isolation" ON room_blocks;
CREATE POLICY "room_blocks_tenant_isolation" ON room_blocks
  USING (hotel_id = public.current_hotel_id())
  WITH CHECK (hotel_id = public.current_hotel_id());

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_tenant_isolation" ON payments;
CREATE POLICY "payments_tenant_isolation" ON payments
  USING (hotel_id = public.current_hotel_id())
  WITH CHECK (hotel_id = public.current_hotel_id());

ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "competitors_tenant_isolation" ON competitors;
CREATE POLICY "competitors_tenant_isolation" ON competitors
  USING (hotel_id = public.current_hotel_id())
  WITH CHECK (hotel_id = public.current_hotel_id());

ALTER TABLE competitor_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "competitor_rates_tenant_isolation" ON competitor_rates;
CREATE POLICY "competitor_rates_tenant_isolation" ON competitor_rates
  USING (
    competitor_id IN (
      SELECT id FROM competitors WHERE hotel_id = public.current_hotel_id()
    )
  );

ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "integration_settings_tenant_isolation" ON integration_settings;
CREATE POLICY "integration_settings_tenant_isolation" ON integration_settings
  USING (hotel_id = public.current_hotel_id())
  WITH CHECK (hotel_id = public.current_hotel_id());

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_keys_tenant_isolation" ON api_keys;
CREATE POLICY "api_keys_tenant_isolation" ON api_keys
  USING (hotel_id = public.current_hotel_id())
  WITH CHECK (hotel_id = public.current_hotel_id());

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_tenant_isolation" ON users;
CREATE POLICY "users_tenant_isolation" ON users
  USING (hotel_id = public.current_hotel_id())
  WITH CHECK (hotel_id = public.current_hotel_id());

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_tenant_isolation" ON notifications;
CREATE POLICY "notifications_tenant_isolation" ON notifications
  USING (hotel_id = public.current_hotel_id())
  WITH CHECK (hotel_id = public.current_hotel_id());

ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "addons_tenant_isolation" ON addons;
CREATE POLICY "addons_tenant_isolation" ON addons
  USING (hotel_id = public.current_hotel_id())
  WITH CHECK (hotel_id = public.current_hotel_id());

ALTER TABLE booking_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "booking_addons_tenant_isolation" ON booking_addons;
CREATE POLICY "booking_addons_tenant_isolation" ON booking_addons
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE hotel_id = public.current_hotel_id()
    )
  );


-- =============================================================================
-- CHAIN-LEVEL TABLES  (use chain_id isolation)
-- =============================================================================

ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loyalty_programs_isolation" ON loyalty_programs;
CREATE POLICY "loyalty_programs_isolation" ON loyalty_programs
  USING (
    (hotel_id IS NOT NULL AND hotel_id = public.current_hotel_id())
    OR (chain_id IS NOT NULL AND chain_id = public.current_chain_id())
  );

ALTER TABLE guest_loyalty ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guest_loyalty_isolation" ON guest_loyalty;
CREATE POLICY "guest_loyalty_isolation" ON guest_loyalty
  USING (
    (hotel_id IS NOT NULL AND hotel_id = public.current_hotel_id())
    OR (chain_id IS NOT NULL AND chain_id = public.current_chain_id())
  );

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "promo_codes_isolation" ON promo_codes;
CREATE POLICY "promo_codes_isolation" ON promo_codes
  USING (
    (hotel_id IS NOT NULL AND hotel_id = public.current_hotel_id())
    OR (chain_id IS NOT NULL AND chain_id = public.current_chain_id())
  );


-- =============================================================================
-- SUPER-ADMIN BYPASS  (service role already bypasses RLS — this is informational)
-- =============================================================================
-- FastAPI uses the service_role key → all policies above are bypassed automatically.
-- Super-admin endpoints in app/api/v1/superadmin/ always use service role,
-- so they can read/write any tenant's data as intended.
--
-- To verify RLS is working in psql:
--   SET LOCAL role = 'authenticated';
--   SET LOCAL request.jwt.claims = '{"hotel_id": "some-uuid-here"}';
--   SELECT count(*) FROM bookings;  -- should return only that hotel's rows
