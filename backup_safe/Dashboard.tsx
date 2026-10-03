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
  Cardiology: 'bg-[#FBE5DC] text-[#B9543D]',
  Neurology: 'bg-[#EFEBF5] text-[#5B507A]',
  Oncology: 'bg-[#FAF0E6] text-[#C27D38]',
  'Emergency Medicine': 'bg-[#FDEEEB] text-[#C04A36]',
  'Internal Medicine': 'bg-[#E8F1F5] text-[#34657F]',
  Paediatrics: 'bg-[#E4EFEA] text-[#3D7A68]',
  Surgery: 'bg-[#FCECEE] text-[#B83B5E]',
};

export default function DashboardPage({ navigate, onSelectCase, onSelectMentor }: DashboardProps) {
  const { user, role } = useAuth();
  const [activeFilter, setActiveFilter] = useState('All');
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [suggestedMentors, setSuggestedMentors] = useState<MentorItem[]>([]);

  // Publish Case Modal State (Mentor Only)
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [submittingCase, setSubmittingCase] = useState(false);
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
  const fetchCases = async (specialty?: string) => {
    setLoadingCases(true);
    try {
      const params = specialty && specialty !== 'All' ? { specialty } : {};
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
            rating: m.rating || 4.9,
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
    fetchCases(activeFilter);
  }, [activeFilter]);

  useEffect(() => {
    fetchMentors();
  }, []);

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

  const handlePublishCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!caseForm.title.trim() || !caseForm.presentingComplaint.trim() || !caseForm.diagnosis.trim()) {
      setFormError('Please fill out the Title, Presenting Complaint, and Diagnosis.');
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

  return (
    <Layout navigate={navigate} currentPage="dashboard">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Dynamic Hero Banner per Role */}
        {role === 'admin' ? (
          <section className="relative mb-8 overflow-hidden rounded-3xl bg-[#183D3A] px-6 py-8 sm:px-10 sm:py-10 text-white shadow-md">
            <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[28px] border-[#D86F52]/25" />
            <div className="absolute bottom-[-90px] right-36 h-48 w-48 rounded-full border-[22px] border-[#F0B28A]/15" />

            <div className="relative max-w-3xl">
              <div className="inline-flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-[#E57A60] animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F0B28A]">
                  Platform Administration & Clinical Governance
                </p>
              </div>

              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl text-white" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                Admin Operations Console
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-[#C6D5D0]">
                Supervise medical credential verification (GMC/MBBS), moderate clinical cases for PHI safety, and track real-time platform telemetry across MedConnect.
              </p>

              {/* Admin metrics strip */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-base sm:text-lg font-bold text-white">Verification</div>
                  <div className="text-[11px] text-[#C6D5D0]">GMC / Medical Licences</div>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-base sm:text-lg font-bold text-white">Moderation</div>
                  <div className="text-[11px] text-[#C6D5D0]">PHI Safety Check</div>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-base sm:text-lg font-bold text-white">Governance</div>
                  <div className="text-[11px] text-[#C6D5D0]">Role Permissions</div>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-base sm:text-lg font-bold text-[#F0B28A]">Active</div>
                  <div className="text-[11px] text-[#C6D5D0]">System Telemetry</div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => navigate('admin')}
                  className="rounded-full bg-[#D86F52] hover:bg-[#B9543D] text-white px-5 py-2.5 text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
                >
                  <span>🛡️</span> Open Doctor Verification Queue
                </button>
                <button
                  onClick={() => navigate('admin')}
                  className="rounded-full bg-[#FFFCF8] text-[#183D3A] px-5 py-2.5 text-xs sm:text-sm font-bold transition-all hover:bg-[#F1EEE8] hover:shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <span>⚖️</span> Content Moderation
                </button>
                <button
                  onClick={() => document.getElementById('community-feed')?.scrollIntoView({ behavior: 'smooth' })}
                  className="rounded-full border border-white/30 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-white/10 cursor-pointer"
                >
                  Review Feed
                </button>
              </div>
            </div>
          </section>
        ) : role === 'mentor' ? (
          <section className="relative mb-8 overflow-hidden rounded-3xl bg-[#183D3A] px-6 py-8 sm:px-10 sm:py-10 text-white shadow-md">
            <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[28px] border-[#D86F52]/25" />
            <div className="absolute bottom-[-90px] right-36 h-48 w-48 rounded-full border-[22px] border-[#F0B28A]/15" />

            <div className="relative max-w-3xl">
              <div className="inline-flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-[#3D7A68] border border-white" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F0B28A]">
                  Verified Consultant & Attending Hub
                </p>
              </div>

              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl text-white" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                Welcome back, {user?.name ? (user.name.toLowerCase().startsWith('dr') ? user.name : `Dr. ${user.name}`) : 'Doctor'}.
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-[#C6D5D0]">
                Publish authentic clinical cases, guide trainees through diagnostic dilemmas, host virtual Grand Rounds, and share hospital protocols with the next generation.
              </p>

              {/* Mentor practice stats strip */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-xl font-bold text-white">{cases.length}</div>
                  <div className="text-[11px] text-[#C6D5D0]">Published Cases</div>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-base sm:text-lg font-bold text-white truncate">{user?.specialty || 'Consultant'}</div>
                  <div className="text-[11px] text-[#C6D5D0]">Clinical Specialty</div>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-base sm:text-lg font-bold text-white truncate">{user?.hospital || 'Teaching Hospital'}</div>
                  <div className="text-[11px] text-[#C6D5D0]">Hospital Affiliation</div>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-base sm:text-lg font-bold text-[#F0B28A]">Active</div>
                  <div className="text-[11px] text-[#C6D5D0]">Mentorship Status</div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setPublishModalOpen(true)}
                  className="rounded-full bg-[#D86F52] px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition-all hover:bg-[#B9543D] hover:shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <span>+</span> Publish Clinical Case
                </button>
                <button
                  onClick={() => navigate('events')}
                  className="rounded-full bg-[#FFFCF8] text-[#183D3A] px-5 py-2.5 text-xs sm:text-sm font-bold transition-all hover:bg-[#F1EEE8] hover:shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <span>📅</span> Host Grand Round / Webinar
                </button>
                <button
                  onClick={() => navigate('resources')}
                  className="rounded-full border border-white/30 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-white/10 cursor-pointer flex items-center gap-1.5"
                >
                  <span>📄</span> Upload Protocol
                </button>
                <button
                  onClick={() => navigate('forums')}
                  className="rounded-full border border-white/30 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-white/10 cursor-pointer flex items-center gap-1.5"
                >
                  <span>💬</span> Trainee Discussions
                </button>
              </div>
            </div>
          </section>
        ) : (
          /* Mentee / Resident / Trainee Hero */
          <section className="relative mb-8 overflow-hidden rounded-3xl bg-[#183D3A] px-6 py-8 sm:px-10 sm:py-10 text-white shadow-md">
            <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[28px] border-[#D86F52]/25" />
            <div className="absolute bottom-[-90px] right-36 h-48 w-48 rounded-full border-[22px] border-[#F0B28A]/15" />

            <div className="relative max-w-3xl">
              <div className="inline-flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-[#F0B28A]" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F0B28A]">
                  Junior Doctor & Trainee Learning Hub
                </p>
              </div>

              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl text-white" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                Good morning, {user?.name || 'Doctor'}.
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-[#C6D5D0]">
                Access authentic consultant case presentations, exam revision notes (MRCP, USMLE, PACES), join specialty syndicates, and request 1-on-1 mentorship.
              </p>

              {/* Trainee learning stats strip */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-xl font-bold text-white">{suggestedMentors.length}</div>
                  <div className="text-[11px] text-[#C6D5D0]">Available Mentors</div>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-xl font-bold text-white">{cases.length}</div>
                  <div className="text-[11px] text-[#C6D5D0]">Clinical Cases</div>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-base sm:text-lg font-bold text-white truncate">{user?.careerStage || 'Trainee'}</div>
                  <div className="text-[11px] text-[#C6D5D0]">Training Stage</div>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10">
                  <div className="text-base sm:text-lg font-bold text-[#F0B28A] truncate">{user?.specialty || 'General Medicine'}</div>
                  <div className="text-[11px] text-[#C6D5D0]">Target Specialty</div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => navigate('mentor-profile')}
                  className="rounded-full bg-[#D86F52] hover:bg-[#B9543D] text-white px-5 py-2.5 text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <span>🔍</span> Find a Senior Mentor
                </button>
                <button
                  onClick={() => navigate('resources')}
                  className="rounded-full bg-[#FFFCF8] text-[#183D3A] px-5 py-2.5 text-xs sm:text-sm font-bold transition-all hover:bg-[#F1EEE8] hover:shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <span>📚</span> Exam & Study Notes
                </button>
                <button
                  onClick={() => navigate('groups')}
                  className="rounded-full border border-white/30 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-white/10 cursor-pointer flex items-center gap-1.5"
                >
                  <span>👥</span> Specialty Syndicates
                </button>
                <button
                  onClick={() => navigate('forums')}
                  className="rounded-full border border-white/30 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-white/10 cursor-pointer flex items-center gap-1.5"
                >
                  <span>💬</span> Trainee Q&A Forum
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
              <div className="p-4 rounded-2xl bg-[#E4EFEA] border border-[#3D7A68]/30 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <span className="text-2xl shrink-0">🩺</span>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-[#183D3A]">Clinician Publishing & Peer Review Portal</div>
                    <div className="text-[11px] sm:text-xs text-[#3D7A68]">You have verified educator credentials to author complex case studies and answer trainee questions.</div>
                  </div>
                </div>
                <button
                  onClick={() => setPublishModalOpen(true)}
                  className="shrink-0 rounded-full bg-[#183D3A] hover:bg-[#254f4b] text-white px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                >
                  + New Case
                </button>
              </div>
            ) : role === 'admin' ? (
              <div className="p-4 rounded-2xl bg-[#FBE5DC] border border-[#D86F52]/30 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <span className="text-2xl shrink-0">🛡️</span>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-[#183D3A]">Admin Moderation & Safety Active</div>
                    <div className="text-[11px] sm:text-xs text-[#B9543D]">You are supervising clinical content for Patient Identifiers (HIPAA / GDPR) and medical accuracy.</div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('admin')}
                  className="shrink-0 rounded-full bg-[#D86F52] hover:bg-[#B9543D] text-white px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                >
                  Admin Portal →
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[#FFFCF8] border border-[#D8D2C8] flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <span className="text-2xl shrink-0">📖</span>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-[#183D3A]">Consultant-Authored Clinical Cases Archive</div>
                    <div className="text-[11px] sm:text-xs text-[#71807C]">Reviewed teaching cases presented by verified Attendings & Specialists for clinical reasoning & exam prep.</div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('resources')}
                  className="shrink-0 text-xs font-bold text-[#D86F52] hover:underline cursor-pointer"
                >
                  Study Vault →
                </button>
              </div>
            )}

            {/* Filter Pills and Mentor Publish Action */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#D8D2C8]/70">
              <div className="flex gap-2 flex-wrap items-center">
                <span className="text-xs font-bold text-[#71807C] uppercase tracking-wider mr-1">Filter:</span>
                {filters.map(f => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      activeFilter === f
                        ? 'bg-[#D86F52] text-white shadow-xs'
                        : 'bg-[#FFFCF8] text-[#596965] border border-[#D8D2C8] hover:border-[#D86F52] hover:text-[#183D3A]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Mentor-only Publishing Badge / Button */}
              {role === 'mentor' && (
                <button
                  onClick={() => setPublishModalOpen(true)}
                  className="rounded-full bg-[#183D3A] hover:bg-[#254f4b] text-white px-4 py-1.5 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <span>+</span> New Case
                </button>
              )}
            </div>

            {/* Cases List */}
            {loadingCases ? (
              <div className="py-12 text-center text-sm text-[#71807C] bg-[#FFFCF8] rounded-2xl border border-[#D8D2C8]">
                <div className="w-8 h-8 border-3 border-[#D86F52] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Loading authentic clinical cases…
              </div>
            ) : cases.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#71807C] bg-[#FFFCF8] rounded-2xl border border-[#D8D2C8] p-6">
                <p className="font-semibold text-[#183D3A] text-base mb-1">No cases found in this category.</p>
                <p className="text-xs text-[#596965]">
                  {role === 'mentor' ? 'Be the first mentor to publish a case in this specialty!' : 'Check other specialty filters or check back soon.'}
                </p>
                {role === 'mentor' && (
                  <button
                    onClick={() => setPublishModalOpen(true)}
                    className="mt-4 px-4 py-2 bg-[#D86F52] text-white text-xs font-bold rounded-full hover:bg-[#B9543D]"
                  >
                    + Publish First Case
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {cases.map(c => {
                  const id = c.id || c._id || '';
                  const isUpvoted = upvotedIds.has(id);
                  return (
                    <div
                      key={id}
                      className="rounded-2xl bg-[#FFFCF8] border border-[#D8D2C8] p-6 hover:shadow-md hover:border-[#D86F52] transition-all cursor-pointer group"
                      onClick={() => handleCaseClick(c)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${specialtyColors[c.specialty] || 'bg-[#F1EEE8] text-[#596965]'}`}>
                          {c.specialty}
                        </span>
                        <span className="text-xs font-medium text-[#71807C]">{c.timeAgo || 'Recent'}</span>
                      </div>

                      <h3
                        className="font-bold text-[#183D3A] text-lg leading-snug mb-2 group-hover:text-[#D86F52] transition-colors"
                        style={{ fontFamily: 'Fraunces, Georgia, serif' }}
                      >
                        {c.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-[#596965] leading-relaxed mb-5 line-clamp-2">
                        {c.preview}
                      </p>

                      <div className="flex items-center justify-between pt-3 border-t border-[#EAE5DC]">
                        {/* Author Details */}
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#183D3A] flex items-center justify-center text-white text-[11px] font-bold">
                            {c.author ? c.author.split(' ').map(w => w[0]).join('').slice(0, 2) : 'DR'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-[#183D3A]">{c.author}</span>
                              {c.verified && (
                                <span title="Verified Clinician">
                                  <svg className="w-3.5 h-3.5 text-[#D86F52]" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#71807C]">{c.role}</span>
                          </div>
                        </div>

                        {/* Upvote & Comments */}
                        <div className="flex items-center gap-3">
                          <button
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                              isUpvoted
                                ? 'bg-[#FBE5DC] text-[#D86F52] border border-[#D86F52]/40'
                                : 'text-[#71807C] hover:bg-[#F1EEE8] hover:text-[#D86F52]'
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
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-[#71807C] hover:bg-[#F1EEE8] hover:text-[#183D3A] transition-colors cursor-pointer"
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
                <div className="rounded-2xl bg-[#FFFCF8] border border-[#D8D2C8] p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-4 border-b border-[#EAE5DC] pb-3">
                    <h3 className="font-bold text-[#183D3A] text-base" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                      Trainee Inquiries
                    </h3>
                    <button
                      onClick={() => navigate('messages')}
                      className="text-xs text-[#D86F52] hover:underline font-bold cursor-pointer"
                    >
                      Open Chat →
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F7F4EE] border border-[#EAE5DC] text-center space-y-2">
                    <span className="text-xl block">💬</span>
                    <p className="text-xs text-[#596965] leading-relaxed">
                      New 1-on-1 mentorship requests and clinical inquiries from junior doctors will appear here.
                    </p>
                    <button
                      onClick={() => navigate('messages')}
                      className="w-full mt-1 text-center py-2 text-xs font-bold text-[#183D3A] bg-white rounded-lg border border-[#D8D2C8] hover:bg-[#183D3A] hover:text-white transition-all cursor-pointer"
                    >
                      Open Mentorship Inbox →
                    </button>
                  </div>
                </div>

                {/* 2. Trainee Questions in Clinical Forums */}
                <div className="rounded-2xl bg-[#FFFCF8] border border-[#D8D2C8] p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-3 border-b border-[#EAE5DC] pb-3">
                    <h3 className="font-bold text-[#183D3A] text-base" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                      Trainee Case Questions
                    </h3>
                    <button
                      onClick={() => navigate('forums')}
                      className="text-xs text-[#D86F52] hover:underline font-bold cursor-pointer"
                    >
                      All Forums →
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F7F4EE] border border-[#EAE5DC] space-y-2">
                    <p className="text-xs text-[#596965] leading-relaxed">
                      Contribute consultant clinical pearls and answer diagnostic dilemmas posted by trainees across specialties.
                    </p>
                    <button
                      onClick={() => navigate('forums')}
                      className="w-full text-center py-2 text-xs font-bold text-[#183D3A] bg-white rounded-lg border border-[#D8D2C8] hover:bg-[#183D3A] hover:text-white transition-all cursor-pointer"
                    >
                      Browse Trainee Discussions →
                    </button>
                  </div>
                </div>

                {/* 3. Host Masterclasses & Webinars */}
                <div className="rounded-2xl bg-[#FFFCF8] border border-[#D8D2C8] p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-3 border-b border-[#EAE5DC] pb-3">
                    <h3 className="font-bold text-[#183D3A] text-base" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                      Grand Rounds & Webinars
                    </h3>
                    <button
                      onClick={() => navigate('events')}
                      className="text-xs text-[#D86F52] hover:underline font-bold cursor-pointer"
                    >
                      Calendar →
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-[#E4EFEA] border border-[#3D7A68]/20 space-y-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3D7A68]">Educational Events</span>
                    <p className="text-xs text-[#183D3A] leading-relaxed">
                      Host virtual Grand Rounds, complex case presentations, and interactive webinars for junior doctors.
                    </p>
                  </div>

                  <button
                    onClick={() => navigate('events')}
                    className="w-full text-center py-2 text-xs font-bold text-white bg-[#183D3A] rounded-xl hover:bg-[#254f4b] transition-all cursor-pointer"
                  >
                    + Schedule Grand Round / Webinar
                  </button>
                </div>
              </>
            ) : role === 'admin' ? (
              /* ================= ADMIN RIGHT PANEL ================= */
              <>
                {/* 1. Physician Verification Queue */}
                <div className="rounded-2xl bg-[#FFFCF8] border border-[#D8D2C8] p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-4 border-b border-[#EAE5DC] pb-3">
                    <h3 className="font-bold text-[#183D3A] text-base" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                      Doctor Credentialing
                    </h3>
                    <button
                      onClick={() => navigate('admin')}
                      className="text-xs text-[#D86F52] hover:underline font-bold cursor-pointer"
                    >
                      Open Queue →
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F7F4EE] border border-[#EAE5DC] space-y-2 mb-4">
                    <p className="text-xs text-[#596965] leading-relaxed">
                      Review submitted physician licenses, medical qualifications, and verify consultant credentials.
                    </p>
                  </div>

                  <button
                    onClick={() => navigate('admin')}
                    className="w-full text-center py-2 text-xs font-bold text-white bg-[#D86F52] rounded-xl hover:bg-[#B9543D] transition-all cursor-pointer"
                  >
                    Open Admin Verification Queue →
                  </button>
                </div>

                {/* 2. Platform Telemetry */}
                <div className="rounded-2xl bg-[#FFFCF8] border border-[#D8D2C8] p-5 shadow-2xs">
                  <h3 className="font-bold text-[#183D3A] text-base mb-3 border-b border-[#EAE5DC] pb-3" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                    Platform Governance
                  </h3>
                  <div className="space-y-2.5">
                    {[
                      { label: 'Access Control', val: 'Role-Based Authentication', status: 'text-[#183D3A]' },
                      { label: 'Database Storage', val: 'MongoDB Atlas Connected', status: 'text-[#3D7A68]' },
                      { label: 'PHI Compliance', val: 'De-identification Active', status: 'text-[#3D7A68]' },
                      { label: 'Platform Security', val: 'Audit Logging Enabled', status: 'text-[#183D3A]' },
                    ].map((tel, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[#F7F4EE] text-xs">
                        <span className="text-[#596965]">{tel.label}</span>
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
                <div className="rounded-2xl bg-[#FFFCF8] border border-[#D8D2C8] p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-4 border-b border-[#EAE5DC] pb-3">
                    <h3 className="font-bold text-[#183D3A] text-base" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                      Senior Consultants
                    </h3>
                    <button
                      onClick={() => navigate('mentor-profile')}
                      className="text-xs text-[#D86F52] hover:underline font-bold cursor-pointer"
                    >
                      View all
                    </button>
                  </div>
                  {suggestedMentors.length > 0 ? (
                    <div className="space-y-3.5">
                      {suggestedMentors.map(m => (
                        <div key={m.id || m.name} className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-[#F1EEE8] transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#183D3A] flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {m.initials}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-bold text-[#183D3A] truncate">{m.name}</div>
                              <div className="text-xs text-[#71807C] truncate">{m.specialty} · ★ {m.rating}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleMentorClick(m)}
                            className="shrink-0 text-xs font-bold text-[#D86F52] border border-[#D86F52] px-3 py-1 rounded-full hover:bg-[#FBE5DC] transition-colors cursor-pointer"
                          >
                            Connect
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#F7F4EE] border border-[#EAE5DC] text-center text-xs text-[#596965]">
                      Verified senior consultants and mentors will appear here.
                    </div>
                  )}
                </div>

                {/* 2. Upcoming Masterclasses & Grand Rounds */}
                <div className="rounded-2xl bg-[#FFFCF8] border border-[#D8D2C8] p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-4 border-b border-[#EAE5DC] pb-3">
                    <h3 className="font-bold text-[#183D3A] text-base" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                      Grand Rounds & Webinars
                    </h3>
                    <button
                      onClick={() => navigate('events')}
                      className="text-xs text-[#D86F52] hover:underline font-bold cursor-pointer"
                    >
                      Calendar
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-[#F7F4EE] border border-[#EAE5DC] space-y-2">
                    <p className="text-xs text-[#596965] leading-relaxed">
                      Attend live clinical case conferences, diagnostic workshops, and specialty grand rounds hosted by senior clinicians.
                    </p>
                    <button
                      onClick={() => navigate('events')}
                      className="w-full text-center py-2 text-xs font-bold text-[#183D3A] bg-white rounded-lg border border-[#D8D2C8] hover:bg-[#183D3A] hover:text-white transition-all cursor-pointer"
                    >
                      View Upcoming Webinars & RSVPs →
                    </button>
                  </div>
                </div>

                {/* 3. High-Yield PACES & Guidelines */}
                <div className="rounded-2xl bg-[#FFFCF8] border border-[#D8D2C8] p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-4 border-b border-[#EAE5DC] pb-3">
                    <h3 className="font-bold text-[#183D3A] text-base" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                      Clinical Resources & Vault
                    </h3>
                    <button
                      onClick={() => navigate('resources')}
                      className="text-xs text-[#D86F52] hover:underline font-bold cursor-pointer"
                    >
                      All Notes
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-[#F7F4EE] border border-[#EAE5DC] space-y-2">
                    <p className="text-xs text-[#596965] leading-relaxed">
                      Access high-yield revision notes, diagnostic algorithms, and hospital protocols shared by verified clinicians.
                    </p>
                    <button
                      onClick={() => navigate('resources')}
                      className="w-full text-center py-2 text-xs font-bold text-[#183D3A] bg-white rounded-lg border border-[#D8D2C8] hover:bg-[#183D3A] hover:text-white transition-all cursor-pointer"
                    >
                      Explore Study Vault →
                    </button>
                  </div>
                </div>

                {/* 4. Specialty Study Circles */}
                <div className="rounded-2xl bg-[#FFFCF8] border border-[#D8D2C8] p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-3 border-b border-[#EAE5DC] pb-3">
                    <h3 className="font-bold text-[#183D3A] text-base" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                      Specialty Syndicates
                    </h3>
                    <button
                      onClick={() => navigate('groups')}
                      className="text-xs text-[#D86F52] hover:underline font-bold cursor-pointer"
                    >
                      Browse
                    </button>
                  </div>
                  <p className="text-xs text-[#596965] mb-3 leading-relaxed">
                    Collaborate with fellow registrars and residents on clinical audits and exam revision circles.
                  </p>
                  <button
                    onClick={() => navigate('groups')}
                    className="w-full text-center py-2 text-xs font-bold text-[#183D3A] bg-[#F1EEE8] rounded-xl hover:bg-[#183D3A] hover:text-white transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#183D3A]/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#FFFCF8] rounded-3xl border border-[#D8D2C8] shadow-2xl max-w-2xl w-full p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#D8D2C8] mb-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#D86F52]">
                  Mentor Publishing Portal
                </span>
                <h2 className="text-2xl font-bold text-[#183D3A]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                  Publish Clinical Case Study
                </h2>
              </div>
              <button
                onClick={() => setPublishModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#71807C] hover:bg-[#F1EEE8] hover:text-[#183D3A]"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-[#FBE5DC] border border-[#D86F52]/30 text-xs font-semibold text-[#B9543D]">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-[#E4EAE3] border border-[#3D7A68]/30 text-xs font-semibold text-[#183D3A]">
                ✓ {formSuccess}
              </div>
            )}

            <form onSubmit={handlePublishCase} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#183D3A] mb-1">Case Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Atypical chest pain in a 34-year-old female"
                  value={caseForm.title}
                  onChange={e => setCaseForm({ ...caseForm, title: e.target.value })}
                  className="w-full rounded-xl border border-[#D8D2C8] bg-white px-4 py-2.5 text-sm text-[#183D3A] focus:border-[#D86F52] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#183D3A] mb-1">Specialty *</label>
                  <select
                    value={caseForm.specialty}
                    onChange={e => setCaseForm({ ...caseForm, specialty: e.target.value })}
                    className="w-full rounded-xl border border-[#D8D2C8] bg-white px-4 py-2.5 text-sm text-[#183D3A] focus:border-[#D86F52] focus:outline-none"
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
                  <label className="block text-xs font-bold text-[#183D3A] mb-1">Subspecialty</label>
                  <input
                    type="text"
                    placeholder="e.g. NSTEMI / SCAD"
                    value={caseForm.subspecialty}
                    onChange={e => setCaseForm({ ...caseForm, subspecialty: e.target.value })}
                    className="w-full rounded-xl border border-[#D8D2C8] bg-white px-4 py-2.5 text-sm text-[#183D3A] focus:border-[#D86F52] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#183D3A] mb-1">Patient Age Range</label>
                  <input
                    type="text"
                    value={caseForm.ageRange}
                    onChange={e => setCaseForm({ ...caseForm, ageRange: e.target.value })}
                    placeholder="30–39 years"
                    className="w-full rounded-xl border border-[#D8D2C8] bg-white px-4 py-2.5 text-sm text-[#183D3A] focus:border-[#D86F52] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#183D3A] mb-1">Biological Sex</label>
                  <select
                    value={caseForm.sex}
                    onChange={e => setCaseForm({ ...caseForm, sex: e.target.value })}
                    className="w-full rounded-xl border border-[#D8D2C8] bg-white px-4 py-2.5 text-sm text-[#183D3A] focus:border-[#D86F52] focus:outline-none"
                  >
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other / Unspecified</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#183D3A] mb-1">Presenting Complaint & Timeline *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Summary of presentation, symptoms, triage vital signs…"
                  value={caseForm.presentingComplaint}
                  onChange={e => setCaseForm({ ...caseForm, presentingComplaint: e.target.value })}
                  className="w-full rounded-xl border border-[#D8D2C8] bg-white px-4 py-2.5 text-sm text-[#183D3A] focus:border-[#D86F52] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#183D3A] mb-1">Past Medical History & Medications</label>
                <textarea
                  rows={2}
                  placeholder="Relevant past history, medications, risk factors…"
                  value={caseForm.history}
                  onChange={e => setCaseForm({ ...caseForm, history: e.target.value })}
                  className="w-full rounded-xl border border-[#D8D2C8] bg-white px-4 py-2.5 text-sm text-[#183D3A] focus:border-[#D86F52] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#183D3A] mb-1">Investigations & Key Diagnostic Findings</label>
                <textarea
                  rows={2}
                  placeholder="ECG, labs, imaging, biomarker findings…"
                  value={caseForm.investigations}
                  onChange={e => setCaseForm({ ...caseForm, investigations: e.target.value })}
                  className="w-full rounded-xl border border-[#D8D2C8] bg-white px-4 py-2.5 text-sm text-[#183D3A] focus:border-[#D86F52] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#183D3A] mb-1">Final Diagnosis *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SCAD of LAD"
                    value={caseForm.diagnosis}
                    onChange={e => setCaseForm({ ...caseForm, diagnosis: e.target.value })}
                    className="w-full rounded-xl border border-[#D8D2C8] bg-white px-4 py-2.5 text-sm text-[#183D3A] focus:border-[#D86F52] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#183D3A] mb-1">Treatment / Management</label>
                  <input
                    type="text"
                    placeholder="e.g. Conservative aspirin + beta-blockade"
                    value={caseForm.treatment}
                    onChange={e => setCaseForm({ ...caseForm, treatment: e.target.value })}
                    className="w-full rounded-xl border border-[#D8D2C8] bg-white px-4 py-2.5 text-sm text-[#183D3A] focus:border-[#D86F52] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#183D3A] mb-1">Outcome</label>
                <input
                  type="text"
                  placeholder="e.g. Discharge day 4, repeat echo normal at 6 weeks"
                  value={caseForm.outcome}
                  onChange={e => setCaseForm({ ...caseForm, outcome: e.target.value })}
                  className="w-full rounded-xl border border-[#D8D2C8] bg-white px-4 py-2.5 text-sm text-[#183D3A] focus:border-[#D86F52] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#183D3A] mb-1">Key Learning Points (One per line)</label>
                <textarea
                  rows={3}
                  placeholder="Point 1&#10;Point 2&#10;Point 3"
                  value={caseForm.learningPoints}
                  onChange={e => setCaseForm({ ...caseForm, learningPoints: e.target.value })}
                  className="w-full rounded-xl border border-[#D8D2C8] bg-white px-4 py-2.5 text-sm text-[#183D3A] focus:border-[#D86F52] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#D8D2C8]">
                <button
                  type="button"
                  onClick={() => setPublishModalOpen(false)}
                  className="rounded-full px-5 py-2.5 text-xs font-bold text-[#596965] hover:bg-[#F1EEE8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCase}
                  className="rounded-full bg-[#D86F52] hover:bg-[#B9543D] text-white px-6 py-2.5 text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
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
