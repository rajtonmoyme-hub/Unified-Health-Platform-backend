const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const { query } = require('../../config/db');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createHttpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

class AuthService {
  /**
   * Builds the full identity, role, tenant, patient/doctor profile, and permission context for a user.
   */
  static async buildUserContext(userId, requestedRole = null, requestedProviderId = null) {
    const userRes = await query(
      `SELECT id, mobile, email, full_name, nid_number, is_mobile_verified, is_nid_verified, is_active, pin_hash, created_at
       FROM users WHERE id = $1`,
      [userId]
    );
    if (userRes.rowCount === 0) {
      throw createHttpError('User not found', 404);
    }
    const user = userRes.rows[0];
    if (!user.is_active) {
      throw createHttpError('Account is deactivated', 403);
    }

    // Global / Patient-side roles
    const globalRolesRes = await query(
      `SELECT r.code, r.name, r.scope
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [userId]
    );
    const globalRoles = globalRolesRes.rows.map((r) => r.code);

    // Provider tenant staff roles
    const staffRes = await query(
      `SELECT ps.provider_id, p.name AS provider_name, p.provider_type, r.code AS role_code, r.name AS role_name
       FROM provider_staff ps
       JOIN providers p ON p.id = ps.provider_id
       JOIN roles r ON r.id = ps.role_id
       WHERE ps.user_id = $1 AND ps.is_active = TRUE`,
      [userId]
    );
    const providerMemberships = staffRes.rows;

    // Combined list of all role codes held by the user
    const allRoleCodes = Array.from(
      new Set([...globalRoles, ...providerMemberships.map((m) => m.role_code)])
    );

    // Determine active role and active provider tenant
    let activeRole = requestedRole;
    let activeProviderId = requestedProviderId ? Number(requestedProviderId) : null;

    if (activeRole) {
      const hasGlobal = globalRoles.includes(activeRole);
      const matchingStaff = providerMemberships.find(
        (m) =>
          m.role_code === activeRole &&
          (!activeProviderId || Number(m.provider_id) === activeProviderId)
      );
      if (!hasGlobal && !matchingStaff) {
        throw createHttpError(
          `User does not hold role "${activeRole}"${activeProviderId ? ` at provider #${activeProviderId}` : ''}`,
          403
        );
      }
      if (matchingStaff && !activeProviderId) {
        activeProviderId = Number(matchingStaff.provider_id);
      }
    } else if (activeProviderId) {
      const matchingStaff = providerMemberships.find(
        (m) => Number(m.provider_id) === activeProviderId
      );
      if (!matchingStaff) {
        throw createHttpError(`User is not a staff member of provider #${activeProviderId}`, 403);
      }
      activeRole = matchingStaff.role_code;
    } else {
      activeRole = globalRoles[0] || providerMemberships[0]?.role_code || 'patient';
      if (!globalRoles.includes(activeRole) && providerMemberships[0]) {
        activeProviderId = Number(providerMemberships[0].provider_id);
      }
    }

    // Fetch permissions for the active role
    const permRes = await query(
      `SELECT p.code
       FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE r.code = $1
       ORDER BY p.code ASC`,
      [activeRole]
    );
    const permissions = permRes.rows.map((p) => p.code);

    // Linked patient profile
    const patientRes = await query(
      `SELECT id, health_id, full_name, mobile, date_of_birth, gender, blood_group, emergency_contact
       FROM patients
       WHERE user_id = $1 OR mobile = $2
       LIMIT 1`,
      [userId, user.mobile]
    );
    const patientProfile = patientRes.rows[0] || null;

    // Linked doctor profile
    const doctorRes = await query(
      `SELECT id, bmdc_reg_number, full_name, specialty, qualifications, is_verified
       FROM doctors
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );
    const doctorProfile = doctorRes.rows[0] || null;

    return {
      id: user.id,
      mobile: user.mobile,
      email: user.email,
      full_name: user.full_name,
      nid_number: user.nid_number,
      is_mobile_verified: user.is_mobile_verified,
      is_nid_verified: user.is_nid_verified,
      has_pin_lock: Boolean(user.pin_hash),
      active_role: activeRole,
      active_provider_id: activeProviderId,
      roles: allRoleCodes,
      global_roles: globalRoles,
      provider_memberships: providerMemberships,
      permissions,
      patient_profile: patientProfile,
      doctor_profile: doctorProfile,
      created_at: user.created_at,
    };
  }

  /**
   * Issues signed JWT accessToken and refreshToken and records the session in auth_sessions.
   */
  static async issueTokens(userContext, meta = {}) {
    const jwtPayload = {
      id: userContext.id,
      mobile: userContext.mobile,
      full_name: userContext.full_name,
      role: userContext.active_role,
      roles: userContext.roles,
      providerId: userContext.active_provider_id || null,
      patientId: userContext.patient_profile?.id || null,
      healthId: userContext.patient_profile?.health_id || null,
      doctorId: userContext.doctor_profile?.id || null,
      permissions: userContext.permissions,
    };

    const accessToken = jwt.sign(jwtPayload, env.jwt.secret, {
      expiresIn: env.jwt.expiresIn,
    });

    const refreshToken = jwt.sign(
      {
        id: userContext.id,
        role: userContext.active_role,
        providerId: userContext.active_provider_id || null,
        jti: crypto.randomUUID(),
      },
      env.jwt.refreshSecret,
      { expiresIn: env.jwt.refreshExpiresIn }
    );

    const refreshHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const sessionRes = await query(
      `INSERT INTO auth_sessions (user_id, refresh_token_hash, active_role, active_provider_id, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at, expires_at`,
      [
        userContext.id,
        refreshHash,
        userContext.active_role,
        userContext.active_provider_id || null,
        meta.userAgent || null,
        meta.ipAddress || null,
        expiresAt,
      ]
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: env.jwt.expiresIn,
      session: sessionRes.rows[0],
    };
  }

  /**
   * Generates a 6-digit OTP in otp_verifications (FR-1.1).
   */
  static async sendOtp({ mobile, purpose = 'login' }) {
    if (!mobile) {
      throw createHttpError('mobile is required', 400);
    }

    const validPurposes = ['register', 'login', 'reset_password', 'consent_grant'];
    const normalizedPurpose = validPurposes.includes(purpose) ? purpose : 'login';
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await query(
      `INSERT INTO otp_verifications (mobile, otp_code, purpose, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [mobile, otpCode, normalizedPurpose, expiresAt]
    );

    return {
      mobile,
      purpose: normalizedPurpose,
      expires_in_seconds: 600,
      dev_otp: otpCode,
    };
  }

  /**
   * Registers a user, assigns their role, creates a Patient Health ID if patient, and issues JWT tokens.
   */
  static async register(payload, meta = {}) {
    const {
      mobile,
      email,
      password,
      full_name,
      nid_number,
      role = 'patient',
      date_of_birth,
      gender,
      blood_group,
      emergency_contact,
    } = payload;

    if (!mobile || !full_name || !password) {
      throw createHttpError('mobile, full_name, and password are required', 400);
    }

    const existing = await query(
      'SELECT id FROM users WHERE mobile = $1 OR ($2::text IS NOT NULL AND email = $2)',
      [mobile, email || null]
    );
    if (existing.rowCount > 0) {
      throw createHttpError('A user with this mobile number or email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const userRes = await query(
      `INSERT INTO users (mobile, email, password_hash, full_name, nid_number, is_mobile_verified, is_nid_verified)
       VALUES ($1, $2, $3, $4, $5, FALSE, $6)
       RETURNING id`,
      [mobile, email || null, passwordHash, full_name, nid_number || null, Boolean(nid_number)]
    );
    const userId = userRes.rows[0].id;

    // Assign role in user_roles (default to patient)
    const allowedSelfRegisterRoles = ['patient', 'caregiver'];
    const targetRole = allowedSelfRegisterRoles.includes(role) ? role : 'patient';

    await query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE code = $2
       ON CONFLICT DO NOTHING`,
      [userId, targetRole]
    );

    // Ensure patient record with unique Platform Health ID (FR-1.2)
    if (targetRole === 'patient') {
      const existingPatient = await query('SELECT id FROM patients WHERE mobile = $1', [mobile]);
      if (existingPatient.rowCount > 0) {
        await query('UPDATE patients SET user_id = $1 WHERE id = $2', [
          userId,
          existingPatient.rows[0].id,
        ]);
      } else {
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const healthId = `BD-UHP-${new Date().getFullYear()}-${randomSuffix}`;
        await query(
          `INSERT INTO patients (user_id, health_id, full_name, mobile, date_of_birth, gender, blood_group, emergency_contact)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            userId,
            healthId,
            full_name,
            mobile,
            date_of_birth || null,
            gender || null,
            blood_group || null,
            emergency_contact || null,
          ]
        );
      }
    }

    const otpInfo = await this.sendOtp({ mobile, purpose: 'register' });
    const userContext = await this.buildUserContext(userId, targetRole);
    const tokens = await this.issueTokens(userContext, meta);

    return {
      ...tokens,
      dev_otp: otpInfo.dev_otp,
      user: userContext,
    };
  }

  /**
   * Verifies a mobile OTP and issues JWT tokens (FR-1.1, FR-1.2).
   * Supports both verifying an existing account and passwordless mobile OTP registration.
   */
  static async verifyOtp({ mobile, otp_code, full_name }, meta = {}) {
    if (!mobile || !otp_code) {
      throw createHttpError('mobile and otp_code are required', 400);
    }

    const otpRes = await query(
      `SELECT id, purpose
       FROM otp_verifications
       WHERE mobile = $1
         AND otp_code = $2
         AND is_used = FALSE
         AND expires_at > NOW()
       ORDER BY id DESC
       LIMIT 1`,
      [mobile, String(otp_code)]
    );

    if (otpRes.rowCount === 0) {
      throw createHttpError('Invalid or expired OTP code', 400);
    }

    await query('UPDATE otp_verifications SET is_used = TRUE WHERE id = $1', [otpRes.rows[0].id]);

    // Check if user exists; if not, create patient account automatically (FR-1.1)
    let userRes = await query('SELECT id FROM users WHERE mobile = $1', [mobile]);
    let userId;

    if (userRes.rowCount === 0) {
      const displayName = full_name || `Patient (${mobile.slice(-4)})`;
      const createdUser = await query(
        `INSERT INTO users (mobile, full_name, is_mobile_verified)
         VALUES ($1, $2, TRUE)
         RETURNING id`,
        [mobile, displayName]
      );
      userId = createdUser.rows[0].id;

      await query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE code = 'patient'
         ON CONFLICT DO NOTHING`,
        [userId]
      );

      const existingPatient = await query('SELECT id FROM patients WHERE mobile = $1', [mobile]);
      if (existingPatient.rowCount > 0) {
        await query('UPDATE patients SET user_id = $1 WHERE id = $2', [
          userId,
          existingPatient.rows[0].id,
        ]);
      } else {
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const healthId = `BD-UHP-${new Date().getFullYear()}-${randomSuffix}`;
        await query(
          `INSERT INTO patients (user_id, health_id, full_name, mobile)
           VALUES ($1, $2, $3, $4)`,
          [userId, healthId, displayName, mobile]
        );
      }
    } else {
      userId = userRes.rows[0].id;
      await query('UPDATE users SET is_mobile_verified = TRUE, updated_at = NOW() WHERE id = $1', [
        userId,
      ]);
    }

    const userContext = await this.buildUserContext(userId);
    const tokens = await this.issueTokens(userContext, meta);

    return {
      ...tokens,
      user: userContext,
    };
  }

  /**
   * Standard password login by mobile or email, with optional active_role and provider_id selection.
   */
  static async login({ mobile, email, password, active_role, provider_id }, meta = {}) {
    if ((!mobile && !email) || !password) {
      throw createHttpError('mobile (or email) and password are required', 400);
    }

    const userRes = await query(
      `SELECT id, password_hash, is_active
       FROM users
       WHERE ($1::text IS NOT NULL AND mobile = $1)
          OR ($2::text IS NOT NULL AND email = $2)
       LIMIT 1`,
      [mobile || null, email || null]
    );

    if (userRes.rowCount === 0) {
      throw createHttpError('Invalid credentials', 401);
    }

    const user = userRes.rows[0];
    if (!user.password_hash) {
      throw createHttpError(
        'This account uses mobile OTP login. Please request an OTP or set a password.',
        401
      );
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw createHttpError('Invalid credentials', 401);
    }

    const userContext = await this.buildUserContext(user.id, active_role, provider_id);
    const tokens = await this.issueTokens(userContext, meta);

    return {
      ...tokens,
      user: userContext,
    };
  }

  /**
   * Exchanges a valid refreshToken for a new accessToken and rotated refreshToken.
   */
  static async refreshSession({ refreshToken }, meta = {}) {
    if (!refreshToken) {
      throw createHttpError('refreshToken is required', 400);
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, env.jwt.refreshSecret);
    } catch {
      throw createHttpError('Invalid or expired refresh token', 401);
    }

    const refreshHash = hashToken(refreshToken);
    const sessionRes = await query(
      `SELECT id, user_id, active_role, active_provider_id
       FROM auth_sessions
       WHERE refresh_token_hash = $1
         AND is_revoked = FALSE
         AND expires_at > NOW()
       LIMIT 1`,
      [refreshHash]
    );

    if (sessionRes.rowCount === 0) {
      throw createHttpError('Refresh session is revoked or expired', 401);
    }

    const session = sessionRes.rows[0];
    await query('UPDATE auth_sessions SET is_revoked = TRUE WHERE id = $1', [session.id]);

    const userContext = await this.buildUserContext(
      session.user_id,
      session.active_role || decoded.role,
      session.active_provider_id || decoded.providerId
    );
    const tokens = await this.issueTokens(userContext, meta);

    return {
      ...tokens,
      user: userContext,
    };
  }

  /**
   * Switches active role and/or provider workspace tenant for a multi-role user (FR-1.4, FR-6.4).
   */
  static async switchContext(userId, { role, provider_id }, meta = {}) {
    if (!role && !provider_id) {
      throw createHttpError('Provide role and/or provider_id to switch context', 400);
    }
    const userContext = await this.buildUserContext(userId, role, provider_id);
    const tokens = await this.issueTokens(userContext, meta);
    return {
      ...tokens,
      user: userContext,
    };
  }

  /**
   * Updates user password.
   */
  static async changePassword(userId, { current_password, new_password }) {
    if (!new_password || new_password.length < 6) {
      throw createHttpError('new_password must be at least 6 characters', 400);
    }

    const userRes = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (userRes.rowCount === 0) {
      throw createHttpError('User not found', 404);
    }

    const existingHash = userRes.rows[0].password_hash;
    if (existingHash) {
      if (!current_password) {
        throw createHttpError('current_password is required', 400);
      }
      const valid = await bcrypt.compare(current_password, existingHash);
      if (!valid) {
        throw createHttpError('Current password is incorrect', 401);
      }
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      newHash,
      userId,
    ]);

    return { password_updated: true };
  }

  /**
   * Sets or verifies a 4-6 digit app PIN lock (FR-1.5).
   */
  static async managePin(userId, { action = 'set', pin }) {
    if (!pin || !/^\d{4,6}$/.test(String(pin))) {
      throw createHttpError('pin must be a 4 to 6 digit number', 400);
    }

    if (action === 'set') {
      const pinHash = await bcrypt.hash(String(pin), 10);
      await query('UPDATE users SET pin_hash = $1, updated_at = NOW() WHERE id = $2', [
        pinHash,
        userId,
      ]);
      return { pin_configured: true };
    }

    if (action === 'verify') {
      const userRes = await query('SELECT pin_hash FROM users WHERE id = $1', [userId]);
      const pinHash = userRes.rows[0]?.pin_hash;
      if (!pinHash) {
        throw createHttpError('No PIN lock is configured for this account', 400);
      }
      const isMatch = await bcrypt.compare(String(pin), pinHash);
      if (!isMatch) {
        throw createHttpError('Invalid PIN', 401);
      }
      return { pin_verified: true };
    }

    throw createHttpError('action must be "set" or "verify"', 400);
  }

  /**
   * Creates or assigns a staff user to a provider tenant workspace (FR-6.4).
   */
  static async assignProviderStaff({ provider_id, mobile, email, full_name, password, role_code }) {
    if (!provider_id || !mobile || !role_code) {
      throw createHttpError('provider_id, mobile, and role_code are required', 400);
    }

    const validStaffRoles = [
      'provider_admin',
      'doctor',
      'receptionist',
      'lab_tech',
      'billing_staff',
    ];
    if (!validStaffRoles.includes(role_code)) {
      throw createHttpError(
        `role_code must be one of: ${validStaffRoles.join(', ')}`,
        400
      );
    }

    const roleRes = await query('SELECT id FROM roles WHERE code = $1', [role_code]);
    if (roleRes.rowCount === 0) {
      throw createHttpError(`Role "${role_code}" not found in database`, 404);
    }
    const roleId = roleRes.rows[0].id;

    let userRes = await query('SELECT id FROM users WHERE mobile = $1', [mobile]);
    let userId;
    if (userRes.rowCount === 0) {
      if (!full_name) {
        throw createHttpError('full_name is required when creating a new staff user', 400);
      }
      const passwordHash = password ? await bcrypt.hash(password, 10) : null;
      const created = await query(
        `INSERT INTO users (mobile, email, password_hash, full_name, is_mobile_verified)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id`,
        [mobile, email || null, passwordHash, full_name]
      );
      userId = created.rows[0].id;
    } else {
      userId = userRes.rows[0].id;
    }

    await query(
      `INSERT INTO provider_staff (provider_id, user_id, role_id, is_active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (provider_id, user_id, role_id)
       DO UPDATE SET is_active = TRUE`,
      [provider_id, userId, roleId]
    );

    return this.buildUserContext(userId, role_code, provider_id);
  }

  /**
   * Logs out by revoking the current refresh token or all active sessions for the user.
   */
  static async logout(userId, { refreshToken, all_devices = false }) {
    if (all_devices) {
      const res = await query(
        'UPDATE auth_sessions SET is_revoked = TRUE WHERE user_id = $1 AND is_revoked = FALSE',
        [userId]
      );
      return { revoked_sessions: res.rowCount, all_devices: true };
    }

    if (refreshToken) {
      const refreshHash = hashToken(refreshToken);
      const res = await query(
        'UPDATE auth_sessions SET is_revoked = TRUE WHERE user_id = $1 AND refresh_token_hash = $2',
        [userId, refreshHash]
      );
      return { revoked_sessions: res.rowCount, all_devices: false };
    }

    const res = await query(
      'UPDATE auth_sessions SET is_revoked = TRUE WHERE user_id = $1 AND is_revoked = FALSE',
      [userId]
    );
    return { revoked_sessions: res.rowCount, all_devices: true };
  }

  /**
   * Lists active and recent sessions for the user (Section 7.3 remote session revoke).
   */
  static async listSessions(userId) {
    const { rows } = await query(
      `SELECT id, active_role, active_provider_id, user_agent, ip_address, is_revoked, expires_at, created_at
       FROM auth_sessions
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 20`,
      [userId]
    );
    return rows;
  }

  /**
   * Revokes a specific session by ID for the authenticated user.
   */
  static async revokeSession(userId, sessionId) {
    const res = await query(
      `UPDATE auth_sessions
       SET is_revoked = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING id, active_role, is_revoked`,
      [sessionId, userId]
    );
    if (res.rowCount === 0) {
      throw createHttpError('Session not found', 404);
    }
    return res.rows[0];
  }
}

module.exports = AuthService;
