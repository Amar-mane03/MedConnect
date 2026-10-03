import type { Page } from '../../App';

interface FooterProps {
  navigate: (page: Page) => void;
  openAuth: (mode: 'login' | 'register') => void;
}

export default function Footer({ navigate, openAuth }: FooterProps) {
  return (
    <footer className="border-t border-[#E1E7E5] bg-white px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <a href="#top" className="flex items-center gap-3 text-[#0B192C]">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0B192C] text-xs font-bold text-white">M</span>
          <span className="text-sm font-bold">MedConnect</span>
        </a>
        <p className="max-w-md text-xs leading-5 text-[#74817D]">A professional learning community for clinicians and trainees. Case discussions must not include identifiable patient information.</p>
        <div className="flex flex-wrap gap-4 text-xs font-semibold text-[#52616C]">
          <button onClick={() => navigate('resources')} className="hover:text-[#52796F]">Resources</button>
          <button onClick={() => openAuth('login')} className="hover:text-[#52796F]">Sign in</button>
        </div>
      </div>
    </footer>
  );
}