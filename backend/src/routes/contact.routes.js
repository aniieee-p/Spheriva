const express = require('express');

const {
  addContact,
  getContacts,
  getContact,
  updateContact,
  deleteContact
} = require('../controllers/contact.controller');

const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect);

router.post('/', addContact);
router.get('/', getContacts);
router.get('/:id', getContact);
router.patch('/:id', updateContact);
router.delete('/:id', deleteContact);

module.exports = router;