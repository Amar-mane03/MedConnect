import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import type { Page } from '../App';
import API from '../api';
import { useAuth } from '../context/AuthContext';

interface DashboardProps {
  navigate: (p: Page, meta?: any) => void;
  onSelectCase?: (id: string) => void;
  onSelectMentor?: (id: string) => void;
}

interface CaseItem {
  id?: string;
  _id?: string;
  title: string;
  specialty: string;
  subspecialty?: string;
  author: string;
  role: string;
  verified?: boolean;
  upvotes: number;
  upvotedUsers?: string[];
  comments: number;
  preview: string;
  timeAgo?: string;
}

interface MentorItem {
  id?: string;
  _id?: string;
  name: string;
  specialty: string;
  hospital?: string;
  rating?: number;
  initials?: string;
}

const specialtyColors: Record<string, string> = {
  Cardiology: 'bg-[#E8F0EC] text-[#35564E]',
  Neurology: 'bg-[#F0F4F2] text-[#52616C]',
  Oncology: 'bg-[#FAF0E6] text-[#C27D38]',
  'Emergency Medicine': 'bg-[#FDEEEB] text-[#C04A36]',
  'Internal Medicine': 'bg-[#F0F4F2] text-[#52616C]',
  Paediatrics: 'bg-[#EFF4F1] text-[#3D7A68]',
  Surgery: 'bg-[#F0F4F2] text-[#52616C]',
};

export default function DashboardPage({ navigate, onSelectCase, onSelectMentor }: DashboardProps) {
  const { user, role } = useAuth();
  const [activeFilter, setActiveFilter] = useState('All');
  const [caseSearch, setCaseSearch] = useState('');
  const [topicSearch, setTopicSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedCaseFilters, setAppliedCaseFilters] = useState({ search: '', topic: '', from: '', to: '' });
  const [savedCaseIds, setSavedCaseIds] = useState<Set<string>>(new Set());
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [suggestedMentors, setSuggestedMentors] = useState<MentorItem[]>([]);

  // Publish Case Modal State (Mentor Only)
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [submittingCase, setSubmittingCase] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [caseForm, setCaseForm] = useState({
    title: '',
    specialty: 'Cardiology',
    subspecialty: '',
    ageRange: '30–39 years',
    sex: 'Female',
    presentingComplaint: '',
    history: '',
    investigations: '',
    diagnosis: '',
    treatment: '',
    outcome: '',
    learningPoints: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const filters = ['All', 'Cardiology', 'Neurology', 'Oncology', 'Emergency Medicine', 'Internal Medicine', 'Paediatrics'];


  // Load cases from backend
  const fetchCases = async (specialty?: string, extraFilters = appliedCaseFilters) => {
    setLoadingCases(true);
    try {
      const params = {
        ...(specialty && specialty !== 'All' ? { specialty } : {}),
        ...Object.fromEntries(Object.entries(extraFilters).filter(([, value]) => value.trim())),
      };
      const res = await API.get('/cases', { params });
      if (res.data?.cases) {
        setCases(res.data.cases);
        // Identify cases current user already upvoted
        const myId = user?._id || user?.id;
        if (myId) {
          const upvoted = new Set<string>();
          res.data.cases.forEach((c: any) => {
            if (c.upvotedUsers?.includes(myId)) {
              upvoted.add(c.id || c._id);
            }
          });
          setUpvotedIds(upvoted);
        }
      }
    } catch (err) {
      console.error('Failed to load cases:', err);
    } finally {
      setLoadingCases(false);
    }
  };

  // Load mentors from backend
  const fetchMentors = async () => {
    try {
      const res = await API.get('/mentors');
      if (res.data?.mentors) {
        setSuggestedMentors(
          res.data.mentors.slice(0, 3).map((m: any) => ({
            id: m.id || m._id,
            name: m.name,
            specialty: m.specialty,
            hospital: m.hospital,
            rating: m.rating,
            initials: m.name
              .split(' ')
              .map((w: string) => w[0])
              .join('')
              .slice(0, 2),
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load mentors:', err);
    }
  };

  useEffect(() => {
    fetchCases(activeFilter, appliedCaseFilters);
  }, [activeFilter, appliedCaseFilters]);

  useEffect(() => {
    fetchMentors();
  }, []);

  const userId = user?._id || user?.id;
  useEffect(() => {
    if (!userId) {
      setSavedCaseIds(new Set());
      return;
    }
    API.get('/cases/saved')
      .then(res => setSavedCaseIds(new Set((res.data?.savedCaseIds || []).map((id: string) => String(id)))))
      .catch(err => console.error('Failed to load saved cases:', err));
  }, [userId]);

  const toggleUpvote = async (caseId: string) => {
    try {
      const res = await API.post(`/cases/${caseId}/upvote`);
      if (res.data) {
        setCases(prev =>
          prev.map(c => {
            const id = c.id || c._id;
            if (id === caseId) {
              return { ...c, upvotes: res.data.upvotes };
            }
            return c;
          })
        );
        setUpvotedIds(prev => {
          const next = new Set(prev);
          if (res.data.isUpvoted) {
            next.add(caseId);
          } else {
            next.delete(caseId);
          }
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to upvote:', err);
    }
  };

  const toggleSavedCase = async (caseId: string) => {
    if (!user) {
      navigate('login');
      return;
    }
    try {
      const res = await API.post(`/cases/${caseId}/save`);
      setSavedCaseIds(prev => {
        const next = new Set(prev);
        if (res.data?.saved) next.add(caseId);
        else next.delete(caseId);
        return next;
      });
    } catch (err) {
      console.error('Failed to update saved case:', err);
    }
  };

  const handlePublishCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!caseForm.title.trim() || !caseForm.presentingComplaint.trim() || !caseForm.diagnosis.trim()) {
      setFormError('Please fill out the Title, Presenting Complaint, and Diagnosis.');
      return;
    }
    if (!privacyAcknowledged) {
      setFormError('Confirm that you have removed patient-identifying information before publishing.');
      return;
    }

    setSubmittingCase(true);
    try {
      const pointsArray = caseForm.learningPoints
        .split('\n')
        .map(p => p.trim())
        .filter(Boolean);

      const payload = {
        title: caseForm.title,
        specialty: caseForm.specialty,
        subspecialty: caseForm.subspecialty,
        ageRange: caseForm.ageRange,
        sex: caseForm.sex,
        presentingComplaint: caseForm.presentingComplaint,
        history: caseForm.history,
        investigations: caseForm.investigations,
        diagnosis: caseForm.diagnosis,
        treatment: caseForm.treatment,
        outcome: caseForm.outcome,
        learningPoints: pointsArray.length > 0 ? pointsArray : ['Comprehensive diagnostic evaluation is vital.'],
        deidentifiedConfirmed: privacyAcknowledged,
      };

      await API.post('/cases', payload);
      setFormSuccess('Clinical case published successfully to the platform!');
      setCaseForm({
        title: '',
        specialty: 'Cardiology',
        subspecialty: '',
        ageRange: '30–39 years',
        sex: 'Female',
        presentingComplaint: '',
        history: '',
        investigations: '',
        diagnosis: '',
        treatment: '',
        outcome: '',
        learningPoints: '',
      });
      setPrivacyAcknowledged(false);
      setTimeout(() => {
        setPublishModalOpen(false);
        setFormSuccess(null);
        fetchCases(activeFilter);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setFormError(err.response?.data?.message || 'Failed to publish case study. Please try again.');
    } finally {
      setSubmittingCase(false);
    }
  };

  const handleCaseClick = (caseItem: CaseItem) => {
    const id = caseItem.id || caseItem._id;
    if (id) {
      if (onSelectCase) onSelectCase(id);
      else navigate('case-detail', { caseId: id });
    } else {
      navigate('case-detail');
    }
  };

  const handleMentorClick = (mentorItem: MentorItem) => {
    const id = mentorItem.id || mentorItem._id;
    if (id) {
      if (onSelectMentor) onSelectMentor(id);
      else navigate('mentor-profile', { mentorId: id });
    } else {
      navigate('mentor-profile');
    }
  };

  const visibleCases = showSavedOnly
    ? cases.filter(c => savedCaseIds.has(c.id || c._id || ''))
    : cases;

  return (
    <Layout navigate={navigate} currentPage="dashboard">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Dynamic Hero Banner per Role */}
        {role === 'admin' ? (
          <section className="relative mb-8 overflow-hidden rounded-lg bg-[#0B192C] px-6 py-8 text-white shadow-sm sm:px-10 sm:py-10">
            <div className="relative max-w-3xl">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#A9C1B5]">
                <span className="h-2 w-2 rounded-full bg-[#E57A60]" />
                Platform governance
              </div>

              <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                Admin Operations Console
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-[#D6E0E5]">
                Supervise credential verification, moderate clinical content, and keep member activity aligned with platform safety standards.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-base font-bold text-white">Verification</div>
                  <div className="text-[11px] text-[#D6E0E5]">GMC / licences</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-base font-bold text-white">Moderation</div>
                  <div className="text-[11px] text-[#D6E0E5]">PHI safety</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-base font-bold text-white">Governance</div>
                  <div className="text-[11px] text-[#D6E0E5]">Permissions</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-base font-bold text-[#A9C1B5]">Live</div>
                  <div className="text-[11px] text-[#D6E0E5]">Telemetry</div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button onClick={() => navigate('admin')} className="rounded-lg bg-[#0B192C] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#192B40] sm:text-sm">
                  Review queue
                </button>
                <button onClick={() => navigate('admin')} className="rounded-lg bg-white px-5 py-2.5 text-xs font-bold text-[#0B192C] transition-colors hover:bg-[#F0F4F2] sm:text-sm">
                  Moderation
                </button>
              </div>
            </div>
          </section>
        ) : role === 'mentor' ? (
          <section className="relative mb-8 overflow-hidden rounded-lg bg-[#0B192C] px-6 py-8 text-white shadow-sm sm:px-10 sm:py-10">
            <div className="relative max-w-3xl">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#A9C1B5]">
                <span className="h-2 w-2 rounded-full bg-[#3D7A68]" />
                Verified consultant hub
              </div>

              <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                Welcome back, {user?.name ? (user.name.toLowerCase().startsWith('dr') ? user.name : `Dr. ${user.name}`) : 'Doctor'}.
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-[#D6E0E5]">
                Publish case teaching, guide trainees, and share clinical insight with the next generation of doctors.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xl font-bold text-white">{cases.length}</div>
                  <div className="text-[11px] text-[#D6E0E5]">Cases</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-base font-bold text-white truncate">{user?.specialty || 'Not provided'}</div>
                  <div className="text-[11px] text-[#D6E0E5]">Specialty</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-base font-bold text-white truncate">{user?.hospital || 'Not provided'}</div>
                  <div className="text-[11px] text-[#D6E0E5]">Hospital</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-base font-bold text-[#A9C1B5]">Active</div>
                  <div className="text-[11px] text-[#D6E0E5]">Mentorship</div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button onClick={() => setPublishModalOpen(true)} className="rounded-lg bg-[#0B192C] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#192B40] sm:text-sm">
                  Publish case
                </button>
                <button onClick={() => navigate('events')} className="rounded-lg bg-white px-5 py-2.5 text-xs font-bold text-[#0B192C] transition-colors hover:bg-[#F0F4F2] sm:text-sm">
                  Host event
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="relative mb-8 overflow-hidden rounded-lg bg-[#0B192C] px-6 py-8 text-white shadow-sm sm:px-10 sm:py-10">
            <div className="relative max-w-3xl">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#A9C1B5]">
                <span className="h-2 w-2 rounded-full bg-[#A9C1B5]" />
                Junior doctor learning hub
              </div>

              <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                Good morning, {user?.name || 'Doctor'}.
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-[#D6E0E5]">
                Access consultant case discussions, revision notes, and specialized support as you grow through training.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xl font-bold text-white">{suggestedMentors.length}</div>
                  <div className="text-[11px] text-[#D6E0E5]">Mentors</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-xl font-bold text-white">{cases.length}</div>
                  <div className="text-[11px] text-[#D6E0E5]">Cases</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-base font-bold text-white truncate">{user?.careerStage || 'Trainee'}</div>
                  <div className="text-[11px] text-[#D6E0E5]">Stage</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-base font-bold text-[#A9C1B5] truncate">{user?.specialty || 'Not provided'}</div>
                  <div className="text-[11px] text-[#D6E0E5]">Specialty</div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button onClick={() => navigate('mentor-profile')} className="rounded-lg bg-[#0B192C] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#192B40] sm:text-sm">
                  Find mentor
                </button>
                <button onClick={() => navigate('resources')} className="rounded-lg bg-white px-5 py-2.5 text-xs font-bold text-[#0B192C] transition-colors hover:bg-[#F0F4F2] sm:text-sm">
                  Study notes
                </button>
              </div>
            </div>
          </section>
        )}



        {/* Main Grid: Feed + Right Panel */}
        <div id="community-feed" className="grid grid-cols-1 gap-8 lg:grid-cols-3">

          {/* Main Feed Column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Contextual Notice per Role */}
            {role === 'mentor' ? (
              <div className="p-4 rounded-lg bg-[#EFF4F1] border border-[#3D7A68]/30 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#C8D6D0] text-[10px] font-bold text-[#35564E]">MD</span>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-[#0B192C]">Clinician Publishing & Peer Review Portal</div>
                    <div className="text-[11px] sm:text-xs text-[#3D7A68]">You have verified educator credentials to author complex case studies and answer trainee questions.</div>
                  </div>
                </div>
                <button
                  onClick={() => setPublishModalOpen(true)}
                  className="shrink-0 rounded-full bg-[#0B192C] hover:bg-[#192B40] text-white px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                >
                  + New Case
                </button>
              </div>
            ) : role === 'admin' ? (
              <div className="p-4 rounded-lg bg-[#E8F0EC] border border-[#52796F]/30 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 shrink-0 text-[#52796F]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="m9 12 2 2 4-4" />
                  </svg>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-[#0B192C]">Admin Moderation & Safety Active</div>
                    <div className="text-[11px] sm:text-xs text-[#35564E]">You are supervising clinical content for Patient Identifiers (HIPAA / GDPR) and medical accuracy.</div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('admin')}
                  className="shrink-0 rounded-full bg-[#0B192C] hover:bg-[#192B40] text-white px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                >
                  Admin Portal →
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#E1E7E5] text-[9px] font-bold text-[#52796F]">LEARN</span>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-[#0B192C]">Consultant-Authored Clinical Cases Archive</div>
                    <div className="text-[11px] sm:text-xs text-[#74817D]">Reviewed teaching cases presented by verified Attendings & Specialists for clinical reasoning & exam prep.</div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('resources')}
                  className="shrink-0 text-xs font-bold text-[#52796F] hover:underline cursor-pointer"
                >
                  Study Vault →
                </button>
              </div>
            )}

            <form
              onSubmit={e => {
                e.preventDefault();
                setAppliedCaseFilters({ search: caseSearch.trim(), topic: topicSearch.trim(), from: dateFrom, to: dateTo });
              }}
              className="grid grid-cols-1 gap-3 border border-[#E1E7E5] bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
              aria-label="Search and filter clinical cases"
            >
              <label className="text-xs font-semibold text-[#0B192C] lg:col-span-2">
                Search cases
                <input value={caseSearch} onChange={e => setCaseSearch(e.target.value)} placeholder="Title, diagnosis, or summary" className="mt-1.5 w-full border border-[#E1E7E5] px-3 py-2 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-[#0B192C] lg:col-span-2">
                Topic
                <input value={topicSearch} onChange={e => setTopicSearch(e.target.value)} placeholder="e.g. arrhythmia" className="mt-1.5 w-full border border-[#E1E7E5] px-3 py-2 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-[#0B192C]">
                From
                <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} className="mt-1.5 w-full min-w-0 border border-[#E1E7E5] px-2 py-2 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-[#0B192C]">
                To
                <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className="mt-1.5 w-full min-w-0 border border-[#E1E7E5] px-2 py-2 text-sm font-normal" />
              </label>
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
                <button type="submit" className="bg-[#0B192C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#192B40]">Apply filters</button>
                <button type="button" onClick={() => { setCaseSearch(''); setTopicSearch(''); setDateFrom(''); setDateTo(''); setAppliedCaseFilters({ search: '', topic: '', from: '', to: '' }); }} className="px-3 py-2 text-sm font-semibold text-[#52616C] underline underline-offset-2">Clear</button>
              </div>
            </form>

            {/* Filter Pills and Mentor Publish Action */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#E1E7E5]/70">
              <div className="flex gap-2 flex-wrap items-center">
                <span className="text-xs font-bold text-[#74817D] uppercase tracking-wider mr-1">Filter:</span>
                {filters.map(f => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      activeFilter === f
                        ? 'bg-[#0B192C] text-white shadow-xs'
                        : 'bg-[#FFFFFF] text-[#52616C] border border-[#E1E7E5] hover:border-[#52796F] hover:text-[#0B192C]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
                {user && (
                  <button
                    type="button"
                    onClick={() => setShowSavedOnly(prev => !prev)}
                    aria-pressed={showSavedOnly}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${showSavedOnly ? 'bg-[#0B192C] text-white' : 'border border-[#E1E7E5] bg-white text-[#52616C] hover:text-[#52796F]'}`}
                  >
                    Saved cases
                  </button>
                )}
              </div>

              {/* Mentor-only Publishing Badge / Button */}
              {role === 'mentor' && (
                <button
                  onClick={() => setPublishModalOpen(true)}
                  className="rounded-full bg-[#0B192C] hover:bg-[#192B40] text-white px-4 py-1.5 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <span>+</span> New Case
                </button>
              )}
            </div>

            {/* Cases List */}
            {loadingCases ? (
              <div className="py-12 text-center text-sm text-[#74817D] bg-[#FFFFFF] rounded-lg border border-[#E1E7E5]">
                <div className="w-8 h-8 border-3 border-[#52796F] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Loading authentic clinical cases…
              </div>
            ) : visibleCases.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#74817D] bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] p-6">
                <p className="font-semibold text-[#0B192C] text-base mb-1">{showSavedOnly ? 'No saved cases yet.' : 'No cases found in this category.'}</p>
                <p className="text-xs text-[#52616C]">
                  {role === 'mentor' ? 'Be the first mentor to publish a case in this specialty!' : 'Check other specialty filters or check back soon.'}
                </p>
                {role === 'mentor' && (
                  <button
                    onClick={() => setPublishModalOpen(true)}
                    className="mt-4 px-4 py-2 bg-[#0B192C] text-white text-xs font-bold rounded-full hover:bg-[#192B40]"
                  >
                    + Publish First Case
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {visibleCases.map(c => {
                  const id = c.id || c._id || '';
                  const isUpvoted = upvotedIds.has(id);
                  return (
                    <div
                      key={id}
                      className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-6 hover:shadow-md hover:border-[#52796F] transition-all cursor-pointer group"
                      onClick={() => handleCaseClick(c)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${specialtyColors[c.specialty] || 'bg-[#F0F4F2] text-[#52616C]'}`}>
                          {c.specialty}
                        </span>
                        <span className="text-xs font-medium text-[#74817D]">{c.timeAgo || 'Recent'}</span>
                      </div>

                      <h3
                        className="font-bold text-[#0B192C] text-lg leading-snug mb-2 group-hover:text-[#52796F] transition-colors"
                        style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                      >
                        {c.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-[#52616C] leading-relaxed mb-5 line-clamp-2">
                        {c.preview}
                      </p>

                      <div className="flex items-center justify-between pt-3 border-t border-[#E1E7E5]">
                        {/* Author Details */}
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#0B192C] flex items-center justify-center text-white text-[11px] font-bold">
                            {c.author ? c.author.split(' ').map(w => w[0]).join('').slice(0, 2) : 'DR'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-[#0B192C]">{c.author}</span>
                              {c.verified && (
                                <span title="Verified Clinician">
                                  <svg className="w-3.5 h-3.5 text-[#52796F]" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#74817D]">{c.role}</span>
                          </div>
                        </div>

                        {/* Upvote & Comments */}
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            aria-label={savedCaseIds.has(id) ? 'Remove saved case' : 'Save case'}
                            aria-pressed={savedCaseIds.has(id)}
                            className={`text-xs font-semibold ${savedCaseIds.has(id) ? 'text-[#52796F]' : 'text-[#74817D] hover:text-[#52796F]'}`}
                            onClick={e => { e.stopPropagation(); toggleSavedCase(id); }}
                          >
                            {savedCaseIds.has(id) ? 'Saved' : 'Save'}
                          </button>
                          <button
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                              isUpvoted
                                ? 'bg-[#E8F0EC] text-[#52796F] border border-[#52796F]/40'
                                : 'text-[#74817D] hover:bg-[#F0F4F2] hover:text-[#52796F]'
                            }`}
                            onClick={e => {
                              e.stopPropagation();
                              toggleUpvote(id);
                            }}
                          >
                            <svg className="w-3.5 h-3.5" fill={isUpvoted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                            {c.upvotes}
                          </button>
                          <button
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-[#74817D] hover:bg-[#F0F4F2] hover:text-[#0B192C] transition-colors cursor-pointer"
                            onClick={e => {
                              e.stopPropagation();
                              handleCaseClick(c);
                            }}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {c.comments}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Tailored by Role */}
          <div className="space-y-6">
            {role === 'mentor' ? (
              /* ================= MENTOR RIGHT PANEL ================= */
              <>
                {/* 1. Trainee Mentorship Inquiries */}
                <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-4 border-b border-[#E1E7E5] pb-3">
                    <h3 className="font-bold text-[#0B192C] text-base" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                      Trainee Inquiries
                    </h3>
                    <button
                      onClick={() => navigate('messages')}
                      className="text-xs text-[#52796F] hover:underline font-bold cursor-pointer"
                    >
                      Open Chat →
                    </button>
                  </div>

                  <div className="p-4 rounded-lg bg-[#F7F9F8] border border-[#E1E7E5] text-center space-y-2">
                    <p className="text-xs text-[#52616C] leading-relaxed">
                      New 1-on-1 mentorship requests and clinical inquiries from junior doctors will appear here.
                    </p>
                    <button
                      onClick={() => navigate('messages')}
                      className="w-full mt-1 text-center py-2 text-xs font-bold text-[#0B192C] bg-white rounded-lg border border-[#E1E7E5] hover:bg-[#0B192C] hover:text-white transition-all cursor-pointer"
                    >
                      Open Mentorship Inbox →
                    </button>
                  </div>
                </div>

                {/* 2. Trainee Questions in Clinical Forums */}
                <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-3 border-b border-[#E1E7E5] pb-3">
                    <h3 className="font-bold text-[#0B192C] text-base" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                      Trainee Case Questions
                    </h3>
                    <button
                      onClick={() => navigate('forums')}
                      className="text-xs text-[#52796F] hover:underline font-bold cursor-pointer"
                    >
                      All Forums →
                    </button>
                  </div>

                  <div className="p-4 rounded-lg bg-[#F7F9F8] border border-[#E1E7E5] space-y-2">
                    <p className="text-xs text-[#52616C] leading-relaxed">
                      Contribute consultant clinical pearls and answer diagnostic dilemmas posted by trainees across specialties.
                    </p>
                    <button
                      onClick={() => navigate('forums')}
                      className="w-full text-center py-2 text-xs font-bold text-[#0B192C] bg-white rounded-lg border border-[#E1E7E5] hover:bg-[#0B192C] hover:text-white transition-all cursor-pointer"
                    >
                      Browse Trainee Discussions →
                    </button>
                  </div>
                </div>

                {/* 3. Host Masterclasses & Webinars */}
                <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-3 border-b border-[#E1E7E5] pb-3">
                    <h3 className="font-bold text-[#0B192C] text-base" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                      Grand Rounds & Webinars
                    </h3>
                    <button
                      onClick={() => navigate('events')}
                      className="text-xs text-[#52796F] hover:underline font-bold cursor-pointer"
                    >
                      Calendar →
                    </button>
                  </div>

                  <div className="p-4 rounded-lg bg-[#EFF4F1] border border-[#3D7A68]/20 space-y-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3D7A68]">Educational Events</span>
                    <p className="text-xs text-[#0B192C] leading-relaxed">
                      Host virtual Grand Rounds, complex case presentations, and interactive webinars for junior doctors.
                    </p>
                  </div>

                  <button
                    onClick={() => navigate('events')}
                    className="w-full text-center py-2 text-xs font-bold text-white bg-[#0B192C] rounded-lg hover:bg-[#192B40] transition-all cursor-pointer"
                  >
                    + Schedule Grand Round / Webinar
                  </button>
                </div>
              </>
            ) : role === 'admin' ? (
              /* ================= ADMIN RIGHT PANEL ================= */
              <>
                {/* 1. Physician Verification Queue */}
                <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-4 border-b border-[#E1E7E5] pb-3">
                    <h3 className="font-bold text-[#0B192C] text-base" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                      Doctor Credentialing
                    </h3>
                    <button
                      onClick={() => navigate('admin')}
                      className="text-xs text-[#52796F] hover:underline font-bold cursor-pointer"
                    >
                      Open Queue →
                    </button>
                  </div>

                  <div className="p-4 rounded-lg bg-[#F7F9F8] border border-[#E1E7E5] space-y-2 mb-4">
                    <p className="text-xs text-[#52616C] leading-relaxed">
                      Review submitted physician licenses, medical qualifications, and verify consultant credentials.
                    </p>
                  </div>

                  <button
                    onClick={() => navigate('admin')}
                    className="w-full text-center py-2 text-xs font-bold text-white bg-[#0B192C] rounded-lg hover:bg-[#192B40] transition-all cursor-pointer"
                  >
                    Open Admin Verification Queue →
                  </button>
                </div>

                {/* 2. Platform Telemetry */}
                <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-5 shadow-2xs">
                  <h3 className="font-bold text-[#0B192C] text-base mb-3 border-b border-[#E1E7E5] pb-3" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                    Platform Governance
                  </h3>
                  <div className="space-y-2.5">
                    {[
                      { label: 'Access Control', val: 'Role-Based Authentication', status: 'text-[#0B192C]' },
                      { label: 'Database Storage', val: 'MongoDB Atlas Connected', status: 'text-[#3D7A68]' },
                      { label: 'PHI Compliance', val: 'De-identification Active', status: 'text-[#3D7A68]' },
                      { label: 'Platform Security', val: 'Audit Logging Enabled', status: 'text-[#0B192C]' },
                    ].map((tel, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[#F7F9F8] text-xs">
                        <span className="text-[#52616C]">{tel.label}</span>
                        <span className={`font-semibold ${tel.status}`}>{tel.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* ================= MENTEE RIGHT PANEL ================= */
              <>
                {/* 1. Recommended Senior Mentors */}
                <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-4 border-b border-[#E1E7E5] pb-3">
                    <h3 className="font-bold text-[#0B192C] text-base" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                      Senior Consultants
                    </h3>
                    <button
                      onClick={() => navigate('mentor-profile')}
                      className="text-xs text-[#52796F] hover:underline font-bold cursor-pointer"
                    >
                      View all
                    </button>
                  </div>
                  {suggestedMentors.length > 0 ? (
                    <div className="space-y-3.5">
                      {suggestedMentors.map(m => (
                        <div key={m.id || m.name} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-[#F0F4F2] transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#0B192C] flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {m.initials}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-bold text-[#0B192C] truncate">{m.name}</div>
                              <div className="text-xs text-[#74817D] truncate">{m.specialty} · ★ {m.rating}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleMentorClick(m)}
                            className="shrink-0 text-xs font-bold text-[#52796F] border border-[#52796F] px-3 py-1 rounded-full hover:bg-[#E8F0EC] transition-colors cursor-pointer"
                          >
                            Connect
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-[#F7F9F8] border border-[#E1E7E5] text-center text-xs text-[#52616C]">
                      Verified senior consultants and mentors will appear here.
                    </div>
                  )}
                </div>

                {/* 2. Upcoming Masterclasses & Grand Rounds */}
                <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-4 border-b border-[#E1E7E5] pb-3">
                    <h3 className="font-bold text-[#0B192C] text-base" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                      Grand Rounds & Webinars
                    </h3>
                    <button
                      onClick={() => navigate('events')}
                      className="text-xs text-[#52796F] hover:underline font-bold cursor-pointer"
                    >
                      Calendar
                    </button>
                  </div>
                  <div className="p-4 rounded-lg bg-[#F7F9F8] border border-[#E1E7E5] space-y-2">
                    <p className="text-xs text-[#52616C] leading-relaxed">
                      Attend live clinical case conferences, diagnostic workshops, and specialty grand rounds hosted by senior clinicians.
                    </p>
                    <button
                      onClick={() => navigate('events')}
                      className="w-full text-center py-2 text-xs font-bold text-[#0B192C] bg-white rounded-lg border border-[#E1E7E5] hover:bg-[#0B192C] hover:text-white transition-all cursor-pointer"
                    >
                      View Upcoming Webinars & RSVPs →
                    </button>
                  </div>
                </div>

                {/* 3. High-Yield PACES & Guidelines */}
                <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-4 border-b border-[#E1E7E5] pb-3">
                    <h3 className="font-bold text-[#0B192C] text-base" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                      Clinical Resources & Vault
                    </h3>
                    <button
                      onClick={() => navigate('resources')}
                      className="text-xs text-[#52796F] hover:underline font-bold cursor-pointer"
                    >
                      All Notes
                    </button>
                  </div>
                  <div className="p-4 rounded-lg bg-[#F7F9F8] border border-[#E1E7E5] space-y-2">
                    <p className="text-xs text-[#52616C] leading-relaxed">
                      Access high-yield revision notes, diagnostic algorithms, and hospital protocols shared by verified clinicians.
                    </p>
                    <button
                      onClick={() => navigate('resources')}
                      className="w-full text-center py-2 text-xs font-bold text-[#0B192C] bg-white rounded-lg border border-[#E1E7E5] hover:bg-[#0B192C] hover:text-white transition-all cursor-pointer"
                    >
                      Explore Study Vault →
                    </button>
                  </div>
                </div>

                {/* 4. Specialty Study Circles */}
                <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-3 border-b border-[#E1E7E5] pb-3">
                    <h3 className="font-bold text-[#0B192C] text-base" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                      Specialty Syndicates
                    </h3>
                    <button
                      onClick={() => navigate('groups')}
                      className="text-xs text-[#52796F] hover:underline font-bold cursor-pointer"
                    >
                      Browse
                    </button>
                  </div>
                  <p className="text-xs text-[#52616C] mb-3 leading-relaxed">
                    Collaborate with fellow registrars and residents on clinical audits and exam revision circles.
                  </p>
                  <button
                    onClick={() => navigate('groups')}
                    className="w-full text-center py-2 text-xs font-bold text-[#0B192C] bg-[#F0F4F2] rounded-lg hover:bg-[#0B192C] hover:text-white transition-all cursor-pointer"
                  >
                    Join a Specialty Circle →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Case Publishing Modal - Exclusively for Mentors */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] shadow-2xl max-w-2xl w-full p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#E1E7E5] mb-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#52796F]">
                  Mentor Publishing Portal
                </span>
                <h2 className="text-2xl font-bold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  Publish Clinical Case Study
                </h2>
              </div>
              <button
                onClick={() => setPublishModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#74817D] hover:bg-[#F0F4F2] hover:text-[#0B192C]"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-[#FDEEEB] border border-[#C04A36]/30 text-xs font-semibold text-[#C04A36]">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-[#E8F0EC] border border-[#3D7A68]/30 text-xs font-semibold text-[#0B192C]">
                ✓ {formSuccess}
              </div>
            )}

            <form onSubmit={handlePublishCase} className="space-y-4">
              <section className="border-l-4 border-[#9A5B12] bg-[#FFF7E8] p-4" aria-labelledby="privacy-reminder-title">
                <h3 id="privacy-reminder-title" className="text-sm font-bold text-[#603B0B]">Protect patient privacy</h3>
                <p className="mt-1 text-xs leading-5 text-[#604C32]">
                  Remove names, exact dates, contact details, record numbers, images, and combinations of details that could identify someone. This reminder is a safeguard, not a guarantee of privacy or regulatory compliance.
                </p>
                <label className="mt-3 flex items-start gap-2 text-xs font-semibold text-[#0B192C]">
                  <input
                    type="checkbox"
                    checked={privacyAcknowledged}
                    onChange={e => setPrivacyAcknowledged(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#52796F]"
                  />
                  <span>I reviewed this case and removed patient-identifying information.</span>
                </label>
              </section>

              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1">Case Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Atypical chest pain in a 34-year-old female"
                  value={caseForm.title}
                  onChange={e => setCaseForm({ ...caseForm, title: e.target.value })}
                  className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0B192C] mb-1">Specialty *</label>
                  <select
                    value={caseForm.specialty}
                    onChange={e => setCaseForm({ ...caseForm, specialty: e.target.value })}
                    className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none"
                  >
                    <option>Cardiology</option>
                    <option>Neurology</option>
                    <option>Oncology</option>
                    <option>Emergency Medicine</option>
                    <option>Internal Medicine</option>
                    <option>Paediatrics</option>
                    <option>Surgery</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0B192C] mb-1">Subspecialty</label>
                  <input
                    type="text"
                    placeholder="e.g. NSTEMI / SCAD"
                    value={caseForm.subspecialty}
                    onChange={e => setCaseForm({ ...caseForm, subspecialty: e.target.value })}
                    className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0B192C] mb-1">Patient Age Range</label>
                  <input
                    type="text"
                    value={caseForm.ageRange}
                    onChange={e => setCaseForm({ ...caseForm, ageRange: e.target.value })}
                    placeholder="30–39 years"
                    className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0B192C] mb-1">Biological Sex</label>
                  <select
                    value={caseForm.sex}
                    onChange={e => setCaseForm({ ...caseForm, sex: e.target.value })}
                    className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none"
                  >
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other / Unspecified</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1">Presenting Complaint & Timeline *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Summary of presentation, symptoms, triage vital signs…"
                  value={caseForm.presentingComplaint}
                  onChange={e => setCaseForm({ ...caseForm, presentingComplaint: e.target.value })}
                  className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1">Past Medical History & Medications</label>
                <textarea
                  rows={2}
                  placeholder="Relevant past history, medications, risk factors…"
                  value={caseForm.history}
                  onChange={e => setCaseForm({ ...caseForm, history: e.target.value })}
                  className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1">Investigations & Key Diagnostic Findings</label>
                <textarea
                  rows={2}
                  placeholder="ECG, labs, imaging, biomarker findings…"
                  value={caseForm.investigations}
                  onChange={e => setCaseForm({ ...caseForm, investigations: e.target.value })}
                  className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0B192C] mb-1">Final Diagnosis *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SCAD of LAD"
                    value={caseForm.diagnosis}
                    onChange={e => setCaseForm({ ...caseForm, diagnosis: e.target.value })}
                    className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0B192C] mb-1">Treatment / Management</label>
                  <input
                    type="text"
                    placeholder="e.g. Conservative aspirin + beta-blockade"
                    value={caseForm.treatment}
                    onChange={e => setCaseForm({ ...caseForm, treatment: e.target.value })}
                    className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1">Outcome</label>
                <input
                  type="text"
                  placeholder="e.g. Discharge day 4, repeat echo normal at 6 weeks"
                  value={caseForm.outcome}
                  onChange={e => setCaseForm({ ...caseForm, outcome: e.target.value })}
                  className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1">Key Learning Points (One per line)</label>
                <textarea
                  rows={3}
                  placeholder="Point 1&#10;Point 2&#10;Point 3"
                  value={caseForm.learningPoints}
                  onChange={e => setCaseForm({ ...caseForm, learningPoints: e.target.value })}
                  className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-sm text-[#0B192C] focus:border-[#52796F] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#E1E7E5]">
                <button
                  type="button"
                  onClick={() => setPublishModalOpen(false)}
                  className="rounded-full px-5 py-2.5 text-xs font-bold text-[#52616C] hover:bg-[#F0F4F2]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCase}
                  className="rounded-full bg-[#0B192C] hover:bg-[#192B40] text-white px-6 py-2.5 text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submittingCase ? 'Publishing…' : 'Publish Case Study'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
