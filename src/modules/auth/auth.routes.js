const express = require('express');
const authController = require('./auth.controller');
const { authenticateJWT, requireRole } = require('../../middlewares/auth.middleware');

const router = express.Router();

// Public Auth Routes
router.post('/register', authController.register);
router.post('/otp/send', authController.sendOtp);
router.post('/otp/verify', authController.verifyOtp);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);

// Protected Auth Routes (Requires Bearer JWT)
router.get('/me', authenticateJWT, authController.getMe);
router.post('/switch-context', authenticateJWT, authController.switchContext);
router.put('/password', authenticateJWT, authController.changePassword);
router.post('/pin', authenticateJWT, authController.managePin);
router.post('/logout', authenticateJWT, authController.logout);
router.get('/sessions', authenticateJWT, authController.listSessions);
router.delete('/sessions/:sessionId', authenticateJWT, authController.revokeSession);

// Provider Admin / Platform Admin Staff Assignment (FR-6.4)
router.post(
  '/staff/assign',
  authenticateJWT,
  requireRole('provider_admin', 'platform_admin'),
  authController.assignStaff
);

module.exports = router;
