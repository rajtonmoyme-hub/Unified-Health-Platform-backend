const ProviderService = require('./provider.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const getProviders = asyncHandler(async (req, res) => {
  const providers = await ProviderService.getAllProviders();
  return ApiResponse.success(res, providers, 'Providers retrieved successfully');
});

const registerProvider = asyncHandler(async (req, res) => {
  const { name, provider_type, license_number, district, address } = req.body;
  if (!name || !provider_type || !license_number || !district || !address) {
    return ApiResponse.error(res, 'name, provider_type, license_number, district, and address are required', 400);
  }
  const created = await ProviderService.createProvider(req.body);
  return ApiResponse.success(res, created, 'Provider registered successfully', 201);
});

module.exports = {
  getProviders,
  registerProvider,
};

