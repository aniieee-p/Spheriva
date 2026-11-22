
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

import {
  validateEmailOrPhone,
  validatePassword,
} from '../utils/validation';

import {
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  LockKeyhole,
  PhoneCall,
  HeartHandshake,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

const LoginScreen = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    emailOrPhone: '',
    password: '',
    rememberMe: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));

    setError('');

    if (fieldErrors[name]) {
      setFieldErrors((previous) => ({
        ...previous,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    const errors = {
      emailOrPhone: validateEmailOrPhone(formData.emailOrPhone),
      password: validatePassword(formData.password),
    };

    setFieldErrors(errors);

    if (errors.emailOrPhone || errors.password) return;

    setLoading(true);
    setError('');

    try {
      const result = await login({
        ...formData,
        emailOrPhone: formData.emailOrPhone.trim(),
      });

      if (result?.success) {
        navigate('/home', { replace: true });
      } else {
        setError(result?.message || 'Unable to sign in.');
      }
    } catch (err) {
      setError(
        err?.message || 'Login failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (name) =>
    `w-full rounded-xl border bg-slate-50 py-3.5 pl-12 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-teal-400/25 ${
      fieldErrors[name]
        ? 'border-red-400 focus:border-red-400'
        : 'border-slate-200 focus:border-teal-500'
    }`;

  return (
    <div className="min-h-screen bg-[#F5F7FA] lg:grid lg:grid-cols-[0.95fr_1.05fr]">

      {/* Left branding panel */}
      <aside className="relative overflow-hidden bg-gradient-to-br from-[#0B1423] via-[#112936] to-[#13464B] text-white px-6 py-8 sm:px-12 lg:px-14 lg:py-12 flex flex-col">

        <div className="absolute -right-28 top-24 w-80 h-80 bg-teal-300/10 blur-3xl rounded-full pointer-events-none" />

        <button
          type="button"
          onClick={() => navigate('/')}
          className="relative z-10 flex items-center gap-3 self-start"
        >
          <span className="w-12 h-12 rounded-xl border border-teal-300/20 bg-teal-400/15 flex items-center justify-center">
            <ShieldCheck
              size={28}
              className="text-teal-300"
            />
          </span>

          <span className="text-xl font-extrabold tracking-[0.12em]">
            SPHERIVA
          </span>
        </button>

        <div className="relative z-10 my-auto py-8 lg:py-16">
          <div className="hidden lg:flex w-20 h-20 rounded-3xl bg-teal-300/10 border border-teal-300/20 items-center justify-center mb-9">
            <ShieldCheck
              size={45}
              className="text-teal-300"
              strokeWidth={1.5}
            />
          </div>

          <p className="text-xs tracking-[0.2em] uppercase text-teal-300 font-semibold">
            Your Safety Companion
          </p>

          <h1 className="mt-4 text-3xl sm:text-4xl xl:text-5xl font-extrabold leading-tight">
            Welcome back
            <span className="text-teal-300">.</span>
          </h1>

          <p className="mt-5 text-sm sm:text-base text-slate-300 leading-relaxed max-w-md">
            Sign in to access your trusted circle,
            safety sessions and calling features
            in one place.
          </p>

          <div className="hidden lg:block space-y-4 mt-10">
            <div className="flex items-center gap-3 text-sm text-slate-200">
              <CheckCircle2
                size={19}
                className="text-teal-300"
              />
              Your personal safety workspace
            </div>

            <div className="flex items-center gap-3 text-sm text-slate-200">
              <PhoneCall
                size={19}
                className="text-teal-300"
              />
              Real and simulated calling tools
            </div>

            <div className="flex items-center gap-3 text-sm text-slate-200">
              <HeartHandshake
                size={19}
                className="text-teal-300"
              />
              Trusted contact management
            </div>
          </div>
        </div>

        <p className="hidden lg:block relative z-10 text-xs text-slate-400">
          Spheriva — Your Safety, Your Control.
        </p>
      </aside>

      {/* Sign-in form panel */}
      <main className="flex items-center justify-center p-5 sm:p-9 lg:p-12">
        <div className="w-full max-w-[470px]">

          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-teal-700 font-medium mb-8"
          >
            <ArrowLeft size={17} />
            Back to Welcome
          </button>

          <div className="bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/40 p-6 sm:p-9">

            <div className="mb-8">
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-5">
                <LockKeyhole size={24} />
              </div>

              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Sign In
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Enter your details to continue to Spheriva.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-red-800"
              >
                <AlertCircle size={19} className="shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              noValidate
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="emailOrPhone"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  Email or Phone Number
                </label>

                <div className="relative">
                  <Mail
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />

                  <input
                    id="emailOrPhone"
                    name="emailOrPhone"
                    type="text"
                    autoComplete="username"
                    value={formData.emailOrPhone}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="Enter email or phone number"
                    aria-invalid={Boolean(fieldErrors.emailOrPhone)}
                    aria-describedby={
                      fieldErrors.emailOrPhone
                        ? 'login-identity-error'
                        : undefined
                    }
                    className={inputClass('emailOrPhone')}
                  />
                </div>

                {fieldErrors.emailOrPhone && (
                  <p
                    id="login-identity-error"
                    className="text-xs text-red-600 mt-2"
                  >
                    {fieldErrors.emailOrPhone}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  Password
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="Enter your password"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={
                      fieldErrors.password
                        ? 'login-password-error'
                        : undefined
                    }
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
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>

                {fieldErrors.password && (
                  <p
                    id="login-password-error"
                    className="text-xs text-red-600 mt-2"
                  >
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <label className="inline-flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-4 h-4 rounded border-slate-300 accent-teal-700"
                />

                <span className="text-sm text-slate-600">
                  Remember me
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-teal-700 hover:bg-teal-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white py-4 px-5 font-bold transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  'Signing In...'
                ) : (
                  <>
                    Sign In to Spheriva
                    <ArrowRight size={19} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-7 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                New to Spheriva?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  disabled={loading}
                  className="font-bold text-teal-700 hover:text-teal-900"
                >
                  Create an account
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

export default LoginScreen;
