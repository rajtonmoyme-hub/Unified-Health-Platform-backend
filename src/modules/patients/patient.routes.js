const express = require('express');
const patientController = require('./patient.controller');

const router = express.Router();

router.get('/', patientController.getPatients);
router.get('/:healthId', patientController.getPatientByHealthId);
router.post('/', patientController.registerPatient);

module.exports = router;

