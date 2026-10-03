import { useState } from 'react';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import CaseStudyDetailPage from './pages/CaseStudyDetail';
import MentorProfilePage from './pages/MentorProfile';
import MessagesPage from './pages/Messages';
import AdminDashboardPage from './pages/AdminDashboard';
import HomePage from './pages/Home';
import ForumsPage from './pages/Forums';
import ResourcesPage from './pages/Resources';
import GroupsPage from './pages/Groups';
import EventsPage from './pages/Events';
import { AuthProvider, useAuth } from './context/AuthContext';

export type Page = 'home' | 'login' | 'dashboard' | 'case-detail' | 'mentor-profile' | 'messages' | 'admin' | 'forums' | 'resources' | 'groups' | 'events';

function AppContent() {
  const [page, setPage] = useState<Page>('home');
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);

  const { role } = useAuth();

  const navigate = (p: Page, meta?: { caseId?: string; mentorId?: string }) => {
    if (meta?.caseId) setSelectedCaseId(meta.caseId);
    if (meta?.mentorId) setSelectedMentorId(meta.mentorId);
    setPage(p);
  };

  const openAuth = (mode: 'login' | 'register') => {
    setLoginMode(mode);
    setPage('login');
  };

  if (page === 'home') {
    return <HomePage navigate={navigate} openAuth={openAuth} />;
  }

  if (page === 'login') {
    return (
      <LoginPage
        initialMode={loginMode}
        onLogin={(userRole?: string) => {
          let effectiveRole = userRole || role;
          if (!effectiveRole) {
            const saved = localStorage.getItem('medconnect_user');
            if (saved) {
              try { effectiveRole = JSON.parse(saved).role; } catch (e) {}
            }
          }
          if (effectiveRole === 'admin') {
            navigate('admin');
          } else {
            navigate('dashboard');
          }
        }}
        onBack={() => navigate('home')}
      />
    );
  }
  if (page === 'case-detail') return <CaseStudyDetailPage navigate={navigate} caseId={selectedCaseId} onSelectMentor={(id) => navigate('mentor-profile', { mentorId: id })} />;
  if (page === 'mentor-profile') return <MentorProfilePage navigate={navigate} mentorId={selectedMentorId} onSelectMentor={(id) => setSelectedMentorId(id)} />;
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
