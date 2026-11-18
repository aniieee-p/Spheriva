
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api.service';

const TrustedContactsScreen = () => {
  const navigate = useNavigate();
  const MAX_CONTACTS = 3;

  const [contacts, setContacts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    relationship: 'Family',
  });

  // Load contacts from backend
  useEffect(() => {
    const loadContacts = async () => {
      try {
        setLoading(true);
        setApiError('');

        const response = await apiService.getEmergencyContacts();
        setContacts(response?.data?.contacts || []);
      } catch (error) {
        console.error('Error loading trusted contacts:', error);
        setApiError(error.message || 'Unable to load contacts.');
      } finally {
        setLoading(false);
      }
    };

    loadContacts();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: '',
      general: '',
    }));

    setApiError('');
  };

  // Form validation
  const validateForm = () => {
    const newErrors = {};

    const name = formData.name.trim();
    const phone = formData.phoneNumber.trim();

    if (!name) {
      newErrors.name = 'Name is required';
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      newErrors.phoneNumber =
        'Enter a valid 10-digit Indian mobile number';
    } else {
      const isDuplicate = contacts.some(
        (contact) =>
          contact.phoneNumber.trim() === phone &&
          contact._id !== editingId
      );

      if (isDuplicate) {
        newErrors.phoneNumber =
          'This phone number is already added';
      }
    }

    if (
      editingId === null &&
      contacts.length >= MAX_CONTACTS
    ) {
      newErrors.general =
        'You can add a maximum of 3 trusted contacts';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Add or update contact
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const contactData = {
      name: formData.name.trim(),
      phoneNumber: formData.phoneNumber.trim(),
      relationship: formData.relationship,
    };

    try {
      setSaving(true);
      setApiError('');

      if (editingId !== null) {
        const response = await apiService.updateEmergencyContact(
          editingId,
          contactData
        );

        const updatedContact = response?.data?.contact;

        if (!updatedContact) {
          throw new Error('Updated contact was not returned by server.');
        }

        setContacts((prev) =>
          prev.map((contact) =>
            contact._id === editingId ? updatedContact : contact
          )
        );
      } else {
        const response = await apiService.addEmergencyContact(contactData);
        const newContact = response?.data?.contact;

        if (!newContact) {
          throw new Error('New contact was not returned by server.');
        }

        setContacts((prev) => [...prev, newContact]);
      }

      resetForm();
    } catch (error) {
      console.error('Error saving contact:', error);
      setApiError(error.message || 'Unable to save contact.');
    } finally {
      setSaving(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      phoneNumber: '',
      relationship: 'Family',
    });

    setErrors({});
    setEditingId(null);
    setShowForm(false);
  };

  // Open add contact form
  const handleAdd = () => {
    if (contacts.length >= MAX_CONTACTS || loading) return;

    setEditingId(null);
    setFormData({
      name: '',
      phoneNumber: '',
      relationship: 'Family',
    });

    setErrors({});
    setApiError('');
    setShowForm(true);
  };

  // Edit contact
  const handleEdit = (contact) => {
    setFormData({
      name: contact.name,
      phoneNumber: contact.phoneNumber,
      relationship: contact.relationship,
    });

    setEditingId(contact._id);
    setErrors({});
    setApiError('');
    setShowForm(true);
  };

  // Delete contact
  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this contact?'
    );

    if (!confirmed) return;

    try {
      setApiError('');

      await apiService.deleteEmergencyContact(id);

      setContacts((prev) =>
        prev.filter((contact) => contact._id !== id)
      );

      if (editingId === id) {
        resetForm();
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      setApiError(error.message || 'Unable to delete contact.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate('/home')}
            className="text-2xl hover:bg-white/20 rounded-lg px-3 py-1"
            aria-label="Go back"
          >
            ←
          </button>

          <div>
            <h1 className="text-2xl font-bold">
              Trusted Contacts
            </h1>
            <p className="text-sm opacity-90">
              People who can help you in an emergency
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6">

        {/* API Error */}
        {apiError && (
          <div className="bg-red-100 border border-red-300 text-red-700 rounded-lg p-3 mb-5">
            {apiError}
          </div>
        )}

        {/* Safety Network */}
        <div className="bg-white rounded-xl shadow-md p-5 mb-5">
          <h2 className="text-lg font-bold text-gray-800 mb-2">
            Your Safety Network
          </h2>

          <p className="text-sm text-gray-600">
            Add people you trust. They can be contacted during an
            emergency once the emergency alert feature is connected.
          </p>

          <div className="mt-4 flex justify-between items-center gap-3">
            <span className="text-sm text-gray-600">
              Total contacts:{' '}
              <strong>{contacts.length}/{MAX_CONTACTS}</strong>
            </span>

            <button
              onClick={handleAdd}
              disabled={contacts.length >= MAX_CONTACTS || loading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium"
            >
              {contacts.length >= MAX_CONTACTS
                ? 'Maximum 3 Reached'
                : '+ Add Contact'}
            </button>
          </div>
        </div>

        {/* Add / Edit Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl shadow-md p-5 mb-5"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editingId !== null ? 'Edit Contact' : 'Add New Contact'}
            </h2>

            {errors.general && (
              <p className="text-red-600 text-sm mb-3">
                {errors.general}
              </p>
            )}

            {/* Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>

              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter contact name"
                className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />

              {errors.name && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.name}
                </p>
              )}
            </div>

            {/* Phone Number */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>

              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                maxLength={10}
                placeholder="10-digit mobile number"
                className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />

              {errors.phoneNumber && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.phoneNumber}
                </p>
              )}
            </div>

            {/* Relationship */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Relationship
              </label>

              <select
                name="relationship"
                value={formData.relationship}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option>Family</option>
                <option>Friend</option>
                <option>Parent</option>
                <option>Sibling</option>
                <option>Partner</option>
                <option>Other</option>
              </select>
            </div>

            {/* Form Buttons */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold"
              >
                {saving
                  ? 'Please wait...'
                  : editingId !== null
                    ? 'Update Contact'
                    : 'Save Contact'}
              </button>

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Saved Contacts */}
        <section className="bg-white rounded-xl shadow-md p-5">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Saved Contacts
          </h2>

          {loading ? (
            <p className="text-center text-gray-500 py-8">
              Loading contacts...
            </p>
          ) : contacts.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-5xl mb-3">👥</div>

              <h3 className="font-semibold text-gray-700">
                No trusted contacts yet
              </h3>

              <p className="text-sm text-gray-500 mt-2">
                Add your first trusted contact to build your safety network.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div
                  key={contact._id}
                  className="border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {contact.name}
                    </h3>

                    <p className="text-sm text-gray-600">
                      {contact.phoneNumber}
                    </p>

                    <span className="inline-block mt-2 text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                      {contact.relationship}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(contact)}
                      className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-medium"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleDelete(contact._id)}
                      className="px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
};

export default TrustedContactsScreen;
