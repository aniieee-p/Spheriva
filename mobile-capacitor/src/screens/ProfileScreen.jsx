
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api.service';

import {
  validateName,
  validateEmail,
  validatePhone,
} from '../utils/validation';

import {
  ShieldCheck,
  ArrowLeft,
  UserRound,
  Mail,
  Phone,
  CalendarDays,
  Pencil,
  Save,
  X,
  LogOut,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
} from 'lucide-react';

// ==========================================
// PROFILE FIELDS
// ==========================================

const FIELDS = [
  {
    name: 'name',
    label: 'Full Name',
    type: 'text',
    placeholder: 'Enter your full name',
    icon: UserRound,
  },
  {
    name: 'email',
    label: 'Email Address',
    type: 'email',
    placeholder: 'you@example.com',
    icon: Mail,
  },
  {
    name: 'phoneNumber',
    label: 'Phone Number',
    type: 'tel',
    placeholder: '10-digit mobile number',
    icon: Phone,
  },
];

// ==========================================
// INPUT STYLING
// ==========================================

const inputClass = (hasError) =>
  `w-full rounded-xl border bg-slate-50 py-3.5 pl-12 pr-4
   text-sm text-slate-900 outline-none transition
   focus:bg-white focus:ring-2 focus:ring-teal-400/20
   ${
     hasError
       ? 'border-red-400 focus:border-red-400'
       : 'border-slate-200 focus:border-teal-500'
   }`;

// ==========================================
// MAIN PROFILE SCREEN
// ==========================================

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

  // ==========================================
  // LOAD PROFILE FROM BACKEND
  // ==========================================

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setServerError('');

        const response = await apiService.getMe();
        const currentUser = response?.data?.user;

        if (!currentUser) {
          throw new Error(
            'Profile details could not be loaded.'
          );
        }

        if (cancelled) return;

        setProfile(currentUser);

        setForm({
          name: currentUser.name || '',
          email: currentUser.email || '',
          phoneNumber: currentUser.phoneNumber || '',
        });
      } catch (err) {
        if (!cancelled) {
          setServerError(
            err.message || 'Unable to load profile.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  // ==========================================
  // HANDLE FIELD CHANGES
  // ==========================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((previous) => ({
        ...previous,
        [name]: '',
      }));
    }

    setServerError('');
  };

  // ==========================================
  // START EDITING
  // ==========================================

  const startEdit = () => {
    setSuccess('');
    setServerError('');
    setErrors({});
    setEditing(true);
  };

  // ==========================================
  // CANCEL EDITING
  // ==========================================

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

  // ==========================================
  // SAVE PROFILE
  // ==========================================

  const handleSave = async (event) => {
    event.preventDefault();

    if (saving) return;

    const newErrors = {
      name: validateName(form.name),
      email: validateEmail(form.email),
      phoneNumber: validatePhone(form.phoneNumber),
    };

    setErrors(newErrors);

    if (Object.values(newErrors).some(Boolean)) {
      return;
    }

    const changes = {};

    if (
      form.name.trim() !== (profile.name || '')
    ) {
      changes.name = form.name.trim();
    }

    if (
      form.email.trim().toLowerCase() !==
      (profile.email || '').toLowerCase()
    ) {
      changes.email = form.email.trim();
    }

    if (
      form.phoneNumber.trim() !==
      (profile.phoneNumber || '')
    ) {
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
        throw new Error(
          result?.message || 'Profile update failed.'
        );
      }

      const updatedProfile = {
        ...profile,
        ...changes,
      };

      setProfile(updatedProfile);

      setForm({
        name: updatedProfile.name || '',
        email: updatedProfile.email || '',
        phoneNumber: updatedProfile.phoneNumber || '',
      });

      setEditing(false);
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setServerError(
        err.message || 'Unable to update profile.'
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = async () => {
    try {
      const result = await logout();

      if (!result?.success) {
        setServerError(
          result?.message ||
          'Unable to logout. Please try again.'
        );
        return;
      }

      navigate('/login', { replace: true });
    } catch (err) {
      setServerError(
        err.message || 'Unable to logout.'
      );
    }
  };

  // ==========================================
  // LOADING SCREEN
  // ==========================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center">
          <LoaderCircle
            size={31}
            className="animate-spin text-teal-700"
          />
        </div>

        <p className="text-sm font-medium text-slate-600">
          Loading your profile...
        </p>
      </div>
    );
  }

  // ==========================================
  // DISPLAY VALUES
  // ==========================================

  const displayName =
    profile.name || 'Spheriva User';

  const initial = displayName
    .trim()
    .charAt(0)
    .toUpperCase();

  const createdDate = profile.createdAt
    ? new Date(profile.createdAt)
    : null;

  const formattedDate =
    createdDate &&
    !Number.isNaN(createdDate.getTime())
      ? createdDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'Not available';

  // ==========================================
  // PROFESSIONAL PROFILE UI
  // ==========================================

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-900 pb-24">

      {/* ======================================
          COMPACT NAVY HEADER
      ====================================== */}

      <header className="bg-[#0B1423] text-white">

        <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-6 pb-12">

          <div className="flex items-center justify-between gap-4">

            <button
              type="button"
              onClick={() => navigate('/home')}
              className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition"
            >
              <ArrowLeft size={18} />
              Back to Dashboard
            </button>

            <div className="flex items-center gap-2 text-teal-300">
              <ShieldCheck size={23} />

              <span className="text-sm font-extrabold tracking-[0.12em] text-white">
                SPHERIVA
              </span>
            </div>
          </div>

          <div className="mt-9">

            <p className="text-xs text-teal-300 uppercase tracking-[0.18em] font-bold">
              Account Management
            </p>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-3">
              My Profile
            </h1>

            <p className="text-sm text-slate-300 mt-3">
              View and manage your personal information.
            </p>

          </div>
        </div>
      </header>

      {/* ======================================
          CONTENT CONTAINER
      ====================================== */}

      <main className="max-w-5xl mx-auto px-4 sm:px-8 -mt-5 relative z-10">

        <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.3fr] gap-5 items-start">

          {/* ===================================
              PROFILE IDENTITY CARD
          =================================== */}

          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7">

            <div className="flex flex-col items-center text-center">

              {/* Avatar */}
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-teal-100 to-teal-200 border border-teal-200 text-teal-800 flex items-center justify-center text-4xl font-extrabold">
                {initial || 'U'}
              </div>

              <h2 className="text-xl font-extrabold text-slate-900 mt-5 break-words max-w-full">
                {displayName}
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Spheriva Member
              </p>

            </div>

            <div className="border-t border-slate-100 mt-7 pt-6 space-y-4">

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Mail size={19} />
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-slate-500">
                    Email Address
                  </p>

                  <p className="text-sm font-semibold text-slate-800 mt-1 break-all">
                    {profile.email || 'Not available'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
                  <Phone size={19} />
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Phone Number
                  </p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {profile.phoneNumber || 'Not available'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center">
                  <CalendarDays size={19} />
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Account Created
                  </p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {formattedDate}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ===================================
              PERSONAL INFORMATION CARD
          =================================== */}

          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">

            <div className="p-6 sm:p-7">

              <div className="flex flex-wrap items-start justify-between gap-3 mb-7">

                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    Personal Information
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    {editing
                      ? 'Update your account details below.'
                      : 'Your current account details.'}
                  </p>
                </div>

                {!editing && (
                  <button
                    type="button"
                    onClick={startEdit}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 px-4 py-2.5 text-sm font-bold transition"
                  >
                    <Pencil size={16} />
                    Edit Profile
                  </button>
                )}

              </div>

              {/* Feedback Messages */}
              {success && (
                <div
                  role="status"
                  className="mb-6 flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-teal-900"
                >
                  <CheckCircle2
                    size={19}
                    className="shrink-0 mt-0.5"
                  />

                  <p className="text-sm">
                    {success}
                  </p>
                </div>
              )}

              {serverError && (
                <div
                  role="alert"
                  className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
                >
                  <AlertCircle
                    size={19}
                    className="shrink-0 mt-0.5"
                  />

                  <p className="text-sm">
                    {serverError}
                  </p>
                </div>
              )}

              {/* Profile Form */}
              <form
                onSubmit={handleSave}
                noValidate
                className="space-y-5"
              >

                {FIELDS.map((field) => {
                  const Icon = field.icon;

                  return (
                    <div key={field.name}>

                      <label
                        htmlFor={field.name}
                        className="block text-sm font-semibold text-slate-700 mb-2"
                      >
                        {field.label}
                      </label>

                      {editing ? (
                        <>
                          <div className="relative">

                            <Icon
                              size={19}
                              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />

                            <input
                              id={field.name}
                              name={field.name}
                              type={field.type}
                              value={form[field.name]}
                              onChange={handleChange}
                              placeholder={field.placeholder}
                              maxLength={
                                field.name === 'phoneNumber'
                                  ? 10
                                  : field.name === 'name'
                                  ? 50
                                  : undefined
                              }
                              autoComplete={
                                field.name === 'name'
                                  ? 'name'
                                  : field.name === 'email'
                                  ? 'email'
                                  : 'tel-national'
                              }
                              disabled={saving}
                              aria-invalid={Boolean(errors[field.name])}
                              className={inputClass(
                                errors[field.name]
                              )}
                            />
                          </div>

                          {errors[field.name] && (
                            <p className="mt-2 text-xs text-red-600">
                              {errors[field.name]}
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-[#F8FAFB] px-4 py-3.5">

                          <Icon
                            size={19}
                            className="shrink-0 text-teal-700"
                          />

                          <p className="min-w-0 text-sm text-slate-800 font-medium break-all">
                            {profile[field.name] || 'Not available'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Edit Buttons */}
                {editing && (
                  <div className="flex flex-col sm:flex-row gap-3 pt-3">

                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white px-5 py-3.5 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <>
                          <LoaderCircle
                            size={18}
                            className="animate-spin"
                          />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save size={18} />
                          Save Changes
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={saving}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3.5 text-sm font-semibold transition disabled:opacity-50"
                    >
                      <X size={18} />
                      Cancel
                    </button>
                  </div>
                )}
              </form>
            </div>
          </section>
        </div>

        {/* ======================================
            LOGOUT
        ====================================== */}

        <div className="mt-5 flex justify-end">

          <button
            type="button"
            onClick={handleLogout}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 px-6 py-3.5 font-bold text-sm transition disabled:opacity-50"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>

        <footer className="text-center text-xs text-slate-400 mt-10">
          Spheriva — Your Safety, Your Control.
        </footer>
      </main>
    </div>
  );
};

export default ProfileScreen;
