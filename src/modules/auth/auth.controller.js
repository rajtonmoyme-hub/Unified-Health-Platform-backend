const AuthService = require('./auth.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

function getRequestMeta(req) {
  return {
    userAgent: req.headers['user-agent'] || null,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
  };
}

const register = asyncHandler(async (req, res) => {
  const result = await AuthService.register(req.body, getRequestMeta(req));
  return ApiResponse.success(
    res,
    result,
    'User registered successfully with JWT tokens and OTP verification code',
    201
  );
});

const sendOtp = asyncHandler(async (req, res) => {
  const result = await AuthService.sendOtp(req.body);
  return ApiResponse.success(res, result, 'OTP code generated and sent successfully');
});

const verifyOtp = asyncHandler(async (req, res) => {
  const result = await AuthService.verifyOtp(req.body, getRequestMeta(req));
  return ApiResponse.success(res, result, 'Mobile OTP verified and JWT tokens issued');
});

const login = asyncHandler(async (req, res) => {
  const result = await AuthService.login(req.body, getRequestMeta(req));
  return ApiResponse.success(res, result, 'Authenticated successfully');
});

const refresh = asyncHandler(async (req, res) => {
  const result = await AuthService.refreshSession(req.body, getRequestMeta(req));
  return ApiResponse.success(res, result, 'Access token refreshed successfully');
});

const getMe = asyncHandler(async (req, res) => {
  const userContext = await AuthService.buildUserContext(
    req.user.id,
    req.user.role,
    req.user.providerId
  );
  return ApiResponse.success(
    res,
    {
      jwt_claims: req.user,
      user: userContext,
    },
    'Authenticated user profile retrieved'
  );
});

const switchContext = asyncHandler(async (req, res) => {
  const result = await AuthService.switchContext(req.user.id, req.body, getRequestMeta(req));
  return ApiResponse.success(
    res,
    result,
    'Switched active role / provider workspace context successfully'
  );
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await AuthService.changePassword(req.user.id, req.body);
  return ApiResponse.success(res, result, 'Password updated successfully');
});

const managePin = asyncHandler(async (req, res) => {
  const result = await AuthService.managePin(req.user.id, req.body);
  const message =
    req.body.action === 'verify' ? 'PIN verified successfully' : 'PIN lock configured successfully';
  return ApiResponse.success(res, result, message);
});

const assignStaff = asyncHandler(async (req, res) => {
  const providerId = req.body.provider_id || req.providerId;
  const result = await AuthService.assignProviderStaff({
    ...req.body,
    provider_id: providerId,
  });
  return ApiResponse.success(res, result, 'Staff user assigned to provider workspace', 201);
});

const logout = asyncHandler(async (req, res) => {
  const result = await AuthService.logout(req.user.id, req.body || {});
  return ApiResponse.success(res, result, 'Logged out and session revoked');
});

const listSessions = asyncHandler(async (req, res) => {
  const sessions = await AuthService.listSessions(req.user.id);
  return ApiResponse.success(res, sessions, 'Active and recent sessions retrieved');
});

const revokeSession = asyncHandler(async (req, res) => {
  const revoked = await AuthService.revokeSession(req.user.id, Number(req.params.sessionId));
  return ApiResponse.success(res, revoked, 'Session revoked remotely');
});

module.exports = {
  register,
  sendOtp,
  verifyOtp,
  login,
  refresh,
  getMe,
  switchContext,
  changePassword,
  managePin,
  assignStaff,
  logout,
  listSessions,
  revokeSession,
};
