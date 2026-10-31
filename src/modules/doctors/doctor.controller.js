const DoctorService = require('./doctor.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const getDoctors = asyncHandler(async (req, res) => {
  const { specialty, district } = req.query;
  const doctors = await DoctorService.getDoctorDirectory({ specialty, district });
  return ApiResponse.success(res, doctors, 'Doctor directory retrieved successfully');
});

module.exports = {
  getDoctors,
};

