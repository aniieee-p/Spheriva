/**
 * Profile Screen
 * Shows the logged-in user's details and lets them edit name, email and phone.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateName, validateEmail, validatePhone } from '../utils/validation';

const FIELDS = [
  { name: 'name', label: 'Full name', type: 'text', placeholder: 'Your name' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
  { name: 'phoneNumber', label: 'Phone number', type: 'tel', placeholder: '10-digit number' },
];

const inputClass = (hasError) =>
  `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
    hasError ? 'border-red-500' : 'border-gray-300'
  }`;

const ProfileScreen = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phoneNumber: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const fillForm = () =>
    setForm({
      name: user?.name || '',
      email: user?.email || '',
      phoneNumber: user?.phoneNumber || '',
    });

  useEffect(() => {
    fillForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    setServerError('');
  };

  const startEdit = () => {
    setSuccess('');
    setServerError('');
    setErrors({});
    setEditing(true);
  };

  const cancelEdit = () => {
    fillForm();
    setErrors({});
    setServerError('');
    setEditing(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const newErrors = {
      name: validateName(form.name),
      email: validateEmail(form.email),
      phoneNumber: validatePhone(form.phoneNumber),
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    // Sirf wahi fields bhejo jo badli hain
    const changes = {};
    if (form.name.trim() !== (user?.name || '')) changes.name = form.name.trim();
    if (form.email.trim().toLowerCase() !== (user?.email || '').toLowerCase()) {
      changes.email = form.email.trim();
    }
    if (form.phoneNumber.trim() !== (user?.phoneNumber || '')) {
      changes.phoneNumber = form.phoneNumber.trim();
    }

    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setServerError('');
    const result = await updateUser(changes);
    setSaving(false);

    if (result.success) {
      setEditing(false);
      setSuccess('Profile updated successfully');
    } else {
      setServerError(result.message || 'Update failed. Please try again.');
    }
  };

  const handleLogout = async () => {
    const result = await logout();
    if (!result?.success) {
      setServerError(result?.message || 'Tracking cleanup failed. Please retry before logging out.');
      return;
    }
    navigate('/login', { replace: true });
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm opacity-90">Your account details</p>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center mb-6">
            <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold">
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="ml-4">
              <p className="text-lg font-bold text-gray-800">{user?.name || 'User'}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>

          {success && (
            <div role="status" className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
              {success}
            </div>
          )}
          {serverError && (
            <div role="alert" className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSave} noValidate className="space-y-4">
            {FIELDS.map((field) => (
              <div key={field.name}>
                <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                </label>
                {editing ? (
                  <>
                    <input
                      id={field.name}
                      name={field.name}
                      type={field.type}
                      value={form[field.name]}
                      onChange={handleChange}
                      placeholder={field.placeholder}
                      maxLength={field.name === 'phoneNumber' ? 10 : undefined}
                      disabled={saving}
                      className={inputClass(errors[field.name])}
                    />
                    {errors[field.name] && (
                      <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
                    )}
                  </>
                ) : (
                  <p className="px-1 py-2 text-gray-800">{user?.[field.name] || '-'}</p>
                )}
              </div>
            ))}

            {editing ? (
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startEdit}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Edit profile
              </button>
            )}
          </form>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full mt-4 bg-white border border-red-300 text-red-600 py-3 rounded-lg font-semibold hover:bg-red-50 transition"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default ProfileScreen;
