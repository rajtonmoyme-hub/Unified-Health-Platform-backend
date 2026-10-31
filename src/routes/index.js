const express = require('express');
const authRoutes = require('../modules/auth/auth.routes');
const healthRoutes = require('../modules/health/health.routes');
const patientRoutes = require('../modules/patients/patient.routes');
const providerRoutes = require('../modules/providers/provider.routes');
const doctorRoutes = require('../modules/doctors/doctor.routes');
const pricingRoutes = require('../modules/pricing/pricing.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/health', healthRoutes);
router.use('/patients', patientRoutes);
router.use('/providers', providerRoutes);
router.use('/doctors', doctorRoutes);
router.use('/pricing', pricingRoutes);

module.exports = router;
