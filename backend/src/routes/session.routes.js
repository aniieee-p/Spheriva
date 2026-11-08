const express = require('express');
const {
  createSession,
  updateLocation,
  endSession
} = require('../controllers/session.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect);

router.post('/', createSession);
router.post('/:id/location', updateLocation);
router.patch('/:id/end', endSession);
router.post('/:id/end', endSession);

module.exports = router;
