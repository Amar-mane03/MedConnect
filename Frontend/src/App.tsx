import { useEffect, useState } from 'react';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import CaseStudyDetailPage from './pages/CaseStudyDetail';
import MentorProfilePage from './pages/MentorProfile';
import MessagesPage from './pages/Messages';
import AdminDashboardPage from './pages/AdminDashboard';
import HomePage from './pages/HomePage';
import ForumsPage from './pages/Forums';
import ResourcesPage from './pages/Resources';
import GroupsPage from './pages/Groups';
import EventsPage from './pages/Events';
import NGOCommunity from './pages/NGOCommunity';
import ConsentApproval from './pages/ConsentApproval';
import CommunityHub from './pages/CommunityHub';
import EditProfilePage from './pages/EditProfile';
import { AuthProvider, useAuth } from './context/AuthContext';

export type Page = 'home' | 'community' | 'login' | 'reset-password' | 'dashboard' | 'case-detail' | 'mentor-profile' | 'messages' | 'admin' | 'forums' | 'resources' | 'groups' | 'events' | 'ngos' | 'camps' | 'activities' | 'ngo-dashboard' | 'ngo-admin' | 'profile' | 'consent';

type RouteState = {
  page: Page;
  caseId: string | null;
  mentorId: string | null;
  loginMode: 'login' | 'register';
  redirectTo: string | null;
};

const protectedPages: Page[] = ['dashboard', 'messages', 'admin', 'forums', 'resources', 'groups', 'events', 'case-detail', 'mentor-profile', 'activities', 'ngo-dashboard', 'ngo-admin', 'profile'];
const appBasePath = new URL(import.meta.env.BASE_URL, window.location.origin).pathname.replace(/\/+$/, '');

function appPath(path: string) {
  return `${appBasePath}${path.startsWith('/') ? path : `/${path}`}`;
}

function defaultPageForRole(role: string | null): Page {
  if (role === 'admin') return 'ngo-admin';
  if (role === 'ngo') return 'ngo-dashboard';
  if (role === 'student' || role === 'mentee') return 'dashboard';
  return 'dashboard';
}

function postLoginDestination(role: string | null, redirectTo: string | null): string {
  let effectiveRole = role;
  if (!effectiveRole) {
    const saved = localStorage.getItem('medconnect_user');
    if (saved) {
      try { effectiveRole = JSON.parse(saved).role; } catch {}
    }
  }

  if (redirectTo && redirectTo !== '/' && redirectTo !== appPath('/')) return redirectTo;
  return appPath(`/${defaultPageForRole(effectiveRole)}`);
}

function readRoute(): RouteState {
  let path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (appBasePath && (path === appBasePath || path.startsWith(`${appBasePath}/`))) {
    path = path.slice(appBasePath.length) || '/';
  }
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent);
  const searchParams = new URLSearchParams(window.location.search);
  const loginMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const redirectTo = searchParams.get('redirect');

  if (path === '/') return { page: 'home', caseId: null, mentorId: null, loginMode, redirectTo: null };
  if (path === '/community' || path === '/demo') return { page: 'community', caseId: null, mentorId: null, loginMode, redirectTo: null };
  if (path === '/login') return { page: 'login', caseId: null, mentorId: null, loginMode, redirectTo };
  if (segments[0] === 'reset-password' && segments[1]) return { page: 'reset-password', caseId: null, mentorId: null, loginMode, redirectTo: null };
  if (path === '/dashboard') return { page: 'dashboard', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/messages') return { page: 'messages', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/admin') return { page: 'admin', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/forums') return { page: 'forums', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/resources') return { page: 'resources', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/groups') return { page: 'groups', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/events') return { page: 'events', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/ngos') return { page: 'ngos', caseId: null, mentorId: null, loginMode, redirectTo: null };
  if (path === '/camps') return { page: 'camps', caseId: null, mentorId: null, loginMode, redirectTo: null };
  if (path === '/mentors') return { page: 'mentor-profile', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/activities') return { page: 'activities', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/ngo-dashboard') return { page: 'ngo-dashboard', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/ngo-admin') return { page: 'ngo-admin', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/profile') return { page: 'profile', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/consent') return { page: 'consent', caseId: null, mentorId: null, loginMode, redirectTo: null };
  if (segments[0] === 'verify-email' && segments[1]) return { page: 'login', caseId: null, mentorId: null, loginMode, redirectTo: null };
  if (segments[0] === 'case-study' && segments[1]) return { page: 'case-detail', caseId: segments[1], mentorId: null, loginMode, redirectTo };
  if (segments[0] === 'mentors' && segments[1]) return { page: 'mentor-profile', caseId: null, mentorId: segments[1], loginMode, redirectTo };
  return { page: 'home', caseId: null, mentorId: null, loginMode, redirectTo: null };
}

function routeUrl(page: Page, meta?: { caseId?: string; mentorId?: string; loginMode?: 'login' | 'register'; redirectTo?: string }) {
  if (page === 'home') return appPath('/');
  if (page === 'community') return appPath('/community');
  if (page === 'case-detail') return appPath(meta?.caseId ? `/case-study/${encodeURIComponent(meta.caseId)}` : '/dashboard');
  if (page === 'mentor-profile') return appPath(meta?.mentorId ? `/mentors/${encodeURIComponent(meta.mentorId)}` : '/mentors');
  if (page === 'login' && meta?.loginMode === 'register') return appPath(`/login?mode=register${meta.redirectTo ? `&redirect=${encodeURIComponent(meta.redirectTo)}` : ''}`);
  if (page === 'login') return appPath(meta?.redirectTo ? `/login?redirect=${encodeURIComponent(meta.redirectTo)}` : '/login');
  return appPath(`/${page}`);
}

function AppContent() {
  const [route, setRoute] = useState<RouteState>(readRoute);

  const { role, isAuthenticated } = useAuth();

  useEffect(() => {
    setRoute(readRoute());
  }, [isAuthenticated, role]);

  useEffect(() => {
    const handlePopState = () => setRoute(readRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (isAuthenticated && route.page === 'login') {
      const destination = postLoginDestination(role, route.redirectTo);
      window.history.replaceState(null, '', destination);
      setRoute(readRoute());
    }
  }, [isAuthenticated, route.page, role]);

  useEffect(() => {
    if (isAuthenticated || !protectedPages.includes(route.page)) return;
    const destination = appPath(`/login?redirect=${encodeURIComponent(routeUrl(route.page, { caseId: route.caseId ?? undefined, mentorId: route.mentorId ?? undefined }))}`);
    if (window.location.pathname + window.location.search !== destination) {
      window.history.replaceState(null, '', destination);
      setRoute(readRoute());
    }
  }, [isAuthenticated, route.page, route.caseId, route.mentorId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (route.page === 'admin' && role !== 'admin') {
      const destination = appPath(`/${defaultPageForRole(role)}`);
      window.history.replaceState(null, '', destination);
      setRoute(readRoute());
      return;
    }
    if (route.page === 'profile' && !['student', 'mentee', 'mentor'].includes(role || '')) {
      const destination = appPath(role === 'ngo' ? '/ngo-dashboard' : role === 'admin' ? '/admin' : `/${defaultPageForRole(role)}`);
      window.history.replaceState(null, '', destination);
      setRoute(readRoute());
      return;
    }
    if (route.page === 'dashboard' && ['ngo', 'admin'].includes(role || '')) {
      const destination = appPath(`/${defaultPageForRole(role)}`);
      window.history.replaceState(null, '', destination);
      setRoute(readRoute());
      return;
    }
    if (route.page === 'activities' && !['student', 'mentee'].includes(role || '')) {
      const destination = appPath(role === 'ngo' ? '/ngo-dashboard' : role === 'admin' ? '/ngo-admin' : '/');
      window.history.replaceState(null, '', destination);
      setRoute(readRoute());
    } else if (route.page === 'ngo-dashboard' && role !== 'ngo') {
      const destination = appPath(role === 'admin' ? '/ngo-admin' : '/');
      window.history.replaceState(null, '', destination);
      setRoute(readRoute());
    } else if (route.page === 'ngo-admin' && role !== 'admin') {
      const destination = appPath(role === 'ngo' ? '/ngo-dashboard' : '/');
      window.history.replaceState(null, '', destination);
      setRoute(readRoute());
    }
  }, [isAuthenticated, role, route.page]);

  const navigate = (page: Page, meta?: { caseId?: string; mentorId?: string; loginMode?: 'login' | 'register'; redirectTo?: string }) => {
    const resolvedPage = page === 'dashboard' && ['student', 'ngo', 'admin'].includes(role || '')
      ? defaultPageForRole(role)
      : page;
    const target = routeUrl(resolvedPage, meta);

    if (!isAuthenticated && protectedPages.includes(resolvedPage) && resolvedPage !== 'login') {
      const loginTarget = target || '/';
      const nextRoute: RouteState = {
        page: 'login',
        caseId: null,
        mentorId: null,
        loginMode: meta?.loginMode ?? 'login',
        redirectTo: loginTarget,
      };
      window.history.pushState(null, '', appPath(`/login?redirect=${encodeURIComponent(loginTarget)}`));
      setRoute(nextRoute);
      return;
    }

    const nextRoute: RouteState = {
      page: resolvedPage,
      caseId: meta?.caseId ?? null,
      mentorId: meta?.mentorId ?? null,
      loginMode: meta?.loginMode ?? 'login',
      redirectTo: meta?.redirectTo ?? null,
    };
    window.history.pushState(null, '', target);
    setRoute(nextRoute);
  };

  const openAuth = (mode: 'login' | 'register') => {
    const redirectTarget = route.page !== 'home' && route.page !== 'login' ? routeUrl(route.page, { caseId: route.caseId ?? undefined, mentorId: route.mentorId ?? undefined }) : '/';
    navigate('login', { loginMode: mode, redirectTo: redirectTarget });
  };

  const { page, caseId, mentorId, loginMode, redirectTo } = route;

  if (!isAuthenticated && protectedPages.includes(page)) {
    return (
      <LoginPage
        initialMode={loginMode}
        navigate={navigate}
        onLogin={(userRole?: string) => {
          window.history.pushState(null, '', postLoginDestination(userRole || role, redirectTo));
          setRoute(readRoute());
        }}
        onBack={() => navigate('home')}
      />
    );
  }

  if (page === 'home') {
    return <HomePage navigate={navigate} openAuth={openAuth} />;
  }
  if (page === 'community') {
    return <CommunityHub navigate={navigate} openAuth={openAuth} />;
  }
  if (page === 'consent') return <ConsentApproval />;

  if (isAuthenticated && (
    (page === 'activities' && !['student', 'mentee'].includes(role || ''))
    || (page === 'admin' && role !== 'admin')
    || (page === 'ngo-dashboard' && role !== 'ngo')
    || (page === 'ngo-admin' && role !== 'admin')
  )) {
    return <HomePage navigate={navigate} openAuth={openAuth} />;
  }

  if (page === 'ngos' || page === 'camps' || page === 'activities' || page === 'ngo-dashboard' || page === 'ngo-admin') {
    return <NGOCommunity page={page} navigate={navigate} openAuth={openAuth} />;
  }

  if (page === 'login' || page === 'reset-password') {
    return (
      <LoginPage
        initialMode={loginMode}
        navigate={navigate}
        onLogin={(userRole?: string) => {
          window.history.pushState(null, '', postLoginDestination(userRole || role, redirectTo));
          setRoute(readRoute());
        }}
        onBack={() => navigate('home')}
      />
    );
  }
  if (page === 'case-detail') return <CaseStudyDetailPage navigate={navigate} caseId={caseId} onSelectMentor={(id) => navigate('mentor-profile', { mentorId: id })} />;
  if (page === 'mentor-profile') return <MentorProfilePage navigate={navigate} mentorId={mentorId} onSelectMentor={(id) => navigate('mentor-profile', { mentorId: id })} />;
  if (page === 'messages') return <MessagesPage navigate={navigate} />;
  if (page === 'forums') return <ForumsPage navigate={navigate} />;
  if (page === 'resources') return <ResourcesPage navigate={navigate} />;
  if (page === 'groups') return <GroupsPage navigate={navigate} />;
  if (page === 'events') return <EventsPage navigate={navigate} />;
  if (page === 'admin') {
    return <AdminDashboardPage navigate={navigate} />;
  }
  if (page === 'profile') return <EditProfilePage navigate={navigate} />;
  return (
    <DashboardPage
      navigate={navigate}
      onSelectCase={(id) => navigate('case-detail', { caseId: id })}
      onSelectMentor={(id) => navigate('mentor-profile', { mentorId: id })}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
