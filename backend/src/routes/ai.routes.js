const express = require('express');

const {
  generateEmergencyMessage
} = require('../controllers/ai.controller');

const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect);

router.post('/emergency-message', generateEmergencyMessage);

module.exports = router;