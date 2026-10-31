const express = require('express');
const doctorController = require('./doctor.controller');

const router = express.Router();

router.get('/', doctorController.getDoctors);

module.exports = router;

