const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth.middleware');
const { getCallingToken, resolveCallingContact, createCallingSession } = require('../controllers/call.controller');

// All calling endpoints require authentication
router.use(protect);

router.get('/token', getCallingToken);
router.post('/resolve', resolveCallingContact);
router.post('/', createCallingSession);

module.exports = router;
