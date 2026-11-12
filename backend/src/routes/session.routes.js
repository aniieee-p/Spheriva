const express = require('express');
const {
  createSession,
  getActiveSession,
  updateLocation,
  endSession
} = require('../controllers/session.controller');
const { protect } = require('../middleware/auth.middleware');
const { getSessionHistory } = require('../controllers/sessionHistory.controller');

const router = express.Router();

router.use(protect);

router.get('/', getSessionHistory);
router.get('/active', getActiveSession);
router.post('/', createSession);
router.post('/:id/location', updateLocation);
router.patch('/:id/end', endSession);
router.post('/:id/end', endSession);

module.exports = router;
