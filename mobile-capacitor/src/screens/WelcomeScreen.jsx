
import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  ArrowRight,
  HeartHandshake,
  PhoneCall,
  MapPin,
  LockKeyhole,
  Sparkles,
  LoaderCircle,
} from 'lucide-react';

const WelcomeScreen = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1423] flex flex-col items-center justify-center gap-4 text-white">
        <LoaderCircle
          size={36}
          className="text-teal-400 animate-spin"
        />
        <p className="text-sm text-slate-300">
          Preparing Spheriva...
        </p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  const features = [
    {
      icon: PhoneCall,
      title: 'Voice & Video Calling',
      description: 'Stay connected when it matters.',
    },
    {
      icon: HeartHandshake,
      title: 'Trusted Circle',
      description: 'Keep your trusted people close.',
    },
    {
      icon: ShieldCheck,
      title: 'Safety Sessions',
      description: 'Manage your personal safety journey.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Header */}
      <header className="relative z-10 bg-[#0B1423] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-3 text-white"
          >
            <span className="w-11 h-11 rounded-xl bg-teal-400/15 border border-teal-400/20 flex items-center justify-center">
              <ShieldCheck
                size={26}
                className="text-teal-300"
              />
            </span>

            <span className="text-xl font-extrabold tracking-[0.12em]">
              SPHERIVA
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="relative overflow-hidden bg-gradient-to-br from-[#0B1423] via-[#112D39] to-[#103F45] text-white">
        <div className="absolute -top-40 -right-40 w-[540px] h-[540px] rounded-full bg-teal-400/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -left-40 w-[440px] h-[440px] rounded-full bg-sky-400/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-16 md:py-24 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-14 items-center">

            {/* Text content */}
            <section>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-400/10 px-4 py-2 text-xs sm:text-sm font-medium text-teal-200">
                <Sparkles size={16} />
                Your Personal Safety Companion
              </div>

              <h1 className="mt-7 text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.12]">
                Feel Connected.
                <br />
                Stay Prepared.
                <br />
                <span className="text-teal-300">
                  Live Confidently.
                </span>
              </h1>

              <p className="mt-6 text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                Spheriva brings your safety tools, trusted
                contacts, and calling features together in
                one thoughtfully designed space.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="inline-flex items-center justify-center gap-3 rounded-xl bg-teal-400 hover:bg-teal-300 text-[#09252A] font-bold px-7 py-4 transition shadow-lg shadow-teal-950/20"
                >
                  Get Started
                  <ArrowRight size={19} />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 hover:bg-white/10 px-7 py-4 font-semibold transition"
                >
                  Already have an account?
                </button>
              </div>

              <p className="mt-6 text-xs text-slate-400">
                Personal safety features in one workspace.
              </p>
            </section>

            {/* Illustration */}
            <section
              aria-label="Spheriva safety illustration"
              className="relative flex items-center justify-center min-h-[340px] sm:min-h-[420px]"
            >
              <div className="absolute w-[300px] h-[300px] sm:w-[390px] sm:h-[390px] rounded-full border border-teal-300/15" />
              <div className="absolute w-[235px] h-[235px] sm:w-[310px] sm:h-[310px] rounded-full border border-dashed border-teal-300/25" />
              <div className="absolute w-[170px] h-[170px] sm:w-[230px] sm:h-[230px] rounded-full bg-teal-300/10 blur-xl" />

              <div className="relative z-10 w-40 h-40 sm:w-52 sm:h-52 rounded-[42px] bg-gradient-to-br from-teal-300/30 to-sky-400/10 border border-teal-200/25 shadow-2xl shadow-teal-900/30 flex items-center justify-center">
                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-[34px] bg-[#103C42] border border-teal-300/30 flex items-center justify-center">
                  <ShieldCheck
                    size={86}
                    strokeWidth={1.4}
                    className="text-teal-300"
                  />
                </div>
              </div>

              <div className="absolute top-4 right-0 sm:right-6 bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
                <PhoneCall size={20} className="text-teal-300" />
                <span className="text-sm font-semibold">
                  Stay Connected
                </span>
              </div>

              <div className="absolute bottom-6 left-0 sm:left-6 bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
                <HeartHandshake size={20} className="text-teal-300" />
                <span className="text-sm font-semibold">
                  Trusted Circle
                </span>
              </div>

              <div className="absolute bottom-8 right-0 sm:right-9 w-12 h-12 rounded-2xl bg-teal-300/15 border border-teal-200/20 flex items-center justify-center">
                <MapPin size={22} className="text-teal-300" />
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Feature cards */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
        <div className="text-center max-w-xl mx-auto">
          <p className="text-xs font-bold text-teal-700 tracking-[0.2em] uppercase">
            Your Safety Workspace
          </p>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
            Everything starts with feeling prepared.
          </h2>

          <p className="text-slate-500 mt-3 text-sm sm:text-base">
            Explore the Spheriva features designed
            to support your everyday safety.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mt-10">
          {features.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
            >
              <span className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Icon size={25} />
              </span>

              <h3 className="mt-5 text-lg font-bold text-slate-900">
                {title}
              </h3>

              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                {description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-14">
        <div className="rounded-3xl bg-[#112638] text-white p-7 sm:p-10 flex flex-wrap justify-between items-center gap-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">
              Ready to explore Spheriva?
            </h2>

            <p className="text-sm text-slate-300 mt-2">
              Create an account and set up your safety workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/register')}
            className="bg-teal-400 hover:bg-teal-300 text-[#09252A] font-bold px-6 py-3.5 rounded-xl flex items-center gap-2 transition"
          >
            Create Account
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-6 px-5 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <LockKeyhole size={14} />
        Spheriva — Your Safety, Your Control.
      </footer>
    </div>
  );
};

export default WelcomeScreen;
