import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import type { Page } from '../App';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import CampMap from '../components/CampMap';

type VerificationStatus = 'pending' | 'verified' | 'rejected';
type ApplicationStatus = 'consent_pending' | 'pending' | 'approved' | 'rejected' | 'waitlisted' | 'completed' | 'cancelled';

interface NGO {
  _id: string;
  name: string;
  mission: string;
  logoUrl: string;
  causeTags: string[];
  location: string;
  website?: string;
  campaigns: { title: string; description: string; status: string }[];
  isDemo?: boolean;
  verificationStatus: VerificationStatus;
  verificationDocStatus?: 'unverified' | 'pending_review' | 'approved' | 'rejected';
  hasVerificationDocument?: boolean;
  beneficiariesServed: number;
  campsCompleted: number;
  volunteersEngaged: number;
  totalVerifiedHours?: number;
  owner?: { name: string; email: string };
}

interface Camp {
  id: string;
  title: string;
  causeCategory: string;
  description: string;
  startAt: string;
  endAt: string;
  venue: string;
  capacity: number;
  applicationsCount: number;
  prerequisiteSkills: string[];
  latitude?: number | null;
  longitude?: number | null;
  isApplied?: boolean;
  isWaitlisted?: boolean;
  isDemo?: boolean;
  hasReport?: boolean;
  ngo?: { id?: string; name: string; logoUrl?: string; location?: string };
}

interface CampApplication {
  id: string;
  status: ApplicationStatus;
  statement: string;
  volunteerHours: number;
  createdAt: string;
  completedAt?: string | null;
  badgeIssued?: boolean;
  checkedInAt?: string | null;
  consentStatus?: string;
  waitlistPosition?: number | null;
  student?: { id: string; name: string; email: string };
  camp?: { id: string; title: string; causeCategory: string; startAt: string; endAt: string; venue: string; ngo?: string };
}

interface ImpactReport {
  _id?: string;
  beneficiariesServed: number;
  volunteersAttended: number;
  resourcesDistributed: { kits: number; medicines: number; books: number; other: number };
  successNotes: string;
  photoUrls: string[];
  createdAt?: string;
  camp: { title: string; causeCategory: string; startAt: string; endAt: string; venue: string };
  ngo: { name: string; location: string; logoUrl?: string };
  attendeeApplicationIds: { student?: { name: string; email: string } }[];
}

interface NGOCommunityProps {
  page: Page;
  navigate: (page: Page) => void;
  openAuth: (mode: 'login' | 'register') => void;
}

const CAUSES = ['Healthcare', 'Education', 'Environment', 'Community Development', 'Food Security', 'Disaster Relief'];
const inputClass = 'w-full rounded-lg border border-[#DCE5E1] bg-white px-3.5 py-2.5 text-sm text-[#0B192C] outline-none transition focus:border-[#52796F] focus:ring-2 focus:ring-[#52796F]/15';
const buttonClass = 'inline-flex items-center justify-center rounded-lg bg-[#0B192C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#192B40] disabled:cursor-not-allowed disabled:opacity-50';

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function dateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function localDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-[#E1E7E5] bg-white p-5 shadow-[0_8px_25px_rgba(11,25,44,0.035)] sm:p-6 ${className}`}>{children}</section>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-7 max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#52796F]">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight text-[#0B192C] sm:text-4xl" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>{title}</h1>
      <p className="mt-3 text-sm leading-6 text-[#64727C]">{description}</p>
    </div>
  );
}

export default function NGOCommunity({ page, navigate, openAuth }: NGOCommunityProps) {
  const { user, role, isAuthenticated, logout } = useAuth();
  const title = page === 'ngos' ? 'NGO directory' : page === 'camps' ? 'Upcoming camps' : page === 'activities' ? 'My activities' : page === 'ngo-dashboard' ? 'NGO dashboard' : 'NGO verification';
  const roleLinks: { label: string; page: Page }[] = role === 'ngo'
    ? [{ label: 'Dashboard', page: 'ngo-dashboard' }, { label: 'Explore camps', page: 'camps' }, { label: 'NGO directory', page: 'ngos' }]
    : role === 'admin'
      ? [{ label: 'Verification queue', page: 'ngo-admin' }, { label: 'NGO directory', page: 'ngos' }, { label: 'Camps', page: 'camps' }]
      : role === 'student' || role === 'mentee'
        ? [{ label: 'Learning feed', page: 'dashboard' }, { label: 'Mentors', page: 'mentor-profile' }, { label: 'Study resources', page: 'resources' }, { label: 'Discussions', page: 'forums' }, { label: 'Messages', page: 'messages' }, { label: 'Learning groups', page: 'groups' }, { label: 'Events', page: 'events' }, { label: 'My activities', page: 'activities' }, { label: 'Find camps', page: 'camps' }, { label: 'NGO directory', page: 'ngos' }]
        : [{ label: 'NGO directory', page: 'ngos' }, { label: 'Upcoming camps', page: 'camps' }];
  if (!roleLinks.some((link) => link.page === 'community')) roleLinks.push({ label: 'Community', page: 'community' });

  const content = (
    <div className={isAuthenticated ? 'bg-[#F7F9F8] text-[#0B192C]' : 'min-h-screen bg-[#F7F9F8] text-[#0B192C]'}>
      {!isAuthenticated && <header className="sticky top-0 z-30 border-b border-[#E1E7E5] bg-white/95 px-4 shadow-[0_2px_10px_rgba(11,25,44,0.04)] backdrop-blur sm:px-6">
        <div className="mx-auto flex min-h-[60px] max-w-7xl items-center justify-between gap-3 sm:min-h-[68px]">
          <button onClick={() => navigate('home')} className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-lg font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52796F]">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0B192C] text-sm text-white">G</span>
            <span className="truncate text-base sm:text-lg">Good Neighbors</span>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            {isAuthenticated ? (
              <>
                <span className="hidden max-w-40 truncate text-xs font-semibold text-[#64727C] lg:inline" title={user?.name}>{user?.name}</span>
                <button onClick={() => { logout(); navigate('home'); }} className="rounded-lg border border-[#DCE5E1] px-2.5 py-2 text-xs font-semibold text-[#52616C] transition hover:border-[#A9C1B5] hover:bg-[#F7F9F8] sm:px-3">Sign out</button>
              </>
            ) : (
              <>
                <button onClick={() => openAuth('login')} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-[#52616C] transition hover:bg-[#F7F9F8] hover:text-[#0B192C] sm:px-3 sm:text-sm">Sign in</button>
                <button onClick={() => openAuth('register')} className={`${buttonClass} px-3 py-2 text-xs sm:px-4 sm:text-sm`}>Join</button>
              </>
            )}
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1.5 overflow-x-auto overscroll-x-contain border-t border-[#F0F3F1] py-2 [scrollbar-width:thin] xl:flex-wrap xl:justify-center xl:overflow-visible" aria-label="Community navigation">
          {roleLinks.map((link) => (
            <button
              key={link.page}
              onClick={() => navigate(link.page)}
              aria-current={page === link.page ? 'page' : undefined}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52796F] sm:px-3.5 sm:text-sm ${page === link.page ? 'bg-[#E8F0EC] text-[#35564E]' : 'text-[#52616C] hover:bg-[#F0F4F2] hover:text-[#0B192C]'}`}
            >
              {link.label}
            </button>
          ))}
        </nav>
      </header>}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
        {page === 'ngos' && <DirectoryPage navigate={navigate} openAuth={openAuth} />}
        {page === 'camps' && <CampsPage navigate={navigate} openAuth={openAuth} />}
        {page === 'activities' && <ActivitiesPage />}
        {page === 'ngo-dashboard' && <NGODashboard />}
        {page === 'ngo-admin' && <NGOAdminPage />}
      </main>
      <footer className="border-t border-[#E1E7E5] bg-white px-4 py-6 text-center text-xs leading-5 text-[#74817D] sm:px-8">
        Medical learning, clinician mentorship, and community-led volunteering. Verify every opportunity with its host organization.
      </footer>
    </div>
  );
  return isAuthenticated ? <Layout navigate={navigate} currentPage={page}>{content}</Layout> : content;
}

function DirectoryPage({ navigate, openAuth }: { navigate: (page: Page) => void; openAuth: (mode: 'login' | 'register') => void }) {
  const { role, isAuthenticated } = useAuth();
  const [ngos, setNgos] = useState<NGO[]>([]);
  const [selected, setSelected] = useState<NGO | null>(null);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [cause, setCause] = useState('All causes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailCamps, setDetailCamps] = useState<Camp[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadNGOs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await API.get('/community/ngos', { params: { search, location, cause } });
      if (!Array.isArray(response.data?.ngos)) throw new Error('The NGO API returned an invalid response.');
      setNgos(response.data.ngos);
    } catch (requestError) {
      setNgos([]);
      setError(errorMessage(requestError, 'Could not load verified organizations.'));
    } finally {
      setLoading(false);
    }
  }, [search, location, cause]);

  useEffect(() => { void loadNGOs(); }, [loadNGOs]);

  const openDetail = async (ngo: NGO) => {
    setSelected(ngo);
    setDetailLoading(true);
    try {
      const response = await API.get(`/community/ngos/${ngo._id}`);
      setSelected(response.data.ngo);
      setDetailCamps(response.data.activeCamps || []);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not load this NGO profile.'));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      <PageHeading eyebrow="Find trusted local partners" title="Meet the organizations making a difference." description="Explore verified organizations and the real volunteer opportunities they publish." />
      <Panel className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
          <label className="sr-only" htmlFor="ngo-search">Search organizations</label>
          <input id="ngo-search" className={inputClass} placeholder="Search name, mission, or cause" value={search} onChange={(event) => setSearch(event.target.value)} />
          <label className="sr-only" htmlFor="ngo-location">Filter by location</label>
          <input id="ngo-location" className={inputClass} placeholder="City or region" value={location} onChange={(event) => setLocation(event.target.value)} />
          <label className="sr-only" htmlFor="ngo-cause">Filter by cause</label>
          <select id="ngo-cause" className={inputClass} value={cause} onChange={(event) => setCause(event.target.value)}>
            <option>All causes</option>{CAUSES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button onClick={() => void loadNGOs()} className={buttonClass}>Search NGOs</button>
        </div>
      </Panel>
      {error && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>{error}</span><button onClick={() => void loadNGOs()} className="font-bold underline underline-offset-2">Retry</button></div>}
      {loading ? <p role="status" className="py-10 text-center text-sm text-[#64727C]">Loading verified organizations…</p> : ngos.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ngos.map((ngo) => (
            <Panel key={ngo._id} className="flex flex-col">
              <div className="flex items-start gap-4">
                <NGOLogo ngo={ngo} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-bold">{ngo.name}</h2>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${ngo.isDemo ? 'bg-amber-100 text-amber-900' : 'bg-[#E8F0EC] text-[#35564E]'}`}>{ngo.isDemo ? 'Demo Test' : 'Verified'}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#64727C]">{ngo.location}</p>
                </div>
              </div>
              <p className="mt-4 line-clamp-3 flex-1 text-sm leading-6 text-[#52616C]">{ngo.mission}</p>
              <div className="mt-4 flex flex-wrap gap-2">{ngo.causeTags.map((tag) => <span key={tag} className="rounded-full bg-[#F0F4F2] px-2.5 py-1 text-xs font-semibold text-[#52616C]">{tag}</span>)}</div>
              <div className="mt-5 grid grid-cols-3 border-y border-[#E8ECEA] py-3 text-center">
                <Metric label="Beneficiaries" value={ngo.beneficiariesServed} />
                <Metric label="Camps" value={ngo.campsCompleted} />
                <Metric label="Verified hours" value={ngo.totalVerifiedHours || 0} />
              </div>
              <button onClick={() => void openDetail(ngo)} className="mt-4 self-start text-sm font-bold text-[#35564E] underline underline-offset-4">View organization & opportunities</button>
            </Panel>
          ))}
        </div>
      ) : ngos.length === 0 && !error ? (
        <Panel>
          <h2 className="text-lg font-bold">{search || location || cause !== 'All causes' ? 'No verified organizations match these filters' : 'No verified organizations are listed yet'}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64727C]">
            {search || location || cause !== 'All causes'
              ? 'Try a different cause, organization name, or location.'
              : 'Organizations appear here after they submit their profile and verification documents and an administrator approves them. Once verified, they can publish real volunteer camps.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => isAuthenticated && role === 'ngo' ? navigate('ngo-dashboard') : isAuthenticated ? navigate('camps') : openAuth('register')} className={buttonClass}>
              {isAuthenticated && role === 'ngo' ? 'Continue NGO setup' : isAuthenticated ? 'Browse volunteer camps' : 'Register as an organization'}
            </button>
            <button onClick={() => void loadNGOs()} className="rounded-lg border border-[#DCE5E1] px-4 py-2.5 text-sm font-semibold text-[#52616C] hover:bg-[#F7F9F8]">Refresh listings</button>
          </div>
        </Panel>
      ) : null}
      {selected && <NGODetailModal ngo={selected} camps={detailCamps} loading={detailLoading} onClose={() => setSelected(null)} onCamps={() => { setSelected(null); navigate('camps'); }} />}
    </>
  );
}

function NGOLogo({ ngo }: { ngo: Pick<NGO, 'name' | 'logoUrl'> }) {
  return ngo.logoUrl
    ? <img src={ngo.logoUrl} alt={`${ngo.name} logo`} className="h-14 w-14 shrink-0 rounded-xl border border-[#E1E7E5] object-cover" />
    : <div aria-label={`${ngo.name} logo placeholder`} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#E8F0EC] text-lg font-bold text-[#35564E]">{ngo.name.slice(0, 1).toUpperCase()}</div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-lg font-bold text-[#0B192C]">{value.toLocaleString()}</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#74817D]">{label}</p></div>;
}

function NGODetailModal({ ngo, camps, loading, onClose, onCamps }: { ngo: NGO; camps: Camp[]; loading: boolean; onClose: () => void; onCamps: () => void }) {
  return (
    <Modal title={ngo.name} onClose={onClose}>
      <div className="flex items-center gap-4"><NGOLogo ngo={ngo} /><div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ngo.isDemo ? 'bg-amber-100 text-amber-900' : 'bg-[#E8F0EC] text-[#35564E]'}`}>{ngo.isDemo ? 'Demo Test' : 'Verified partner'}</span><p className="mt-2 text-sm text-[#64727C]">{ngo.location}</p></div></div>
      <h3 className="mt-6 text-sm font-bold">Our mission</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#52616C]">{ngo.mission}</p>
      <div className="mt-5 flex flex-wrap gap-2">{ngo.causeTags.map((tag) => <span key={tag} className="rounded-full bg-[#F0F4F2] px-2.5 py-1 text-xs font-semibold text-[#52616C]">{tag}</span>)}</div>
      <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg bg-[#F7F9F8] p-4 text-center"><Metric label="Beneficiaries" value={ngo.beneficiariesServed} /><Metric label="Camps completed" value={ngo.campsCompleted} /><Metric label="Verified hours" value={ngo.totalVerifiedHours || 0} /></div>
      {ngo.campaigns?.length > 0 && <div className="mt-6"><h3 className="text-sm font-bold">Campaigns</h3><ul className="mt-2 space-y-2">{ngo.campaigns.map((campaign) => <li key={campaign.title} className="rounded-lg border border-[#E1E7E5] p-3"><p className="text-sm font-semibold">{campaign.title}</p><p className="mt-1 text-xs leading-5 text-[#64727C]">{campaign.description}</p><span className="mt-2 inline-block text-[10px] font-bold uppercase text-[#52796F]">{campaign.status}</span></li>)}</ul></div>}
      <div className="mt-6"><h3 className="text-sm font-bold">Upcoming camps</h3>{loading ? <p className="mt-2 text-sm text-[#64727C]">Loading opportunities…</p> : camps.length ? <ul className="mt-2 space-y-2">{camps.map((camp) => <li key={camp.id} className="flex justify-between gap-3 rounded-lg bg-[#F7F9F8] p-3 text-sm"><span className="font-semibold">{camp.title}</span><span className="shrink-0 text-xs text-[#64727C]">{shortDate(camp.startAt)}</span></li>)}</ul> : <p className="mt-2 text-sm text-[#64727C]">No upcoming camps are listed yet.</p>}</div>
      <div className="mt-6 flex flex-wrap justify-end gap-2"><button onClick={onClose} className="rounded-lg border border-[#DCE5E1] px-4 py-2.5 text-sm font-semibold">Close</button><button onClick={onCamps} className={buttonClass}>Browse camps</button></div>
    </Modal>
  );
}

function CampsPage({ navigate, openAuth }: { navigate: (page: Page) => void; openAuth: (mode: 'login' | 'register') => void }) {
  const { role, isAuthenticated } = useAuth();
  const [camps, setCamps] = useState<Camp[]>([]);
  const [search, setSearch] = useState('');
  const [cause, setCause] = useState('All causes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [selectedCamp, setSelectedCamp] = useState<Camp | null>(null);
  const [detailsCamp, setDetailsCamp] = useState<Camp | null>(null);
  const [authPrompt, setAuthPrompt] = useState(false);
  const [statement, setStatement] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [consentMethod, setConsentMethod] = useState<'guardian_email' | 'signed_document'>('guardian_email');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [consentDocument, setConsentDocument] = useState<File | null>(null);
  const [applying, setApplying] = useState(false);
  const [notice, setNotice] = useState('');
  const [scrollToDetails, setScrollToDetails] = useState(false);
  const detailsPanelRef = useRef<HTMLElement>(null);

  const loadCamps = useCallback(async () => {
    setLoading(true);
    setError('');
    setLoadError('');
    try {
      const response = await API.get('/community/camps', { params: { search, cause } });
      if (!Array.isArray(response.data?.camps)) throw new Error('The camp API returned an invalid response.');
      setCamps(response.data.camps);
    } catch (requestError) {
      setCamps([]);
      setLoadError(errorMessage(requestError, 'Could not load upcoming camps.'));
    } finally {
      setLoading(false);
    }
  }, [search, cause]);

  useEffect(() => { void loadCamps(); }, [loadCamps]);

  useEffect(() => {
    if (!detailsCamp || !scrollToDetails) return;
    detailsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setScrollToDetails(false);
  }, [detailsCamp, scrollToDetails]);

  useEffect(() => {
    if (!selectedCamp || !isAuthenticated) return;
    API.get('/community/student/profile')
      .then((response) => setDateOfBirth(response.data.dateOfBirth ? String(response.data.dateOfBirth).slice(0, 10) : ''))
      .catch((requestError) => setError(errorMessage(requestError, 'Could not load your student profile.')));
  }, [selectedCamp, isAuthenticated]);

  const openApply = (camp: Camp) => {
    if (!isAuthenticated) {
      setAuthPrompt(true);
      return;
    }
    if (role !== 'student' && role !== 'mentee') return;
    setError('');
    setSelectedCamp(camp);
  };

  const openMappedCamp = useCallback((id: string) => {
    const camp = camps.find((item) => item.id === id);
    if (camp) {
      setScrollToDetails(false);
      setDetailsCamp(camp);
    }
  }, [camps]);

  const submitApplication = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCamp) return;
    setApplying(true);
    setError('');
    try {
      const form = new FormData();
      form.set('statement', statement);
      form.set('dateOfBirth', dateOfBirth);
      const age = calculateAge(dateOfBirth);
      if (age !== null && age < 18) {
        form.set('consentMethod', consentMethod);
        if (consentMethod === 'guardian_email') form.set('guardianEmail', guardianEmail);
        if (consentDocument) form.set('consentDocument', consentDocument);
      }
      const response = await API.post(`/community/camps/${selectedCamp.id}/applications`, form);
      setNotice(response.data.message || `Your application for ${selectedCamp.title} was submitted.`);
      setSelectedCamp(null);
      setStatement('');
      setConsentDocument(null);
      await loadCamps();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not submit your application.'));
    } finally {
      setApplying(false);
    }
  };

  const hasActiveFilters = search.trim().length > 0 || cause !== 'All causes';

  return (
    <>
      <PageHeading eyebrow="Volunteer locally" title="Find a camp where you can help." description="Browse real upcoming field camps published by verified organizations. Submit an application to the host and track its review in My activities." />
      <Panel className="mb-6">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="sr-only" htmlFor="camp-search">Search camps</label><input id="camp-search" className={inputClass} placeholder="Search camp, description, or venue" value={search} onChange={(event) => setSearch(event.target.value)} />
          <label className="sr-only" htmlFor="camp-cause">Filter by cause</label><select id="camp-cause" className={inputClass} value={cause} onChange={(event) => setCause(event.target.value)}><option>All causes</option>{CAUSES.map((item) => <option key={item}>{item}</option>)}</select>
          <button onClick={() => void loadCamps()} className={buttonClass}>Find camps</button>
        </div>
      </Panel>
      {notice && <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {loadError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>{loadError}</span><button onClick={() => void loadCamps()} className="font-bold underline underline-offset-2">Retry</button></div>}
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!loading && (
        <div className={`mb-6 items-start gap-6 ${detailsCamp ? 'grid md:grid-cols-2' : ''}`}>
          <Panel className={detailsCamp ? '' : 'mb-6'}><h2 className="mb-3 text-lg font-bold">Explore camps on the map</h2><CampMap camps={camps} onSelect={openMappedCamp} /></Panel>
          {detailsCamp && <section ref={detailsPanelRef} className="scroll-mt-6" aria-labelledby="selected-camp-title">
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-wide text-[#52796F]">{detailsCamp.causeCategory}</p>{detailsCamp.isDemo && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900">Demo Test</span>}</div>
                  <h2 id="selected-camp-title" className="mt-1 text-xl font-bold">{detailsCamp.title}</h2>
                </div>
                <button type="button" onClick={() => setDetailsCamp(null)} className="rounded-lg border border-[#DCE5E1] px-3 py-2 text-sm font-semibold text-[#52616C] hover:bg-[#F7F9F8]">Close details</button>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#52616C]">{detailsCamp.description || 'Join this field camp and support the local community.'}</p>
              <div className="mt-3 grid gap-2 rounded-lg bg-[#F7F9F8] p-3 text-sm text-[#52616C] sm:grid-cols-2">
                <p><strong className="text-[#0B192C]">Host:</strong> {detailsCamp.ngo?.name || 'Verified NGO'}{detailsCamp.ngo?.location ? ` · ${detailsCamp.ngo.location}` : ''}</p>
                <p><strong className="text-[#0B192C]">When:</strong> {dateTime(detailsCamp.startAt)}</p>
                <p><strong className="text-[#0B192C]">Venue:</strong> {detailsCamp.venue}</p>
                {detailsCamp.latitude != null && detailsCamp.longitude != null && <p><strong className="text-[#0B192C]">Map coordinates:</strong> {detailsCamp.latitude.toFixed(4)}, {detailsCamp.longitude.toFixed(4)}</p>}
                <p><strong className="text-[#0B192C]">Availability:</strong> {Math.max(0, detailsCamp.capacity - detailsCamp.applicationsCount)} spots</p>
              </div>
              <CampDiscussion campId={detailsCamp.id} role={role} isAuthenticated={isAuthenticated} openAuth={openAuth} />
              <div className="mt-5 flex justify-end">
                <button
                  disabled={detailsCamp.isApplied || detailsCamp.isWaitlisted || (isAuthenticated && role !== 'student' && role !== 'mentee')}
                  onClick={() => openApply(detailsCamp)}
                  className={buttonClass}
                >
                  {detailsCamp.isApplied ? 'Application submitted' : detailsCamp.isWaitlisted ? 'On the waitlist' : !isAuthenticated ? 'Sign in to apply' : role !== 'student' && role !== 'mentee' ? 'Student applications only' : detailsCamp.capacity <= detailsCamp.applicationsCount ? 'Apply for waitlist' : 'Apply to volunteer'}
                </button>
              </div>
            </Panel>
          </section>}
        </div>
      )}
      {loading ? <p role="status" className="py-10 text-center text-sm text-[#64727C]">Loading upcoming camps…</p> : loadError ? (
        <Panel><h2 className="text-lg font-bold">Camp listings are unavailable</h2><p className="mt-2 text-sm leading-6 text-[#64727C]">We could not check for current opportunities. Please retry when the service is available.</p><button onClick={() => void loadCamps()} className={`${buttonClass} mt-4`}>Retry</button></Panel>
      ) : camps.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {camps.map((camp) => (
            <Panel key={camp.id} className="flex flex-col">
              <div className="flex items-center justify-between gap-3"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-[#E8F0EC] px-2.5 py-1 text-xs font-bold text-[#35564E]">{camp.causeCategory}</span>{camp.isDemo && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">Demo Test</span>}</div><span className="text-xs font-semibold text-[#74817D]">{Math.max(0, camp.capacity - camp.applicationsCount)} spots left</span></div>
              <h2 className="mt-4 text-xl font-bold">{camp.title}</h2>
              <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-[#52616C]">{camp.description || 'Join this field camp and support the local community.'}</p>
              <div className="mt-4 space-y-2 border-t border-[#E8ECEA] pt-4 text-xs text-[#52616C]">
                <p><strong className="text-[#0B192C]">Host:</strong> {camp.ngo?.name || 'Verified NGO'}</p>
                <p><strong className="text-[#0B192C]">When:</strong> {dateTime(camp.startAt)}</p><p><strong className="text-[#0B192C]">Venue:</strong> {camp.venue}</p>
                {camp.latitude != null && camp.longitude != null && <p><strong className="text-[#0B192C]">Map:</strong> {camp.latitude.toFixed(4)}, {camp.longitude.toFixed(4)}</p>}
                {camp.prerequisiteSkills.length > 0 && <p><strong className="text-[#0B192C]">Skills:</strong> {camp.prerequisiteSkills.join(', ')}</p>}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button onClick={() => { setScrollToDetails(true); setDetailsCamp(camp); }} className="rounded-lg border border-[#DCE5E1] px-3 py-2.5 text-sm font-semibold">Details & Q&A</button>
                <button
                  disabled={camp.isApplied || camp.isWaitlisted || (isAuthenticated && role !== 'student' && role !== 'mentee')}
                  onClick={() => openApply(camp)}
                  className={buttonClass}
                >
                  {camp.isApplied ? 'Application submitted' : camp.isWaitlisted ? 'On the waitlist' : !isAuthenticated ? 'Sign in to apply' : role !== 'student' && role !== 'mentee' ? 'Student applications only' : camp.capacity <= camp.applicationsCount ? 'Apply for waitlist' : 'Apply to volunteer'}
                </button>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <>
          <Panel>
            <h2 className="text-lg font-bold">{hasActiveFilters ? 'No camps match these filters' : 'No real volunteer camps are open yet'}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64727C]">
              {hasActiveFilters
                ? 'Try another search or select All causes to see every upcoming camp.'
                : 'Only published camps from verified organizations appear here. Browse verified organizations, or organizations can register and submit their details for review before publishing opportunities.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={() => isAuthenticated && role === 'ngo' ? navigate('ngo-dashboard') : navigate('ngos')} className={buttonClass}>
                {isAuthenticated && role === 'ngo' ? 'Continue NGO setup' : 'Browse organizations'}
              </button>
              <button onClick={() => void loadCamps()} className="rounded-lg border border-[#DCE5E1] px-4 py-2.5 text-sm font-semibold text-[#52616C] hover:bg-[#F7F9F8]">Refresh camp listings</button>
            </div>
          </Panel>
        </>
      )}
      {selectedCamp && <Modal title={`Apply: ${selectedCamp.title}`} onClose={() => setSelectedCamp(null)}>
        <p className="text-sm leading-6 text-[#64727C]">Introduce yourself and tell {selectedCamp.ngo?.name || 'the host organization'} how you would like to contribute. The host reviews applications; submitting does not guarantee approval or a place. Keep your statement under 1,500 characters.</p>
        <form className="mt-4 space-y-4" onSubmit={(event) => void submitApplication(event)}>
          <label className="block text-sm font-semibold">Date of birth<input required type="date" max={new Date().toISOString().slice(0, 10)} className={`${inputClass} mt-1.5`} value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} /></label>
          <label className="block text-sm font-semibold">Volunteer statement<textarea required maxLength={1500} rows={5} className={`${inputClass} mt-1.5`} value={statement} onChange={(event) => setStatement(event.target.value)} /></label>
          <p className="text-right text-xs text-[#74817D]">{statement.length}/1,500</p>
          {calculateAge(dateOfBirth) !== null && calculateAge(dateOfBirth)! < 18 && <fieldset className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <legend className="px-1 text-sm font-bold text-amber-900">Parent or institutional consent required</legend>
            <p className="mb-3 text-xs leading-5 text-amber-900">Download the consent form for a parent, guardian, or faculty coordinator to sign. You can upload the signed form or request secure email sign-off.</p>
            <a href={`${API.defaults.baseURL}/community/consent/template.pdf`} target="_blank" rel="noreferrer" className="inline-block text-sm font-bold text-[#35564E] underline">Download consent form template (PDF)</a>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="consent-method" checked={consentMethod === 'guardian_email'} onChange={() => setConsentMethod('guardian_email')} />Email sign-off</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="consent-method" checked={consentMethod === 'signed_document'} onChange={() => setConsentMethod('signed_document')} />Upload signed form</label>
            </div>
            {consentMethod === 'guardian_email'
              ? <label className="mt-3 block text-sm font-semibold">Guardian or faculty coordinator email<input required type="email" className={`${inputClass} mt-1.5`} value={guardianEmail} onChange={(event) => setGuardianEmail(event.target.value)} /></label>
              : <label className="mt-3 block text-sm font-semibold">Signed consent document<input required type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className={`${inputClass} mt-1.5`} onChange={(event) => setConsentDocument(event.target.files?.[0] || null)} /></label>}
          </fieldset>}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setSelectedCamp(null)} className="rounded-lg border border-[#DCE5E1] px-4 py-2.5 text-sm font-semibold">Cancel</button><button disabled={applying} className={buttonClass}>{applying ? 'Submitting…' : 'Submit application'}</button></div>
        </form>
      </Modal>}
      {authPrompt && <Modal title="Join this camp" onClose={() => setAuthPrompt(false)}>
        <p className="text-sm leading-6 text-[#52616C]">Sign in or create a student/volunteer account to apply. The host organization reviews each application; if the camp is full, eligible applicants can join its waitlist.</p>
        <div className="mt-5 flex justify-end gap-2"><button onClick={() => setAuthPrompt(false)} className="rounded-lg border border-[#DCE5E1] px-4 py-2.5 text-sm font-semibold">Not now</button><button onClick={() => openAuth('login')} className="rounded-lg border border-[#DCE5E1] px-4 py-2.5 text-sm font-semibold">Sign in</button><button onClick={() => openAuth('register')} className={buttonClass}>Create student account</button></div>
      </Modal>}
    </>
  );
}

function calculateAge(dateOfBirth: string) {
  if (!dateOfBirth) return null;
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
  return age;
}

interface CampQuestion {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  replies: { authorName: string; authorRole: string; body: string; createdAt: string }[];
}

function CampDiscussion({ campId, role, isAuthenticated, openAuth }: { campId: string; role: string | null; isAuthenticated: boolean; openAuth: (mode: 'login' | 'register') => void }) {
  const [questions, setQuestions] = useState<CampQuestion[]>([]);
  const [body, setBody] = useState('');
  const [replyByQuestion, setReplyByQuestion] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const loadQuestions = useCallback(async () => {
    try {
      const response = await API.get(`/community/camps/${campId}/qa`);
      setQuestions(response.data.questions || []);
      setError('');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not load camp questions.'));
    }
  }, [campId]);
  useEffect(() => { void loadQuestions(); }, [loadQuestions]);

  const post = async (event: FormEvent, questionId?: string) => {
    event.preventDefault();
    if (!isAuthenticated) {
      openAuth('login');
      return;
    }
    const message = questionId ? replyByQuestion[questionId] || '' : body;
    if (!message.trim()) return;
    setSaving(true);
    setError('');
    try {
      await API.post(questionId ? `/community/camps/${campId}/qa/${questionId}/reply` : `/community/camps/${campId}/qa`, { body: message });
      setBody('');
      setReplyByQuestion((current) => ({ ...current, [questionId || '']: '' }));
      await loadQuestions();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not post to the camp discussion.'));
    } finally {
      setSaving(false);
    }
  };

  return <section className="mt-6 border-t border-[#E8ECEA] pt-5">
    <h3 className="font-bold">Camp questions & answers</h3>
    <p className="mt-1 text-xs text-[#64727C]">Registered volunteers can ask operational questions; the host organization can reply.</p>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-800">{error}</p>}
    <div className="mt-3 max-h-72 space-y-3 overflow-y-auto">
      {questions.map((question) => <article key={question.id} className="rounded-lg bg-[#F7F9F8] p-3">
        <p className="text-xs font-bold">{question.authorName}</p><p className="mt-1 whitespace-pre-wrap text-sm">{question.body}</p>
        {question.replies.map((reply, index) => <div key={`${question.id}-${index}`} className="ml-3 mt-3 border-l-2 border-[#A9C1B5] pl-3"><p className="text-xs font-bold">{reply.authorName} <span className="font-medium text-[#74817D]">({reply.authorRole})</span></p><p className="mt-1 whitespace-pre-wrap text-sm">{reply.body}</p></div>)}
        {role === 'ngo' && <form onSubmit={(event) => void post(event, question.id)} className="mt-3 flex gap-2"><input aria-label="Reply" className={inputClass} value={replyByQuestion[question.id] || ''} onChange={(event) => setReplyByQuestion((current) => ({ ...current, [question.id]: event.target.value }))} maxLength={2000} placeholder="Reply as the host organization" /><button disabled={saving} className={buttonClass}>Reply</button></form>}
      </article>)}
      {!questions.length && <p className="text-sm text-[#74817D]">No questions yet.</p>}
    </div>
    <form onSubmit={(event) => void post(event)} className="mt-4 space-y-2">
      <label className="block text-xs font-semibold">Ask a question<textarea className={`${inputClass} mt-1.5`} rows={3} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Ask about the venue, schedule, or what to bring" /></label>
      <div className="flex justify-end"><button disabled={saving || !body.trim()} className={buttonClass}>Post question</button></div>
    </form>
  </section>;
}

function ActivitiesPage() {
  const [applications, setApplications] = useState<CampApplication[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [completedCamps, setCompletedCamps] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [qrApplication, setQrApplication] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    API.get('/community/activities')
      .then((response) => {
        setApplications(response.data.applications || []);
        setTotalHours(response.data.totalHours || 0);
        setCompletedCamps(response.data.completedCamps || 0);
      })
      .catch((requestError) => setError(errorMessage(requestError, 'Could not load your volunteer activities.')))
      .finally(() => setLoading(false));
  }, []);

  const downloadTranscript = async () => {
    try {
      const response = await API.get('/community/activities/transcript.pdf', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'good-neighbors-verified-transcript.pdf';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setError('');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not create your verified transcript.'));
    }
  };

  const showQr = async (application: CampApplication) => {
    setBusyId(application.id);
    setError('');
    try {
      const response = await API.get(`/community/applications/${application.id}/qr`);
      setQrApplication(application.id);
      setQrCode(response.data.qrCode);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not load your camp check-in code.'));
    } finally {
      setBusyId('');
    }
  };

  const cancelApplication = async (application: CampApplication) => {
    if (!window.confirm(`Cancel your application for ${application.camp?.title || 'this camp'}? If your spot is approved, the next volunteer on the waitlist will be promoted.`)) return;
    setError('');
    setNotice('');
    try {
      const response = await API.post(`/community/applications/${application.id}/cancel`);
      setApplications((current) => current.map((item) => item.id === application.id ? { ...item, status: 'cancelled', waitlistPosition: null } : item));
      setNotice(response.data.message);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not cancel this camp application.'));
    }
  };

  const downloadCertificate = (application: CampApplication) => {
    const safe = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
    const certificate = `<!doctype html><html><head><meta charset="utf-8"><title>Volunteer Certificate</title><style>body{font-family:Georgia,serif;background:#f7f9f8;color:#0b192c;padding:48px}.certificate{max-width:780px;margin:0 auto;background:white;border:8px double #52796f;padding:56px;text-align:center}h1{font-size:38px}p{line-height:1.7}.hours{font-size:26px;font-weight:bold;color:#35564e}</style></head><body><main class="certificate"><p>COMMUNITY VOLUNTEER CERTIFICATE</p><h1>Certificate of Service</h1><p>This recognizes</p><h2>${safe(application.student?.name || 'Volunteer')}</h2><p>for completing volunteer service at <strong>${safe(application.camp?.title || 'Community Camp')}</strong>${application.camp?.ngo ? ` hosted by ${safe(application.camp.ngo)}` : ''}.</p><p class="hours">${application.volunteerHours} volunteer hours</p><p>Issued ${safe(application.completedAt ? shortDate(application.completedAt) : shortDate(application.createdAt))}</p><p>________________________<br>Authorized Organization Representative</p></main></body></html>`;
    const url = URL.createObjectURL(new Blob([certificate], { type: 'text/html' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `volunteer-certificate-${application.id}.html`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <PageHeading eyebrow="Your field training" title="Every hour of service counts." description="Track camp applications, display check-in codes, and export a verified transcript of your completed field work." />
      <div className="mb-5 flex justify-end"><button onClick={() => void downloadTranscript()} className={buttonClass}>Download verified transcript (PDF)</button></div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Panel><Metric label="Volunteer hours" value={totalHours} /></Panel><Panel><Metric label="Completed camps" value={completedCamps} /></Panel><Panel><Metric label="Applications" value={applications.length} /></Panel>
      </div>
      {notice && <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <Panel className="p-0">
        <div className="border-b border-[#E8ECEA] px-5 py-4"><h2 className="font-bold">My applications</h2></div>
        {loading ? <p role="status" className="p-6 text-sm text-[#64727C]">Loading activities…</p> : applications.length ? (
          <div className="divide-y divide-[#E8ECEA]">
            {applications.map((application) => <div key={application.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h3 className="font-semibold">{application.camp?.title || 'Camp'}</h3><p className="mt-1 text-xs text-[#64727C]">{application.camp?.ngo || 'NGO'} · {application.camp?.startAt ? shortDate(application.camp.startAt) : ''} · {application.camp?.venue}</p><p className="mt-1 text-xs text-[#74817D]">Applied {shortDate(application.createdAt)}</p></div>
              <div className="flex flex-wrap items-center gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusClass(application.status)}`}>{application.status.replace('_', ' ')}{application.waitlistPosition ? ` #${application.waitlistPosition}` : ''}</span>{application.status === 'approved' && <button disabled={busyId === application.id} onClick={() => void showQr(application)} className="rounded-lg border border-[#DCE5E1] px-3 py-2 text-xs font-semibold hover:bg-[#F7F9F8]">Show check-in QR</button>}{application.status === 'approved' && application.checkedInAt && <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-800">Checked in · badge issued</span>}{application.status === 'completed' && <><span className="text-sm font-bold text-[#35564E]">{application.volunteerHours} verified hrs</span><button onClick={() => downloadCertificate(application)} className="rounded-lg border border-[#DCE5E1] px-3 py-2 text-xs font-semibold hover:bg-[#F7F9F8]">Download certificate</button></>}{['consent_pending', 'pending', 'approved', 'waitlisted'].includes(application.status) && <button onClick={() => void cancelApplication(application)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Cancel application</button>}</div>
            </div>)}
          </div>
        ) : <EmptyState title="No camp applications yet" detail="Explore the camp calendar to find a volunteering opportunity." />}
      </Panel>
      {qrCode && <Modal title="Camp check-in QR code" onClose={() => { setQrCode(''); setQrApplication(''); }}><p className="text-sm text-[#64727C]">Show this private QR code to the camp coordinator at check-in. It can be used only once for this camp.</p><img className="mx-auto mt-4 h-72 w-72 max-w-full" src={qrCode} alt={`Check-in QR code for application ${qrApplication}`} /><p className="text-center text-xs font-semibold text-[#35564E]">Approved volunteer check-in</p></Modal>}
    </>
  );
}

function NGODashboard() {
  const [ngo, setNgo] = useState<NGO | null>(null);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [applications, setApplications] = useState<CampApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [scannerCamp, setScannerCamp] = useState<Camp | null>(null);
  const [announcementCampId, setAnnouncementCampId] = useState('');
  const [announcementSubject, setAnnouncementSubject] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [profileForm, setProfileForm] = useState({ name: '', mission: '', location: '', logoUrl: '', website: '', causeTags: 'Healthcare, Education', campaignEntries: '' });
  const [campEditing, setCampEditing] = useState<Camp | null>(null);
  const [campForm, setCampForm] = useState({ title: '', causeCategory: 'Healthcare', description: '', startAt: '', endAt: '', venue: '', latitude: '', longitude: '', capacity: '25', prerequisiteSkills: '' });
  const [reportCamp, setReportCamp] = useState<Camp | null>(null);
  const [report, setReport] = useState<ImpactReport | null>(null);
  const [reportForm, setReportForm] = useState({ beneficiariesServed: '0', volunteersAttended: '0', kits: '0', medicines: '0', books: '0', other: '0', successNotes: '', photoUrls: '', attendeeApplicationIds: [] as string[] });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profileResponse, campResponse, applicationResponse] = await Promise.all([
        API.get('/community/ngo/profile'),
        API.get('/community/ngo/camps'),
        API.get('/community/ngo/applications'),
      ]);
      const profile = profileResponse.data.ngo as NGO | null;
      setNgo(profile);
      setCamps(campResponse.data.camps || []);
      setApplications(applicationResponse.data.applications || []);
      if (profile) setProfileForm((form) => ({ ...form, name: profile.name, mission: profile.mission, location: profile.location, logoUrl: profile.logoUrl, website: profile.website || '', causeTags: profile.causeTags.join(', '), campaignEntries: (profile.campaigns || []).map((campaign) => `${campaign.title} | ${campaign.description}`).join('\n') }));
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not load the NGO dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const payload = {
      name: profileForm.name,
      mission: profileForm.mission,
      location: profileForm.location,
      logoUrl: profileForm.logoUrl,
      website: profileForm.website,
      causeTags: profileForm.causeTags.split(',').map((tag) => tag.trim()).filter(Boolean),
      campaigns: profileForm.campaignEntries.split(/\r?\n/).map((entry) => {
        const [title, ...description] = entry.split('|');
        return { title: title.trim(), description: description.join('|').trim(), status: 'active' };
      }).filter((campaign) => campaign.title),
    };
    try {
      const response = ngo
        ? await API.put(`/community/ngos/${ngo._id}`, payload)
        : await API.post('/community/ngos', payload);
      setNgo(response.data.ngo);
      setNotice(response.data.message);
      await loadDashboard();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not save the NGO profile.'));
    } finally {
      setSaving(false);
    }
  };

  const uploadVerificationDocument = async (event: FormEvent) => {
    event.preventDefault();
    if (!documentFile) return;
    const form = new FormData();
    form.set('document', documentFile);
    setSaving(true);
    setError('');
    try {
      const response = await API.post('/community/ngo/upload-doc', form);
      setNotice(response.data.message);
      setDocumentFile(null);
      await loadDashboard();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not upload the verification document.'));
    } finally {
      setSaving(false);
    }
  };

  const sendAnnouncement = async (event: FormEvent) => {
    event.preventDefault();
    if (!announcementCampId) return;
    setSaving(true);
    setError('');
    try {
      const response = await API.post(`/community/camps/${announcementCampId}/announce`, { subject: announcementSubject, body: announcementBody });
      setNotice(response.data.message);
      setAnnouncementSubject('');
      setAnnouncementBody('');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not send the camp announcement.'));
    } finally {
      setSaving(false);
    }
  };

  const submitCamp = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const payload = {
      ...campForm,
      capacity: Number(campForm.capacity),
      prerequisiteSkills: campForm.prerequisiteSkills.split(',').map((skill) => skill.trim()).filter(Boolean),
      startAt: new Date(campForm.startAt).toISOString(),
      endAt: new Date(campForm.endAt).toISOString(),
    };
    try {
      const response = campEditing
        ? await API.put(`/community/camps/${campEditing.id}`, payload)
        : await API.post('/community/camps', payload);
      setNotice(response.data.message);
      setCampEditing(null);
      setCampForm({ title: '', causeCategory: 'Healthcare', description: '', startAt: '', endAt: '', venue: '', latitude: '', longitude: '', capacity: '25', prerequisiteSkills: '' });
      await loadDashboard();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not save the camp.'));
    } finally {
      setSaving(false);
    }
  };

  const reviewApplication = async (application: CampApplication, action: 'approve' | 'reject') => {
    setError('');
    try {
      await API.patch(`/community/applications/${application.id}`, { action });
      await loadDashboard();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not update this application.'));
    }
  };

  const beginReport = (camp: Camp) => {
    setReportCamp(camp);
    setReport(null);
    setReportForm({ beneficiariesServed: '0', volunteersAttended: '0', kits: '0', medicines: '0', books: '0', other: '0', successNotes: '', photoUrls: '', attendeeApplicationIds: applications.filter((application) => application.camp?.id === camp.id && application.status === 'approved' && application.checkedInAt).map((application) => application.id) });
  };

  const viewReport = async (camp: Camp) => {
    setError('');
    try {
      const response = await API.get(`/community/camps/${camp.id}/report`);
      setReportCamp(camp);
      setReport(response.data.report);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not load this impact report.'));
    }
  };

  const submitReport = async (event: FormEvent) => {
    event.preventDefault();
    if (!reportCamp) return;
    setSaving(true);
    setError('');
    try {
      const response = await API.post(`/community/camps/${reportCamp.id}/report`, {
        beneficiariesServed: Number(reportForm.beneficiariesServed),
        volunteersAttended: Number(reportForm.volunteersAttended),
        resourcesDistributed: { kits: Number(reportForm.kits), medicines: Number(reportForm.medicines), books: Number(reportForm.books), other: Number(reportForm.other) },
        successNotes: reportForm.successNotes,
        photoUrls: reportForm.photoUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
        attendeeApplicationIds: reportForm.attendeeApplicationIds,
      });
      setReport(response.data.report);
      setNotice(response.data.message);
      await loadDashboard();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not generate this impact report.'));
    } finally {
      setSaving(false);
    }
  };

  const updateCampForm = (camp: Camp) => {
    setCampEditing(camp);
    setCampForm({
      title: camp.title,
      causeCategory: camp.causeCategory,
      description: camp.description,
      startAt: localDateTime(camp.startAt),
      endAt: localDateTime(camp.endAt),
      venue: camp.venue,
      latitude: camp.latitude === null || camp.latitude === undefined ? '' : String(camp.latitude),
      longitude: camp.longitude === null || camp.longitude === undefined ? '' : String(camp.longitude),
      capacity: String(camp.capacity),
      prerequisiteSkills: camp.prerequisiteSkills.join(', '),
    });
  };

  const pendingApplications = applications.filter((application) => application.status === 'pending');

  if (loading) return <p role="status" className="py-20 text-center text-sm text-[#64727C]">Loading organization dashboard…</p>;

  return (
    <>
      <PageHeading eyebrow="Organization workspace" title="Coordinate people and field impact." description="Keep your NGO profile current, publish upcoming camps, review volunteer applications, and document outcomes after each event." />
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {ngo && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E1E7E5] bg-white p-4">
        <div><p className="font-bold">{ngo.name}</p><p className="mt-1 text-xs text-[#64727C]">Profile status: <span className={`font-bold capitalize ${ngo.verificationStatus === 'verified' ? 'text-[#2E7D5A]' : ngo.verificationStatus === 'rejected' ? 'text-red-700' : 'text-amber-700'}`}>{ngo.verificationStatus}</span>{ngo.verificationStatus === 'rejected' ? ' · Update your profile and resubmit for review.' : ''}</p><p className="mt-1 text-xs text-[#64727C]">Document status: <span className="font-semibold capitalize">{(ngo.verificationDocStatus || 'unverified').replace('_', ' ')}</span></p></div>
        {ngo.verificationStatus === 'verified' && <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${ngo.isDemo ? 'bg-amber-100 text-amber-900' : 'bg-[#E8F0EC] text-[#35564E]'}`}>{ngo.isDemo ? 'Demo Test' : 'Verified partner'}</span>}
      </div>}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Panel>
          <h2 className="text-lg font-bold">{ngo ? 'Edit organization profile' : 'Submit your NGO for verification'}</h2>
          <p className="mt-1 text-xs leading-5 text-[#64727C]">Verified profiles appear in public search and can publish camps. Editing a verified profile returns it to the review queue.</p>
          <form onSubmit={(event) => void saveProfile(event)} className="mt-4 space-y-3">
            <Field label="Organization name" value={profileForm.name} onChange={(value) => setProfileForm({ ...profileForm, name: value })} required />
            <Field label="Mission statement" value={profileForm.mission} onChange={(value) => setProfileForm({ ...profileForm, mission: value })} required multiline />
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Location" value={profileForm.location} onChange={(value) => setProfileForm({ ...profileForm, location: value })} required /><Field label="Logo URL" value={profileForm.logoUrl} onChange={(value) => setProfileForm({ ...profileForm, logoUrl: value })} type="url" /></div>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Website" value={profileForm.website} onChange={(value) => setProfileForm({ ...profileForm, website: value })} type="url" /><Field label="Cause tags (comma-separated)" value={profileForm.causeTags} onChange={(value) => setProfileForm({ ...profileForm, causeTags: value })} /></div>
            <Field label="Campaigns (one per line: title | summary)" value={profileForm.campaignEntries} onChange={(value) => setProfileForm({ ...profileForm, campaignEntries: value })} multiline />
            <button disabled={saving} className={buttonClass}>{saving ? 'Saving…' : ngo ? 'Save and resubmit profile' : 'Submit organization profile'}</button>
          </form>
          <form onSubmit={(event) => void uploadVerificationDocument(event)} className="mt-5 border-t border-[#E8ECEA] pt-4">
            <h3 className="text-sm font-bold">Optional organization document</h3>
            <p className="mt-1 text-xs leading-5 text-[#64727C]">Upload a registration certificate or license (PDF, JPG, or PNG; maximum 10 MB). Documents are stored privately and reviewed by an administrator. This is optional for onboarding.</p>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} className={`${inputClass} mt-3`} />
            <button disabled={saving || !ngo || !documentFile} className={`${buttonClass} mt-3`}>{saving ? 'Uploading…' : 'Upload document for review'}</button>
          </form>
        </Panel>
        <div className="space-y-5">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{campEditing ? 'Edit upcoming camp' : 'Create a camp'}</h2><p className="mt-1 text-xs leading-5 text-[#64727C]">{ngo?.verificationStatus === 'verified' ? 'Publish or update a volunteer opportunity.' : 'A verified NGO profile is needed before a camp can be published.'}</p></div>{campEditing && <button type="button" onClick={() => { setCampEditing(null); setCampForm({ title: '', causeCategory: 'Healthcare', description: '', startAt: '', endAt: '', venue: '', latitude: '', longitude: '', capacity: '25', prerequisiteSkills: '' }); }} className="text-xs font-semibold text-[#52616C] underline">Cancel edit</button>}</div>
            <form onSubmit={(event) => void submitCamp(event)} className="mt-4 space-y-3">
              <Field label="Camp title" value={campForm.title} onChange={(value) => setCampForm({ ...campForm, title: value })} required />
              <label className="block text-xs font-bold">Cause category<select className={`${inputClass} mt-1.5`} value={campForm.causeCategory} onChange={(event) => setCampForm({ ...campForm, causeCategory: event.target.value })}>{CAUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
              <Field label="Camp details" value={campForm.description} onChange={(value) => setCampForm({ ...campForm, description: value })} multiline />
              <div className="grid gap-3 sm:grid-cols-2"><Field label="Starts" type="datetime-local" value={campForm.startAt} onChange={(value) => setCampForm({ ...campForm, startAt: value })} required /><Field label="Ends" type="datetime-local" value={campForm.endAt} onChange={(value) => setCampForm({ ...campForm, endAt: value })} required /></div>
              <div className="grid gap-3 sm:grid-cols-2"><Field label="Venue" value={campForm.venue} onChange={(value) => setCampForm({ ...campForm, venue: value })} required /><Field label="Volunteer capacity" type="number" value={campForm.capacity} onChange={(value) => setCampForm({ ...campForm, capacity: value })} required /></div>
              <div className="grid gap-3 sm:grid-cols-2"><Field label="Latitude (optional map pin)" type="number" step="any" value={campForm.latitude} onChange={(value) => setCampForm({ ...campForm, latitude: value })} /><Field label="Longitude (optional map pin)" type="number" step="any" value={campForm.longitude} onChange={(value) => setCampForm({ ...campForm, longitude: value })} /></div>
              <Field label="Prerequisite skills (comma-separated)" value={campForm.prerequisiteSkills} onChange={(value) => setCampForm({ ...campForm, prerequisiteSkills: value })} />
              <button disabled={saving || ngo?.verificationStatus !== 'verified'} className={buttonClass}>{saving ? 'Saving…' : campEditing ? 'Save camp changes' : 'Publish camp'}</button>
            </form>
          </Panel>
          <Panel><h2 className="text-lg font-bold">Your camps</h2>{camps.length ? <div className="mt-3 divide-y divide-[#E8ECEA]">{camps.map((camp) => <div key={camp.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{camp.title}</p><p className="mt-1 text-xs text-[#64727C]">{dateTime(camp.startAt)} · {camp.applicationsCount}/{camp.capacity} confirmed spots</p></div><div className="flex flex-wrap gap-2">{new Date(camp.startAt) > new Date() && <button onClick={() => updateCampForm(camp)} className="rounded-lg border border-[#DCE5E1] px-3 py-2 text-xs font-semibold">Edit</button>}{new Date(camp.startAt) <= new Date() && new Date(camp.endAt) >= new Date() && <button onClick={() => setScannerCamp(camp)} className="rounded-lg border border-[#DCE5E1] px-3 py-2 text-xs font-semibold">QR check-in</button>}{new Date(camp.endAt) < new Date() && <button onClick={() => camp.hasReport ? void viewReport(camp) : beginReport(camp)} className="rounded-lg bg-[#E8F0EC] px-3 py-2 text-xs font-bold text-[#35564E]">{camp.hasReport ? 'View impact report' : 'Generate report'}</button>}</div></div>)}</div> : <p className="mt-3 text-sm text-[#64727C]">No camps published yet.</p>}</Panel>
        </div>
      </div>
      <Panel className="mt-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Volunteer applications</h2><p className="mt-1 text-xs text-[#64727C]">{pendingApplications.length} awaiting your review</p></div><span className="rounded-full bg-[#F0F4F2] px-3 py-1 text-xs font-bold">{applications.length} total</span></div>
        {applications.length ? <div className="mt-3 divide-y divide-[#E8ECEA]">{applications.map((application) => <div key={application.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{application.student?.name || 'Student volunteer'}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold capitalize ${statusClass(application.status)}`}>{application.status}</span></div><p className="mt-1 text-xs text-[#64727C]">{application.student?.email} · {application.camp?.title}</p><p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-[#52616C]">{application.statement}</p></div>{application.status === 'pending' && <div className="flex shrink-0 gap-2"><button onClick={() => void reviewApplication(application, 'approve')} className="rounded-lg bg-[#E8F0EC] px-3 py-2 text-xs font-bold text-[#35564E]">Approve</button><button onClick={() => void reviewApplication(application, 'reject')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Reject</button></div>}</div>)}</div> : <p className="mt-4 text-sm text-[#64727C]">Volunteer applications appear here as students apply.</p>}
      </Panel>
      <Panel className="mt-5">
        <h2 className="text-lg font-bold">Broadcast an announcement</h2><p className="mt-1 text-xs text-[#64727C]">Deliver an in-app notification and email to approved volunteers for one camp.</p>
        <form onSubmit={(event) => void sendAnnouncement(event)} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block text-xs font-bold">Camp<select required className={`${inputClass} mt-1.5`} value={announcementCampId} onChange={(event) => setAnnouncementCampId(event.target.value)}><option value="">Select a camp</option>{camps.map((camp) => <option key={camp.id} value={camp.id}>{camp.title}</option>)}</select></label>
          <label className="block text-xs font-bold">Subject<input required maxLength={200} className={`${inputClass} mt-1.5`} value={announcementSubject} onChange={(event) => setAnnouncementSubject(event.target.value)} /></label>
          <label className="block text-xs font-bold md:col-span-2">Message<textarea required maxLength={3000} rows={4} className={`${inputClass} mt-1.5`} value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} /></label>
          <div className="md:col-span-2"><button disabled={saving || !camps.length} className={buttonClass}>Send to approved volunteers</button></div>
        </form>
      </Panel>
      {reportCamp && !report && <Modal title={`Post-camp report · ${reportCamp.title}`} onClose={() => setReportCamp(null)}>
        <form onSubmit={(event) => void submitReport(event)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Beneficiaries served" type="number" min="0" value={reportForm.beneficiariesServed} onChange={(value) => setReportForm({ ...reportForm, beneficiariesServed: value })} required /><Field label="Volunteers attended" type="number" min="0" value={reportForm.volunteersAttended} onChange={(value) => setReportForm({ ...reportForm, volunteersAttended: value })} required /></div>
          <fieldset><legend className="mb-2 text-sm font-bold">Resources distributed</legend><div className="grid grid-cols-2 gap-3"><Field label="Kits" type="number" min="0" value={reportForm.kits} onChange={(value) => setReportForm({ ...reportForm, kits: value })} /><Field label="Medicines" type="number" min="0" value={reportForm.medicines} onChange={(value) => setReportForm({ ...reportForm, medicines: value })} /><Field label="Books" type="number" min="0" value={reportForm.books} onChange={(value) => setReportForm({ ...reportForm, books: value })} /><Field label="Other resources" type="number" min="0" value={reportForm.other} onChange={(value) => setReportForm({ ...reportForm, other: value })} /></div></fieldset>
          <fieldset><legend className="text-sm font-bold">Checked-in student volunteers</legend><div className="mt-2 max-h-36 space-y-2 overflow-y-auto rounded-lg border border-[#E1E7E5] p-3">{applications.filter((application) => application.camp?.id === reportCamp.id && application.status === 'approved' && application.checkedInAt).map((application) => <label key={application.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reportForm.attendeeApplicationIds.includes(application.id)} onChange={(event) => setReportForm({ ...reportForm, attendeeApplicationIds: event.target.checked ? [...reportForm.attendeeApplicationIds, application.id] : reportForm.attendeeApplicationIds.filter((id) => id !== application.id) })} className="accent-[#52796F]" />{application.student?.name || application.student?.email}</label>)}{!applications.some((application) => application.camp?.id === reportCamp.id && application.status === 'approved' && application.checkedInAt) && <p className="text-xs text-[#74817D]">No student check-ins were recorded.</p>}</div><p className="mt-1 text-xs text-[#74817D]">Only scanned volunteers can receive verified completion hours and badges.</p></fieldset>
          <Field label="Success notes" value={reportForm.successNotes} onChange={(value) => setReportForm({ ...reportForm, successNotes: value })} multiline required />
          <Field label="Photo URLs (one per line)" value={reportForm.photoUrls} onChange={(value) => setReportForm({ ...reportForm, photoUrls: value })} multiline />
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setReportCamp(null)} className="rounded-lg border border-[#DCE5E1] px-4 py-2.5 text-sm font-semibold">Cancel</button><button disabled={saving} className={buttonClass}>{saving ? 'Generating…' : 'Generate impact report'}</button></div>
        </form>
      </Modal>}
      {report && <Modal title="Camp impact report" onClose={() => { setReport(null); setReportCamp(null); }}>
        <ImpactReportCard report={report} />
        <div className="no-print mt-5 flex justify-end gap-2"><button onClick={() => { setReport(null); setReportCamp(null); }} className="rounded-lg border border-[#DCE5E1] px-4 py-2.5 text-sm font-semibold">Close</button><button onClick={() => window.print()} className={buttonClass}>Print / save as PDF</button></div>
      </Modal>}
      {scannerCamp && <CampScanner camp={scannerCamp} onClose={() => setScannerCamp(null)} />}
    </>
  );
}

function CampScanner({ camp, onClose }: { camp: Camp; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [started, setStarted] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => () => controlsRef.current?.stop(), []);

  const checkIn = async (rawValue: string) => {
    let token = rawValue.trim();
    try {
      const parsed: unknown = JSON.parse(token);
      if (typeof parsed === 'object' && parsed !== null && 'token' in parsed && typeof parsed.token === 'string') token = parsed.token;
    } catch {
      // The camera may decode a raw token rather than the JSON payload.
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await API.post(`/community/camps/${camp.id}/scan`, { token });
      setMessage(`${response.data.message} Verified hours will be recorded after the camp report is submitted.`);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to check in this volunteer.'));
    } finally {
      setBusy(false);
      setTokenInput('');
    }
  };

  const startCamera = async () => {
    if (!videoRef.current) return;
    setError('');
    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (!result) return;
        controlsRef.current?.stop();
        setStarted(false);
        void checkIn(result.getText());
      });
      controlsRef.current = controls;
      setStarted(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not start the camera. Check browser permissions or use manual entry.');
    }
  };

  return <Modal title={`QR check-in · ${camp.title}`} onClose={() => { controlsRef.current?.stop(); onClose(); }}>
    <p className="text-sm text-[#64727C]">Scan the private QR code shown in the approved volunteer’s dashboard. Check-in is available only during the scheduled camp.</p>
    <video ref={videoRef} className="mt-4 max-h-72 w-full rounded-lg bg-[#0B192C]" muted playsInline />
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void startCamera()} disabled={started || busy} className={buttonClass}>{started ? 'Camera active' : 'Start camera scanner'}</button><button type="button" onClick={() => { controlsRef.current?.stop(); setStarted(false); }} className="rounded-lg border border-[#DCE5E1] px-4 py-2.5 text-sm font-semibold">Stop camera</button></div>
    <form onSubmit={(event) => { event.preventDefault(); void checkIn(tokenInput); }} className="mt-5 flex gap-2"><input aria-label="QR code contents" className={inputClass} value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} placeholder="Or paste QR code contents" /><button disabled={busy || !tokenInput.trim()} className={buttonClass}>Check in</button></form>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
  </Modal>;
}

function NGOAdminPage() {
  const [ngos, setNgos] = useState<NGO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get('/community/admin/ngos');
      setNgos(response.data.ngos || []);
      setError('');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not load the verification queue.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  const review = async (ngo: NGO, action: 'approve' | 'reject') => {
    setBusyId(ngo._id);
    setError('');
    try {
      await API.patch(`/community/admin/ngos/${ngo._id}`, { action });
      await loadQueue();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not update NGO verification.'));
    } finally {
      setBusyId('');
    }
  };

  const reviewDocument = async (ngo: NGO, action: 'approve' | 'reject') => {
    setBusyId(ngo._id);
    setError('');
    try {
      const response = await API.patch(`/community/admin/ngos/${ngo._id}/document`, { action });
      setError(response.data.message);
      await loadQueue();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not update the NGO document status.'));
    } finally {
      setBusyId('');
    }
  };

  const openDocument = async (ngo: NGO) => {
    setBusyId(ngo._id);
    setError('');
    try {
      const response = await API.get(`/community/admin/ngos/${ngo._id}/document`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not open the NGO verification document.'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <PageHeading eyebrow="Platform governance" title="Verify community organizations." description="Review NGO profile details before they appear in public search or can publish volunteer camps." />
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {loading ? <p role="status" className="py-10 text-center text-sm text-[#64727C]">Loading verification requests…</p> : ngos.length ? <div className="space-y-4">{ngos.map((ngo) => <Panel key={ngo._id}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start"><NGOLogo ngo={ngo} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{ngo.name}</h2><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">Profile: {ngo.verificationStatus}</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">Document: {(ngo.verificationDocStatus || 'unverified').replace('_', ' ')}</span></div><p className="mt-1 text-xs text-[#64727C]">{ngo.owner?.name} · {ngo.owner?.email} · {ngo.location}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#52616C]">{ngo.mission}</p><div className="mt-3 flex flex-wrap gap-2">{ngo.causeTags.map((tag) => <span key={tag} className="rounded-full bg-[#F0F4F2] px-2.5 py-1 text-xs font-semibold">{tag}</span>)}</div>{ngo.website && <a className="mt-3 inline-block text-xs font-semibold text-[#35564E] underline" target="_blank" rel="noreferrer" href={ngo.website}>Organization website</a>}</div><div className="flex shrink-0 flex-wrap gap-2">{ngo.verificationStatus === 'pending' && <><button disabled={busyId === ngo._id} onClick={() => void review(ngo, 'approve')} className="rounded-lg bg-[#E8F0EC] px-3 py-2 text-xs font-bold text-[#35564E]">Approve profile</button><button disabled={busyId === ngo._id} onClick={() => void review(ngo, 'reject')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Reject profile</button></>}{ngo.hasVerificationDocument && <><button disabled={busyId === ngo._id} onClick={() => void openDocument(ngo)} className="rounded-lg border border-[#DCE5E1] px-3 py-2 text-xs font-semibold">View document</button><button disabled={busyId === ngo._id} onClick={() => void reviewDocument(ngo, 'approve')} className="rounded-lg bg-[#E8F0EC] px-3 py-2 text-xs font-bold text-[#35564E]">Approve document</button><button disabled={busyId === ngo._id} onClick={() => void reviewDocument(ngo, 'reject')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Reject document</button></>}</div></div>
      </Panel>)}</div> : <EmptyState title="Verification queue is clear" detail="New NGO applications will appear here." />}
      <ConsentReviewQueue />
    </>
  );
}

function ConsentReviewQueue() {
  const [applications, setApplications] = useState<{ id: string; student?: { name: string; email: string }; camp?: { title: string }; submittedAt: string; hasDocument: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const load = useCallback(async () => {
    try {
      const response = await API.get('/community/admin/consents');
      setApplications(response.data.applications || []);
      setError('');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not load pending consent forms.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const approve = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      await API.patch(`/community/admin/consents/${id}`, { action: 'approve' });
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not approve this consent form.'));
    } finally {
      setBusyId('');
    }
  };

  const viewDocument = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      const response = await API.get(`/community/admin/consents/${id}/document`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not open the signed consent form.'));
    } finally {
      setBusyId('');
    }
  };

  return <Panel className="mt-6">
    <h2 className="text-lg font-bold">Minor consent review</h2>
    <p className="mt-1 text-xs text-[#64727C]">Review uploaded signed forms. Guardian email approvals are recorded automatically through their private link.</p>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {loading ? <p role="status" className="mt-4 text-sm text-[#64727C]">Loading consent queue…</p> : applications.length ? <div className="mt-3 divide-y divide-[#E8ECEA]">
      {applications.map((application) => <div key={application.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{application.student?.name || 'Student'} · {application.camp?.title || 'Camp'}</p><p className="mt-1 text-xs text-[#64727C]">{application.student?.email} · submitted {dateTime(application.submittedAt)}</p></div><div className="flex gap-2">{application.hasDocument && <button disabled={busyId === application.id} onClick={() => void viewDocument(application.id)} className="rounded-lg border border-[#DCE5E1] px-3 py-2 text-xs font-semibold">View signed form</button>}<button disabled={busyId === application.id} onClick={() => void approve(application.id)} className="rounded-lg bg-[#E8F0EC] px-3 py-2 text-xs font-bold text-[#35564E]">Approve consent</button></div></div>)}
    </div> : <p className="mt-4 text-sm text-[#64727C]">No uploaded consent forms are waiting for review.</p>}
  </Panel>;
}

function ImpactReportCard({ report }: { report: ImpactReport }) {
  const participants = report.attendeeApplicationIds.map((application) => application.student?.name).filter((name): name is string => Boolean(name));
  return <article className="printable-report mx-auto max-w-2xl border-2 border-[#52796F] bg-white p-6 sm:p-9">
    <div className="flex items-start justify-between gap-4 border-b border-[#DCE5E1] pb-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#52796F]">Community impact report</p><h2 className="mt-2 text-2xl font-semibold" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>{report.camp.title}</h2><p className="mt-1 text-sm text-[#64727C]">{report.ngo.name} · {report.ngo.location}</p></div>{report.ngo.logoUrl && <img src={report.ngo.logoUrl} alt={`${report.ngo.name} logo`} className="h-14 w-14 rounded-lg object-cover" />}</div>
    <p className="mt-4 text-xs text-[#64727C]">{report.camp.causeCategory} · {dateTime(report.camp.startAt)} · {report.camp.venue}</p>
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Beneficiaries', report.beneficiariesServed], ['Volunteers', report.volunteersAttended], ['Kits', report.resourcesDistributed.kits], ['Medicines', report.resourcesDistributed.medicines], ['Books', report.resourcesDistributed.books], ['Other', report.resourcesDistributed.other]].map(([label, value]) => <div key={label} className="rounded-lg bg-[#F4F7F5] p-3"><p className="text-xl font-bold text-[#0B192C]">{value}</p><p className="mt-1 text-[10px] font-bold uppercase text-[#74817D]">{label}</p></div>)}</div>
    <section className="mt-6"><h3 className="text-sm font-bold">Success notes</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#52616C]">{report.successNotes}</p></section>
    <section className="mt-6"><h3 className="text-sm font-bold">Participating student volunteers</h3>{participants.length ? <ul className="mt-2 grid gap-1 text-sm text-[#52616C] sm:grid-cols-2">{participants.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul> : <p className="mt-2 text-sm text-[#64727C]">No student participant names were recorded.</p>}</section>
    {report.photoUrls.length > 0 && <div className="mt-6 grid grid-cols-2 gap-2">{report.photoUrls.map((url) => <img key={url} src={url} alt="Camp impact" className="max-h-48 w-full rounded-lg object-cover" />)}</div>}
    <div className="mt-10 grid gap-8 border-t border-[#DCE5E1] pt-5 sm:grid-cols-2"><div><div className="h-8 border-b border-[#64727C]" /><p className="mt-2 text-xs text-[#64727C]">Authorized representative signature</p></div><div><div className="h-8 border-b border-[#64727C]" /><p className="mt-2 text-xs text-[#64727C]">Official organization stamp</p></div></div>
    <p className="mt-5 text-right text-[10px] text-[#74817D]">Generated {report.createdAt ? dateTime(report.createdAt) : 'today'}</p>
  </article>;
}

function Field({ label, value, onChange, type = 'text', required = false, multiline = false, min, step }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; multiline?: boolean; min?: string; step?: string }) {
  return <label className="block text-xs font-bold text-[#263847]">{label}{multiline
    ? <textarea required={required} rows={3} className={`${inputClass} mt-1.5`} value={value} onChange={(event) => onChange(event.target.value)} />
    : <input required={required} min={min} step={step} type={type} className={`${inputClass} mt-1.5`} value={value} onChange={(event) => onChange(event.target.value)} />}</label>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#0B192C]/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} className="my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#E1E7E5] bg-white p-5 shadow-2xl sm:p-7"><div className="mb-5 flex items-start justify-between gap-4"><h2 className="text-xl font-bold">{title}</h2><button onClick={onClose} aria-label="Close dialog" className="rounded-lg px-2 py-1 text-lg text-[#64727C] hover:bg-[#F0F4F2]">×</button></div>{children}</section></div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-xl border border-dashed border-[#C9D5D0] bg-white px-5 py-12 text-center"><h2 className="font-bold">{title}</h2><p className="mt-2 text-sm text-[#64727C]">{detail}</p></div>;
}

function statusClass(status: ApplicationStatus) {
  if (status === 'approved') return 'bg-blue-50 text-blue-800';
  if (status === 'completed') return 'bg-green-50 text-green-800';
  if (status === 'rejected') return 'bg-red-50 text-red-800';
  return 'bg-amber-50 text-amber-800';
}
