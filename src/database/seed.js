const bcrypt = require('bcryptjs');
const { query, testDatabaseConnection } = require('../config/db');
const { runMigrations } = require('./migrate');

async function seedDatabase() {
  await testDatabaseConnection();
  await runMigrations();

  // 1. Seed Roles (FR-1.4, FR-6.4, FR-11.1-11.3)
  await query(`
    INSERT INTO roles (code, name, scope, description)
    VALUES
      ('patient', 'Patient', 'patient_side', 'Owns health record vault, grants/revokes consent, books appointments, uploads receipts'),
      ('caregiver', 'Family Caregiver / Guardian', 'patient_side', 'Manages child or elderly parent profiles with guardian-scoped permissions (FR-5.1)'),
      ('provider_admin', 'Provider Workspace Admin', 'provider_tenant', 'Manages hospital/clinic/lab staff accounts, doctor schedules, and published price lists (FR-6.4)'),
      ('doctor', 'Doctor / Clinician', 'provider_tenant', 'Views consented patient history, writes prescriptions & visit notes, receives duplicate-test alerts (FR-6.7)'),
      ('receptionist', 'Receptionist / Front Desk', 'provider_tenant', 'Registers patients by Health ID, opens visits, manages appointment calendar & queue (FR-6.5, FR-6.6)'),
      ('lab_tech', 'Lab Technician', 'provider_tenant', 'Uploads diagnostic test reports and coded lab observations to patient records (FR-6.8)'),
      ('billing_staff', 'Billing & Accounts Staff', 'provider_tenant', 'Generates patient bills and invoices from provider price list (FR-6.9)'),
      ('platform_admin', 'Platform Administrator', 'platform_global', 'Verifies provider licenses, suspends rule-breaking providers, views audit dashboards (FR-6.2, FR-11.1)'),
      ('price_reviewer', 'Price Verification Reviewer', 'platform_global', 'Reviews patient receipt discrepancy flags and provider price disputes before public flagging (FR-9.5, FR-11.2)')
    ON CONFLICT (code) DO NOTHING;
  `);

  // 2. Seed Granular Permissions
  await query(`
    INSERT INTO permissions (code, module, description)
    VALUES
      ('record:read_own', 'vault', 'Read own longitudinal medical records and lab trends'),
      ('record:upload_own', 'vault', 'Upload paper prescriptions/reports for OCR & confirm extracted data'),
      ('consent:manage', 'consent', 'Grant or revoke category-scoped provider consent via OTP/QR'),
      ('family:manage', 'family', 'Create and manage dependent child/parent profiles'),
      ('emergency_card:manage', 'emergency', 'Configure or disable offline-readable signed QR emergency card'),
      ('appointment:book', 'appointments', 'Search doctors, compare fees/test prices, and book appointments'),
      ('receipt:report', 'pricing', 'Upload billing receipts to verify published provider prices'),
      ('workspace:manage_staff', 'provider', 'Create and manage provider staff accounts and roles'),
      ('schedule:manage', 'directory', 'Manage doctor facility schedules and consultation fees'),
      ('price:publish', 'pricing', 'Publish and update provider diagnostic test prices and procedure ranges'),
      ('price:dispute', 'pricing', 'Submit evidence to dispute a flagged price discrepancy'),
      ('patient:register_visit', 'provider', 'Register patient by Health ID and open outpatient visit'),
      ('queue:manage', 'appointments', 'Manage provider appointment calendar and on-site serial queue'),
      ('record:read_consented', 'clinical', 'Read patient records within active consent categories'),
      ('prescription:write', 'clinical', 'Write prescriptions and clinical visit summaries into patient record'),
      ('lab_report:upload', 'clinical', 'Upload diagnostic lab reports and structured LOINC observations'),
      ('invoice:create', 'billing', 'Create bills and receipts from provider price list'),
      ('provider:verify', 'admin', 'Verify provider onboarding documents or suspend providers'),
      ('price:review_flags', 'admin', 'Review receipt-vs-published price discrepancies before public display'),
      ('audit:read_logs', 'admin', 'View system usage, data-quality, and access audit logs'),
      ('break_glass:access', 'admin', 'Logged emergency clinical access with mandatory justification')
    ON CONFLICT (code) DO NOTHING;
  `);

  // 3. Map Roles -> Permissions
  const rolePermissionPairs = [
    // Patient
    ['patient', 'record:read_own'],
    ['patient', 'record:upload_own'],
    ['patient', 'consent:manage'],
    ['patient', 'family:manage'],
    ['patient', 'emergency_card:manage'],
    ['patient', 'appointment:book'],
    ['patient', 'receipt:report'],
    // Caregiver
    ['caregiver', 'record:read_own'],
    ['caregiver', 'record:upload_own'],
    ['caregiver', 'consent:manage'],
    ['caregiver', 'appointment:book'],
    // Provider Admin
    ['provider_admin', 'workspace:manage_staff'],
    ['provider_admin', 'schedule:manage'],
    ['provider_admin', 'price:publish'],
    ['provider_admin', 'price:dispute'],
    ['provider_admin', 'patient:register_visit'],
    ['provider_admin', 'queue:manage'],
    // Doctor
    ['doctor', 'record:read_consented'],
    ['doctor', 'prescription:write'],
    ['doctor', 'queue:manage'],
    // Receptionist
    ['receptionist', 'patient:register_visit'],
    ['receptionist', 'queue:manage'],
    // Lab Tech
    ['lab_tech', 'lab_report:upload'],
    // Billing Staff
    ['billing_staff', 'invoice:create'],
    // Platform Admin
    ['platform_admin', 'provider:verify'],
    ['platform_admin', 'audit:read_logs'],
    ['platform_admin', 'break_glass:access'],
    // Price Reviewer
    ['price_reviewer', 'price:review_flags'],
    ['price_reviewer', 'audit:read_logs'],
  ];

  for (const [roleCode, permCode] of rolePermissionPairs) {
    await query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id FROM roles r, permissions p
       WHERE r.code = $1 AND p.code = $2
       ON CONFLICT DO NOTHING`,
      [roleCode, permCode]
    );
  }

  // 4. Seed LOINC Code Catalog (Section 6.3 & FR-2.7, FR-2.9)
  await query(`
    INSERT INTO loinc_catalog (loinc_code, standard_name, bd_common_name, unit, duplicate_warning_days)
    VALUES
      ('LOINC-4548-4', 'Hemoglobin A1c/Hemoglobin.total in Blood', 'HbA1c (Glycated Hemoglobin)', '%', 90),
      ('LOINC-58410-2', 'Complete blood count (hemogram) panel', 'CBC (Complete Blood Count)', 'panel', 7),
      ('LOINC-2160-0', 'Creatinine [Mass/volume] in Serum or Plasma', 'Serum Creatinine', 'mg/dL', 14),
      ('LOINC-2345-7', 'Glucose [Mass/volume] in Serum or Plasma', 'Fasting Blood Sugar (FBS)', 'mmol/L', 7),
      ('LOINC-24331-1', 'Lipid 1996 panel - Serum or Plasma', 'Fasting Lipid Profile', 'mg/dL', 60)
    ON CONFLICT (loinc_code) DO NOTHING;
  `);

  // 5. Seed Local Bangladesh Drug Catalog (Section 6.3)
  const drugCount = await query('SELECT COUNT(*)::int AS count FROM drug_catalog');
  if (drugCount.rows[0].count === 0) {
    await query(`
      INSERT INTO drug_catalog (brand_name, generic_name, strength, dosage_form, manufacturer)
      VALUES
        ('Napa', 'Paracetamol', '500 mg', 'Tablet', 'Beximco Pharmaceuticals Ltd.'),
        ('Seclo', 'Omeprazole', '20 mg', 'Capsule', 'Square Pharmaceuticals PLC'),
        ('Bizoran', 'Amlodipine + Olmesartan', '5 mg / 20 mg', 'Tablet', 'Beximco Pharmaceuticals Ltd.'),
        ('Comet', 'Metformin Hydrochloride', '500 mg', 'Tablet', 'Square Pharmaceuticals PLC')
    `);
  }

  // 6. Seed Pilot Providers
  await query(`
    INSERT INTO providers (name, provider_type, license_number, district, address, contact_phone, status, is_verified)
    VALUES
      ('Square Hospital Ltd.', 'hospital', 'DGHS-HOSP-1001', 'Dhaka', '18/F, Bir Uttam Qazi Nuruzzaman Sarak, Panthapath', '+880-2-8144400', 'verified', true),
      ('Popular Diagnostic Centre', 'diagnostic_center', 'DGHS-DIAG-2001', 'Dhaka', 'House #16, Road #2, Dhanmondi', '+880-9613-787801', 'verified', true),
      ('Ibn Sina Diagnostic & Imaging Center', 'diagnostic_center', 'DGHS-DIAG-2002', 'Dhaka', 'House #48, Road #9/A, Dhanmondi', '+880-9610-010615', 'verified', true)
    ON CONFLICT (license_number) DO NOTHING;
  `);

  // 7. Seed Pilot Doctors
  await query(`
    INSERT INTO doctors (bmdc_reg_number, full_name, specialty, qualifications, is_verified)
    VALUES
      ('BMDC-A-45102', 'Prof. Dr. Mahmudul Hasan', 'Cardiology', 'MBBS, FCPS (Medicine), MD (Cardiology)', true),
      ('BMDC-A-51209', 'Dr. Nusrat Jahan', 'Endocrinology', 'MBBS, DEM (BIRDEM), MD (Endocrinology)', true),
      ('BMDC-A-60891', 'Dr. Tanvir Ahmed', 'Internal Medicine', 'MBBS, FCPS (Medicine)', true)
    ON CONFLICT (bmdc_reg_number) DO NOTHING;
  `);

  // 8. Seed Sample Patient & Demo Auth Users (Default Password: Password123!)
  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  await query(
    `INSERT INTO users (mobile, email, password_hash, full_name, is_mobile_verified, is_active)
     VALUES
       ('+8801711000001', 'rahim.patient@rogisathi.bd', $1, 'Rahim Uddin', TRUE, TRUE),
       ('+8801711000002', 'dr.mahmudul@squarehospital.bd', $1, 'Prof. Dr. Mahmudul Hasan', TRUE, TRUE),
       ('+8801711000003', 'admin@squarehospital.bd', $1, 'Square Hospital Admin', TRUE, TRUE),
       ('+8801711000004', 'platform.admin@dghs.gov.bd', $1, 'DGHS Platform Administrator', TRUE, TRUE)
     ON CONFLICT (mobile) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [defaultPasswordHash]
  );

  // Assign Global Roles to Demo Users
  await query(`
    INSERT INTO user_roles (user_id, role_id)
    SELECT u.id, r.id FROM users u, roles r
    WHERE (u.mobile = '+8801711000001' AND r.code IN ('patient', 'caregiver'))
       OR (u.mobile = '+8801711000004' AND r.code = 'platform_admin')
    ON CONFLICT DO NOTHING;
  `);

  // Assign Provider Tenant Staff Roles (Square Hospital Ltd.)
  await query(`
    INSERT INTO provider_staff (provider_id, user_id, role_id, is_active)
    SELECT p.id, u.id, r.id, TRUE
    FROM providers p, users u, roles r
    WHERE p.license_number = 'DGHS-HOSP-1001'
      AND (
        (u.mobile = '+8801711000002' AND r.code = 'doctor')
        OR (u.mobile = '+8801711000003' AND r.code = 'provider_admin')
      )
    ON CONFLICT (provider_id, user_id, role_id) DO NOTHING;
  `);

  await query(`
    INSERT INTO patients (user_id, health_id, full_name, mobile, date_of_birth, gender, blood_group, emergency_contact)
    SELECT u.id, 'BD-UHP-2026-0001', 'Rahim Uddin', '+8801711000001', '1992-05-14', 'Male', 'O+', '+8801711000002'
    FROM users u WHERE u.mobile = '+8801711000001'
    ON CONFLICT (health_id) DO UPDATE SET user_id = EXCLUDED.user_id;
  `);

  await query(`
    UPDATE doctors d
    SET user_id = u.id
    FROM users u
    WHERE d.bmdc_reg_number = 'BMDC-A-45102' AND u.mobile = '+8801711000002';
  `);

  // 9. Seed Practitioner Roles
  await query(`
    INSERT INTO practitioner_roles (doctor_id, provider_id, schedule_days, schedule_hours, visit_fee, followup_fee)
    SELECT d.id, p.id, 'Sat, Mon, Wed', '5:00 PM - 9:00 PM', 1200, 800
    FROM doctors d, providers p
    WHERE d.bmdc_reg_number = 'BMDC-A-45102' AND p.license_number = 'DGHS-HOSP-1001'
    ON CONFLICT (doctor_id, provider_id) DO NOTHING;

    INSERT INTO practitioner_roles (doctor_id, provider_id, schedule_days, schedule_hours, visit_fee, followup_fee)
    SELECT d.id, p.id, 'Sun, Tue, Thu', '6:00 PM - 9:00 PM', 1000, 700
    FROM doctors d, providers p
    WHERE d.bmdc_reg_number = 'BMDC-A-51209' AND p.license_number = 'DGHS-DIAG-2001'
    ON CONFLICT (doctor_id, provider_id) DO NOTHING;
  `);

  // 10. Seed Diagnostic Test Prices
  const existingPrices = await query('SELECT COUNT(*)::int AS count FROM price_items');
  if (existingPrices.rows[0].count === 0) {
    await query(`
      INSERT INTO price_items (provider_id, loinc_code, item_code, item_name, item_category, price, source)
      SELECT id, 'LOINC-4548-4', 'LOINC-4548-4', 'HbA1c (Glycated Hemoglobin)', 'diagnostic_test', 1100, 'provider_published'
      FROM providers WHERE license_number = 'DGHS-HOSP-1001';

      INSERT INTO price_items (provider_id, loinc_code, item_code, item_name, item_category, price, source)
      SELECT id, 'LOINC-4548-4', 'LOINC-4548-4', 'HbA1c (Glycated Hemoglobin)', 'diagnostic_test', 850, 'provider_published'
      FROM providers WHERE license_number = 'DGHS-DIAG-2001';

      INSERT INTO price_items (provider_id, loinc_code, item_code, item_name, item_category, price, source)
      SELECT id, 'LOINC-4548-4', 'LOINC-4548-4', 'HbA1c (Glycated Hemoglobin)', 'diagnostic_test', 750, 'provider_published'
      FROM providers WHERE license_number = 'DGHS-DIAG-2002';

      INSERT INTO price_items (provider_id, loinc_code, item_code, item_name, item_category, price, source)
      SELECT id, 'LOINC-58410-2', 'LOINC-58410-2', 'CBC (Complete Blood Count)', 'diagnostic_test', 600, 'provider_published'
      FROM providers WHERE license_number = 'DGHS-HOSP-1001';

      INSERT INTO price_items (provider_id, loinc_code, item_code, item_name, item_category, price, source)
      SELECT id, 'LOINC-58410-2', 'LOINC-58410-2', 'CBC (Complete Blood Count)', 'diagnostic_test', 450, 'provider_published'
      FROM providers WHERE license_number = 'DGHS-DIAG-2001';
    `);
  }

  console.log('✅ Seeded roles, permissions, role_permissions, LOINC & drug catalogs, providers, doctors, and prices.');
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err.message);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
