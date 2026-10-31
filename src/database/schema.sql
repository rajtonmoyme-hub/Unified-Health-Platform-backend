-- =============================================================================
-- UNIFIED HEALTH PLATFORM (ROGI SATHI) - COMPLETE POSTGRESQL SCHEMA & RBAC
-- Aligned with Requirements Specification v0.1 / v0.2 (HL7 FHIR-shaped)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. IDENTITY, ROLES & GRANULAR PRIVILEGES (RBAC - FR-1.4, FR-6.4, FR-11.1-11.3)
-- Supports one login with multiple roles (e.g., Patient + Caregiver, or Doctor
-- practicing at multiple providers) and strict permission checks.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  mobile VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(150) UNIQUE,
  password_hash TEXT,
  full_name VARCHAR(150) NOT NULL,
  nid_number VARCHAR(30) UNIQUE,
  is_mobile_verified BOOLEAN DEFAULT FALSE,
  is_nid_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL, -- patient, caregiver, provider_admin, doctor, receptionist, lab_tech, billing_staff, platform_admin, price_reviewer
  name VARCHAR(100) NOT NULL,
  scope VARCHAR(30) NOT NULL CHECK (scope IN ('patient_side', 'provider_tenant', 'platform_global')),
  description TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL, -- e.g. record:read, record:write, consent:manage, price:publish, provider:verify
  module VARCHAR(50) NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Global / Patient-side role assignments (FR-1.4: one login can hold multiple roles)
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role_id)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Mobile OTP Verification Codes (FR-1.1, FR-3.2)
CREATE TABLE IF NOT EXISTS otp_verifications (
  id SERIAL PRIMARY KEY,
  mobile VARCHAR(20) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  purpose VARCHAR(40) DEFAULT 'login' CHECK (purpose IN ('register', 'login', 'reset_password', 'consent_grant')),
  is_used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active JWT Refresh Sessions & Remote Device Revocation (FR-1.5, Section 7.3)
CREATE TABLE IF NOT EXISTS auth_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT UNIQUE NOT NULL,
  active_role VARCHAR(50) NOT NULL,
  active_provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL,
  user_agent TEXT,
  ip_address VARCHAR(64),
  is_revoked BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. PROVIDERS, LOCATIONS & TENANT STAFF ROLES (FR-6.1 to FR-6.4)
-- FHIR: Organization, Location
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS providers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('hospital', 'clinic', 'diagnostic_center')),
  license_number VARCHAR(100) UNIQUE NOT NULL,
  district VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  contact_person VARCHAR(150),
  contact_phone VARCHAR(30),
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'suspended')),
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE providers ADD COLUMN IF NOT EXISTS contact_person VARCHAR(150);
ALTER TABLE providers ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending';
ALTER TABLE providers ADD COLUMN IF NOT EXISTS verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS facility_locations (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  branch_name VARCHAR(150) NOT NULL,
  district VARCHAR(100) NOT NULL,
  area VARCHAR(100),
  address TEXT NOT NULL,
  opening_hours VARCHAR(150),
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scopes staff roles (provider_admin, doctor, receptionist, lab_tech, billing_staff)
-- to a specific provider workspace (Tenant Isolation - FR-6.3, FR-6.4)
CREATE TABLE IF NOT EXISTS provider_staff (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider_id, user_id, role_id)
);

-- -----------------------------------------------------------------------------
-- 3. PATIENTS, FAMILY GUARDIANSHIP & EMERGENCY CARD (FR-1.1-1.5, FR-5.1-5.5)
-- FHIR: Patient, RelatedPerson, AllergyIntolerance
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  health_id VARCHAR(32) UNIQUE NOT NULL, -- e.g. BD-UHP-2026-0001
  full_name VARCHAR(150) NOT NULL,
  mobile VARCHAR(20) UNIQUE NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(20),
  blood_group VARCHAR(10),
  emergency_contact VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family Caregiver / Guardianship Vault (FR-5.1)
CREATE TABLE IF NOT EXISTS family_guardianships (
  id SERIAL PRIMARY KEY,
  guardian_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dependent_patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  relationship VARCHAR(50) NOT NULL, -- child, parent, spouse, dependent_adult
  can_view_records BOOLEAN DEFAULT TRUE,
  can_grant_consent BOOLEAN DEFAULT TRUE,
  can_book_appointments BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (guardian_user_id, dependent_patient_id)
);

-- Allergies & Implants (FHIR AllergyIntolerance - FR-5.3)
CREATE TABLE IF NOT EXISTS allergies (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  substance VARCHAR(150) NOT NULL,
  reaction VARCHAR(200),
  severity VARCHAR(30) DEFAULT 'severe' CHECK (severity IN ('mild', 'moderate', 'severe', 'life_threatening')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Offline-Readable Signed Emergency Card (FR-5.3 to FR-5.5)
CREATE TABLE IF NOT EXISTS emergency_cards (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER UNIQUE NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT FALSE,
  show_blood_group BOOLEAN DEFAULT TRUE,
  show_severe_allergies BOOLEAN DEFAULT TRUE,
  show_implants BOOLEAN DEFAULT TRUE,
  show_emergency_contact BOOLEAN DEFAULT TRUE,
  implants_note TEXT,
  qr_signature_hash TEXT,
  regenerated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. DOCTORS, MULTI-FACILITY SCHEDULES & FEES (FR-7.1-7.4, FR-8.1-8.4)
-- FHIR: Practitioner, PractitionerRole
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  bmdc_reg_number VARCHAR(60) UNIQUE NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  specialty VARCHAR(100) NOT NULL,
  qualifications TEXT,
  is_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Links which doctor sits at which provider facility, schedule, and fee
CREATE TABLE IF NOT EXISTS practitioner_roles (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES facility_locations(id) ON DELETE SET NULL,
  schedule_days VARCHAR(100) NOT NULL,
  schedule_hours VARCHAR(100) NOT NULL,
  visit_fee NUMERIC(10, 2) NOT NULL,
  followup_fee NUMERIC(10, 2),
  is_stale BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (doctor_id, provider_id)
);

-- -----------------------------------------------------------------------------
-- 5. CONSENT MANAGER (FR-3.1 to FR-3.6)
-- FHIR: Consent
-- Granular categories: General, Mental Health, Reproductive Health, Other Sensitive
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS consents (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  granted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  allowed_categories TEXT[] NOT NULL DEFAULT ARRAY['General'],
  grant_method VARCHAR(20) DEFAULT 'otp' CHECK (grant_method IN ('otp', 'qr_code', 'portal')),
  purpose VARCHAR(100) DEFAULT 'treatment',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6. APPOINTMENTS & ON-SITE QUEUE (FR-4.3, FR-6.5, FR-6.6)
-- FHIR: Appointment, Slot
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  slot_time VARCHAR(40) NOT NULL,
  queue_serial INTEGER,
  status VARCHAR(30) DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'in_queue', 'done', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 7. CLINICAL VAULT, OCR PIPELINE, LABS & PRESCRIPTIONS (FR-2.1-2.9, FR-6.7-6.8)
-- FHIR: DocumentReference, DiagnosticReport, Observation, MedicationRequest
-- -----------------------------------------------------------------------------

-- Code Systems (Section 6.3: LOINC & Local Bangladesh Drug Catalog)
CREATE TABLE IF NOT EXISTS loinc_catalog (
  loinc_code VARCHAR(40) PRIMARY KEY,
  standard_name VARCHAR(200) NOT NULL,
  bd_common_name VARCHAR(200) NOT NULL,
  unit VARCHAR(40),
  duplicate_warning_days INTEGER DEFAULT 30 -- FR-2.9 duplicate test alert window
);

CREATE TABLE IF NOT EXISTS drug_catalog (
  id SERIAL PRIMARY KEY,
  brand_name VARCHAR(150) NOT NULL,
  generic_name VARCHAR(150) NOT NULL,
  strength VARCHAR(60),
  dosage_form VARCHAR(60),
  manufacturer VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS medical_records (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  record_type VARCHAR(50) NOT NULL CHECK (record_type IN ('prescription', 'lab_report', 'bill', 'visit_summary')),
  category VARCHAR(50) NOT NULL DEFAULT 'General' CHECK (category IN ('General', 'Mental Health', 'Reproductive Health', 'Other Sensitive')),
  title VARCHAR(200) NOT NULL,
  structured_data JSONB DEFAULT '{}'::jsonb,
  file_url TEXT, -- Original image/PDF always kept (FR-2.5)
  ocr_raw_text TEXT,
  source VARCHAR(40) DEFAULT 'provider_upload' CHECK (source IN ('provider_upload', 'patient_upload', 'ocr')),
  verification_status VARCHAR(30) DEFAULT 'pending_confirmation' CHECK (verification_status IN ('pending_confirmation', 'confirmed', 'rejected')),
  confirmed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Structured Lab Values for Trend Charts & Duplicate-Test Alerts (FR-2.7, FR-2.9)
CREATE TABLE IF NOT EXISTS lab_observations (
  id SERIAL PRIMARY KEY,
  medical_record_id INTEGER NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL,
  loinc_code VARCHAR(40) REFERENCES loinc_catalog(loinc_code),
  test_name VARCHAR(150) NOT NULL,
  numeric_value NUMERIC(12, 4),
  text_value VARCHAR(100),
  unit VARCHAR(40),
  reference_range VARCHAR(100),
  observed_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 8. PRICING, RECEIPT VERIFICATION & DISPUTES (FR-9.1-9.6, FR-10.1-10.4, FR-11.2)
-- FHIR: ChargeItemDefinition, Invoice
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS price_items (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  loinc_code VARCHAR(40) REFERENCES loinc_catalog(loinc_code),
  item_code VARCHAR(50) NOT NULL,
  item_name VARCHAR(200) NOT NULL,
  item_category VARCHAR(50) DEFAULT 'diagnostic_test' CHECK (item_category IN ('diagnostic_test', 'procedure_package')),
  price NUMERIC(10, 2),
  min_price_range NUMERIC(10, 2), -- For procedure packages (FR-10.2: range only)
  max_price_range NUMERIC(10, 2),
  source VARCHAR(40) DEFAULT 'provider_published' CHECK (source IN ('provider_published', 'patient_reported')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patient-Uploaded Receipts for Price Verification & Reviewer Queue (FR-9.4, FR-9.5)
CREATE TABLE IF NOT EXISTS price_verifications (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  price_item_id INTEGER REFERENCES price_items(id) ON DELETE SET NULL,
  billed_amount NUMERIC(10, 2) NOT NULL,
  published_amount_snapshot NUMERIC(10, 2),
  receipt_file_url TEXT NOT NULL,
  discrepancy_percent NUMERIC(6, 2),
  review_status VARCHAR(30) DEFAULT 'pending_review' CHECK (review_status IN ('pending_review', 'verified_match', 'flagged_discrepancy', 'provider_disputed', 'resolved')),
  reviewer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  provider_dispute_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 9. IMMUTABLE AUDIT LOGS & BREAK-GLASS ACCESS (FR-3.5, FR-11.3, NFR-10)
-- FHIR: AuditEvent
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_role VARCHAR(50) NOT NULL,
  actor_id VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL, -- e.g. READ_RECORD, UPLOAD_REPORT, REVOKE_CONSENT, BREAK_GLASS_ACCESS
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(64),
  is_break_glass BOOLEAN DEFAULT FALSE,
  justification TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE patients ADD COLUMN IF NOT EXISTS user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE practitioner_roles ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES facility_locations(id) ON DELETE SET NULL;
ALTER TABLE practitioner_roles ADD COLUMN IF NOT EXISTS is_stale BOOLEAN DEFAULT FALSE;
ALTER TABLE consents ADD COLUMN IF NOT EXISTS granted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE consents ADD COLUMN IF NOT EXISTS grant_method VARCHAR(20) DEFAULT 'otp';
ALTER TABLE consents ADD COLUMN IF NOT EXISTS purpose VARCHAR(100) DEFAULT 'treatment';
ALTER TABLE consents ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS queue_serial INTEGER;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS ocr_raw_text TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'pending_confirmation';
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS confirmed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE price_items ADD COLUMN IF NOT EXISTS loinc_code VARCHAR(40) REFERENCES loinc_catalog(loinc_code);
ALTER TABLE price_items ADD COLUMN IF NOT EXISTS min_price_range NUMERIC(10, 2);
ALTER TABLE price_items ADD COLUMN IF NOT EXISTS max_price_range NUMERIC(10, 2);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_id VARCHAR(64);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS is_break_glass BOOLEAN DEFAULT FALSE;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS justification TEXT;

-- Prevent UPDATE or DELETE on audit_logs (Immutability requirement - Section 6.2 & 7.3)
CREATE OR REPLACE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- -----------------------------------------------------------------------------
-- 10. DATABASE ROLES & ROW-LEVEL SECURITY (RLS) FOR TENANT & CONSENT ISOLATION
-- Section 6.1 NFR-1 & Section 7.2: PostgreSQL Row-Level Security
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'uhp_patient_role') THEN
    CREATE ROLE uhp_patient_role NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'uhp_provider_role') THEN
    CREATE ROLE uhp_provider_role NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'uhp_admin_role') THEN
    CREATE ROLE uhp_admin_role NOLOGIN;
  END IF;
END
$$;

-- Enable Row-Level Security on tenant-isolated & consent-protected tables
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policy 1: Patient can read/write all of their own medical_records
DROP POLICY IF EXISTS patient_own_records_policy ON medical_records;
CREATE POLICY patient_own_records_policy ON medical_records
  FOR ALL
  USING (
    current_setting('app.current_role', true) = 'patient'
    AND patient_id = NULLIF(current_setting('app.current_patient_id', true), '')::int
  );

-- Policy 2: Provider can ALWAYS access records IT created (FR-3.6 legal record-keeping),
-- OR records of a patient who has granted ACTIVE consent covering that record's category (FR-3.1, FR-3.3)
DROP POLICY IF EXISTS provider_consent_records_policy ON medical_records;
CREATE POLICY provider_consent_records_policy ON medical_records
  FOR SELECT
  USING (
    current_setting('app.current_role', true) IN ('doctor', 'provider_admin', 'lab_tech')
    AND (
      provider_id = NULLIF(current_setting('app.current_provider_id', true), '')::int
      OR EXISTS (
        SELECT 1 FROM consents c
        WHERE c.patient_id = medical_records.patient_id
          AND c.provider_id = NULLIF(current_setting('app.current_provider_id', true), '')::int
          AND c.status = 'active'
          AND c.expires_at > NOW()
          AND medical_records.category = ANY(c.allowed_categories)
      )
    )
  );
