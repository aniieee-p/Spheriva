/**
 * Trusted Contacts Screen
 * Lists, adds, edits and deletes the user's trusted contacts (maximum 3).
 * Data comes from the backend (/emergency/contacts).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api.service';
import { validateName, validatePhone } from '../utils/validation';

const MAX_CONTACTS = 3;
const RELATIONSHIPS = ['Family', 'Friend', 'Parent', 'Sibling', 'Partner', 'Other'];
const EMPTY_FORM = { name: '', phoneNumber: '', relationship: 'Family' };

const inputClass = (hasError) =>
  `w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
    hasError ? 'border-red-500' : 'border-gray-300'
  }`;

const TrustedContactsScreen = () => {
  const navigate = useNavigate();

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null); // { type: 'error' | 'success', text }
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const limitReached = contacts.length >= MAX_CONTACTS;

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await apiService.getEmergencyContacts();
      setContacts(response.data?.contacts || []);
    } catch (error) {
      setLoadError(error.message || 'Could not load contacts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setEditingId(null);
    setShowForm(false);
  };

  const openAdd = () => {
    setBanner(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (contact) => {
    setBanner(null);
    setForm({
      name: contact.name,
      phoneNumber: contact.phoneNumber,
      relationship: contact.relationship || 'Family',
    });
    setErrors({});
    setEditingId(contact._id);
    setShowForm(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const phone = form.phoneNumber.trim();
    const newErrors = {
      name: validateName(form.name),
      phoneNumber: validatePhone(form.phoneNumber),
    };
    if (
      !newErrors.phoneNumber &&
      contacts.some((c) => c.phoneNumber === phone && c._id !== editingId)
    ) {
      newErrors.phoneNumber = 'This number is already in your contacts';
    }
    setErrors(newErrors);
    if (newErrors.name || newErrors.phoneNumber) return;

    const payload = {
      name: form.name.trim(),
      phoneNumber: phone,
      relationship: form.relationship,
    };

    setSaving(true);
    setBanner(null);
    try {
      if (editingId) {
        const response = await apiService.updateEmergencyContact(editingId, payload);
        const updated = response.data.contact;
        setContacts((prev) => prev.map((c) => (c._id === editingId ? updated : c)));
        setBanner({ type: 'success', text: 'Contact updated' });
      } else {
        const response = await apiService.addEmergencyContact(payload);
        setContacts((prev) => [...prev, response.data.contact]);
        setBanner({ type: 'success', text: 'Contact added' });
      }
      resetForm();
    } catch (error) {
      setBanner({ type: 'error', text: error.message || 'Could not save contact.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contact) => {
    if (!window.confirm(`Remove ${contact.name} from your trusted contacts?`)) return;

    setDeletingId(contact._id);
    setBanner(null);
    try {
      await apiService.deleteEmergencyContact(contact._id);
      setContacts((prev) => prev.filter((c) => c._id !== contact._id));
      if (editingId === contact._id) resetForm();
      setBanner({ type: 'success', text: 'Contact removed' });
    } catch (error) {
      setBanner({ type: 'error', text: error.message || 'Could not remove contact.' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
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
            <h1 className="text-2xl font-bold">Trusted Contacts</h1>
            <p className="text-sm opacity-90">People who can help you in an emergency</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6">
        {banner && (
          <div
            role={banner.type === 'error' ? 'alert' : 'status'}
            className={`mb-4 p-3 rounded-lg text-sm border ${
              banner.type === 'error'
                ? 'bg-red-100 border-red-400 text-red-700'
                : 'bg-green-100 border-green-400 text-green-700'
            }`}
          >
            {banner.text}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-md p-5 mb-5">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Your Safety Network</h2>
          <p className="text-sm text-gray-600">
            Add up to {MAX_CONTACTS} people you trust. They can be contacted during an
            emergency once the emergency alert feature is connected.
          </p>

          <div className="mt-4 flex justify-between items-center">
            <span className="text-sm text-gray-600">
              Contacts:{' '}
              <strong>
                {contacts.length}/{MAX_CONTACTS}
              </strong>
            </span>
            <button
              onClick={openAdd}
              disabled={limitReached || loading || showForm}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium"
            >
              + Add Contact
            </button>
          </div>
          {limitReached && !showForm && (
            <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              You have reached the maximum of {MAX_CONTACTS} contacts. Remove one to add
              a new contact.
            </p>
          )}
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="bg-white rounded-xl shadow-md p-5 mb-5"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editingId ? 'Edit Contact' : 'Add New Contact'}
            </h2>

            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Enter contact name"
                disabled={saving}
                className={inputClass(errors.name)}
              />
              {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
            </div>

            <div className="mb-4">
              <label
                htmlFor="phoneNumber"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Phone Number
              </label>
              <input
                id="phoneNumber"
                type="tel"
                name="phoneNumber"
                value={form.phoneNumber}
                onChange={handleChange}
                maxLength={10}
                placeholder="10-digit mobile number"
                disabled={saving}
                className={inputClass(errors.phoneNumber)}
              />
              {errors.phoneNumber && (
                <p className="text-red-600 text-sm mt-1">{errors.phoneNumber}</p>
              )}
            </div>

            <div className="mb-5">
              <label
                htmlFor="relationship"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Relationship
              </label>
              <select
                id="relationship"
                name="relationship"
                value={form.relationship}
                onChange={handleChange}
                disabled={saving}
                className={inputClass(false)}
              >
                {RELATIONSHIPS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold"
              >
                {saving ? 'Saving...' : editingId ? 'Update Contact' : 'Save Contact'}
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

        <section className="bg-white rounded-xl shadow-md p-5">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Saved Contacts</h2>

          {loading ? (
            <div className="text-center py-10 text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
              <p className="mt-3 text-sm">Loading contacts...</p>
            </div>
          ) : loadError ? (
            <div className="text-center py-8">
              <p className="text-red-600 text-sm mb-3">{loadError}</p>
              <button
                onClick={loadContacts}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
              >
                Try again
              </button>
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-5xl mb-3">👥</div>
              <h3 className="font-semibold text-gray-700">No trusted contacts yet</h3>
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
                    <h3 className="font-semibold text-gray-800">{contact.name}</h3>
                    <p className="text-sm text-gray-600">{contact.phoneNumber}</p>
                    <span className="inline-block mt-2 text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                      {contact.relationship}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(contact)}
                      disabled={deletingId === contact._id}
                      className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(contact)}
                      disabled={deletingId === contact._id}
                      className="px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 text-sm font-medium"
                    >
                      {deletingId === contact._id ? 'Removing...' : 'Delete'}
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
