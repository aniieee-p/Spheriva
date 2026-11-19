const TrustedContact = require('../models/TrustedContact.model');

const MAX_CONTACTS = 3;

// Mongoose / MongoDB ke errors ko saaf message me badalta hai
const handleError = (res, error, fallbackMessage) => {
  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ success: false, message });
  }
  if (error.name === 'CastError') {
    return res.status(404).json({ success: false, message: 'Contact not found' });
  }
  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'This phone number is already in your trusted contacts'
    });
  }
  console.error(error);
  return res.status(500).json({ success: false, message: fallbackMessage });
};

/**
 * @desc    Get all trusted contacts of the logged-in user
 * @route   GET /api/emergency/contacts
 * @access  Private
 */
const getContacts = async (req, res) => {
  try {
    const contacts = await TrustedContact.find({ user: req.user.id }).sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: contacts.length,
      data: { contacts }
    });
  } catch (error) {
    handleError(res, error, 'Server error while fetching contacts');
  }
};

/**
 * @desc    Add a trusted contact (maximum 3 per user)
 * @route   POST /api/emergency/contacts
 * @access  Private
 */
const addContact = async (req, res) => {
  try {
    const { name, relationship } = req.body;
    const phoneNumber =
      req.body.phoneNumber !== undefined ? String(req.body.phoneNumber).trim() : undefined;

    const count = await TrustedContact.countDocuments({ user: req.user.id });
    if (count >= MAX_CONTACTS) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_CONTACTS} trusted contacts allowed`
      });
    }

    if (phoneNumber) {
      const duplicate = await TrustedContact.findOne({ user: req.user.id, phoneNumber });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'This phone number is already in your trusted contacts'
        });
      }
    }

    const contact = await TrustedContact.create({
      user: req.user.id,
      name,
      phoneNumber,
      relationship
    });

    res.status(201).json({
      success: true,
      message: 'Trusted contact added successfully',
      data: { contact }
    });
  } catch (error) {
    handleError(res, error, 'Server error while adding contact');
  }
};

/**
 * @desc    Update a trusted contact
 * @route   PUT /api/emergency/contacts/:id
 * @access  Private
 */
const updateContact = async (req, res) => {
  try {
    const { name, relationship } = req.body;
    const phoneNumber =
      req.body.phoneNumber !== undefined ? String(req.body.phoneNumber).trim() : undefined;

    const contact = await TrustedContact.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    if (phoneNumber !== undefined && phoneNumber !== contact.phoneNumber) {
      const duplicate = await TrustedContact.findOne({
        user: req.user.id,
        phoneNumber,
        _id: { $ne: contact._id }
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'This phone number is already in your trusted contacts'
        });
      }
    }

    if (name !== undefined) contact.name = name;
    if (phoneNumber !== undefined) contact.phoneNumber = phoneNumber;
    if (relationship !== undefined) contact.relationship = relationship;

    await contact.save();

    res.status(200).json({
      success: true,
      message: 'Trusted contact updated successfully',
      data: { contact }
    });
  } catch (error) {
    handleError(res, error, 'Server error while updating contact');
  }
};

/**
 * @desc    Delete a trusted contact
 * @route   DELETE /api/emergency/contacts/:id
 * @access  Private
 */
const deleteContact = async (req, res) => {
  try {
    const contact = await TrustedContact.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Trusted contact deleted successfully'
    });
  } catch (error) {
    handleError(res, error, 'Server error while deleting contact');
  }
};

module.exports = {
  getContacts,
  addContact,
  updateContact,
  deleteContact
};
