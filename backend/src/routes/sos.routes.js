const express = require('express');

const {
  createSOS,
  getActiveSOS,
  acknowledgeSOS,
  resolveSOS,
  cancelSOS
} = require('../controllers/sos.controller');

const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect);

router.post('/', createSOS);
router.get('/active', getActiveSOS);
router.patch('/:id/acknowledge', acknowledgeSOS);
router.patch('/:id/resolve', resolveSOS);
router.patch('/:id/cancel', cancelSOS);

module.exports = router;