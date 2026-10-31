const express = require('express');
const { query } = require('../../config/db');
const ApiResponse = require('../../utils/apiResponse');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM providers WHERE is_verified = true) AS providers_count,
         (SELECT COUNT(*)::int FROM doctors WHERE is_verified = true) AS doctors_count,
         (SELECT COUNT(*)::int FROM patients) AS patients_count`
    );

    return ApiResponse.success(
      res,
      {
        status: 'ok',
        ...result.rows[0],
      },
      'Service is operational'
    );
  } catch (error) {
    return ApiResponse.error(res, 'Service temporarily unavailable', 503);
  }
});

module.exports = router;
