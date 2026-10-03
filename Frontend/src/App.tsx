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
import { AuthProvider, useAuth } from './context/AuthContext';

export type Page = 'home' | 'login' | 'dashboard' | 'case-detail' | 'mentor-profile' | 'messages' | 'admin' | 'forums' | 'resources' | 'groups' | 'events';

type RouteState = {
  page: Page;
  caseId: string | null;
  mentorId: string | null;
  loginMode: 'login' | 'register';
  redirectTo: string | null;
};

const protectedPages: Page[] = ['dashboard', 'messages', 'admin', 'forums', 'resources', 'groups', 'events', 'case-detail', 'mentor-profile'];

function readRoute(): RouteState {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent);
  const searchParams = new URLSearchParams(window.location.search);
  const loginMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const redirectTo = searchParams.get('redirect');

  if (path === '/') return { page: 'home', caseId: null, mentorId: null, loginMode, redirectTo: null };
  if (path === '/login') return { page: 'login', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/dashboard') return { page: 'dashboard', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/messages') return { page: 'messages', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/admin') return { page: 'admin', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/forums') return { page: 'forums', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/resources') return { page: 'resources', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/groups') return { page: 'groups', caseId: null, mentorId: null, loginMode, redirectTo };
  if (path === '/events') return { page: 'events', caseId: null, mentorId: null, loginMode, redirectTo };
  if (segments[0] === 'verify-email' && segments[1]) return { page: 'login', caseId: null, mentorId: null, loginMode, redirectTo: null };
  if (segments[0] === 'case-study' && segments[1]) return { page: 'case-detail', caseId: segments[1], mentorId: null, loginMode, redirectTo };
  if (segments[0] === 'mentors' && segments[1]) return { page: 'mentor-profile', caseId: null, mentorId: segments[1], loginMode, redirectTo };
  return { page: 'home', caseId: null, mentorId: null, loginMode, redirectTo: null };
}

function routeUrl(page: Page, meta?: { caseId?: string; mentorId?: string; loginMode?: 'login' | 'register'; redirectTo?: string }) {
  if (page === 'home') return '/';
  if (page === 'case-detail') return meta?.caseId ? `/case-study/${encodeURIComponent(meta.caseId)}` : '/dashboard';
  if (page === 'mentor-profile') return meta?.mentorId ? `/mentors/${encodeURIComponent(meta.mentorId)}` : '/dashboard';
  if (page === 'login' && meta?.loginMode === 'register') return `/login?mode=register${meta.redirectTo ? `&redirect=${encodeURIComponent(meta.redirectTo)}` : ''}`;
  if (page === 'login') return meta?.redirectTo ? `/login?redirect=${encodeURIComponent(meta.redirectTo)}` : '/login';
  return `/${page}`;
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
      const destination = role === 'admin' ? '/admin' : '/dashboard';
      window.history.replaceState(null, '', destination);
      setRoute(readRoute());
    }
  }, [isAuthenticated, route.page, role]);

  const navigate = (page: Page, meta?: { caseId?: string; mentorId?: string; loginMode?: 'login' | 'register'; redirectTo?: string }) => {
    const target = routeUrl(page, meta);

    if (!isAuthenticated && protectedPages.includes(page) && page !== 'login') {
      const loginTarget = target || '/';
      const nextRoute: RouteState = {
        page: 'login',
        caseId: null,
        mentorId: null,
        loginMode: meta?.loginMode ?? 'login',
        redirectTo: loginTarget,
      };
      window.history.pushState(null, '', `/login?redirect=${encodeURIComponent(loginTarget)}`);
      setRoute(nextRoute);
      return;
    }

    const nextRoute: RouteState = {
      page,
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
        onLogin={(userRole?: string) => {
          const destination = redirectTo || (() => {
            let effectiveRole = userRole || role;
            if (!effectiveRole) {
              const saved = localStorage.getItem('medconnect_user');
              if (saved) {
                try { effectiveRole = JSON.parse(saved).role; } catch (e) {}
              }
            }
            return effectiveRole === 'admin' ? '/admin' : '/dashboard';
          })();

          if (destination.startsWith('/')) {
            window.history.pushState(null, '', destination);
            setRoute(readRoute());
            return;
          }

          if (role === 'admin') {
            navigate('admin');
          } else {
            navigate('dashboard');
          }
        }}
        onBack={() => navigate('home')}
      />
    );
  }

  if (page === 'home') {
    return <HomePage navigate={navigate} openAuth={openAuth} />;
  }

  if (page === 'login') {
    return (
      <LoginPage
        initialMode={loginMode}
        onLogin={(userRole?: string) => {
          const safeRedirect = redirectTo || (() => {
            let effectiveRole = userRole || role;
            if (!effectiveRole) {
              const saved = localStorage.getItem('medconnect_user');
              if (saved) {
                try { effectiveRole = JSON.parse(saved).role; } catch (e) {}
              }
            }
            return effectiveRole === 'admin' ? '/admin' : '/dashboard';
          })();

          if (safeRedirect.startsWith('/')) {
            window.history.pushState(null, '', safeRedirect);
            setRoute(readRoute());
            return;
          }

          if (role === 'admin') {
            navigate('admin');
          } else {
            navigate('dashboard');
          }
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
