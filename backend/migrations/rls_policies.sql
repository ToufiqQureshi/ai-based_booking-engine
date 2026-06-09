-- =============================================================================
-- Staybooker — Row Level Security (RLS) Policies
-- =============================================================================
-- Apply this via Supabase Dashboard > SQL Editor, or psql.
-- These policies enforce hotel_id isolation at the DB layer as defense-in-depth
-- alongside the existing app-level CurrentUser.hotel_id filtering.
--
-- HOW IT WORKS WITH THE FASTAPI STACK
-- ------------------------------------
-- FastAPI currently connects with the service role (bypasses RLS by default).
-- To ACTIVATE these policies per-request, add the following before each query:
--
--   SET LOCAL role = 'authenticated';
--   SET LOCAL request.jwt.claims = '{"hotel_id": "<id>", "sub": "<uid>"}';
--
-- Until that SET LOCAL wrapper is added, these policies are inert for the app
-- but immediately protect direct DB access (Supabase Studio, psql, any PostgREST
-- or Realtime subscription using the anon/authenticated key).
--
-- CHAIN HOTELS
-- ------------
-- Chain-level tables (chains, loyalty_programs, guest_loyalty, promo_codes) use
-- chain_id isolation. Super-admin bypasses all policies via service role.
-- =============================================================================

-- Helper: get the current hotel_id from the JWT claim (set via SET LOCAL)
CREATE OR REPLACE FUNCTION auth.hotel_id() RETURNS text AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json->>'hotel_id', '')
$$ LANGUAGE sql STABLE;

-- Helper: get the current chain_id from the JWT claim
CREATE OR REPLACE FUNCTION auth.chain_id() RETURNS text AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json->>'chain_id', '')
$$ LANGUAGE sql STABLE;


-- =============================================================================
-- CORE TENANT TABLES
-- =============================================================================

ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hotels_tenant_isolation" ON hotels
  USING (id = auth.hotel_id())
  WITH CHECK (id = auth.hotel_id());

ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room_types_tenant_isolation" ON room_types
  USING (hotel_id = auth.hotel_id())
  WITH CHECK (hotel_id = auth.hotel_id());

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings_tenant_isolation" ON bookings
  USING (hotel_id = auth.hotel_id())
  WITH CHECK (hotel_id = auth.hotel_id());

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guests_tenant_isolation" ON guests
  USING (hotel_id = auth.hotel_id())
  WITH CHECK (hotel_id = auth.hotel_id());

ALTER TABLE rate_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_plans_tenant_isolation" ON rate_plans
  USING (hotel_id = auth.hotel_id())
  WITH CHECK (hotel_id = auth.hotel_id());

ALTER TABLE room_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room_rates_tenant_isolation" ON room_rates
  USING (hotel_id = auth.hotel_id())
  WITH CHECK (hotel_id = auth.hotel_id());

ALTER TABLE room_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room_blocks_tenant_isolation" ON room_blocks
  USING (hotel_id = auth.hotel_id())
  WITH CHECK (hotel_id = auth.hotel_id());

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_tenant_isolation" ON payments
  USING (hotel_id = auth.hotel_id())
  WITH CHECK (hotel_id = auth.hotel_id());

ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competitors_tenant_isolation" ON competitors
  USING (hotel_id = auth.hotel_id())
  WITH CHECK (hotel_id = auth.hotel_id());

ALTER TABLE competitor_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competitor_rates_tenant_isolation" ON competitor_rates
  USING (
    competitor_id IN (
      SELECT id FROM competitors WHERE hotel_id = auth.hotel_id()
    )
  );

ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integration_settings_tenant_isolation" ON integration_settings
  USING (hotel_id = auth.hotel_id())
  WITH CHECK (hotel_id = auth.hotel_id());

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_tenant_isolation" ON api_keys
  USING (hotel_id = auth.hotel_id())
  WITH CHECK (hotel_id = auth.hotel_id());

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_tenant_isolation" ON users
  USING (hotel_id = auth.hotel_id())
  WITH CHECK (hotel_id = auth.hotel_id());

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_tenant_isolation" ON notifications
  USING (hotel_id = auth.hotel_id())
  WITH CHECK (hotel_id = auth.hotel_id());

ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addons_tenant_isolation" ON addons
  USING (hotel_id = auth.hotel_id())
  WITH CHECK (hotel_id = auth.hotel_id());

ALTER TABLE booking_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "booking_addons_tenant_isolation" ON booking_addons
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE hotel_id = auth.hotel_id()
    )
  );


-- =============================================================================
-- CHAIN-LEVEL TABLES  (use chain_id isolation)
-- =============================================================================

ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_programs_isolation" ON loyalty_programs
  USING (
    (hotel_id IS NOT NULL AND hotel_id = auth.hotel_id())
    OR (chain_id IS NOT NULL AND chain_id = auth.chain_id())
  );

ALTER TABLE guest_loyalty ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guest_loyalty_isolation" ON guest_loyalty
  USING (
    (hotel_id IS NOT NULL AND hotel_id = auth.hotel_id())
    OR (chain_id IS NOT NULL AND chain_id = auth.chain_id())
  );

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_codes_isolation" ON promo_codes
  USING (
    (hotel_id IS NOT NULL AND hotel_id = auth.hotel_id())
    OR (chain_id IS NOT NULL AND chain_id = auth.chain_id())
  );


-- =============================================================================
-- SUPER-ADMIN BYPASS  (service role already bypasses RLS — this is extra clarity)
-- =============================================================================
-- When FastAPI uses the service_role key, all policies above are bypassed.
-- Super-admin endpoints in app/api/v1/superadmin/ always use service role,
-- so they can read/write any tenant's data as intended.
--
-- To verify RLS is working: connect as 'authenticated' role in psql and run:
--   SET LOCAL request.jwt.claims = '{"hotel_id": "some-id"}';
--   SELECT count(*) FROM bookings;  -- should only see that hotel's bookings
