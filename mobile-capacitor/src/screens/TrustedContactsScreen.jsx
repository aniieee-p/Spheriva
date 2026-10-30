
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TrustedContactsScreen = () => {
  const navigate = useNavigate();

  const [contacts, setContacts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    relationship: 'Family',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!/^[6-9]\d{9}$/.test(formData.phoneNumber.trim())) {
      newErrors.phoneNumber = 'Enter a valid 10-digit phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (editingId !== null) {
      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === editingId
            ? { ...formData, id: editingId }
            : contact
        )
      );
    } else {
      setContacts((prev) => [
        ...prev,
        { ...formData, id: Date.now() },
      ]);
    }

    resetForm();
  };

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

  const handleEdit = (contact) => {
    setFormData({
      name: contact.name,
      phoneNumber: contact.phoneNumber,
      relationship: contact.relationship,
    });
    setEditingId(contact.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this contact?'
    );

    if (confirmed) {
      setContacts((prev) => prev.filter((contact) => contact.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
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
            <p className="text-sm opacity-90">
              People who can help you in an emergency
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-xl shadow-md p-5 mb-5">
          <h2 className="text-lg font-bold text-gray-800 mb-2">
            Your Safety Network
          </h2>
          <p className="text-sm text-gray-600">
            Add people you trust. They can be contacted during an emergency
            once the emergency alert feature is connected.
          </p>

          <div className="mt-4 flex justify-between items-center">
            <span className="text-sm text-gray-600">
              Total contacts: <strong>{contacts.length}</strong>
            </span>

            <button
              onClick={() => {
                setEditingId(null);
                setFormData({
                  name: '',
                  phoneNumber: '',
                  relationship: 'Family',
                });
                setErrors({});
                setShowForm(true);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              + Add Contact
            </button>
          </div>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl shadow-md p-5 mb-5"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editingId !== null ? 'Edit Contact' : 'Add New Contact'}
            </h2>

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
                <p className="text-red-600 text-sm mt-1">{errors.name}</p>
              )}
            </div>

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

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold"
              >
                {editingId !== null ? 'Update Contact' : 'Save Contact'}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <section className="bg-white rounded-xl shadow-md p-5">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Saved Contacts
          </h2>

          {contacts.length === 0 ? (
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
                  key={contact.id}
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
                      onClick={() => handleDelete(contact.id)}
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

        <p className="text-xs text-gray-500 text-center mt-5">
          Contacts are currently stored only in this screen's temporary state.
          Backend integration will be added separately.
        </p>
      </main>
    </div>
  );
};

export default TrustedContactsScreen;
