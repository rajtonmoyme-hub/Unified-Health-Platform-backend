const PatientService = require('./patient.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const getPatients = asyncHandler(async (req, res) => {
  const patients = await PatientService.getAllPatients();
  return ApiResponse.success(res, patients, 'Patients retrieved successfully');
});

const getPatientByHealthId = asyncHandler(async (req, res) => {
  const patient = await PatientService.getPatientByHealthId(req.params.healthId);
  if (!patient) {
    return ApiResponse.error(res, 'Patient not found', 404);
  }
  return ApiResponse.success(res, patient, 'Patient retrieved successfully');
});

const registerPatient = asyncHandler(async (req, res) => {
  const { full_name, mobile } = req.body;
  if (!full_name || !mobile) {
    return ApiResponse.error(res, 'full_name and mobile are required', 400);
  }
  const created = await PatientService.createPatient(req.body);
  return ApiResponse.success(res, created, 'Patient registered with unique Health ID', 201);
});

module.exports = {
  getPatients,
  getPatientByHealthId,
  registerPatient,
};

