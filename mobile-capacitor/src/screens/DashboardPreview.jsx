
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  ShieldCheck,
  LayoutDashboard,
  Siren,
  Phone,
  Video,
  VenetianMask,
  MapPin,
  Navigation,
  Users,
  Bot,
  Activity,
  Settings,
  CircleHelp,
  Bell,
  ChevronRight,
  Menu,
  X,
  Clock3,
  BatteryLow,
  WifiOff,
  LockKeyhole,
  Plus,
  Sparkles,
  Search,
  HeartHandshake,
  Play,
  AlertTriangle,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api.service';

// ======================================
// SPHERIVA - PROFESSIONAL DASHBOARD
// ======================================

// Existing pages and planned features
const navigationItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/home',
  },
  {
    title: 'Emergency Hub',
    icon: Siren,
    path: '/home-old',
  },
  {
    title: 'Calling Center',
    icon: Phone,
    path: '/real-calling',
  },
  {
    title: 'Location & Journey',
    icon: Navigation,
    comingSoon: true,
  },
  {
    title: 'Trusted Circle',
    icon: Users,
    path: '/contacts',
  },
  {
    title: 'AI Safety Assistant',
    icon: Bot,
    comingSoon: true,
  },
  {
    title: 'Safety Activity',
    icon: Activity,
    path: '/history',
  },
];

// Dashboard quick actions
const quickActions = [
  {
    title: 'Real Call',
    description: 'Voice calling',
    icon: Phone,
    path: '/real-calling',
    color: 'teal',
  },
  {
    title: 'Real Video Call',
    description: 'Secure video calls',
    icon: Video,
    path: '/real-calling',
    color: 'blue',
  },
  {
    title: 'Fake Call',
    description: 'Simulated incoming call',
    icon: VenetianMask,
    path: '/fake-call',
    color: 'rose',
  },
  {
    title: 'Fake Video Call',
    description: 'Video call simulation',
    icon: Video,
    path: '/fake-call',
    color: 'rose',
  },
  {
    title: 'Trusted Contacts',
    description: 'Manage trusted circle',
    icon: Users,
    path: '/contacts',
    color: 'teal',
  },
  {
    title: 'Safe Journey',
    description: 'Journey monitoring',
    icon: Navigation,
    comingSoon: true,
    color: 'blue',
  },
  {
    title: 'Live Location',
    description: 'Location sharing',
    icon: MapPin,
    comingSoon: true,
    color: 'teal',
  },
  {
    title: 'Safety Check-in',
    description: 'Scheduled check-ins',
    icon: Clock3,
    comingSoon: true,
    color: 'violet',
  },
  {
    title: 'Family Access',
    description: 'Location permissions',
    icon: HeartHandshake,
    comingSoon: true,
    color: 'blue',
  },
];

const featureColors = {
  teal: 'bg-teal-50 text-teal-700',
  blue: 'bg-sky-50 text-sky-700',
  rose: 'bg-rose-50 text-rose-600',
  violet: 'bg-violet-50 text-violet-700',
};

// ======================================
// REUSABLE SECTION HEADING
// ======================================

function SectionHeading({
  title,
  subtitle,
  action,
  onAction,
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          {title}
        </h2>

        {subtitle && (
          <p className="text-sm text-slate-500 mt-1">
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <button
          type="button"
          onClick={onAction}
          className="flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-900"
        >
          {action}
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

// ======================================
// QUICK ACTION CARD
// ======================================

function ActionCard({ feature, onClick }) {
  const Icon = feature.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-2xl border border-slate-200 bg-[#FAFBFC] p-4 transition hover:bg-white hover:border-teal-300 hover:shadow-md"
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center ${
          featureColors[feature.color]
        }`}
      >
        <Icon size={22} />
      </div>

      <div className="flex items-start justify-between gap-2 mt-4">
        <h3 className="text-sm font-bold text-slate-900">
          {feature.title}
        </h3>

        <ChevronRight
          size={16}
          className="shrink-0 text-slate-400 group-hover:text-teal-600"
        />
      </div>

      <p className="text-xs text-slate-500 mt-2 leading-relaxed">
        {feature.description}
      </p>

      {feature.comingSoon && (
        <span className="inline-block mt-3 text-[11px] font-semibold text-amber-700">
          Coming Soon
        </span>
      )}
    </button>
  );
}

// ======================================
// FUTURE FEATURE
// ======================================

function FutureFeature({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3 p-3">
      <div className="shrink-0 w-11 h-11 rounded-xl bg-white/10 text-teal-300 flex items-center justify-center">
        <Icon size={21} />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">
          {title}
        </h3>

        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
          {description}
        </p>

        <span className="inline-block text-[11px] text-teal-300 mt-2">
          Coming Soon
        </span>
      </div>
    </div>
  );
}

// ======================================
// MAIN DASHBOARD
// ======================================

export default function DashboardPreview() {
  const navigate = useNavigate();

  const { user } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState('');

  const [activeSession, setActiveSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');

  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');

  const displayName = user?.name || 'Spheriva User';

  const firstName =
    displayName.trim().split(/\s+/)[0] || 'there';

  const hour = new Date().getHours();

  const greeting =
    hour < 12
      ? 'Good Morning'
      : hour < 17
      ? 'Good Afternoon'
      : 'Good Evening';

  // ======================================
  // LOAD BACKEND DATA
  // ======================================

  useEffect(() => {
    let cancelled = false;

    const loadContacts = async () => {
      try {
        const response =
          await apiService.getEmergencyContacts();

        if (cancelled) return;

        if (!response?.success) {
          throw new Error('Could not retrieve trusted contacts');
        }

        const data = response.data;

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.contacts)
          ? data.contacts
          : [];

        setContacts(list);

      } catch (error) {
        if (!cancelled) {
          setContactsError(
            error.message || 'Unable to load contacts'
          );
        }
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    };

    const loadSession = async () => {
      try {
        const response =
          await apiService.getActiveSession();

        if (cancelled) return;

        if (!response?.success) {
          throw new Error('Could not retrieve session status');
        }

        const data = response.data;

        setActiveSession(
          data?.session ||
          data?.activeSession ||
          (data?._id ? data : null)
        );

      } catch (error) {
        if (!cancelled) {
          setSessionError(
            error.message || 'Session status unavailable'
          );
        }
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    };

    void loadContacts();
    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // ======================================
  // NAVIGATION
  // ======================================

  const showNotice = (message) => {
    setNotice(message);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const openFeature = (feature) => {
    setSidebarOpen(false);

    if (feature.path) {
      navigate(feature.path);
      return;
    }

    showNotice(
      `${feature.title || feature.name} is coming soon to Spheriva.`
    );
  };

  const filteredActions = quickActions.filter(
    (feature) =>
      feature.title
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      feature.description
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  // ======================================
  // UI
  // ======================================

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-900 lg:flex">

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 bg-[#0B1423] text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck size={27} className="text-teal-400" />

          <span className="text-lg font-extrabold tracking-widest">
            SPHERIVA
          </span>
        </div>

        <button
          type="button"
          aria-label="Toggle navigation"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[260px]
          flex flex-col bg-[#0B1423] text-white
          transition-transform duration-300
          lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand */}
        <div className="px-6 py-7 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-500/15 border border-teal-400/20 flex items-center justify-center">
              <ShieldCheck
                size={29}
                className="text-teal-400"
              />
            </div>

            <div>
              <h1 className="text-xl font-extrabold tracking-widest">
                SPHERIVA
              </h1>

              <p className="text-xs text-slate-400 mt-1">
                Personal Safety Platform
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav
          aria-label="Safety navigation"
          className="flex-1 overflow-y-auto px-3 py-6"
        >
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500 px-4 mb-4">
            Safety Workspace
          </p>

          <div className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;

              const active = item.title === 'Dashboard';

              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() =>
                    openFeature({
                      title: item.title,
                      path: item.path,
                    })
                  }
                  className={`
                    w-full flex items-center gap-3
                    rounded-xl px-4 py-3.5
                    text-left transition
                    ${
                      active
                        ? 'bg-teal-500/15 border border-teal-400/30 text-teal-300'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <Icon size={19} />

                  <span className="flex-1 text-sm font-medium">
                    {item.title}
                  </span>

                  {item.comingSoon && (
                    <span className="rounded bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-white/10 px-3 py-5 space-y-1">
          <button
            type="button"
            onClick={() => showNotice('Settings is coming soon.')}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white"
          >
            <Settings size={19} />
            Settings
          </button>

          <button
            type="button"
            onClick={() => showNotice('Help & Support is coming soon.')}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white"
          >
            <CircleHelp size={19} />
            Help & Support
          </button>

          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="w-full flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3 mt-3 hover:bg-white/10"
          >
            <div className="shrink-0 w-10 h-10 rounded-xl bg-teal-700 flex items-center justify-center font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1 text-left">
              <p className="font-semibold text-sm truncate">
                {displayName}
              </p>

              <p className="text-xs text-slate-400">
                View Profile
              </p>
            </div>

            <ChevronRight size={17} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">

        {/* Desktop Header */}
        <div className="hidden lg:flex bg-white border-b border-slate-200 min-h-[76px] px-8 items-center justify-between gap-6">
          <div>
            <p className="text-xs text-slate-400">
              Spheriva OS / Dashboard
            </p>

            <h2 className="text-lg font-bold mt-1">
              Safety Overview
            </h2>
          </div>

          <div className="flex items-center gap-5">
            <span className="text-xs bg-slate-100 rounded-full px-3 py-2 text-slate-600">
              Safety Dashboard
            </span>

            <button
              type="button"
              onClick={() =>
                showNotice('Notifications are coming soon.')
              }
              aria-label="Notifications"
              className="text-slate-600 hover:text-teal-700"
            >
              <Bell size={22} />
            </button>

            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2"
            >
              <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center text-teal-800 font-bold">
                {displayName.charAt(0).toUpperCase()}
              </div>

              <span className="text-sm font-semibold">
                {displayName}
              </span>
            </button>
          </div>
        </div>

        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">

          {/* Welcome */}
          <section className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {greeting}, {firstName} 👋
              </h2>

              <p className="text-slate-500 text-sm sm:text-base mt-2">
                Your safety companion, always by your side.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-2 text-sm text-slate-600">
              <ShieldCheck
                size={18}
                className="text-teal-700"
              />
              Safety Workspace
            </div>
          </section>

          {/* Messages */}
          {notice && (
            <div
              role="status"
              className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-amber-900 text-sm"
            >
              <span>{notice}</span>

              <button
                type="button"
                onClick={() => setNotice('')}
                aria-label="Dismiss notice"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Emergency + Status */}
          <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-5">

            {/* Emergency */}
            <section className="relative overflow-hidden bg-gradient-to-br from-[#111827] via-[#251623] to-[#4A1527] rounded-3xl p-7 sm:p-9 text-white min-h-[300px] shadow-sm">

              <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-red-500/10 blur-3xl" />

              <div className="relative z-10">
                <span className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-300/20 text-amber-300 rounded-full px-3 py-1.5 text-xs font-semibold">
                  <Siren size={15} />
                  Emergency Hub
                </span>

                <h2 className="text-3xl sm:text-4xl font-bold leading-tight mt-6">
                  Help, When You
                  <br />
                  Need It Most.
                </h2>

                <p className="text-sm text-slate-300 mt-4 max-w-md leading-relaxed">
                  Open your existing SOS controls to record
                  an emergency alert. Trusted-contact delivery
                  is not yet confirmed.
                </p>

                <button
                  type="button"
                  onClick={() => navigate('/home-old')}
                  className="inline-flex items-center gap-3 bg-rose-600 hover:bg-rose-700 rounded-xl px-6 py-3.5 mt-7 font-semibold transition"
                >
                  <Siren size={20} />
                  Open Emergency SOS Controls
                  <ChevronRight size={18} />
                </button>

                <p className="text-xs text-rose-200 mt-3">
                  Shake-to-SOS and automatic contact alerts
                  are planned features.
                </p>
              </div>

              <ShieldCheck
                size={175}
                strokeWidth={0.7}
                className="hidden sm:block absolute bottom-4 right-0 text-rose-200/15"
              />
            </section>

            {/* Safety and Location */}
            <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-sm">

              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center shrink-0">
                  <ShieldCheck size={29} />
                </div>

                <div>
                  <p className="text-sm text-slate-500">
                    Your Safety Workspace
                  </p>

                  <h3 className="text-xl font-bold mt-1">
                    Stay Prepared
                  </h3>

                  <p className="text-sm text-slate-500 mt-2">
                    Keep your safety information and
                    trusted contacts up to date.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 my-6" />

              <div className="rounded-2xl bg-[#F7FAFA] border border-slate-100 p-5">
                <div className="flex items-start gap-3">
                  <MapPin
                    size={22}
                    className="text-teal-700 shrink-0"
                  />

                  <div>
                    <h4 className="font-bold text-sm">
                      Live Location
                    </h4>

                    <p className="text-sm text-slate-500 mt-1">
                      Family location sharing is planned.
                    </p>
                  </div>
                </div>

                <div className="mt-4 min-h-[96px] rounded-xl border border-dashed border-slate-200 bg-white flex items-center justify-center gap-2 text-sm text-slate-400">
                  <MapPin size={19} />
                  Location sharing not enabled
                </div>
              </div>

              <p className="text-xs text-slate-500 mt-4">
                Location sharing will require consent.
              </p>
            </section>
          </div>

          {/* Features and Session */}
          <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_1fr] gap-5">

            {/* Actions */}
            <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm">
              <SectionHeading
                title="Core Safety Features"
                subtitle="Everything you need, organized in one place."
              />

              <div className="relative mb-5">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search safety features..."
                  aria-label="Search safety features"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredActions.map((feature) => (
                  <ActionCard
                    key={feature.title}
                    feature={feature}
                    onClick={() => openFeature(feature)}
                  />
                ))}
              </div>

              {filteredActions.length === 0 && (
                <p className="text-center text-slate-500 py-8 text-sm">
                  No matching features found.
                </p>
              )}
            </section>

            {/* Safety Session */}
            <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm">
              <SectionHeading
                title="Safety Session"
                subtitle="Manage your personal safety sessions."
              />

              <div className="bg-teal-50/60 border border-teal-100 rounded-2xl p-5">

                <div className="w-12 h-12 bg-white text-teal-700 rounded-xl flex items-center justify-center">
                  <Navigation size={24} />
                </div>

                <h3 className="font-bold text-lg mt-5">
                  {sessionLoading
                    ? 'Checking Session...'
                    : sessionError
                    ? 'Status Unavailable'
                    : activeSession
                    ? 'Backend Session Found'
                    : 'No Active Backend Session'}
                </h3>

                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  {sessionError
                    ? sessionError
                    : activeSession
                    ? 'An active session exists on the server. Open session controls to verify local tracking and manage it safely.'
                    : 'Start a safety session or review your previous journeys.'}
                </p>

                <button
                  type="button"
                  onClick={() => navigate('/home-old')}
                  className="mt-6 w-full flex items-center justify-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm rounded-xl px-4 py-3.5 transition"
                >
                  <Play size={18} />
                  Manage Safety Session
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/history')}
                  className="mt-3 w-full rounded-xl border border-teal-200 bg-white text-teal-800 px-4 py-3 text-sm font-semibold hover:bg-teal-50"
                >
                  View Session History
                </button>
              </div>

              <p className="text-xs text-slate-400 mt-4">
                Start, Stop and Retry Cleanup use your
                existing protected tracking workflow.
              </p>
            </section>
          </div>

          {/* Contacts + Activity */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

            {/* Trusted Circle */}
            <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm">
              <SectionHeading
                title="Trusted Circle"
                subtitle="Your trusted people, one tap away."
                action="Manage"
                onAction={() => navigate('/contacts')}
              />

              {contactsLoading ? (
                <p className="text-sm text-slate-500 py-8">
                  Loading contacts...
                </p>
              ) : contactsError ? (
                <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                  {contactsError}
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center bg-slate-50 rounded-2xl p-7 border border-dashed border-slate-200">
                  <Users
                    size={30}
                    className="mx-auto text-teal-700"
                  />

                  <h3 className="font-semibold mt-3">
                    Create Your Trusted Circle
                  </h3>

                  <p className="text-sm text-slate-500 mt-2">
                    Add people you trust for quick access.
                  </p>

                  <button
                    type="button"
                    onClick={() => navigate('/contacts')}
                    className="mt-4 inline-flex items-center gap-2 font-semibold text-sm text-teal-700"
                  >
                    <Plus size={18} />
                    Add Contact
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {contacts.slice(0, 4).map((contact) => (
                    <div
                      key={contact._id}
                      className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3"
                    >
                      <div className="shrink-0 w-11 h-11 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700 font-bold">
                        {contact.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">
                          {contact.name}
                        </p>

                        <p className="text-xs text-slate-500 truncate mt-1">
                          {contact.relationship || 'Trusted Contact'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate('/real-calling')}
                        title={`Call ${contact.name}`}
                        aria-label={`Call ${contact.name}`}
                        className="shrink-0 rounded-full w-9 h-9 flex items-center justify-center bg-white border border-teal-100 text-teal-700"
                      >
                        <Phone size={17} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Activity */}
            <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm">
              <SectionHeading
                title="Recent Safety Activity"
                subtitle="Your session and safety records."
                action="View History"
                onAction={() => navigate('/history')}
              />

              <div className="min-h-[190px] bg-slate-50 rounded-2xl border border-dashed border-slate-200 px-6 py-8 flex flex-col items-center justify-center text-center">
                <Activity
                  size={30}
                  className="text-teal-700"
                />

                <h3 className="font-semibold mt-4">
                  Your Safety Timeline
                </h3>

                <p className="text-sm text-slate-500 mt-2 max-w-xs">
                  Open History to view your actual
                  safety session records.
                </p>

                <button
                  type="button"
                  onClick={() => navigate('/history')}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 mt-4"
                >
                  Open History
                  <ChevronRight size={16} />
                </button>
              </div>
            </section>
          </div>

          {/* Future Features */}
          <section className="rounded-3xl bg-[#142133] text-white p-5 sm:p-6 shadow-sm">

            <div className="flex items-center gap-3 mb-4">
              <Sparkles
                size={21}
                className="text-teal-300"
              />

              <div>
                <h2 className="font-bold text-lg">
                  Coming to Spheriva
                </h2>

                <p className="text-xs text-slate-300 mt-1">
                  Future safety innovations.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">

              <FutureFeature
                icon={Bot}
                title="AI Safety Assistant"
                description="Conversational safety guidance and support."
              />

              <FutureFeature
                icon={BatteryLow}
                title="Low Battery Alert"
                description="Battery warnings and trusted circle alerts."
              />

              <FutureFeature
                icon={WifiOff}
                title="Offline Safety Mode"
                description="Supported safety fallbacks without internet."
              />

              <FutureFeature
                icon={LockKeyhole}
                title="Privacy & Control"
                description="Manage data and location permissions."
              />
            </div>
          </section>

          <footer className="text-center text-xs text-slate-400 py-3">
            Spheriva — Your Safety, Your Control.
          </footer>
        </div>
      </main>
    </div>
  );
}
