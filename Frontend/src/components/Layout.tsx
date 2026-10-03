import { useEffect, useState } from 'react';
import type { Page } from '../App';
import { useAuth } from '../context/AuthContext';
import API, { SOCKET_URL } from '../api';
import { io } from 'socket.io-client';

interface LayoutProps {
  navigate: (p: Page, meta?: { caseId?: string; mentorId?: string }) => void;
  children: React.ReactNode;
  currentPage?: Page;
}

interface ActivityNotification {
  id: string;
  category: 'mentorship' | 'messages' | 'caseComments';
  title: string;
  message: string;
  page: Page;
  targetId: string;
  createdAt: string;
  readAt: string | null;
}

type NotificationPreferences = Record<ActivityNotification['category'], boolean>;

export default function Layout({ navigate, children, currentPage }: LayoutProps) {
  const { user, role, logout } = useAuth();
  const [searchVal, setSearchVal] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<ActivityNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    mentorship: true,
    messages: true,
    caseComments: true,
  });
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const userId = user?._id || user?.id;

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    API.get('/notifications')
      .then(res => {
        setNotifications(res.data?.notifications || []);
        setUnreadCount(res.data?.unreadCount || 0);
      })
      .catch(err => console.error('Failed to load notifications:', err));

    API.get('/notifications/preferences')
      .then(res => setNotificationPreferences(res.data?.preferences || notificationPreferences))
      .catch(err => console.error('Failed to load notification preferences:', err));

    const socket = io(SOCKET_URL, { auth: { token: localStorage.getItem('medconnect_token') } });
    socket.emit('join_user', userId);
    socket.on('notification_created', (notification: ActivityNotification) => {
      setNotifications(prev => [notification, ...prev.filter(item => item.id !== notification.id)].slice(0, 30));
      setUnreadCount(prev => prev + 1);
    });

    return () => socket.disconnect();
  }, [userId]);

  const updateNotificationPreference = async (category: ActivityNotification['category'], enabled: boolean) => {
    const next = { ...notificationPreferences, [category]: enabled };
    setNotificationPreferences(next);
    try {
      const res = await API.put('/notifications/preferences', next);
      setNotificationPreferences(res.data?.preferences || next);
    } catch (error) {
      setNotificationPreferences(notificationPreferences);
      console.error('Failed to save notification preference:', error);
    }
  };

  const openNotification = async (notification: ActivityNotification) => {
    if (!notification.readAt) {
      try {
        await API.patch(`/notifications/${notification.id}/read`);
      } catch (error) {
        console.error('Failed to mark notification read:', error);
      }
      setNotifications(prev => prev.map(item => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setNotifOpen(false);
    navigate(notification.page, notification.page === 'case-detail'
      ? { caseId: notification.targetId }
      : notification.page === 'mentor-profile'
        ? { mentorId: notification.targetId }
        : undefined);
  };

  const markAllNotificationsRead = async () => {
    try {
      await API.patch('/notifications/read-all');
      setNotifications(prev => prev.map(item => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications read:', error);
    }
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'MC';

  const navLinks: { label: string; icon: typeof HomeIcon; page: Page }[] = [
    { label: 'Clinical Feed', icon: HomeIcon, page: 'dashboard' },
    { label: 'Mentors Directory', icon: MentorsIcon, page: 'mentor-profile' },
    { label: 'Discussion Forums', icon: ForumIcon, page: 'forums' },
    { label: 'Messages', icon: MsgIcon, page: 'messages' },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F7F9F8] text-[#0B192C]">
      {/* Top Navbar */}
      <header className="h-16 bg-[#FFFFFF] border-b border-[#E1E7E5] flex items-center px-4 sm:px-6 gap-3 sm:gap-4 shrink-0 z-30">
        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg text-[#52616C] hover:bg-[#F0F4F2] hover:text-[#0B192C] transition-colors cursor-pointer"
          aria-label="Toggle Navigation Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>

        {/* Logo */}
        <button
          onClick={() => navigate('home')}
          className="flex items-center gap-2.5 shrink-0 transition-opacity hover:opacity-90 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-md bg-[#0B192C] flex items-center justify-center shadow-sm">
            <span className="text-white font-extrabold text-base" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>M</span>
          </div>
          <span className="font-bold text-[#0B192C] text-xl tracking-tight" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
            MedConnect
          </span>
        </button>

        {/* Search bar */}
        <div className="flex-1 max-w-md mx-auto hidden sm:block">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#74817D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              placeholder="Search clinical cases, mentors, specialties…"
              className="w-full pl-10 pr-4 py-2 text-sm bg-[#F0F4F2] text-[#0B192C] placeholder-[#74817D] rounded-full border border-[#E1E7E5]/70 focus:border-[#52796F] focus:bg-[#FFFFFF] focus:outline-none focus:ring-2 focus:ring-[#52796F]/15 transition-all"
            />
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                if (!user) {
                  navigate('login');
                  return;
                }
                setNotifOpen(!notifOpen);
              }}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F0F4F2] text-[#52616C] hover:text-[#0B192C] transition-colors relative cursor-pointer"
              aria-label="Notifications"
              aria-expanded={notifOpen}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#9B3F35] px-1 text-[10px] font-bold leading-4 text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] border border-[#E1E7E5] bg-white shadow-xl">
                <div className="flex items-center justify-between gap-2 border-b border-[#E1E7E5] px-4 py-3">
                  <span className="text-sm font-bold text-[#0B192C]">Activity</span>
                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && <button onClick={markAllNotificationsRead} className="text-xs font-semibold text-[#52796F] underline underline-offset-2">Mark all read</button>}
                    <button onClick={() => setPreferencesOpen(prev => !prev)} aria-expanded={preferencesOpen} className="text-xs font-semibold text-[#52616C] underline underline-offset-2">Preferences</button>
                  </div>
                </div>
                {preferencesOpen ? (
                  <div className="space-y-3 p-4">
                    <p className="text-xs leading-5 text-[#52616C]">Choose which in-app activity appears here.</p>
                    {([
                      ['mentorship', 'Mentorship requests'],
                      ['messages', 'New messages'],
                      ['caseComments', 'Case replies'],
                    ] as const).map(([category, label]) => (
                      <label key={category} className="flex items-center justify-between gap-4 text-sm text-[#0B192C]">
                        {label}
                        <input type="checkbox" checked={notificationPreferences[category]} onChange={e => updateNotificationPreference(category, e.target.checked)} className="h-4 w-4 accent-[#52796F]" />
                      </label>
                    ))}
                  </div>
                ) : notifications.length > 0 ? (
                  <ul className="max-h-96 divide-y divide-[#E1E7E5] overflow-y-auto">
                    {notifications.slice(0, 12).map(notification => (
                      <li key={notification.id}>
                        <button onClick={() => openNotification(notification)} className={`w-full px-4 py-3 text-left hover:bg-[#F7F9F8] ${notification.readAt ? '' : 'bg-[#F7F9F8]'}`}>
                          <span className="flex items-center justify-between gap-3">
                            <span className="text-xs font-bold text-[#0B192C]">{notification.title}</span>
                            {!notification.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-[#0B192C]" aria-label="Unread" />}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-[#52616C]">{notification.message}</span>
                          <time className="mt-1 block text-[10px] text-[#74817D]" dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-6 text-center text-xs text-[#74817D]">No activity yet.</div>
                )}
              </div>
            )}
          </div>

          {/* User Profile Button & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1.5 rounded-full hover:bg-[#F0F4F2] transition-colors cursor-pointer border border-transparent hover:border-[#E1E7E5]"
              title="User Menu"
            >
              <div className="w-9 h-9 rounded-full bg-[#0B192C] flex items-center justify-center text-white text-xs font-bold ring-2 ring-[#A9C1B5]/40">
                {initials}
              </div>
              <div className="hidden lg:flex flex-col text-left leading-tight">
                <span className="text-xs font-bold text-[#0B192C] truncate max-w-[120px]">
                  {user?.name || 'MedConnect member'}
                </span>
                <span className="text-[10px] font-semibold text-[#52796F] capitalize">
                  {role || 'Guest'}
                </span>
              </div>
              <svg className="w-3.5 h-3.5 text-[#74817D] hidden lg:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-12 w-64 bg-[#FFFFFF] rounded-lg shadow-xl border border-[#E1E7E5] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-3 border-b border-[#E1E7E5]">
                  <p className="text-xs font-bold text-[#0B192C] truncate" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                    {user?.name || 'MedConnect User'}
                  </p>
                  <p className="text-[11px] text-[#74817D] truncate">{user?.email}</p>
                  <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F0EC] text-[#35564E]">
                    <span>{role === 'mentor' ? (user?.mentorVerificationStatus === 'verified' ? 'Verified mentor' : 'Mentor') : role === 'admin' ? 'Administrator' : 'Mentee'}</span>
                  </div>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { setProfileOpen(false); navigate('home'); }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-[#0B192C] hover:bg-[#F0F4F2] flex items-center gap-2 cursor-pointer"
                  >
                    Home
                  </button>
                  <button
                    onClick={() => { setProfileOpen(false); navigate('mentor-profile'); }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-[#0B192C] hover:bg-[#F0F4F2] flex items-center gap-2 cursor-pointer"
                  >
                    Profile & mentors
                  </button>
                  {role === 'admin' && (
                    <button
                      onClick={() => { setProfileOpen(false); navigate('admin'); }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-[#0B192C] hover:bg-[#F0F4F2] flex items-center gap-2 cursor-pointer"
                    >
                      Admin portal
                    </button>
                  )}
                </div>
                <div className="border-t border-[#E1E7E5] pt-1">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                      navigate('login');
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-[#C04A36] hover:bg-[#FDEEEB] flex items-center gap-2 cursor-pointer"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar */}
        <aside className="w-60 bg-[#FFFFFF] border-r border-[#E1E7E5] flex flex-col py-4 shrink-0 hidden md:flex">
          <nav className="flex flex-col gap-1.5 px-3">
            {navLinks.map(({ label, icon: Icon, page }) => {
              const active = currentPage === page;
              return (
                <button
                  key={label}
                  onClick={() => navigate(page)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all w-full text-left cursor-pointer ${
                    active
                      ? 'bg-[#E8F0EC] text-[#0B192C] shadow-xs'
                      : 'text-[#52616C] hover:bg-[#F0F4F2] hover:text-[#0B192C]'
                  }`}
                >
                  <Icon active={active} />
                  {label}
                </button>
              );
            })}
          </nav>

          {role === 'admin' && (
            <div className="mt-auto px-3 pt-4 border-t border-[#E1E7E5]">
              <button
                onClick={() => navigate('admin')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors w-full text-left cursor-pointer ${
                  currentPage === 'admin'
                    ? 'bg-[#E8F0EC] text-[#0B192C]'
                    : 'text-[#74817D] hover:bg-[#F0F4F2] hover:text-[#0B192C]'
                }`}
              >
                <AdminIcon active={currentPage === 'admin'} />
                Admin Portal
              </button>
            </div>
          )}
        </aside>

        {/* Mobile Slide-down / Drawer */}
        {mobileMenuOpen && (
          <div className="absolute inset-0 z-40 bg-[#0B192C]/20 backdrop-blur-xs md:hidden" onClick={() => setMobileMenuOpen(false)}>
            <div
              className="w-64 h-full bg-[#FFFFFF] border-r border-[#E1E7E5] p-4 flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#E1E7E5]">
                <span className="font-bold text-[#0B192C] text-lg" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Navigation</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-[#74817D] hover:text-[#0B192C]">✕</button>
              </div>
              <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
                {navLinks.map(({ label, icon: Icon, page }) => {
                  const active = currentPage === page;
                  return (
                    <button
                      key={label}
                      onClick={() => { navigate(page); setMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all w-full text-left cursor-pointer ${
                        active
                          ? 'bg-[#E8F0EC] text-[#0B192C]'
                          : 'text-[#52616C] hover:bg-[#F0F4F2] hover:text-[#0B192C]'
                      }`}
                    >
                      <Icon active={active} />
                      {label}
                    </button>
                  );
                })}

                {role === 'admin' && (
                  <button
                    onClick={() => { navigate('admin'); setMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all w-full text-left cursor-pointer mt-auto border-t border-[#E1E7E5] pt-3 ${
                      currentPage === 'admin'
                        ? 'bg-[#E8F0EC] text-[#0B192C]'
                        : 'text-[#74817D] hover:bg-[#F0F4F2] hover:text-[#0B192C]'
                    }`}
                  >
                    <AdminIcon active={currentPage === 'admin'} />
                    Admin Portal
                  </button>
                )}
              </nav>
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden bg-[#FFFFFF] border-t border-[#E1E7E5] px-4 py-2 flex items-center justify-around shrink-0 z-20" aria-label="Mobile Navigation">
        <button
          onClick={() => navigate('dashboard')}
          className={`flex flex-col items-center gap-1 text-xs font-semibold cursor-pointer ${currentPage === 'dashboard' ? 'text-[#52796F]' : 'text-[#74817D]'}`}
        >
          <HomeIcon active={currentPage === 'dashboard'} />
          <span>Feed</span>
        </button>
        <button
          onClick={() => navigate('mentor-profile')}
          className={`flex flex-col items-center gap-1 text-xs font-semibold cursor-pointer ${currentPage === 'mentor-profile' ? 'text-[#52796F]' : 'text-[#74817D]'}`}
        >
          <MentorsIcon active={currentPage === 'mentor-profile'} />
          <span>Mentors</span>
        </button>
        <button
          onClick={() => navigate('forums')}
          className={`flex flex-col items-center gap-1 text-xs font-semibold cursor-pointer ${currentPage === 'forums' ? 'text-[#52796F]' : 'text-[#74817D]'}`}
        >
          <ForumIcon active={currentPage === 'forums'} />
          <span>Forums</span>
        </button>
        <button
          onClick={() => navigate('messages')}
          className={`flex flex-col items-center gap-1 text-xs font-semibold cursor-pointer ${currentPage === 'messages' ? 'text-[#52796F]' : 'text-[#74817D]'}`}
        >
          <MsgIcon active={currentPage === 'messages'} />
          <span>Messages</span>
        </button>
        {role === 'admin' && (
          <button
            onClick={() => navigate('admin')}
            className={`flex flex-col items-center gap-1 text-xs font-semibold cursor-pointer ${currentPage === 'admin' ? 'text-[#52796F]' : 'text-[#74817D]'}`}
          >
            <AdminIcon active={currentPage === 'admin'} />
            <span>Admin</span>
          </button>
        )}
      </nav>
    </div>
  );
}

function HomeIcon({ active }: { active?: boolean }) {
  return (
    <svg className={`w-4 h-4 ${active ? 'text-[#52796F]' : 'text-[#74817D]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function MentorsIcon({ active }: { active?: boolean }) {
  return (
    <svg className={`w-4 h-4 ${active ? 'text-[#52796F]' : 'text-[#74817D]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MsgIcon({ active }: { active?: boolean }) {
  return (
    <svg className={`w-4 h-4 ${active ? 'text-[#52796F]' : 'text-[#74817D]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  );
}

function AdminIcon({ active }: { active?: boolean }) {
  return (
    <svg className={`w-4 h-4 ${active ? 'text-[#52796F]' : 'text-[#74817D]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ForumIcon({ active }: { active?: boolean }) {
  return (
    <svg className={`w-4 h-4 ${active ? 'text-[#52796F]' : 'text-[#74817D]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
    </svg>
  );
}
