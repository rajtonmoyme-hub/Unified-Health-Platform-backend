const PricingService = require('./pricing.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const comparePrices = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const items = await PricingService.compareTestPrices(q);
  return ApiResponse.success(res, items, 'Cross-provider test prices retrieved successfully');
});

module.exports = {
  comparePrices,
};

