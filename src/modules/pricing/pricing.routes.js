const express = require('express');
const pricingController = require('./pricing.controller');

const router = express.Router();

router.get('/', pricingController.comparePrices);

module.exports = router;

