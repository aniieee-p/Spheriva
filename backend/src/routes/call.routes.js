
const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth.middleware');

const {
  getCallingToken,
  resolveCallingContact,
  createCallingSession,
  endCallingSession
} = require('../controllers/call.controller');

// All calling endpoints require authentication
router.use(protect);

// Generate Stream calling token
router.get('/token', getCallingToken);

// Resolve registered trusted contact
router.post('/resolve', resolveCallingContact);

// Create real voice or video call
router.post('/', createCallingSession);

// End call for both participants
router.post('/end', endCallingSession);

module.exports = router;
