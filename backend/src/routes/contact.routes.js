const express = require('express');
const router = express.Router();
const {
  getContacts,
  addContact,
  updateContact,
  deleteContact
} = require('../controllers/contact.controller');
const { protect } = require('../middleware/auth.middleware');

// Saare contact routes protected hain
router.use(protect);

router.route('/')
  .get(getContacts)
  .post(addContact);

router.route('/:id')
  .put(updateContact)
  .delete(deleteContact);

module.exports = router;
