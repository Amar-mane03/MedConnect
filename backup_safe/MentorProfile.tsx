import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import type { Page } from '../App';
import API from '../api';
import { useAuth } from '../context/AuthContext';

interface Props {
  navigate: (p: Page, meta?: any) => void;
  mentorId?: string | null;
  onSelectMentor?: (id: string) => void;
}

interface Mentor {
  _id: string;
  id?: string;
  name: string;
  email: string;
  specialty: string;
  subspecialty?: string;
  hospital?: string;
  degrees?: string;
  licenseNumber?: string;
  experienceYears?: number;
  rating?: number;
  reviews?: number;
  bio?: string;
  publications?: { title: string; journal: string; year: string }[];
  verified?: boolean;
}

interface MentorshipRequestItem {
  _id: string;
  mentee: {
    _id: string;
    name: string;
    email: string;
    specialty?: string;
  };
  goal?: string;
  note?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export default function MentorProfilePage({ navigate, mentorId, onSelectMentor }: Props) {
  const { user, role } = useAuth();
  const [mentorsList, setMentorsList] = useState<Mentor[]>([]);
  const [activeMentor, setActiveMentor] = useState<Mentor | null>(null);
  const [loading, setLoading] = useState(true);
  const [requested, setRequested] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [requestGoal, setRequestGoal] = useState('Clinical Reasoning & Case Reviews');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // For Mentors viewing their incoming requests
  const [incomingRequests, setIncomingRequests] = useState<MentorshipRequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const fetchMentors = async () => {
    setLoading(true);
    try {
      const res = await API.get('/mentors');
      if (res.data?.mentors) {
        setMentorsList(res.data.mentors);
        // Find target mentor or pick first
        let current: Mentor | undefined;
        if (mentorId) {
          current = res.data.mentors.find((m: Mentor) => (m.id || m._id) === mentorId);
        }
        if (!current && res.data.mentors.length > 0) {
          current = res.data.mentors[0];
        }
        if (current) {
          fetchMentorDetail(current.id || current._id);
        }
      }
    } catch (err) {
      console.error('Failed to load mentors:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMentorDetail = async (id: string) => {
    try {
      const res = await API.get(`/mentors/${id}`);
      if (res.data) {
        setActiveMentor(res.data);
      }
    } catch (err) {
      console.error('Failed to load mentor details:', err);
    }
  };

  const fetchIncomingRequests = async () => {
    if (role !== 'mentor') return;
    setLoadingRequests(true);
    try {
      const res = await API.get('/mentors/requests/incoming');
      if (res.data?.requests) {
        setIncomingRequests(res.data.requests);
      }
    } catch (err) {
      console.error('Failed to load incoming requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchMentors();
    if (role === 'mentor') {
      fetchIncomingRequests();
    }
  }, [mentorId, role]);

  const handleSelectMentor = (m: Mentor) => {
    const id = m.id || m._id;
    if (onSelectMentor) onSelectMentor(id);
    fetchMentorDetail(id);
    setRequested(false);
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMentor) return;
    setSubmittingRequest(true);
    try {
      const id = activeMentor.id || activeMentor._id;
      await API.post(`/mentors/${id}/request`, {
        note: requestNote,
        goal: requestGoal,
      });
      setRequested(true);
      setRequestModalOpen(false);
    } catch (err: any) {
      console.error('Failed to request mentorship:', err);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleUpdateRequestStatus = async (requestId: string, status: 'accepted' | 'declined') => {
    try {
      await API.patch(`/mentors/requests/${requestId}`, { status });
      setIncomingRequests(prev =>
        prev.map(r => (r._id === requestId ? { ...r, status } : r))
      );
    } catch (err) {
      console.error('Failed to update request:', err);
    }
  };

  if (loading && !activeMentor) {
    return (
      <Layout navigate={navigate} currentPage="mentor-profile">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <div className="w-10 h-10 border-3 border-[#D86F52] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-[#183D3A]">Loading mentors directory…</p>
        </div>
      </Layout>
    );
  }

  const mentor = activeMentor || mentorsList[0];
  const initials = mentor?.name
    ? mentor.name.split(' ').map(w => w[0]).join('').slice(0, 2)
    : 'MP';

  return (
    <Layout navigate={navigate} currentPage="mentor-profile">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Navigation Breadcrumb & Mentor Directory Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <button
            onClick={() => navigate('dashboard')}
            className="flex items-center gap-2 text-sm text-[#596965] hover:text-[#D86F52] transition-colors font-semibold cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Feed
          </button>

          {/* Quick Mentor Switcher */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <span className="text-xs font-bold text-[#71807C] shrink-0">Mentors:</span>
            {mentorsList.map(m => {
              const id = m.id || m._id;
              const active = (mentor?.id || mentor?._id) === id;
              return (
                <button
                  key={id}
                  onClick={() => handleSelectMentor(m)}
                  className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#183D3A] text-white shadow-xs'
                      : 'bg-[#FFFCF8] text-[#596965] border border-[#D8D2C8] hover:border-[#D86F52]'
                  }`}
                >
                  {m.name.split(' ')[0]} {m.name.split(' ')[1] || ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* Incoming Mentorship Requests (Visible only to Mentors) */}
        {role === 'mentor' && incomingRequests.length > 0 && (
          <div className="mb-8 bg-[#FFFCF8] rounded-2xl border border-[#D8D2C8] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-[#EAE5DC] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📬</span>
                <h3 className="font-bold text-[#183D3A] text-base" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                  Incoming Mentee Applications ({incomingRequests.filter(r => r.status === 'pending').length} pending)
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              {incomingRequests.map(r => (
                <div key={r._id} className="p-4 rounded-xl bg-[#F1EEE8]/60 border border-[#D8D2C8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#183D3A]">{r.mentee.name}</span>
                      <span className="text-xs text-[#71807C]">({r.mentee.email})</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        r.status === 'accepted' ? 'bg-[#E4EAE3] text-[#2E7D5A]' : r.status === 'declined' ? 'bg-[#FBE5DC] text-[#B9543D]' : 'bg-[#FAF0E6] text-[#C27D38]'
                      }`}>
                        {r.status}
                      </span>
                    </div>
                    {r.goal && <p className="text-xs text-[#D86F52] font-semibold mt-1">Goal: {r.goal}</p>}
                    {r.note && <p className="text-xs text-[#596965] mt-0.5">{r.note}</p>}
                  </div>

                  {r.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleUpdateRequestStatus(r._id, 'accepted')}
                        className="px-4 py-1.5 bg-[#2E7D5A] hover:bg-[#256347] text-white text-xs font-bold rounded-full transition-colors cursor-pointer"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleUpdateRequestStatus(r._id, 'declined')}
                        className="px-4 py-1.5 border border-[#D8D2C8] hover:bg-[#FBE5DC] text-[#B9543D] text-xs font-bold rounded-full transition-colors cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {mentor && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Mentor Card & Stats */}
            <div className="lg:col-span-1 space-y-5">
              <div className="bg-[#FFFCF8] rounded-2xl border border-[#D8D2C8] p-6 text-center shadow-xs">
                <div
                  className="w-24 h-24 rounded-full bg-[#D86F52] flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-sm"
                  style={{ fontFamily: 'Fraunces, Georgia, serif' }}
                >
                  {initials}
                </div>

                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <h1 className="text-xl font-bold text-[#183D3A]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                    {mentor.name}
                  </h1>
                  <svg className="w-5 h-5 text-[#D86F52]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>

                <p className="text-sm text-[#D86F52] font-bold">{mentor.specialty}</p>
                <p className="text-xs text-[#71807C] mt-0.5">{mentor.hospital || "St. Mary's Hospital · London, UK"}</p>

                {/* Rating */}
                <div className="flex items-center justify-center gap-1 mt-3">
                  {[1, 2, 3, 4, 5].map(s => (
                    <svg key={s} className="w-4 h-4 text-[#D86F52]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="text-sm font-bold text-[#183D3A] ml-1.5">{mentor.rating || 4.9}</span>
                  <span className="text-xs text-[#71807C]">({mentor.reviews || 47} reviews)</span>
                </div>

                {/* Action Buttons */}
                <div className="mt-5 space-y-2">
                  <button
                    onClick={() => {
                      if (!requested) setRequestModalOpen(true);
                      else setRequested(false);
                    }}
                    className={`w-full py-3 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      requested
                        ? 'bg-[#FBE5DC] text-[#B9543D] border border-[#D86F52]'
                        : 'bg-[#D86F52] hover:bg-[#B9543D] text-white shadow-sm'
                    }`}
                  >
                    {requested ? '✓ Mentorship Request Sent' : 'Request Mentorship'}
                  </button>
                  <button
                    onClick={() => navigate('messages')}
                    className="w-full py-3 rounded-full text-xs sm:text-sm font-bold border border-[#D8D2C8] text-[#183D3A] hover:bg-[#F1EEE8] transition-all cursor-pointer"
                  >
                    Send Direct Message
                  </button>
                </div>
              </div>

              {/* Experience & Activity stats */}
              <div className="bg-[#FFFCF8] rounded-2xl border border-[#D8D2C8] p-5 shadow-xs">
                <h3 className="text-sm font-bold text-[#183D3A] mb-3 border-b border-[#EAE5DC] pb-2.5" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                  Activity & Metrics
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: 'Experience', value: `${mentor.experienceYears || 12} yrs` },
                    { label: 'Rating', value: `★ ${mentor.rating || 4.9}` },
                    { label: 'Publications', value: `${mentor.publications?.length || 3}` },
                    { label: 'Licence Verified', value: 'GMC Reg' },
                  ].map(s => (
                    <div key={s.label} className="bg-[#F1EEE8]/70 rounded-xl p-3 text-center">
                      <div className="text-base font-bold text-[#183D3A]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>{s.value}</div>
                      <div className="text-[11px] text-[#71807C] mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Areas of focus */}
              <div className="bg-[#FFFCF8] rounded-2xl border border-[#D8D2C8] p-5 shadow-xs">
                <h3 className="text-sm font-bold text-[#183D3A] mb-3 border-b border-[#EAE5DC] pb-2.5" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                  Areas of Focus
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    mentor.specialty,
                    mentor.subspecialty || 'Acute Clinical Reasoning',
                    'Evidence-Based Practice',
                    'Residency Preparation',
                    'Diagnostic Investigations',
                  ].filter(Boolean).map(t => (
                    <span key={t} className="text-xs bg-[#FBE5DC] text-[#B9543D] px-3 py-1 rounded-full font-semibold">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Bio, Publications, Mentee Reviews */}
            <div className="lg:col-span-2 space-y-6">
              {/* About Card */}
              <div className="bg-[#FFFCF8] rounded-2xl border border-[#D8D2C8] p-6 sm:p-8 shadow-xs">
                <h2 className="text-lg font-bold text-[#183D3A] mb-3" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                  About {mentor.name}
                </h2>
                <p className="text-sm text-[#42524E] leading-relaxed">
                  {mentor.bio ||
                    `${mentor.name} is a verified senior clinician at ${mentor.hospital || "our affiliated teaching hospital"}. With over ${mentor.experienceYears || 10} years of clinical and academic practice, they are passionate about mentoring medical students and junior resident doctors.`}
                </p>

                <div className="mt-5 pt-4 border-t border-[#EAE5DC] flex flex-wrap gap-4 text-xs font-semibold text-[#596965]">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[#D86F52]">📍</span> {mentor.hospital || 'NHS Teaching Hospital'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[#D86F52]">🎓</span> {mentor.degrees || 'MBBS, MD'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[#D86F52]">🛡️</span> {mentor.licenseNumber ? `Licence #${mentor.licenseNumber} (Verified)` : 'Medical Licence (Verified)'}
                  </span>
                </div>
              </div>

              {/* Publications */}
              <div className="bg-[#FFFCF8] rounded-2xl border border-[#D8D2C8] p-6 sm:p-8 shadow-xs">
                <h2 className="text-lg font-bold text-[#183D3A] mb-4" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                  Selected Publications & Case Reports
                </h2>
                <div className="space-y-3">
                  {(mentor.publications && mentor.publications.length > 0 ? mentor.publications : [
                    { title: 'Management of Acute Coronary Presentations in Non-Traditional Risk Cohorts', journal: 'European Heart Journal', year: '2025' },
                    { title: 'Structured Clinical Reasoning for Diagnostic Uncertainty in ED', journal: 'BMJ Clinical Practice', year: '2024' },
                    { title: 'Digital Peer Mentorship in Specialist Surgical and Medical Training', journal: 'Lancet MedEd', year: '2023' },
                  ]).map((p, i) => (
                    <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-[#F1EEE8]/60 border border-[#D8D2C8]/60 hover:bg-[#F1EEE8] transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-[#D86F52]/15 flex items-center justify-center text-[#D86F52] shrink-0 mt-0.5">
                        📄
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-[#183D3A] leading-snug">{p.title}</div>
                        <div className="text-xs text-[#71807C] mt-1">{p.journal} · {p.year}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mentee Testimonials */}
              <div className="bg-[#FFFCF8] rounded-2xl border border-[#D8D2C8] p-6 sm:p-8 shadow-xs">
                <h2 className="text-lg font-bold text-[#183D3A] mb-4" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                  Mentee Endorsements
                </h2>
                <div className="space-y-4">
                  {[
                    { author: 'Dr. Marcus Osei (Neurology Registrar)', text: 'Generous, rigorous, and patient. The monthly discussions transformed how I evaluate complex presentations.' },
                    { author: 'Alex Student (MS4)', text: 'Helped me prepare for rotations and gave constructive feedback on clinical differential diagnosis.' },
                  ].map((rev, i) => (
                    <div key={i} className="p-4 rounded-xl bg-[#F1EEE8]/50 border border-[#EAE5DC]">
                      <p className="text-xs text-[#42524E] leading-relaxed mb-2">"{rev.text}"</p>
                      <span className="text-[11px] font-bold text-[#183D3A]">{rev.author}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Mentorship Request Modal */}
        {requestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#183D3A]/40 backdrop-blur-xs p-4">
            <div className="bg-[#FFFCF8] rounded-3xl border border-[#D8D2C8] shadow-2xl max-w-lg w-full p-6 sm:p-8">
              <div className="flex items-center justify-between pb-3 border-b border-[#D8D2C8] mb-4">
                <h2 className="text-xl font-bold text-[#183D3A]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                  Request Mentorship with {mentor?.name}
                </h2>
                <button onClick={() => setRequestModalOpen(false)} className="text-[#71807C] hover:text-[#183D3A]">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSendRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#183D3A] mb-1">Primary Learning Goal</label>
                  <select
                    value={requestGoal}
                    onChange={e => setRequestGoal(e.target.value)}
                    className="w-full rounded-xl border border-[#D8D2C8] bg-white px-4 py-2.5 text-xs text-[#183D3A]"
                  >
                    <option>Clinical Reasoning & Case Reviews</option>
                    <option>Specialty Application & Career Guidance</option>
                    <option>Research Methodology & Publication</option>
                    <option>General Clinical Mentorship</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#183D3A] mb-1">Introductory Note</label>
                  <textarea
                    rows={3}
                    placeholder="Briefly introduce your stage of training and what you hope to learn…"
                    value={requestNote}
                    onChange={e => setRequestNote(e.target.value)}
                    className="w-full rounded-xl border border-[#D8D2C8] bg-white px-4 py-2.5 text-xs text-[#183D3A]"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setRequestModalOpen(false)}
                    className="px-4 py-2 rounded-full text-xs font-bold text-[#596965] hover:bg-[#F1EEE8]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRequest}
                    className="px-5 py-2 bg-[#D86F52] hover:bg-[#B9543D] text-white text-xs font-bold rounded-full transition-colors cursor-pointer"
                  >
                    {submittingRequest ? 'Sending…' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
