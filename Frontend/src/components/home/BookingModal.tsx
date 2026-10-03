import { useEffect, useRef } from 'react';
import type { Page } from '../../App';

interface BookingModalProps {
  isOpen: boolean;
  isAuthenticated: boolean;
  onClose: () => void;
  navigate: (page: Page) => void;
  openAuth: (mode: 'login' | 'register') => void;
}

export default function BookingModal({ isOpen, isAuthenticated, onClose, navigate, openAuth }: BookingModalProps) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#0B192C]/55 p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDownCapture={(event) => { if (event.key === 'Escape') onClose(); }}
    >
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="connect-title" className="my-auto w-full max-w-lg border border-[#E1E7E5] bg-white p-6 shadow-2xl outline-none sm:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase text-[#52796F]">A good place to begin</p>
            <h2 id="connect-title" className="mt-2 text-2xl leading-tight text-[#0B192C] sm:text-3xl" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Find your next clinical connection.
            </h2>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-[#52616C] hover:bg-[#F1F4F2]" aria-label="Close dialog">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-[#52616C]">
          MedConnect is a professional learning and mentorship community, not a patient-care clinic or appointment service.
        </p>
        <div className="mt-5 border-l-2 border-[#A9BDB5] bg-[#F5F7F6] px-4 py-3 text-sm leading-6 text-[#52616C]">
          Please do not enter patient names or other identifying health information. Share only de-identified cases in the community.
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
          {isAuthenticated ? (
            <button onClick={() => { onClose(); navigate('dashboard'); }} className="rounded-md bg-[#0B192C] px-5 py-3 text-sm font-semibold text-white hover:bg-[#192B40]">
              Continue to your dashboard
            </button>
          ) : (
            <>
              <button onClick={() => { onClose(); openAuth('login'); }} className="rounded-md border border-[#C8D4CF] px-5 py-3 text-sm font-semibold text-[#35564E] hover:bg-[#F5F7F6]">
                Sign in
              </button>
              <button onClick={() => { onClose(); openAuth('register'); }} className="rounded-md bg-[#0B192C] px-5 py-3 text-sm font-semibold text-white hover:bg-[#192B40]">
                Create your account
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}