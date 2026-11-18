
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api.service';

const ProfileScreen = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [profile, setProfile] = useState(user || {});
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await apiService.getMe();
      const currentUser = response?.data?.user;

      if (!currentUser) {
        throw new Error('Profile details could not be loaded.');
      }

      setProfile(currentUser);
      setFormData({
        name: currentUser.name || '',
        email: currentUser.email || '',
        phoneNumber: currentUser.phoneNumber || '',
      });
    } catch (err) {
      setError(err.message || 'Unable to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const name = formData.name.trim();
    const email = formData.email.trim();
    const phoneNumber = formData.phoneNumber.trim();

    if (!name || !email || !phoneNumber) {
      setError('Please fill in all fields.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setSaving(true);

      const result = await updateUser({
        name,
        email,
        phoneNumber,
      });

      if (!result.success) {
        throw new Error(result.message || 'Profile update failed.');
      }

      setProfile((prev) => ({
        ...prev,
        name,
        email,
        phoneNumber,
      }));

      setFormData({ name, email, phoneNumber });
      setEditing(false);
      setMessage('Profile updated successfully!');
    } catch (err) {
      setError(err.message || 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: profile.name || '',
      email: profile.email || '',
      phoneNumber: profile.phoneNumber || '',
    });
    setEditing(false);
    setError('');
    setMessage('');
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
        <button
          onClick={() => navigate('/home')}
          className="mb-4 text-sm bg-white/20 px-4 py-2 rounded-lg"
        >
          ← Back to Home
        </button>

        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-sm opacity-90">
          Manage your personal information
        </p>
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

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                disabled={!editing}
                maxLength={50}
                className="w-full border rounded-lg p-3 disabled:bg-gray-100 disabled:text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={!editing}
                className="w-full border rounded-lg p-3 disabled:bg-gray-100 disabled:text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                disabled={!editing}
                maxLength={10}
                className="w-full border rounded-lg p-3 disabled:bg-gray-100 disabled:text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Created
              </label>
              <input
                type="text"
                value={
                  profile.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString()
                    : 'Not available'
                }
                disabled
                className="w-full border rounded-lg p-3 bg-gray-100 text-gray-600"
              />
            </div>

            {!editing ? (
              <button
                type="button"
                onClick={() => {
                  setMessage('');
                  setError('');
                  setEditing(true);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold"
              >
                Edit Profile
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded-lg font-semibold"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>

                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-semibold"
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;
