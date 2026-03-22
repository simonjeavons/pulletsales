-- ═══════════════════════════════════════════════════════════
-- Seed data for Lloyds Pullet Sales — Development Only
-- ═══════════════════════════════════════════════════════════

-- NOTE: To use this seed, you need to first create an admin user
-- through Supabase Auth, then insert the profile manually.
-- The auth_user_id below is a placeholder.

-- ─── Reps ────────────────────────────────────────────────
INSERT INTO public.reps (name, phone, email, address, is_active) VALUES
  ('John Williams', '07700 900001', 'john.williams@example.com', '12 Farm Lane, Hereford, HR1 1AA', true),
  ('Sarah Thompson', '07700 900002', 'sarah.thompson@example.com', '45 Market Street, Shrewsbury, SY1 1AA', true),
  ('Mike Davis', '07700 900003', 'mike.davis@example.com', '8 High Street, Ludlow, SY8 1AA', true),
  ('Emma Roberts', '07700 900004', 'emma.roberts@example.com', '23 Church Road, Ross-on-Wye, HR9 1AA', false);

-- ─── Customers ───────────────────────────────────────────
INSERT INTO public.customers (customer_unique_id, company_name, address_line_1, town_city, post_code, rep_id, is_active)
SELECT 'CUST-001', 'Green Valley Farms', '100 Valley Road', 'Hereford', 'HR2 6AA',
  (SELECT id FROM public.reps WHERE name = 'John Williams'), true;

INSERT INTO public.customers (customer_unique_id, company_name, address_line_1, town_city, post_code, rep_id, is_active)
SELECT 'CUST-002', 'Oakridge Poultry Ltd', '55 Oak Lane', 'Shrewsbury', 'SY3 8BB',
  (SELECT id FROM public.reps WHERE name = 'Sarah Thompson'), true;

INSERT INTO public.customers (customer_unique_id, company_name, address_line_1, town_city, post_code, rep_id, is_active)
SELECT 'CUST-003', 'Hilltop Free Range', '2 Hilltop Farm', 'Ludlow', 'SY8 4CC',
  (SELECT id FROM public.reps WHERE name = 'Mike Davis'), true;

INSERT INTO public.customers (customer_unique_id, company_name, address_line_1, town_city, post_code, is_active)
VALUES ('CUST-004', 'Retired Farms Co', '99 Old Road', 'Leominster', 'HR6 0ZZ', false);

-- ─── Delivery Addresses ─────────────────────────────────
INSERT INTO public.customer_delivery_addresses (customer_id, label, address_line_1, town_city, post_code, delivery_notes, is_active)
SELECT id, 'Main Yard', '100 Valley Road', 'Hereford', 'HR2 6AA', 'Use the main gate. Call on arrival.', true
FROM public.customers WHERE customer_unique_id = 'CUST-001';

INSERT INTO public.customer_delivery_addresses (customer_id, label, address_line_1, town_city, post_code, delivery_notes, is_active)
SELECT id, 'North Field', 'North Field Access Road', 'Hereford', 'HR2 6AB', 'Access via B road. 4x4 recommended in winter.', true
FROM public.customers WHERE customer_unique_id = 'CUST-001';

INSERT INTO public.customer_delivery_addresses (customer_id, label, address_line_1, town_city, post_code, is_active)
SELECT id, 'Loading Bay', '55 Oak Lane (Rear)', 'Shrewsbury', 'SY3 8BB', true
FROM public.customers WHERE customer_unique_id = 'CUST-002';

-- ─── Extras ──────────────────────────────────────────────
INSERT INTO public.extras (name, description, is_available) VALUES
  ('Beak Trimming', 'Infrared beak treatment at day old', true),
  ('Vaccination - IB', 'Infectious bronchitis vaccination', true),
  ('Vaccination - ND', 'Newcastle disease vaccination', true),
  ('Vaccination - AE', 'Avian encephalomyelitis vaccination', true),
  ('Salmonella Testing', 'Pre-delivery salmonella testing certificate', true),
  ('Wing Tagging', 'Individual wing tag identification', false),
  ('Comb Dubbing', 'Comb trimming service', false);

-- ─── Breeds ──────────────────────────────────────────────
INSERT INTO public.breeds (breed_name, is_available) VALUES
  ('Lohmann Brown', true),
  ('Hy-Line Brown', true),
  ('Bovans Brown', true),
  ('Lohmann LSL Classic', true),
  ('Hy-Line W-36', true),
  ('ISA Brown', false);

-- Link breeds to extras
INSERT INTO public.breed_extras (breed_id, extra_id)
SELECT b.id, e.id FROM public.breeds b, public.extras e
WHERE b.breed_name = 'Lohmann Brown' AND e.name IN ('Beak Trimming', 'Vaccination - IB', 'Vaccination - ND');

INSERT INTO public.breed_extras (breed_id, extra_id)
SELECT b.id, e.id FROM public.breeds b, public.extras e
WHERE b.breed_name = 'Hy-Line Brown' AND e.name IN ('Beak Trimming', 'Vaccination - IB', 'Salmonella Testing');

INSERT INTO public.breed_extras (breed_id, extra_id)
SELECT b.id, e.id FROM public.breeds b, public.extras e
WHERE b.breed_name = 'Bovans Brown' AND e.name IN ('Vaccination - IB', 'Vaccination - ND', 'Vaccination - AE');

-- ─── Transporters ────────────────────────────────────────
INSERT INTO public.transporters (transporter_name, address_line_1, town_city, post_code, phone, email, is_active) VALUES
  ('Midlands Poultry Transport', '15 Industrial Estate', 'Birmingham', 'B12 0AA', '0121 555 0001', 'bookings@mpt.example.com', true),
  ('Welsh Borders Haulage', '3 Depot Road', 'Welshpool', 'SY21 7AA', '01938 550001', 'dispatch@wbh.example.com', true),
  ('West Country Livestock', '88 Station Road', 'Taunton', 'TA1 1AA', '01823 330001', 'info@wcl.example.com', true),
  ('Old Road Transport', '1 Sunset Lane', 'Hereford', 'HR1 1ZZ', '01432 110001', NULL, false);
