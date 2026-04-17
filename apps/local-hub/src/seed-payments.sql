-- =============================================================================
-- Local Hub: SQL Migration + Payment Seed
-- =============================================================================
-- Run once against the social/payments databases:
--   psql $DATABASE_URL -f apps/local-hub/src/seed-payments.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Migration: add highlights column to community table
-- ---------------------------------------------------------------------------
ALTER TABLE community ADD COLUMN IF NOT EXISTS highlights jsonb DEFAULT NULL;

-- ---------------------------------------------------------------------------
-- 2. BusinessPage seed rows
--    Prerequisites: community rows with the listed slugs must already exist.
--    Replace the uuid(...) calls with actual community IDs if running manually.
--
--    Pattern:
--      INSERT INTO business_page (...) SELECT ... WHERE NOT EXISTS (...)
-- ---------------------------------------------------------------------------

-- Savannah, GA – 3 businesses
INSERT INTO business_page (id, community_id, name, description, website, phone, address, category, image_url, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'The Collins Quarter',
  'Beloved Savannah café and restaurant serving European-inspired brunch and dinner inside a stunning historic building on Bull Street.',
  'https://www.thecollinsquarter.com',
  '+19122003039',
  '151 Bull St, Savannah, GA 31401',
  'Restaurant',
  'https://images.unsplash.com/photo-1529543544282-ea669407fca3?w=800&q=80',
  true,
  NOW(),
  NOW()
FROM community c WHERE c.slug = 'savannah-ga'
  AND NOT EXISTS (SELECT 1 FROM business_page bp WHERE bp.name = 'The Collins Quarter' AND bp.community_id = c.id);

INSERT INTO business_page (id, community_id, name, description, website, phone, address, category, image_url, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Service Brewing Co.',
  'Savannah craft brewery honoring military service, with rotating taps and a welcoming taproom near historic Forsyth Park.',
  'https://www.servicebrewing.com',
  '+19124216767',
  '574 Indian St, Savannah, GA 31401',
  'Brewery',
  'https://images.unsplash.com/photo-1559526324-593bc073d938?w=800&q=80',
  true,
  NOW(),
  NOW()
FROM community c WHERE c.slug = 'savannah-ga'
  AND NOT EXISTS (SELECT 1 FROM business_page bp WHERE bp.name = 'Service Brewing Co.' AND bp.community_id = c.id);

INSERT INTO business_page (id, community_id, name, description, website, phone, address, category, image_url, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Savannah Bee Company',
  'Savannah-born honey and beeswax products company with flagship storefront in the historic district offering tastings and gifts.',
  'https://www.savannahbee.com',
  '+19124471700',
  '104 W Broughton St, Savannah, GA 31401',
  'Retail',
  'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=800&q=80',
  true,
  NOW(),
  NOW()
FROM community c WHERE c.slug = 'savannah-ga'
  AND NOT EXISTS (SELECT 1 FROM business_page bp WHERE bp.name = 'Savannah Bee Company' AND bp.community_id = c.id);

-- Charleston, SC – 3 businesses
INSERT INTO business_page (id, community_id, name, description, website, phone, address, category, image_url, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Husk Restaurant',
  'James Beard Award-winning chef Sean Brock''s celebrated ode to Southern ingredients and heritage grains in a stunning historic Charleston home.',
  'https://huskrestaurant.com/charleston',
  '+18435772500',
  '76 Queen St, Charleston, SC 29401',
  'Restaurant',
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
  true,
  NOW(),
  NOW()
FROM community c WHERE c.slug = 'charleston-sc'
  AND NOT EXISTS (SELECT 1 FROM business_page bp WHERE bp.name = 'Husk Restaurant' AND bp.community_id = c.id);

INSERT INTO business_page (id, community_id, name, description, website, phone, address, category, image_url, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Charleston Tea Garden',
  'America''s only large-scale tea garden, growing and producing American Classic Tea on Wadmalaw Island just south of Charleston.',
  'https://www.charlestonteagarden.com',
  '+18435593387',
  '6617 Maybank Hwy, Wadmalaw Island, SC 29487',
  'Agriculture & Tourism',
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80',
  true,
  NOW(),
  NOW()
FROM community c WHERE c.slug = 'charleston-sc'
  AND NOT EXISTS (SELECT 1 FROM business_page bp WHERE bp.name = 'Charleston Tea Garden' AND bp.community_id = c.id);

INSERT INTO business_page (id, community_id, name, description, website, phone, address, category, image_url, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Holy City Brewing',
  'Charleston''s pioneering craft brewery specializing in approachable lagers and ales brewed with Southern character.',
  'https://www.holycitybrewing.com',
  '+18438342436',
  '4155 Dorchester Rd, North Charleston, SC 29405',
  'Brewery',
  'https://images.unsplash.com/photo-1559526324-593bc073d938?w=800&q=80',
  true,
  NOW(),
  NOW()
FROM community c WHERE c.slug = 'charleston-sc'
  AND NOT EXISTS (SELECT 1 FROM business_page bp WHERE bp.name = 'Holy City Brewing' AND bp.community_id = c.id);

-- Jacksonville, FL – 2 businesses
INSERT INTO business_page (id, community_id, name, description, website, phone, address, category, image_url, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Bold Bean Coffee Roasters',
  'Jacksonville''s premier specialty coffee roaster with multiple cafés across the city, pioneering third-wave coffee culture on the First Coast.',
  'https://www.boldbeancoffee.com',
  '+19043792489',
  '1238 Kings Ave, Jacksonville, FL 32207',
  'Coffee',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
  true,
  NOW(),
  NOW()
FROM community c WHERE c.slug = 'jacksonville-fl'
  AND NOT EXISTS (SELECT 1 FROM business_page bp WHERE bp.name = 'Bold Bean Coffee Roasters' AND bp.community_id = c.id);

INSERT INTO business_page (id, community_id, name, description, website, phone, address, category, image_url, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Intuition Ale Works',
  'Flagship Jacksonville craft brewery producing People''s Pale Ale and seasonal favorites with a bustling downtown taproom.',
  'https://www.intuitionalewerks.com',
  '+19046337427',
  '720 King St, Jacksonville, FL 32204',
  'Brewery',
  'https://images.unsplash.com/photo-1559526324-593bc073d938?w=800&q=80',
  true,
  NOW(),
  NOW()
FROM community c WHERE c.slug = 'jacksonville-fl'
  AND NOT EXISTS (SELECT 1 FROM business_page bp WHERE bp.name = 'Intuition Ale Works' AND bp.community_id = c.id);

-- Augusta, GA – 2 businesses
INSERT INTO business_page (id, community_id, name, description, website, phone, address, category, image_url, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Frog Hollow Tavern',
  'Award-winning Augusta restaurant celebrating locally sourced Southern cuisine in an elegant historic rowhouse near the Riverwalk.',
  'https://www.froghollowaugusta.com',
  '+17068286948',
  '1282 Broad St, Augusta, GA 30901',
  'Restaurant',
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
  true,
  NOW(),
  NOW()
FROM community c WHERE c.slug = 'augusta-ga'
  AND NOT EXISTS (SELECT 1 FROM business_page bp WHERE bp.name = 'Frog Hollow Tavern' AND bp.community_id = c.id);

INSERT INTO business_page (id, community_id, name, description, website, phone, address, category, image_url, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Craft & Vine',
  'Augusta''s acclaimed wine bar and kitchen with an extensive bottle list and imaginative small plates in the Broad Street corridor.',
  'https://www.craftandvineaugusta.com',
  '+17067224411',
  '984 Broad St, Augusta, GA 30901',
  'Wine Bar',
  'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80',
  true,
  NOW(),
  NOW()
FROM community c WHERE c.slug = 'augusta-ga'
  AND NOT EXISTS (SELECT 1 FROM business_page bp WHERE bp.name = 'Craft & Vine' AND bp.community_id = c.id);

-- ---------------------------------------------------------------------------
-- 3. CommunitySponsorship seed rows
-- ---------------------------------------------------------------------------

INSERT INTO community_sponsorship (id, community_id, business_id, tier, start_date, end_date, amount, currency, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  bp.id,
  'gold',
  DATE_TRUNC('month', NOW()),
  DATE_TRUNC('month', NOW()) + INTERVAL '3 months',
  500.00,
  'USD',
  true,
  NOW(),
  NOW()
FROM community c
JOIN business_page bp ON bp.community_id = c.id AND bp.name = 'Service Brewing Co.'
WHERE c.slug = 'savannah-ga'
  AND NOT EXISTS (
    SELECT 1 FROM community_sponsorship cs WHERE cs.community_id = c.id AND cs.business_id = bp.id
  );

INSERT INTO community_sponsorship (id, community_id, business_id, tier, start_date, end_date, amount, currency, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  bp.id,
  'silver',
  DATE_TRUNC('month', NOW()),
  DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
  250.00,
  'USD',
  true,
  NOW(),
  NOW()
FROM community c
JOIN business_page bp ON bp.community_id = c.id AND bp.name = 'Husk Restaurant'
WHERE c.slug = 'charleston-sc'
  AND NOT EXISTS (
    SELECT 1 FROM community_sponsorship cs WHERE cs.community_id = c.id AND cs.business_id = bp.id
  );

INSERT INTO community_sponsorship (id, community_id, business_id, tier, start_date, end_date, amount, currency, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  bp.id,
  'bronze',
  DATE_TRUNC('month', NOW()),
  DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
  100.00,
  'USD',
  true,
  NOW(),
  NOW()
FROM community c
JOIN business_page bp ON bp.community_id = c.id AND bp.name = 'Bold Bean Coffee Roasters'
WHERE c.slug = 'jacksonville-fl'
  AND NOT EXISTS (
    SELECT 1 FROM community_sponsorship cs WHERE cs.community_id = c.id AND cs.business_id = bp.id
  );

-- ---------------------------------------------------------------------------
-- 4. DonationGoal seed rows (current month, top 5 cities)
-- ---------------------------------------------------------------------------

INSERT INTO donation_goal (id, community_id, title, description, target_amount, current_amount, currency, start_date, end_date, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Savannah Squares Restoration Fund',
  'Help preserve and restore Savannah''s iconic 22 historic squares for future generations to enjoy.',
  15000.00,
  4280.00,
  'USD',
  DATE_TRUNC('month', NOW()),
  DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day',
  true,
  NOW(),
  NOW()
FROM community c WHERE c.slug = 'savannah-ga'
  AND NOT EXISTS (
    SELECT 1 FROM donation_goal dg WHERE dg.community_id = c.id AND dg.title = 'Savannah Squares Restoration Fund'
  );

INSERT INTO donation_goal (id, community_id, title, description, target_amount, current_amount, currency, start_date, end_date, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Charleston Harbor Cleanup',
  'Fund monthly volunteer cleanups of Charleston Harbor and Cooper River shoreline to keep our waterways beautiful.',
  8000.00,
  3150.00,
  'USD',
  DATE_TRUNC('month', NOW()),
  DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day',
  true,
  NOW(),
  NOW()
FROM community c WHERE c.slug = 'charleston-sc'
  AND NOT EXISTS (
    SELECT 1 FROM donation_goal dg WHERE dg.community_id = c.id AND dg.title = 'Charleston Harbor Cleanup'
  );

INSERT INTO donation_goal (id, community_id, title, description, target_amount, current_amount, currency, start_date, end_date, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Jacksonville Riverside Trail Extension',
  'Raise funds to extend the Riverside trail network along the St. Johns River with new lighting and benches.',
  20000.00,
  6700.00,
  'USD',
  DATE_TRUNC('month', NOW()),
  DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day',
  true,
  NOW(),
  NOW()
FROM community c WHERE c.slug = 'jacksonville-fl'
  AND NOT EXISTS (
    SELECT 1 FROM donation_goal dg WHERE dg.community_id = c.id AND dg.title = 'Jacksonville Riverside Trail Extension'
  );

INSERT INTO donation_goal (id, community_id, title, description, target_amount, current_amount, currency, start_date, end_date, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Augusta Riverwalk Enhancement',
  'Community-funded enhancements to the Augusta Riverwalk including new art installations and accessibility improvements.',
  12000.00,
  2890.00,
  'USD',
  DATE_TRUNC('month', NOW()),
  DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day',
  true,
  NOW(),
  NOW()
FROM community c WHERE c.slug = 'augusta-ga'
  AND NOT EXISTS (
    SELECT 1 FROM donation_goal dg WHERE dg.community_id = c.id AND dg.title = 'Augusta Riverwalk Enhancement'
  );

INSERT INTO donation_goal (id, community_id, title, description, target_amount, current_amount, currency, start_date, end_date, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  'Golden Isles Shoreline Preservation',
  'Protect Brunswick''s barrier island coastline through strategic dune restoration and litter abatement programs.',
  10000.00,
  1950.00,
  'USD',
  DATE_TRUNC('month', NOW()),
  DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day',
  true,
  NOW(),
  NOW()
FROM community c WHERE c.slug = 'brunswick-ga'
  AND NOT EXISTS (
    SELECT 1 FROM donation_goal dg WHERE dg.community_id = c.id AND dg.title = 'Golden Isles Shoreline Preservation'
  );
