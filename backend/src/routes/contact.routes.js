const express = require('express');

const {
  addContact,
  getContacts,
  updateContact,
  deleteContact
} = require('../controllers/contact.controller');

const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect);

router.post('/', addContact);
router.get('/', getContacts);
router.patch('/:id', updateContact);
router.delete('/:id', deleteContact);

module.exports = router;