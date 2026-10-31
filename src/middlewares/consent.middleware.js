const { query } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');

/**
 * Verifies that the requesting provider has active patient consent before reading patient records.
 */
async function requirePatientConsent(req, res, next) {
  const providerId = req.headers['x-provider-id'];
  const patientId = req.params.patientId || req.query.patientId;

  if (!providerId || !patientId) {
    return next();
  }

  try {
    const result = await query(
      `SELECT id, allowed_categories, expires_at
       FROM consents
       WHERE patient_id = $1
         AND provider_id = $2
         AND status = 'active'
         AND expires_at > NOW()
       LIMIT 1`,
      [patientId, providerId]
    );

    if (result.rowCount === 0) {
      return ApiResponse.error(
        res,
        'Access denied: No active patient consent for this provider',
        403
      );
    }

    req.consent = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requirePatientConsent,
};

