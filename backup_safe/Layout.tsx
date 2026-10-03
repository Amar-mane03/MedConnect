import { useState } from 'react';
import type { Page } from '../App';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  navigate: (p: Page) => void;
  children: React.ReactNode;
  currentPage?: Page;
}

export default function Layout({ navigate, children, currentPage }: LayoutProps) {
  const { user, role, logout } = useAuth();
  const [searchVal, setSearchVal] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="flex flex-col h-screen overflow-hidden bg-[#F5F1EA] text-[#183D3A]">
      {/* Top Navbar */}
      <header className="h-16 bg-[#FFFCF8] border-b border-[#D8D2C8] flex items-center px-4 sm:px-6 gap-3 sm:gap-4 shrink-0 z-30">
        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg text-[#596965] hover:bg-[#F1EEE8] hover:text-[#183D3A] transition-colors cursor-pointer"
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
          <div className="w-9 h-9 rounded-full bg-[#D86F52] flex items-center justify-center shadow-sm">
            <span className="text-white font-extrabold text-base" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>M</span>
          </div>
          <span className="font-bold text-[#183D3A] text-xl tracking-tight" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
            MedConnect
          </span>
        </button>

        {/* Search bar */}
        <div className="flex-1 max-w-md mx-auto hidden sm:block">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71807C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              placeholder="Search clinical cases, mentors, specialties…"
              className="w-full pl-10 pr-4 py-2 text-sm bg-[#F1EEE8] text-[#183D3A] placeholder-[#71807C] rounded-full border border-[#D8D2C8]/70 focus:border-[#D86F52] focus:bg-[#FFFCF8] focus:outline-none focus:ring-2 focus:ring-[#D86F52]/15 transition-all"
            />
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F1EEE8] text-[#596965] hover:text-[#183D3A] transition-colors relative cursor-pointer"
              aria-label="Notifications"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-72 bg-[#FFFCF8] rounded-2xl shadow-xl border border-[#D8D2C8] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2.5 border-b border-[#D8D2C8] flex items-center justify-between">
                  <span className="text-sm font-bold text-[#183D3A]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Notifications</span>
                </div>
                <div className="px-4 py-6 text-center text-xs text-[#71807C]">
                  <p className="font-semibold text-[#183D3A]">All caught up!</p>
                  <p className="mt-1">No unread notifications at this time.</p>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Button & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1.5 rounded-full hover:bg-[#F1EEE8] transition-colors cursor-pointer border border-transparent hover:border-[#D8D2C8]"
              title="User Menu"
            >
              <div className="w-9 h-9 rounded-full bg-[#183D3A] flex items-center justify-center text-white text-xs font-bold ring-2 ring-[#D86F52]/30">
                {initials}
              </div>
              <div className="hidden lg:flex flex-col text-left leading-tight">
                <span className="text-xs font-bold text-[#183D3A] truncate max-w-[120px]">
                  {user?.name || 'Dr. Clinician'}
                </span>
                <span className="text-[10px] font-semibold text-[#D86F52] capitalize">
                  {role || 'Guest'}
                </span>
              </div>
              <svg className="w-3.5 h-3.5 text-[#71807C] hidden lg:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-12 w-64 bg-[#FFFCF8] rounded-2xl shadow-xl border border-[#D8D2C8] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-3 border-b border-[#D8D2C8]">
                  <p className="text-xs font-bold text-[#183D3A] truncate" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                    {user?.name || 'MedConnect User'}
                  </p>
                  <p className="text-[11px] text-[#71807C] truncate">{user?.email}</p>
                  <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FBE5DC] text-[#B9543D]">
                    <span>{role === 'mentor' ? '🩺 Verified Mentor' : role === 'admin' ? '🛡️ Administrator' : '🎓 Mentee'}</span>
                  </div>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { setProfileOpen(false); navigate('home'); }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-[#183D3A] hover:bg-[#F1EEE8] flex items-center gap-2 cursor-pointer"
                  >
                    <span>🏠</span> Home Landing Page
                  </button>
                  <button
                    onClick={() => { setProfileOpen(false); navigate('mentor-profile'); }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-[#183D3A] hover:bg-[#F1EEE8] flex items-center gap-2 cursor-pointer"
                  >
                    <span>👤</span> View Profile & Mentors
                  </button>
                  {role === 'admin' && (
                    <button
                      onClick={() => { setProfileOpen(false); navigate('admin'); }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-[#183D3A] hover:bg-[#F1EEE8] flex items-center gap-2 cursor-pointer"
                    >
                      <span>🛡️</span> Admin Portal
                    </button>
                  )}
                </div>
                <div className="border-t border-[#D8D2C8] pt-1">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                      navigate('login');
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-[#B9543D] hover:bg-[#FBE5DC] flex items-center gap-2 cursor-pointer"
                  >
                    <span>🚪</span> Sign Out / Switch Account
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
        <aside className="w-60 bg-[#FFFCF8] border-r border-[#D8D2C8] flex flex-col py-4 shrink-0 hidden md:flex">
          <nav className="flex flex-col gap-1.5 px-3">
            {navLinks.map(({ label, icon: Icon, page }) => {
              const active = currentPage === page;
              return (
                <button
                  key={label}
                  onClick={() => navigate(page)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all w-full text-left cursor-pointer ${
                    active
                      ? 'bg-[#FBE5DC] text-[#B9543D] shadow-xs'
                      : 'text-[#596965] hover:bg-[#F1EEE8] hover:text-[#183D3A]'
                  }`}
                >
                  <Icon active={active} />
                  {label}
                </button>
              );
            })}
          </nav>

          {role === 'admin' && (
            <div className="mt-auto px-3 pt-4 border-t border-[#EAE5DC]">
              <button
                onClick={() => navigate('admin')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors w-full text-left cursor-pointer ${
                  currentPage === 'admin'
                    ? 'bg-[#FBE5DC] text-[#B9543D]'
                    : 'text-[#71807C] hover:bg-[#F1EEE8] hover:text-[#183D3A]'
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
          <div className="absolute inset-0 z-40 bg-[#183D3A]/20 backdrop-blur-xs md:hidden" onClick={() => setMobileMenuOpen(false)}>
            <div
              className="w-64 h-full bg-[#FFFCF8] border-r border-[#D8D2C8] p-4 flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#D8D2C8]">
                <span className="font-bold text-[#183D3A] text-lg" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Navigation</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-[#71807C] hover:text-[#183D3A]">✕</button>
              </div>
              <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
                {navLinks.map(({ label, icon: Icon, page }) => {
                  const active = currentPage === page;
                  return (
                    <button
                      key={label}
                      onClick={() => { navigate(page); setMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all w-full text-left cursor-pointer ${
                        active
                          ? 'bg-[#FBE5DC] text-[#B9543D]'
                          : 'text-[#596965] hover:bg-[#F1EEE8] hover:text-[#183D3A]'
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
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all w-full text-left cursor-pointer mt-auto border-t border-[#EAE5DC] pt-3 ${
                      currentPage === 'admin'
                        ? 'bg-[#FBE5DC] text-[#B9543D]'
                        : 'text-[#71807C] hover:bg-[#F1EEE8] hover:text-[#183D3A]'
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
      <nav className="md:hidden bg-[#FFFCF8] border-t border-[#D8D2C8] px-4 py-2 flex items-center justify-around shrink-0 z-20" aria-label="Mobile Navigation">
        <button
          onClick={() => navigate('dashboard')}
          className={`flex flex-col items-center gap-1 text-xs font-semibold cursor-pointer ${currentPage === 'dashboard' ? 'text-[#D86F52]' : 'text-[#71807C]'}`}
        >
          <HomeIcon active={currentPage === 'dashboard'} />
          <span>Feed</span>
        </button>
        <button
          onClick={() => navigate('mentor-profile')}
          className={`flex flex-col items-center gap-1 text-xs font-semibold cursor-pointer ${currentPage === 'mentor-profile' ? 'text-[#D86F52]' : 'text-[#71807C]'}`}
        >
          <MentorsIcon active={currentPage === 'mentor-profile'} />
          <span>Mentors</span>
        </button>
        <button
          onClick={() => navigate('forums')}
          className={`flex flex-col items-center gap-1 text-xs font-semibold cursor-pointer ${currentPage === 'forums' ? 'text-[#D86F52]' : 'text-[#71807C]'}`}
        >
          <ForumIcon active={currentPage === 'forums'} />
          <span>Forums</span>
        </button>
        <button
          onClick={() => navigate('messages')}
          className={`flex flex-col items-center gap-1 text-xs font-semibold cursor-pointer ${currentPage === 'messages' ? 'text-[#D86F52]' : 'text-[#71807C]'}`}
        >
          <MsgIcon active={currentPage === 'messages'} />
          <span>Messages</span>
        </button>
        {role === 'admin' && (
          <button
            onClick={() => navigate('admin')}
            className={`flex flex-col items-center gap-1 text-xs font-semibold cursor-pointer ${currentPage === 'admin' ? 'text-[#D86F52]' : 'text-[#71807C]'}`}
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
    <svg className={`w-4 h-4 ${active ? 'text-[#D86F52]' : 'text-[#71807C]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function MentorsIcon({ active }: { active?: boolean }) {
  return (
    <svg className={`w-4 h-4 ${active ? 'text-[#D86F52]' : 'text-[#71807C]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MsgIcon({ active }: { active?: boolean }) {
  return (
    <svg className={`w-4 h-4 ${active ? 'text-[#D86F52]' : 'text-[#71807C]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  );
}

function AdminIcon({ active }: { active?: boolean }) {
  return (
    <svg className={`w-4 h-4 ${active ? 'text-[#D86F52]' : 'text-[#71807C]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ForumIcon({ active }: { active?: boolean }) {
  return (
    <svg className={`w-4 h-4 ${active ? 'text-[#D86F52]' : 'text-[#71807C]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
    </svg>
  );
}
