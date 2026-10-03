import { useState } from 'react';

interface NavbarProps {
  onConnect: () => void;
  openAuth: (mode: 'login' | 'register') => void;
}

const links = [
  { label: 'Our approach', href: '#approach' },
  { label: 'Ways to connect', href: '#services' },
  { label: 'Mentors', href: '#mentors' },
];

export default function Navbar({ onConnect, openAuth }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[#E1E7E5] bg-white/95 px-5 backdrop-blur-sm sm:px-8 lg:px-12">
      <nav className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-4" aria-label="Main navigation">
        <a href="#top" className="flex shrink-0 items-center gap-3 text-[#0B192C]" aria-label="MedConnect home">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#0B192C] text-sm font-bold text-white">M</span>
          <span className="text-lg font-bold">MedConnect</span>
        </a>

        <div className="hidden items-center gap-8 text-sm font-medium text-[#52616C] lg:flex">
          {links.map((link) => <a key={link.href} href={link.href} className="transition-colors hover:text-[#52796F]">{link.label}</a>)}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button onClick={() => openAuth('login')} className="rounded-md px-3 py-2 text-sm font-semibold text-[#334653] hover:text-[#0B192C]">Sign in</button>
          <button onClick={onConnect} className="hidden rounded-md bg-[#0B192C] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#192B40] sm:inline-flex">
            Find a mentor
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="rounded-md p-2 text-[#0B192C] hover:bg-[#F1F4F2] lg:hidden"
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileOpen}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={mobileOpen ? 'M6 18 18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="border-t border-[#E1E7E5] py-3 lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="rounded-md px-2 py-3 text-sm font-medium text-[#52616C] hover:bg-[#F5F7F6]">
                {link.label}
              </a>
            ))}
            <button onClick={() => { setMobileOpen(false); onConnect(); }} className="mt-2 rounded-md bg-[#0B192C] px-4 py-3 text-left text-sm font-semibold text-white sm:hidden">
              Find a mentor
            </button>
          </div>
        </div>
      )}
    </header>
  );
}