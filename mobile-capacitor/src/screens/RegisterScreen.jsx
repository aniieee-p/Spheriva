
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import {
  ShieldCheck,
  UserRound,
  Mail,
  Phone,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  HeartHandshake,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

import {
  validateName,
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
} from '../utils/validation';

const RegisterScreen = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: '',
      ...(name === 'password'
        ? { confirmPassword: '' }
        : {}),
    }));

    setError('');
  };

  const validateForm = () => {
    const nextErrors = {
      name: validateName(formData.name),
      email: validateEmail(formData.email),
      phoneNumber: validatePhone(formData.phoneNumber),
      password: validatePassword(formData.password),
      confirmPassword: validateConfirmPassword(
        formData.password,
        formData.confirmPassword
      ),
    };

    // Preserve original backend name-length constraint.
    if (!nextErrors.name && formData.name.trim().length > 50) {
      nextErrors.name = 'Name cannot exceed 50 characters';
    }

    setErrors(nextErrors);

    return !Object.values(nextErrors).some(Boolean);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      // Confirm password is frontend-only.
      const registrationData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        password: formData.password,
      };

      const result = await register(registrationData);

      if (result?.success) {
        navigate('/home', { replace: true });
      } else {
        setError(
          result?.message || 'Unable to create account.'
        );
      }
    } catch (err) {
      setError(
        err?.message ||
          'Registration failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) =>
    `w-full rounded-xl border bg-slate-50 py-3.5 pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-teal-400/25 ${
      errors[field]
        ? 'border-red-400 focus:border-red-400'
        : 'border-slate-200 focus:border-teal-500'
    }`;

  return (
    <div className="min-h-screen bg-[#F5F7FA] lg:grid lg:grid-cols-[0.9fr_1.1fr]">

      {/* Left side branding */}
      <aside className="relative overflow-hidden bg-gradient-to-br from-[#0B1423] via-[#102A37] to-[#12464A] text-white px-6 py-8 sm:px-12 lg:px-14 lg:py-12 flex flex-col">
        <div className="absolute -right-32 top-32 w-96 h-96 rounded-full bg-teal-400/10 blur-3xl pointer-events-none" />

        <button
          type="button"
          onClick={() => navigate('/')}
          className="relative z-10 self-start flex items-center gap-3"
        >
          <span className="w-12 h-12 bg-teal-400/15 border border-teal-300/20 rounded-xl flex items-center justify-center">
            <ShieldCheck
              size={28}
              className="text-teal-300"
            />
          </span>

          <span className="font-extrabold tracking-[0.12em] text-xl">
            SPHERIVA
          </span>
        </button>

        <div className="relative z-10 my-auto py-8 lg:py-16">
          <div className="hidden lg:flex w-20 h-20 rounded-3xl bg-teal-300/10 border border-teal-300/20 items-center justify-center mb-9">
            <HeartHandshake
              size={44}
              className="text-teal-300"
              strokeWidth={1.5}
            />
          </div>

          <p className="text-teal-300 text-xs font-bold uppercase tracking-[0.2em]">
            Start Your Journey
          </p>

          <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold leading-tight mt-4">
            Your safety
            <br className="hidden lg:block" />
            {' '}starts here
            <span className="text-teal-300">.</span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mt-6 max-w-md">
            Create your Spheriva account and get access
            to a personal safety workspace designed
            around connection and preparedness.
          </p>

          <div className="hidden lg:block mt-10 space-y-4">
            <div className="flex gap-3 items-center text-sm text-slate-200">
              <CheckCircle2
                size={19}
                className="text-teal-300"
              />
              Create your personal profile
            </div>

            <div className="flex gap-3 items-center text-sm text-slate-200">
              <CheckCircle2
                size={19}
                className="text-teal-300"
              />
              Manage trusted contacts
            </div>

            <div className="flex gap-3 items-center text-sm text-slate-200">
              <CheckCircle2
                size={19}
                className="text-teal-300"
              />
              Explore safety and calling tools
            </div>
          </div>
        </div>

        <p className="hidden lg:block relative z-10 text-xs text-slate-400">
          Spheriva — Your Safety, Your Control.
        </p>
      </aside>

      {/* Right registration form */}
      <main className="flex items-center justify-center px-5 py-8 sm:px-9 lg:p-12">
        <div className="w-full max-w-[540px]">

          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-teal-700 font-medium mb-7"
          >
            <ArrowLeft size={17} />
            Back to Welcome
          </button>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 p-6 sm:p-9">

            <div className="mb-7">
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-5">
                <UserRound size={24} />
              </div>

              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Create Account
              </h2>

              <p className="text-sm text-slate-500 mt-2">
                Join Spheriva and set up your safety workspace.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="flex gap-3 items-start rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 mb-6"
              >
                <AlertCircle
                  size={19}
                  className="shrink-0 mt-0.5"
                />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              noValidate
              className="space-y-4"
            >
              {/* Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  Full Name
                </label>

                <div className="relative">
                  <UserRound
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />

                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={loading}
                    maxLength={50}
                    placeholder="Enter your full name"
                    aria-invalid={Boolean(errors.name)}
                    className={inputClass('name')}
                  />
                </div>

                {errors.name && (
                  <p className="text-xs text-red-600 mt-1.5">
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  Email Address
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="you@example.com"
                    aria-invalid={Boolean(errors.email)}
                    className={inputClass('email')}
                  />
                </div>

                {errors.email && (
                  <p className="text-xs text-red-600 mt-1.5">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="phoneNumber"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  Phone Number
                </label>

                <div className="relative">
                  <Phone
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />

                  <input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    disabled={loading}
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    aria-invalid={Boolean(errors.phoneNumber)}
                    className={inputClass('phoneNumber')}
                  />
                </div>

                {errors.phoneNumber && (
                  <p className="text-xs text-red-600 mt-1.5">
                    {errors.phoneNumber}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  Password
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="At least 6 characters"
                    aria-invalid={Boolean(errors.password)}
                    className={inputClass('password')}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    aria-pressed={showPassword}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-700"
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                {errors.password && (
                  <p className="text-xs text-red-600 mt-1.5">
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  Confirm Password
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />

                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={
                      showConfirmPassword ? 'text' : 'password'
                    }
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="Re-enter your password"
                    aria-invalid={Boolean(errors.confirmPassword)}
                    className={inputClass('confirmPassword')}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword((value) => !value)
                    }
                    aria-label={
                      showConfirmPassword
                        ? 'Hide confirmation password'
                        : 'Show confirmation password'
                    }
                    aria-pressed={showConfirmPassword}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-700"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                {errors.confirmPassword && (
                  <p className="text-xs text-red-600 mt-1.5">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:bg-slate-400 disabled:cursor-not-allowed px-5 py-4 text-white font-bold flex justify-center items-center gap-2 transition"
              >
                {loading ? (
                  'Creating Account...'
                ) : (
                  <>
                    Create My Account
                    <ArrowRight size={19} />
                  </>
                )}
              </button>
            </form>

            <div className="border-t border-slate-100 mt-7 pt-6 text-center">
              <p className="text-sm text-slate-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  disabled={loading}
                  className="text-teal-700 hover:text-teal-900 font-bold"
                >
                  Sign In
                </button>
              </p>
            </div>
          </div>

          <p className="text-center mt-6 text-xs text-slate-400">
            Spheriva — Your Safety, Your Control.
          </p>
        </div>
      </main>
    </div>
  );
};

export default RegisterScreen;
