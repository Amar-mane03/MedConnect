import { useEffect, useState } from 'react';
import type { Page } from '../App';
import API from '../api';
import { useAuth } from '../context/AuthContext';

interface HomeProps {
  navigate: (page: Page) => void;
  openAuth: (mode: 'login' | 'register') => void;
}

interface PublicNGO {
  _id: string;
  name: string;
  mission: string;
  logoUrl: string;
  causeTags: string[];
  location: string;
  beneficiariesServed: number;
  campsCompleted: number;
  isDemo?: boolean;
}

interface PublicCamp {
  id: string;
  title: string;
  causeCategory: string;
  startAt: string;
  venue: string;
  isDemo?: boolean;
  ngo?: { name: string };
}

export default function HomePage({ navigate, openAuth }: HomeProps) {
  const { role, isAuthenticated } = useAuth();
  const [ngos, setNgos] = useState<PublicNGO[]>([]);
  const [camps, setCamps] = useState<PublicCamp[]>([]);
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [ngoPreviewUnavailable, setNgoPreviewUnavailable] = useState(false);
  const [campPreviewUnavailable, setCampPreviewUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    setPreviewLoading(true);
    Promise.allSettled([API.get('/community/ngos'), API.get('/community/camps')])
      .then(([ngoResult, campResult]) => {
        if (!active) return;
        const ngosValid = ngoResult.status === 'fulfilled' && Array.isArray(ngoResult.value.data?.ngos);
        const campsValid = campResult.status === 'fulfilled' && Array.isArray(campResult.value.data?.camps);
        setNgos(ngosValid ? ngoResult.value.data.ngos.slice(0, 3) : []);
        setCamps(campsValid ? campResult.value.data.camps.slice(0, 3) : []);
        setNgoPreviewUnavailable(!ngosValid);
        setCampPreviewUnavailable(!campsValid);
        if (!ngosValid || !campsValid) {
          if (ngoResult.status === 'rejected') console.error('Unable to load public organizations:', ngoResult.reason);
          else if (!ngosValid) console.error('The public organization endpoint returned an invalid response.');
          if (campResult.status === 'rejected') console.error('Unable to load public camps:', campResult.reason);
          else if (!campsValid) console.error('The public camps endpoint returned an invalid response.');
          setPreviewError('Some live listings could not be loaded. Check the backend connection and try again.');
        } else setPreviewError('');
      })
      .finally(() => { if (active) setPreviewLoading(false); });
    return () => { active = false; };
  }, [previewAttempt]);

  const dashboardPage: Page = role === 'admin' ? 'ngo-admin' : role === 'ngo' ? 'ngo-dashboard' : 'dashboard';

  return (
    <div className="min-h-screen bg-white text-[#0B192C]">
      <header className="sticky top-0 z-30 border-b border-[#E1E7E5] bg-white/95 px-5 backdrop-blur sm:px-8">
        <nav className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4" aria-label="Main navigation">
          <a href="/" onClick={(event) => { event.preventDefault(); navigate('home'); }} className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0B192C] text-sm font-bold text-white">G</span>
            <span className="text-lg font-bold">Good Neighbors</span>
          </a>
          <div className="hidden items-center gap-7 text-sm font-semibold text-[#52616C] md:flex">
            <button onClick={() => navigate('ngos')} className="hover:text-[#35564E]">Explore NGOs</button>
            <button onClick={() => navigate('camps')} className="hover:text-[#35564E]">Upcoming camps</button>
            <button onClick={() => navigate('community')} className="rounded-full bg-[#E8F0EC] px-3 py-2 font-bold text-[#35564E] hover:bg-[#DCEAE2]">Community</button>
            {isAuthenticated && <button onClick={() => navigate(dashboardPage)} className="hover:text-[#35564E]">{role === 'ngo' ? 'NGO dashboard' : role === 'admin' ? 'Admin review' : 'Learning workspace'}</button>}
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated ? <button onClick={() => navigate(dashboardPage)} className="rounded-lg bg-[#0B192C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#192B40]">Open workspace</button> : <><button onClick={() => openAuth('login')} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52616C] hover:text-[#0B192C]">Sign in</button><button onClick={() => openAuth('register')} className="rounded-lg bg-[#0B192C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#192B40]">Join the community</button></>}
          </div>
        </nav>
        <div className="mx-auto flex max-w-7xl gap-5 pb-3 text-xs font-semibold text-[#52616C] md:hidden">
          <button onClick={() => navigate('ngos')}>NGO directory</button><button onClick={() => navigate('camps')}>Camps</button><button onClick={() => navigate('community')} className="rounded-full bg-[#E8F0EC] px-3 py-1 font-bold text-[#35564E]">Community</button>
        </div>
      </header>

      <main>
        {previewError && <div role="alert" className="flex flex-wrap items-center justify-center gap-3 bg-amber-50 px-5 py-3 text-center text-sm text-amber-900 sm:px-8"><span>{previewError}</span><button onClick={() => setPreviewAttempt((attempt) => attempt + 1)} className="font-bold underline underline-offset-2">Retry</button></div>}
        <section className="bg-[#F7F9F8] px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#52796F]">Medical learning, mentorship, and community service</p>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Learn with clinicians. Serve your community.</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[#52616C] sm:text-lg">Connect with medical mentors, learn from clinical cases and study resources, and explore meaningful service opportunities with community organizations.</p>
              <div className="mt-8 flex flex-wrap gap-3"><button onClick={() => navigate('dashboard')} className="rounded-lg bg-[#0B192C] px-5 py-3 text-sm font-bold text-white hover:bg-[#192B40]">{isAuthenticated ? 'Open learning workspace' : 'Explore clinical learning'}</button><button onClick={() => navigate('camps')} className="rounded-lg border border-[#52796F] px-5 py-3 text-sm font-bold text-[#35564E] hover:bg-white">Find a volunteer camp</button><button onClick={() => navigate('ngos')} className="rounded-lg border border-[#52796F] px-5 py-3 text-sm font-bold text-[#35564E] hover:bg-white">Explore NGOs</button><button onClick={() => navigate('community')} className="rounded-lg border border-[#52796F] px-5 py-3 text-sm font-bold text-[#35564E] hover:bg-white">Explore community</button></div>
              <p className="mt-5 text-xs leading-5 text-[#74817D]">For students, volunteers, and nonprofit organizations coordinating community field work.</p>
              <blockquote className="mt-8 max-w-2xl border-l-2 border-[#A9BDB5] pl-5">
                <p className="text-lg leading-7 text-[#263847]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  “Every doctor carries something worth sharing. I built this because one of them changed how I see everything.”
                </p>
                <footer className="mt-3 text-sm font-semibold text-[#65736F]">Dr. Pratha · Oncology</footer>
              </blockquote>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#0B192C] p-6 text-white sm:col-span-2"><p className="text-xs font-bold uppercase tracking-widest text-[#A9C1B5]">Turn intent into impact</p><p className="mt-3 max-w-lg text-2xl leading-snug" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Local partnerships. Meaningful field experience. Measurable outcomes.</p></div>
              <div className="rounded-2xl border border-[#E1E7E5] bg-white p-5"><span className="text-2xl text-[#52796F]">01</span><h2 className="mt-3 font-bold">Find your cause</h2><p className="mt-1 text-xs leading-5 text-[#64727C]">Search trusted organizations and campaigns.</p></div>
              <div className="rounded-2xl border border-[#E1E7E5] bg-white p-5"><span className="text-2xl text-[#52796F]">02</span><h2 className="mt-3 font-bold">Learn by doing</h2><p className="mt-1 text-xs leading-5 text-[#64727C]">Apply for camps and build real-world skills.</p></div>
            </div>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-[#52796F]">More than camp listings</p>
              <h2 className="mt-2 text-3xl font-semibold" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Tools for every part of community work</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <article className="flex flex-col rounded-xl border border-[#E1E7E5] bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-[#52796F]">For volunteers</p>
                <h3 className="mt-2 text-lg font-bold">Track your field experience</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-[#52616C]">Apply for camps, manage waitlist and consent status, check in with your QR code, and download verified service hours.</p>
                <button onClick={() => isAuthenticated && (role === 'student' || role === 'mentee') ? navigate('activities') : isAuthenticated ? navigate('camps') : openAuth('register')} className="mt-5 self-start text-sm font-bold text-[#35564E] underline underline-offset-4">
                  {isAuthenticated && (role === 'student' || role === 'mentee') ? 'Open my activities' : 'Explore volunteer camps'}
                </button>
              </article>
              <article className="flex flex-col rounded-xl border border-[#E1E7E5] bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-[#52796F]">For organizations</p>
                <h3 className="mt-2 text-lg font-bold">Coordinate camps and impact</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-[#52616C]">Submit an NGO profile for review, publish opportunities, manage volunteers, send announcements, and report verified outcomes.</p>
                <button onClick={() => isAuthenticated && role === 'ngo' ? navigate('ngo-dashboard') : isAuthenticated ? navigate('ngos') : openAuth('register')} className="mt-5 self-start text-sm font-bold text-[#35564E] underline underline-offset-4">
                  {isAuthenticated && role === 'ngo' ? 'Open NGO dashboard' : 'Join as an NGO'}
                </button>
              </article>
              <article className="flex flex-col rounded-xl border border-[#E1E7E5] bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-[#52796F]">Trust and discovery</p>
                <h3 className="mt-2 text-lg font-bold">Explore verified local work</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-[#52616C]">Review organization impact, find camps on the map, and read or ask questions about camp details.</p>
                <button onClick={() => navigate('camps')} className="mt-5 self-start text-sm font-bold text-[#35564E] underline underline-offset-4">Browse camps and map</button>
              </article>
            </div>
          </div>
        </section>

        <section className="px-5 py-14 sm:px-8 sm:py-18">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#52796F]">Meet the community</p><h2 className="mt-2 text-3xl font-semibold" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Organizations to explore</h2></div><button onClick={() => navigate('ngos')} className="text-sm font-bold text-[#35564E] underline underline-offset-4">View NGO directory</button></div>
            {previewLoading ? <p role="status" className="rounded-xl border border-dashed border-[#C9D5D0] p-8 text-center text-sm text-[#64727C]">Loading verified organizations…</p> : ngoPreviewUnavailable ? <p className="rounded-xl border border-dashed border-[#C9D5D0] p-8 text-center text-sm text-[#64727C]">Verified organization listings are temporarily unavailable.</p> : ngos.length ? <div className="grid gap-4 md:grid-cols-3">{ngos.map((ngo) => <article key={ngo._id} className="rounded-xl border border-[#E1E7E5] bg-white p-5"><div className="flex items-center gap-3">{ngo.logoUrl ? <img src={ngo.logoUrl} alt="" className="h-11 w-11 rounded-lg object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#E8F0EC] font-bold text-[#35564E]">{ngo.name[0]}</span>}<div><h3 className="font-bold">{ngo.name}</h3>            <p className="text-xs text-[#64727C]">{ngo.location}</p></div></div>{ngo.isDemo && <span className="mt-3 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900">Demo Test</span>}<p className="mt-4 line-clamp-3 text-sm leading-6 text-[#52616C]">{ngo.mission}</p><p className="mt-4 text-xs font-semibold text-[#35564E]">{ngo.beneficiariesServed.toLocaleString()} beneficiaries served · {ngo.campsCompleted} camps completed</p></article>)}</div> : <p className="rounded-xl border border-dashed border-[#C9D5D0] p-8 text-center text-sm text-[#64727C]">No verified organizations are listed yet. Organizations can submit their profile for administrator verification to appear here.</p>}
          </div>
        </section>

        <section className="bg-[#F7F9F8] px-5 py-14 sm:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#52796F]">Get involved</p><h2 className="mt-2 text-3xl font-semibold" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Upcoming field camps</h2></div><button onClick={() => navigate('camps')} className="text-sm font-bold text-[#35564E] underline underline-offset-4">Browse all camps</button></div>
            {previewLoading ? <p role="status" className="rounded-xl border border-dashed border-[#C9D5D0] bg-white p-8 text-center text-sm text-[#64727C]">Loading upcoming volunteer camps…</p> : campPreviewUnavailable ? <p className="rounded-xl border border-dashed border-[#C9D5D0] bg-white p-8 text-center text-sm text-[#64727C]">Upcoming camp listings are temporarily unavailable.</p> : camps.length ? <div className="grid gap-4 md:grid-cols-3">{camps.map((camp) => <article key={camp.id} className="rounded-xl border border-[#E1E7E5] bg-white p-5"><span className="rounded-full bg-[#E8F0EC] px-2.5 py-1 text-xs font-bold text-[#35564E]            ">{camp.causeCategory}</span>{camp.isDemo && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900">Demo Test</span>}<h3 className="mt-4 text-lg font-bold">{camp.title}</h3><p className="mt-2 text-xs text-[#64727C]">{camp.ngo?.name} · {camp.venue}</p><p className="mt-3 text-sm font-semibold text-[#52616C]">{new Date(camp.startAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</p></article>)}</div> : <p className="rounded-xl border border-dashed border-[#C9D5D0] bg-white p-8 text-center text-sm text-[#64727C]">No real upcoming camps are listed yet. Verified organizations can publish opportunities from their dashboard; each published camp can accept applications.</p>}
          </div>
        </section>

        <section className="px-5 py-14 text-center sm:px-8 sm:py-20">
          <div className="mx-auto max-w-3xl"><p className="text-xs font-bold uppercase tracking-widest text-[#52796F]">Make your next step count</p><h2 className="mt-3 text-3xl font-semibold sm:text-4xl" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Your skills can make a difference.</h2><p className="mt-4 text-sm leading-6 text-[#64727C]">Join as a student volunteer to apply for camps and document service hours, or register your NGO to coordinate opportunities and report your impact.</p><button onClick={() => openAuth('register')} className="mt-6 rounded-lg bg-[#0B192C] px-5 py-3 text-sm font-bold text-white hover:bg-[#192B40]">Create your account</button></div>
        </section>
      </main>
      <footer className="border-t border-[#E1E7E5] px-5 py-6 text-center text-xs text-[#74817D]">Good Neighbors · A community platform for student training and NGO-led field work.</footer>
    </div>
  );
}
