const express = require('express');
const providerController = require('./provider.controller');

const router = express.Router();

router.get('/', providerController.getProviders);
router.post('/', providerController.registerProvider);

module.exports = router;

