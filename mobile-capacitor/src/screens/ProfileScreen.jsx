import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api.service';
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

  const [profile, setProfile] = useState(user || {});
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setServerError('');

        const response = await apiService.getMe();
        const currentUser = response?.data?.user;

        if (!currentUser) {
          throw new Error('Profile details could not be loaded.');
        }

        setProfile(currentUser);
        setForm({
          name: currentUser.name || '',
          email: currentUser.email || '',
          phoneNumber: currentUser.phoneNumber || '',
        });
      } catch (err) {
        setServerError(err.message || 'Unable to load profile.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }

    setServerError('');
  };

  const startEdit = () => {
    setSuccess('');
    setServerError('');
    setErrors({});
    setEditing(true);
  };

  const cancelEdit = () => {
    setForm({
      name: profile.name || '',
      email: profile.email || '',
      phoneNumber: profile.phoneNumber || '',
    });
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

    const changes = {};

    if (form.name.trim() !== (profile.name || '')) {
      changes.name = form.name.trim();
    }

    if (form.email.trim().toLowerCase() !== (profile.email || '').toLowerCase()) {
      changes.email = form.email.trim();
    }

    if (form.phoneNumber.trim() !== (profile.phoneNumber || '')) {
      changes.phoneNumber = form.phoneNumber.trim();
    }

    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }

    try {
      setSaving(true);
      setServerError('');
      setSuccess('');

      const result = await updateUser(changes);

      if (!result?.success) {
        throw new Error(result?.message || 'Profile update failed.');
      }

      const updatedProfile = { ...profile, ...changes };

      setProfile(updatedProfile);
      setForm({
        name: updatedProfile.name || '',
        email: updatedProfile.email || '',
        phoneNumber: updatedProfile.phoneNumber || '',
      });

      setEditing(false);
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setServerError(err.message || 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      const result = await logout();

      if (!result?.success) {
        setServerError(
          result?.message || 'Unable to logout. Please try again.'
        );
        return;
      }

      navigate('/login', { replace: true });
    } catch (err) {
      setServerError(err.message || 'Unable to logout.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600 font-medium">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 shadow-lg">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-sm opacity-90">Manage your personal information</p>
      </div>

      <div className="p-4 max-w-xl mx-auto">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-2xl font-bold">
              {(profile.name || 'U').charAt(0).toUpperCase()}
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-800">
                {profile.name || 'User'}
              </h2>
              <p className="text-sm text-gray-500">Spheriva Member</p>
            </div>
          </div>

          {success && (
            <div role="status" className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm">
              {success}
            </div>
          )}

          {serverError && (
            <div role="alert" className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSave} noValidate className="space-y-4">
            {FIELDS.map((field) => (
              <div key={field.name}>
                <label
                  htmlFor={field.name}
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
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
                      maxLength={field.name === 'phoneNumber' ? 10 : field.name === 'name' ? 50 : undefined}
                      disabled={saving}
                      className={inputClass(errors[field.name])}
                    />

                    {errors[field.name] && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors[field.name]}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="px-1 py-2 text-gray-800">
                    {profile[field.name] || '-'}
                  </p>
                )}
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Created
              </label>
              <p className="px-1 py-2 text-gray-600">
                {profile.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString()
                  : 'Not available'}
              </p>
            </div>

            {editing ? (
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>

                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startEdit}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
              >
                Edit Profile
              </button>
            )}
          </form>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full mt-4 bg-white border border-red-300 text-red-600 py-3 rounded-lg font-semibold hover:bg-red-50"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default ProfileScreen;