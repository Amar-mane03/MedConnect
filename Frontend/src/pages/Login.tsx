// MedConnect Authentication & Clinical Onboarding
import { useEffect, useState } from 'react';
import axios from 'axios';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import type { Page } from '../App';

const AUTH_REQUEST_TIMEOUT_MS = 60_000;

interface LoginPageProps {
  onLogin: (role?: string) => void;
  onBack?: () => void;
  navigate: (page: Page) => void;
  initialMode?: 'login' | 'register';
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function LoginPage({ onLogin, onBack, navigate, initialMode = 'login' }: LoginPageProps) {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [authFlow, setAuthFlow] = useState<'login' | 'register' | 'forgot' | 'reset' | 'verify' | 'onboarding'>(() =>
    window.location.pathname.startsWith('/reset-password/') ? 'reset' : initialMode
  );
  const [role, setRole] = useState<'mentor' | 'mentee' | 'student' | 'ngo' | 'admin'>('student');
  const [adminSecret, setAdminSecret] = useState('');
  const [developmentVerificationUrl, setDevelopmentVerificationUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [careerStage, setCareerStage] = useState('');
  const [goals, setGoals] = useState('');
  const [communicationPreference, setCommunicationPreference] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [pendingSignupToken, setPendingSignupToken] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const passwordChecks = {
    length: password.length >= 8,
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const passwordScore = Object.values(passwordChecks).filter(Boolean).length;
  const signupRoles: { value: typeof role; label: string; badge: string; description: string }[] = [
    { value: 'student', label: 'Student / Volunteer', badge: 'ST', description: 'Join camps and track service' },
    { value: 'ngo', label: 'NGO Representative', badge: 'NGO', description: 'Manage camps and impact' },
    { value: 'mentor', label: 'Mentor', badge: 'MD', description: 'Attending / Consultant' },
    ...(import.meta.env.DEV ? [{ value: 'admin' as const, label: 'Administrator', badge: 'ADM', description: 'Development only' }] : []),
  ];

  useEffect(() => {
    if (authFlow !== 'register') setTermsAccepted(false);
  }, [authFlow]);

  useEffect(() => {
    const token = window.location.pathname.startsWith('/verify-email/')
      ? window.location.pathname.split('/').pop()
      : null;

    if (!token) return;

    API.get(`/auth/verify-email/${token}`)
      .then((response) => {
        setStatus({ type: 'success', message: response.data.message });
        window.history.replaceState({}, '', '/');
      })
      .catch((error) => {
        setStatus({
          type: 'error',
          message: error.response?.data?.message || 'This verification link is invalid or expired.',
        });
        window.history.replaceState({}, '', '/');
      });
  }, []);

  // Login / Signup
  const handleSubmit = async () => {
    setStatus(null);

    if (!email.trim() || !password) {
      setStatus({
        type: 'error',
        message: 'Please enter your email address and password.',
      });
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setStatus({
        type: 'error',
        message: 'Please enter your full name to create an account.',
      });
      return;
    }

    if (mode === 'register' && passwordScore < 3) {
      setStatus({ type: 'error', message: 'Use at least 8 characters, one number, and one symbol.' });
      return;
    }

    if (mode === 'register' && !termsAccepted) {
      setStatus({ type: 'error', message: 'Please accept the Good Neighbors terms to create your account.' });
      return;
    }

    if (mode === 'register' && role === 'admin' && !adminSecret.trim()) {
      setStatus({ type: 'error', message: 'Enter the development ADMIN_SECRET from Backend/.env to create an administrator account.' });
      return;
    }

    try {
      if (mode === 'register') {
        const response = await API.post(
          '/auth/signup',
          {
            name,
            email,
            password,
            specialty,
            role,
            ...(role === 'admin' ? { adminSecret } : {}),
            dateOfBirth: role === 'student' ? dateOfBirth : undefined,
            careerStage,
            goals,
            communicationPreference,
          },
          { timeout: AUTH_REQUEST_TIMEOUT_MS },
        );

        setPendingSignupToken(response.data.token || null);
        setDevelopmentVerificationUrl(response.data.verificationUrl || '');

        setStatus({
          type: 'success',
          message: response.data.message,
        });

        setAuthFlow('verify');
      } else {
        const response = await API.post(
          '/auth/login',
          {
            email,
            password,
          },
          { timeout: AUTH_REQUEST_TIMEOUT_MS },
        );

        if (response.data.token && response.data.user) {
          login(response.data.user, response.data.token);
        }

        setStatus({
          type: 'success',
          message: response.data.message,
        });

        onLogin(response.data.user?.role);
      }
    } catch (error: unknown) {
      console.error(error);

      const isAxiosError = axios.isAxiosError(error);
      const responseMessage = isAxiosError ? error.response?.data?.message : undefined;
      const isTimeout = isAxiosError && ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code ?? '');
      const isConnectionError = isAxiosError && !error.response;

      setStatus({
        type: 'error',
        message: responseMessage || (
          isTimeout
            ? 'MedConnect is taking longer than expected to respond. Your account may still have been created—wait a moment, then try signing in before creating it again.'
            : isConnectionError
            ? 'We could not connect to MedConnect. Check your connection and try again.'
            : 'Unable to complete your request. Please try again.'
        ),
      });
    }
  };

  const handleOnboarding = async () => {
    if (!careerStage || !goals || !communicationPreference) {
      setStatus({ type: 'error', message: 'Choose your career stage, goal, and preferred communication style.' });
      return;
    }

    if (!pendingSignupToken) {
      setStatus({ type: 'error', message: 'Please create your account before personalizing your profile.' });
      return;
    }

    try {
      await API.post('/auth/onboarding', {
        careerStage,
        goals,
        communicationPreference,
      }, {
        headers: { Authorization: `Bearer ${pendingSignupToken}` },
      });
      setStatus({ type: 'success', message: 'Profile preferences saved. Verify your email to finish creating your account.' });
      setAuthFlow('verify');
    } catch (error) {
      console.error(error);
      const isAxiosError = axios.isAxiosError(error);
      setStatus({
        type: 'error',
        message: isAxiosError
          ? error.response?.data?.message || 'Unable to save your profile preferences. Please try again.'
          : 'Unable to save your profile preferences. Please try again.',
      });
    }
  };

  const handleResendVerification = async () => {
    try {
      const response = await API.post(
        '/auth/resend-verification',
        { email },
        { timeout: AUTH_REQUEST_TIMEOUT_MS },
      );
      setStatus({ type: 'success', message: response.data.message });
    } catch (error: unknown) {
      console.error(error);
      const isAxiosError = axios.isAxiosError(error);
      const responseMessage = isAxiosError ? error.response?.data?.message : undefined;
      const isTimeout = isAxiosError && ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code ?? '');
      const isConnectionError = isAxiosError && !error.response;
      const fallbackMessage = isTimeout
        ? 'The email service is taking longer than expected. Check your inbox before requesting another link.'
        : isConnectionError
        ? 'We could not connect to MedConnect. Check your connection and try again.'
        : 'We could not resend the verification email right now.';

      setStatus({
        type: 'error',
        message: responseMessage || fallbackMessage,
      });
    }
  };

  const handleCredentialUpload = async (file: File | null) => {
    if (!file) return;

    setVerificationFile(file);
    const formData = new FormData();
    formData.append('email', email);
    formData.append('credential', file);

    try {
      const response = await API.post('/auth/mentor-credentials', formData, {
        headers: pendingSignupToken ? { Authorization: `Bearer ${pendingSignupToken}` } : undefined,
      });
      setStatus({ type: 'success', message: response.data.message });
    } catch (error: any) {
      setStatus({ type: 'error', message: error.response?.data?.message || 'We could not upload this file.' });
    }
  };

  const handleGoogleSignIn = () => {
    if (mode === 'register' && role === 'admin') {
      setStatus({ type: 'error', message: 'Create development administrator accounts with your password and ADMIN_SECRET, not Google sign-up.' });
      return;
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId || !window.google) {
      setStatus({ type: 'error', message: 'Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID to the frontend environment.' });
      return;
    }

    setGoogleLoading(true);
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async ({ credential }) => {
        try {
          const response = await API.post('/auth/google', { credential, role });
          if (response.data.token && response.data.user) {
            login(response.data.user, response.data.token);
          }
          setStatus({ type: 'success', message: response.data.message });
          onLogin(response.data.user?.role);
        } catch (error: any) {
          setStatus({ type: 'error', message: error.response?.data?.message || 'Google sign-in failed. Please try again.' });
        } finally {
          setGoogleLoading(false);
        }
      },
    });
    window.google.accounts.id.prompt();
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setStatus({ type: 'error', message: 'Enter your email address to continue.' });
      return;
    }

    try {
      const response = await API.post('/auth/forgot-password', {
        email: email.trim(),
      });

      setStatus({
        type: 'success',
        message: response.data.message || 'If an account exists, we sent reset instructions to your email.',
      });
    } catch (error: any) {
      console.error(error);

      setStatus({
        type: 'error',
        message: 'We could not send reset instructions right now. Please try again in a moment.',
      });
    }
  };

  const handleResetPassword = async () => {
    const token = window.location.pathname.split('/').pop();

    if (!token) {
      setStatus({ type: 'error', message: 'This reset link is missing or invalid.' });
      return;
    }

    if (password.length < 6) {
      setStatus({ type: 'error', message: 'Your new password must be at least 6 characters.' });
      return;
    }

    if (password !== confirmPassword) {
      setStatus({ type: 'error', message: 'The passwords do not match.' });
      return;
    }

    try {
      await API.post(`/auth/reset-password/${token}`, { password });
      setPassword('');
      setConfirmPassword('');
      setAuthFlow('login');
      setStatus({ type: 'success', message: 'Your password has been updated. You can sign in now.' });
      navigate('login');
    } catch (error: any) {
      console.error(error);
      setStatus({
        type: 'error',
        message: 'This reset link is invalid or expired. Please request a new one.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9F8] px-4 py-4 sm:px-8 sm:py-6">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-[#DCE5E1] pb-4">
        <button type="button" onClick={() => onBack ? onBack() : navigate('home')} className="flex shrink-0 items-center gap-2.5 font-bold text-[#0B192C]">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0B192C] text-sm font-extrabold text-white">G</span>
          <span className="text-lg" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Good Neighbors</span>
        </button>
        <nav aria-label="Main navigation" className="order-3 flex w-full gap-2 overflow-x-auto pb-1 text-sm font-semibold sm:order-2 sm:w-auto sm:pb-0">
          <button type="button" onClick={() => navigate('community')} className="shrink-0 rounded-full px-3 py-2 text-[#35564E] hover:bg-white">Community</button>
          <button type="button" onClick={() => navigate('ngos')} className="shrink-0 rounded-full px-3 py-2 text-[#35564E] hover:bg-white">Organizations</button>
          <button type="button" onClick={() => navigate('camps')} className="shrink-0 rounded-full px-3 py-2 text-[#35564E] hover:bg-white">Volunteer camps</button>
        </nav>
        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setAuthFlow(mode === 'login' ? 'register' : 'login'); setStatus(null); }}
          className="order-2 shrink-0 rounded-lg bg-[#0B192C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#192B40] sm:order-3"
        >
          {mode === 'login' ? 'Create account' : 'Sign in'}
        </button>
      </header>
      <div className="flex min-h-[calc(100vh-6.5rem)] items-center justify-center py-6 sm:py-8">
      <div className="mx-auto grid min-h-[min(760px,calc(100vh-9rem))] w-full max-w-6xl overflow-hidden rounded-lg border border-[#E1E7E5] bg-[#FFFFFF] shadow-[0_24px_60px_rgba(11,25,44,0.08)] lg:grid-cols-[0.9fr_1.1fr]">
        
        {/* Brand panel */}
        <aside className="relative hidden overflow-hidden bg-[#0B192C] px-10 py-12 text-white lg:flex lg:flex-col justify-between">

          {/* Logo */}
          <div className="relative flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#52796F]">
              <span className="text-lg font-extrabold text-white">M</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-white" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Good Neighbors
            </span>
          </div>

          <div className="relative my-auto max-w-sm py-10">
            <p className="mb-4 text-xs font-bold uppercase text-[#A9C1B5]">
              A community for service and learning
            </p>
            <h2 className="text-4xl font-semibold leading-[1.08] text-white" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Learn by doing, alongside people who care about your community.
            </h2>
            <p className="mt-5 text-sm leading-6 text-[#D6E0E5]">
              Discover local organizations, take part in field camps, and keep track of the impact you make.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5 border-t border-white/15 pt-5">
            <div>
              <p className="text-xs font-bold text-white">Verified NGO partners</p>
              <p className="mt-1 text-xs leading-5 text-[#D6E0E5]">Organization profiles are reviewed before listing.</p>
            </div>
            <div>
              <p className="text-xs font-bold text-white">Real-world field experience</p>
              <p className="mt-1 text-xs leading-5 text-[#D6E0E5]">Track participation and service hours as you contribute.</p>
            </div>
          </div>
        </aside>

        {/* Right Side: Form Area */}
        <div className="w-full p-6 sm:p-10 lg:p-12 flex flex-col justify-between bg-[#FFFFFF]">
          <div>
            {/* Auth Mode Tabs (Switch easily between Login and Register) */}
            <div className="mb-6 flex rounded-full bg-[#F0F4F2] p-1 border border-[#E1E7E5]/70">
              <button
                type="button"
                onClick={() => { setMode('login'); setAuthFlow('login'); setStatus(null); }}
                className={`flex-1 rounded-full py-2 text-xs font-bold transition-all ${
                  mode === 'login' && authFlow === 'login'
                    ? 'bg-[#FFFFFF] text-[#0B192C] shadow-xs'
                    : 'text-[#52616C] hover:text-[#0B192C]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setAuthFlow('register'); setStatus(null); }}
                className={`flex-1 rounded-full py-2 text-xs font-bold transition-all ${
                  mode === 'register' && authFlow === 'register'
                    ? 'bg-[#FFFFFF] text-[#0B192C] shadow-xs'
                    : 'text-[#52616C] hover:text-[#0B192C]'
                }`}
              >
                Create Account
              </button>
            </div>

            <div className="mb-6">
              <h1 className="text-3xl font-semibold tracking-tight text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                {authFlow === 'forgot'
                  ? 'Reset your password'
                  : authFlow === 'reset'
                  ? 'Create a new password'
                  : authFlow === 'verify'
                  ? 'Check your inbox'
                  : authFlow === 'onboarding'
                  ? 'Personalize your journey'
                  : mode === 'login'
                  ? 'Welcome back to Good Neighbors'
                  : role === 'ngo'
                    ? 'Join as an NGO representative'
                    : 'Join the volunteer community'}
              </h1>

              <p className="mt-2 text-sm leading-relaxed text-[#52616C]">
                {authFlow === 'forgot'
                  ? 'Enter your email address and we’ll send a link to recover your account.'
                  : mode === 'login'
                  ? 'Find community camps, support a cause, and build practical experience.'
                  : role === 'ngo'
                    ? 'Coordinate community camps, review volunteer applications, and share your organization’s impact.'
                    : 'Discover local organizations, apply for field camps, and track your volunteer experience.'}
              </p>
            </div>

            {/* Status Feedback Alert */}
            {status && (
              <div
                role="alert"
                className={`mb-6 flex items-start gap-3 rounded-lg border p-4 text-xs font-medium ${
                  status.type === 'success'
                    ? 'border-[#3D7A68]/30 bg-[#E8F0EC] text-[#0B192C]'
                    : 'border-[#C04A36]/40 bg-[#FDEEEB] text-[#C04A36]'
                }`}
              >
                <span className="mt-0.5 font-bold text-sm" aria-hidden="true">
                  {status.type === 'success' ? '✓' : 'ℹ'}
                </span>
                <span>{status.message}</span>
              </div>
            )}

            {/* Verification Flow */}
            {authFlow === 'verify' ? (
              <div className="space-y-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#E8F0EC] text-2xl text-[#0B192C]">
                  ✓
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                    Check your inbox
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#52616C]">
                    We created your account. Verify <span className="font-semibold text-[#0B192C]">{email}</span> to unlock the community discussions.
                  </p>
                </div>

                {role === 'mentor' && (
                  <div className="rounded-lg border border-[#E1E7E5] bg-[#F0F4F2] p-4 text-xs text-[#52616C]">
                    <strong className="block text-[#0B192C] text-sm mb-1 font-semibold">Mentor Verification</strong>
                    Mentor profiles receive a verification badge once professional credentials are reviewed.
                    <label className="mt-3 block cursor-pointer font-bold text-[#52796F] hover:underline">
                      <span>{verificationFile ? verificationFile.name : '+ Attach credentials or licence copy (optional)'}</span>
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" onChange={(e) => handleCredentialUpload(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                )}

                {developmentVerificationUrl && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                    <p>Email delivery is not configured. For local development only, verify this account using the link below:</p>
                    <a className="mt-2 inline-block break-all font-semibold underline" href={developmentVerificationUrl}>
                      Verify development account
                    </a>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { setAuthFlow('onboarding'); setStatus(null); }}
                  className="w-full rounded-full bg-[#0B192C] py-3.5 text-sm font-bold text-white transition-all hover:bg-[#192B40]"
                >
                  Personalize my profile
                </button>
                <div className="flex flex-col gap-2 pt-2 text-center text-xs">
                  <button type="button" onClick={handleResendVerification} className="font-semibold text-[#52796F] hover:underline">
                    Resend verification email
                  </button>
                  <button type="button" onClick={() => { setMode('login'); setAuthFlow('login'); setStatus(null); }} className="text-[#74817D] hover:text-[#0B192C]">
                    Continue to sign in later
                  </button>
                </div>
              </div>
            ) : authFlow === 'onboarding' ? (
              /* Onboarding Flow */
              <div className="space-y-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#52796F]">Step 1 of 1</span>
                  <h2 className="mt-1 text-xl font-bold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Make Good Neighbors yours</h2>
                  <p className="mt-1 text-xs text-[#52616C]">{role === 'ngo' ? 'Tell volunteers what your organization hopes to accomplish.' : 'Tell us what you hope to learn and contribute.'}</p>
                </div>

                <div>
                  <label htmlFor="career-stage" className="mb-1 block text-xs font-bold text-[#0B192C]">{role === 'ngo' ? 'Your organization role' : 'Your current stage'}</label>
                  <select
                    id="career-stage"
                    value={careerStage}
                    onChange={(e) => setCareerStage(e.target.value)}
                    className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none focus:ring-2 focus:ring-[#52796F]/15"
                  >
                    <option value="">Choose your stage</option>
                    {role === 'ngo' ? <>
                      <option>Organization coordinator</option>
                      <option>Volunteer coordinator</option>
                      <option>Community program lead</option>
                      <option>Other NGO representative</option>
                    </> : <>
                      <option>Student volunteer</option>
                      <option>Community volunteer</option>
                      <option>Early-career professional</option>
                      <option>Experienced professional</option>
                    </>}
                  </select>
                </div>

                <div>
                  <label htmlFor="goals" className="mb-1 block text-xs font-bold text-[#0B192C]">Primary Goal</label>
                  <select
                    id="goals"
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                    className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none focus:ring-2 focus:ring-[#52796F]/15"
                  >
                    <option value="">Choose a primary goal</option>
                    {role === 'ngo' ? <>
                      <option>Recruit and coordinate volunteers</option>
                      <option>Publish community camps</option>
                      <option>Share program impact</option>
                      <option>Build local partnerships</option>
                    </> : <>
                      <option>Find a volunteer opportunity</option>
                      <option>Build practical field skills</option>
                      <option>Support a local cause</option>
                      <option>Track my volunteer hours</option>
                    </>}
                  </select>
                </div>

                <div>
                  <label htmlFor="communication" className="mb-1 block text-xs font-bold text-[#0B192C]">Preferred Communication</label>
                  <select
                    id="communication"
                    value={communicationPreference}
                    onChange={(e) => setCommunicationPreference(e.target.value)}
                    className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none focus:ring-2 focus:ring-[#52796F]/15"
                  >
                    <option value="">Choose a style</option>
                    <option>Structured and focused</option>
                    <option>Friendly and collaborative</option>
                    <option>Either works for me</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleOnboarding}
                  className="mt-2 w-full rounded-full bg-[#0B192C] py-3.5 text-sm font-bold text-white transition-all hover:bg-[#192B40]"
                >
                  Continue to Good Neighbors
                </button>
              </div>
            ) : authFlow === 'forgot' || authFlow === 'reset' ? (
              /* Forgot / Reset password flow */
              <div className="space-y-4">
                {authFlow === 'forgot' ? (
                  <>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-[#0B192C]">Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@hospital.org"
                        className="w-full rounded-lg border border-[#E1E7E5] px-4 py-3 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none focus:ring-2 focus:ring-[#52796F]/15"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="w-full rounded-full bg-[#0B192C] py-3.5 text-sm font-bold text-white transition-all hover:bg-[#192B40]"
                    >
                      Email me a reset link
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-[#0B192C]">New Password</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full rounded-lg border border-[#E1E7E5] px-4 py-3 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none focus:ring-2 focus:ring-[#52796F]/15"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-[#0B192C]">Confirm Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        className="w-full rounded-lg border border-[#E1E7E5] px-4 py-3 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none focus:ring-2 focus:ring-[#52796F]/15"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      className="w-full rounded-full bg-[#0B192C] py-3.5 text-sm font-bold text-white transition-all hover:bg-[#192B40]"
                    >
                      Update password
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => { setAuthFlow('login'); setStatus(null); }}
                  className="w-full text-center text-xs font-semibold text-[#52796F] hover:underline"
                >
                  ← Back to sign in
                </button>
              </div>
            ) : (
              /* Standard Login & Register Form */
              <div className="space-y-4">
                {mode === 'register' && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[#0B192C]">
                        Full Name
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={role === 'ngo' ? 'Your full name' : role === 'student' ? 'Your name' : 'Dr. Jane Cooper'}
                        className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none focus:ring-2 focus:ring-[#52796F]/15"
                      />
                    </div>

                    {role === 'student' && (
                      <div>
                        <label className="mb-1 block text-xs font-bold text-[#0B192C]">
                          Date of birth
                        </label>
                        <input
                          type="date"
                          value={dateOfBirth}
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={(event) => setDateOfBirth(event.target.value)}
                          required
                          className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none focus:ring-2 focus:ring-[#52796F]/15"
                        />
                        <p className="mt-1 text-[11px] text-[#74817D]">Required for age-appropriate camp consent.</p>
                      </div>
                    )}

                    {role !== 'ngo' && <div>
                      <label className="mb-1 block text-xs font-bold text-[#0B192C]">
                        {role === 'student' ? 'Area of interest' : 'Medical Specialty'}
                      </label>
                      <select
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none focus:ring-2 focus:ring-[#52796F]/15"
                      >
                        <option value="">Select your specialty</option>
                        <option>Cardiology</option>
                        <option>Neurology</option>
                        <option>Oncology</option>
                        <option>Emergency Medicine</option>
                        <option>Internal Medicine</option>
                        <option>Paediatrics</option>
                        <option>Surgery</option>
                        <option>Medical Student</option>
                      </select>
                    </div>}

                    <div>
                      <label className="mb-2 block text-xs font-bold text-[#0B192C]">
                        I am joining as a…
                      </label>
                      <div className={`grid grid-cols-1 gap-3 ${import.meta.env.DEV ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
                        {signupRoles.map(({ value: r, label, badge, description }) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setRole(r)}
                            className={`flex flex-col items-center gap-1 rounded-lg border-2 py-3 px-2 text-sm font-bold transition-all ${
                              role === r
                                ? 'border-[#52796F] bg-[#E8F0EC] text-[#0B192C]'
                                : 'border-[#E1E7E5] bg-[#FFFFFF] text-[#52616C] hover:border-[#52796F]/50'
                            }`}
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8F0EC] text-[10px] font-bold text-[#35564E]">{badge}</span>
                            <span>{label}</span>
                            <span className="text-[11px] font-normal text-[#74817D]">
                              {description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {import.meta.env.DEV && role === 'admin' && (
                      <div>
                        <label htmlFor="admin-secret" className="mb-1 block text-xs font-bold text-[#0B192C]">Development ADMIN_SECRET</label>
                        <input
                          id="admin-secret"
                          type="password"
                          autoComplete="off"
                          value={adminSecret}
                          onChange={(event) => setAdminSecret(event.target.value)}
                          placeholder="Enter the value from Backend/.env.local"
                          className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none focus:ring-2 focus:ring-[#52796F]/15"
                        />
                        <p className="mt-1 text-[11px] leading-5 text-[#74817D]">Only available on the local development site. Do not use this flow on a public deployment.</p>
                      </div>
                    )}
                  </>
                )}

                {/* Email Address */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#0B192C]">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@hospital.org"
                    className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none focus:ring-2 focus:ring-[#52796F]/15"
                  />
                </div>

                {/* Password Field */}
                <div>
                  <div className="mb-1 flex justify-between items-center">
                    <label className="block text-xs font-bold text-[#0B192C]">Password</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-xs font-semibold text-[#52616C] hover:text-[#52796F]"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => { setAuthFlow('forgot'); setStatus(null); }}
                          className="text-xs font-semibold text-[#52796F] hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none focus:ring-2 focus:ring-[#52796F]/15"
                  />

                  {mode === 'register' && password.length > 0 && (
                    <div className="mt-2 space-y-1" aria-live="polite">
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((level) => (
                          <span
                            key={level}
                            className={`h-1.5 flex-1 rounded-full ${
                              level < passwordScore
                                ? passwordScore === 3
                                  ? 'bg-[#2E7D5A]'
                                  : 'bg-[#C27D38]'
                                : 'bg-[#E1E7E5]'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-[#74817D]">
                        {passwordScore === 3 ? 'Strong password' : 'Use 8+ characters, a number, and a symbol'}
                      </p>
                    </div>
                  )}

                  {mode === 'login' && (
                    <label className="mt-3 flex items-center gap-2 text-xs text-[#52616C]">
                      <input type="checkbox" className="h-4 w-4 rounded border-[#E1E7E5] accent-[#52796F]" />
                      Keep me signed in on this device
                    </label>
                  )}
                </div>

                {/* Mentor note */}
                {mode === 'register' && role === 'mentor' && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-[#3D7A68]/30 bg-[#E8F0EC] p-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#52796F]" aria-hidden="true" />
                    <p className="text-xs text-[#0B192C] leading-relaxed">
                      Mentor accounts require medical licence verification. You will be prompted to attach your credentials after signup.
                    </p>
                  </div>
                )}

                {/* Terms accepted */}
                {mode === 'register' && (
                  <label className="flex items-start gap-2 text-xs leading-5 text-[#52616C]">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-[#E1E7E5] accent-[#52796F]"
                    />
                    <span>I agree to the Good Neighbors community terms and understand NGO profiles may require verification.</span>
                  </label>
                )}

                {/* Primary Action Button */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="mt-2 w-full rounded-full bg-[#0B192C] py-3.5 text-sm font-bold text-white transition-all hover:bg-[#192B40] hover:shadow-md cursor-pointer"
                >
                  {mode === 'login' ? 'Sign In to Good Neighbors' : 'Create My Account'}
                </button>

                {/* Divider */}
                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#E1E7E5]" />
                  </div>
                  <div className="relative flex justify-center bg-[#FFFFFF] px-3 text-xs text-[#74817D]">
                    or continue with
                  </div>
                </div>

                {/* Google Sign In */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="flex w-full items-center justify-center gap-2.5 rounded-full border border-[#E1E7E5] bg-white py-3 text-xs font-semibold text-[#0B192C] transition-all hover:bg-[#F0F4F2]"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {googleLoading ? 'Connecting to Google…' : mode === 'register' ? 'Sign up with Google' : 'Sign in with Google'}
                </button>
              </div>
            )}
          </div>

          <div className="pt-6 text-center text-xs text-[#74817D]">
            <span>Good Neighbors · A community for volunteer training and local impact</span>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
