const express = require('express');
const router = express.Router();
const {
  startSession,
  getSessions,
  getSession,
  addLocation,
  endSession
} = require('../controllers/session.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.route('/')
  .post(startSession)
  .get(getSessions);

router.get('/:id', getSession);
router.post('/:id/location', addLocation);
router.put('/:id/end', endSession);

module.exports = router;