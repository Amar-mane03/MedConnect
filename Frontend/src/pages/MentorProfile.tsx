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
  reviewsCount?: number;
  reviews?: { author: string; rating?: number; time?: string; text: string }[];
  bio?: string;
  publications?: { title: string; journal: string; year: string }[];
  areasOfInterest?: string[];
  verified?: boolean;
}

interface MentorshipRequestItem {
  _id: string;
  mentor?: { _id: string; name: string } | string;
  mentee: {
    _id: string;
    name: string;
    email: string;
    specialty?: string;
  };
  goals?: string;
  note?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export default function MentorProfilePage({ navigate, mentorId, onSelectMentor }: Props) {
  const { user, role } = useAuth();
  const [mentorsList, setMentorsList] = useState<Mentor[]>([]);
  const [activeMentor, setActiveMentor] = useState<Mentor | null>(null);
  const [selectedMentorId, setSelectedMentorId] = useState(mentorId || '');
  const [loading, setLoading] = useState(true);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'accepted' | 'declined'>('none');
  const [myRequests, setMyRequests] = useState<MentorshipRequestItem[]>([]);
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
          const id = current.id || current._id;
          setSelectedMentorId(id);
          fetchMentorDetail(id);
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
        setActiveMentor(res.data.mentor || res.data);
      }
    } catch (err) {
      console.error('Failed to load mentor details:', err);
    }
  };

  const fetchMyRequests = async () => {
    if (!user) return;
    setLoadingRequests(true);
    try {
      const res = await API.get('/mentors/requests/mine');
      if (res.data?.requests) {
        setMyRequests(res.data.requests);
        if (role === 'mentor') setIncomingRequests(res.data.requests);
      }
    } catch (err) {
      console.error('Failed to load incoming requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchMentors();
    fetchMyRequests();
  }, [mentorId, role, user?._id]);

  useEffect(() => {
    if (role !== 'mentee') return;
    const request = myRequests.find(r => {
      const requestMentorId = typeof r.mentor === 'string' ? r.mentor : r.mentor?._id;
      return requestMentorId === selectedMentorId;
    });
    setRequestStatus(request?.status || 'none');
  }, [myRequests, selectedMentorId, role]);

  const handleSelectMentor = (m: Mentor) => {
    const id = m.id || m._id;
    setSelectedMentorId(id);
    if (onSelectMentor) onSelectMentor(id);
    fetchMentorDetail(id);
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMentor) return;
    setSubmittingRequest(true);
    try {
      const id = activeMentor.id || activeMentor._id;
      const res = await API.post(`/mentors/${id}/request`, {
        note: requestNote,
        goals: requestGoal,
      });
      if (res.data?.request) {
        setMyRequests(prev => [res.data.request, ...prev.filter(request => request._id !== res.data.request._id)]);
      }
      setRequestStatus(res.data?.request?.status || 'pending');
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
      setMyRequests(prev => prev.map(r => (r._id === requestId ? { ...r, status } : r)));
    } catch (err) {
      console.error('Failed to update request:', err);
    }
  };

  if (loading && !activeMentor) {
    return (
      <Layout navigate={navigate} currentPage="mentor-profile">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <div className="w-10 h-10 border-3 border-[#52796F] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-[#0B192C]">Loading mentors directory…</p>
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
            className="flex items-center gap-2 text-sm text-[#52616C] hover:text-[#52796F] transition-colors font-semibold cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Feed
          </button>

          {/* Quick Mentor Switcher */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <span className="text-xs font-bold text-[#74817D] shrink-0">Mentors:</span>
            {mentorsList.map(m => {
              const id = m.id || m._id;
              const active = (mentor?.id || mentor?._id) === id;
              return (
                <button
                  key={id}
                  onClick={() => handleSelectMentor(m)}
                  className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#0B192C] text-white shadow-xs'
                      : 'bg-[#FFFFFF] text-[#52616C] border border-[#E1E7E5] hover:border-[#52796F]'
                  }`}
                >
                  {m.name.split(' ')[0]} {m.name.split(' ')[1] || ''}
                </button>
              );
            })}
          </div>
        </div>

        {role === 'mentee' && myRequests.length > 0 && (
          <section className="mb-8 border border-[#E1E7E5] bg-white" aria-labelledby="mentorship-history-title">
            <div className="border-b border-[#E1E7E5] px-5 py-3">
              <h2 id="mentorship-history-title" className="text-sm font-bold text-[#0B192C]">Your mentorship requests</h2>
            </div>
            <div className="divide-y divide-[#E1E7E5]">
              {myRequests.map(request => {
                const mentorName = typeof request.mentor === 'string' ? 'Mentor' : request.mentor?.name || 'Mentor';
                return (
                  <div key={request._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0B192C]">{mentorName}</p>
                      <p className="mt-0.5 text-xs text-[#74817D]">{request.goals || 'Clinical learning and guidance'}</p>
                    </div>
                    <span className="text-xs font-semibold capitalize text-[#52796F]">{request.status}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Incoming Mentorship Requests (Visible only to Mentors) */}
        {role === 'mentor' && incomingRequests.length > 0 && (
          <div className="mb-8 bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-[#E1E7E5] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📬</span>
                <h3 className="font-bold text-[#0B192C] text-base" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  Incoming Mentee Applications ({incomingRequests.filter(r => r.status === 'pending').length} pending)
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              {incomingRequests.map(r => (
                <div key={r._id} className="p-4 rounded-lg bg-[#F0F4F2]/60 border border-[#E1E7E5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#0B192C]">{r.mentee.name}</span>
                      <span className="text-xs text-[#74817D]">({r.mentee.email})</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        r.status === 'accepted' ? 'bg-[#E8F0EC] text-[#2E7D5A]' : r.status === 'declined' ? 'bg-[#FDEEEB] text-[#C04A36]' : 'bg-[#FAF0E6] text-[#C27D38]'
                      }`}>
                        {r.status}
                      </span>
                    </div>
                    {r.goals && <p className="text-xs text-[#52796F] font-semibold mt-1">Goal: {r.goals}</p>}
                    {r.note && <p className="text-xs text-[#52616C] mt-0.5">{r.note}</p>}
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
                        className="px-4 py-1.5 border border-[#E1E7E5] hover:bg-[#FDEEEB] text-[#C04A36] text-xs font-bold rounded-full transition-colors cursor-pointer"
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
              <div className="bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] p-6 text-center shadow-xs">
                <div
                  className="w-24 h-24 rounded-full bg-[#0B192C] flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-sm"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                >
                  {initials}
                </div>

                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <h1 className="text-xl font-bold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                    {mentor.name}
                  </h1>
                  <svg className="w-5 h-5 text-[#52796F]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>

                <p className="text-sm text-[#52796F] font-bold">{mentor.specialty}</p>
                {mentor.hospital && <p className="text-xs text-[#74817D] mt-0.5">{mentor.hospital}</p>}

                {/* Rating */}
                {mentor.rating ? (
                  <div className="flex items-center justify-center gap-1 mt-3">
                    <span className="text-sm font-bold text-[#0B192C]">★ {mentor.rating}</span>
                    <span className="text-xs text-[#74817D]">({mentor.reviewsCount ?? mentor.reviews?.length ?? 0} reviews)</span>
                  </div>
                ) : (
                  <p className="text-xs text-[#74817D] mt-3">No ratings yet</p>
                )}

                {/* Action Buttons */}
                <div className="mt-5 space-y-2">
                  <button
                    onClick={() => {
                      if (requestStatus !== 'pending' && requestStatus !== 'accepted') setRequestModalOpen(true);
                    }}
                    disabled={requestStatus === 'pending' || requestStatus === 'accepted'}
                    className={`w-full py-3 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      requestStatus === 'pending' || requestStatus === 'accepted'
                        ? 'bg-[#F0F4F2] text-[#52616C] border border-[#E1E7E5] cursor-default'
                        : 'bg-[#0B192C] hover:bg-[#192B40] text-white shadow-sm'
                    }`}
                  >
                    {requestStatus === 'pending' ? 'Request pending' : requestStatus === 'accepted' ? 'Mentorship connected' : requestStatus === 'declined' ? 'Request again' : 'Request Mentorship'}
                  </button>
                  <button
                    onClick={() => navigate('messages')}
                    className="w-full py-3 rounded-full text-xs sm:text-sm font-bold border border-[#E1E7E5] text-[#0B192C] hover:bg-[#F0F4F2] transition-all cursor-pointer"
                  >
                    Send Direct Message
                  </button>
                </div>
              </div>

              {/* Experience & Activity stats */}
              <div className="bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] p-5 shadow-xs">
                <h3 className="text-sm font-bold text-[#0B192C] mb-3 border-b border-[#E1E7E5] pb-2.5" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  Activity & Metrics
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: 'Experience', value: mentor.experienceYears ? `${mentor.experienceYears} yrs` : 'Not provided' },
                    { label: 'Rating', value: mentor.rating ? `★ ${mentor.rating}` : 'Not rated' },
                    { label: 'Publications', value: `${mentor.publications?.length || 0}` },
                    { label: 'Licence Verified', value: mentor.licenseNumber ? 'Verified' : 'Not provided' },
                  ].map(s => (
                    <div key={s.label} className="bg-[#F0F4F2]/70 rounded-lg p-3 text-center">
                      <div className="text-base font-bold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>{s.value}</div>
                      <div className="text-[11px] text-[#74817D] mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Areas of focus */}
              <div className="bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] p-5 shadow-xs">
                <h3 className="text-sm font-bold text-[#0B192C] mb-3 border-b border-[#E1E7E5] pb-2.5" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  Areas of Focus
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[mentor.specialty, mentor.subspecialty, ...(mentor.areasOfInterest || [])].filter(Boolean).map(t => (
                    <span key={t} className="text-xs bg-[#E8F0EC] text-[#35564E] px-3 py-1 rounded-full font-semibold">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Bio, Publications, Mentee Reviews */}
            <div className="lg:col-span-2 space-y-6">
              {/* About Card */}
              <div className="bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] p-6 sm:p-8 shadow-xs">
                <h2 className="text-lg font-bold text-[#0B192C] mb-3" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  About {mentor.name}
                </h2>
                <p className="text-sm text-[#42524E] leading-relaxed">
                  {mentor.bio || 'No biography provided.'}
                </p>

                <div className="mt-5 pt-4 border-t border-[#E1E7E5] flex flex-wrap gap-4 text-xs font-semibold text-[#52616C]">
                  {mentor.hospital && <span>Hospital: {mentor.hospital}</span>}
                  {mentor.degrees && <span>Qualifications: {mentor.degrees}</span>}
                  {mentor.licenseNumber && <span>Licence #{mentor.licenseNumber}</span>}
                </div>
              </div>

              {/* Publications */}
              <div className="bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] p-6 sm:p-8 shadow-xs">
                <h2 className="text-lg font-bold text-[#0B192C] mb-4" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  Selected Publications & Case Reports
                </h2>
                <div className="space-y-3">
                  {(mentor.publications || []).length > 0 ? mentor.publications?.map((p, i) => (
                    <div key={i} className="flex items-start gap-3 p-3.5 rounded-lg bg-[#F0F4F2]/60 border border-[#E1E7E5]/60 hover:bg-[#F0F4F2] transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-[#E8F0EC] flex items-center justify-center text-[9px] font-bold text-[#35564E] shrink-0 mt-0.5">
                        PUB
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-[#0B192C] leading-snug">{p.title}</div>
                        <div className="text-xs text-[#74817D] mt-1">{p.journal} · {p.year}</div>
                      </div>
                    </div>
                  )) : <p className="text-sm text-[#74817D]">No publications provided.</p>}
                </div>
              </div>

              {/* Mentee Testimonials */}
              <div className="bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] p-6 sm:p-8 shadow-xs">
                <h2 className="text-lg font-bold text-[#0B192C] mb-4" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  Mentee Endorsements
                </h2>
                <div className="space-y-4">
                  {(mentor.reviews || []).length > 0 ? mentor.reviews?.map((rev, i) => (
                    <div key={i} className="p-4 rounded-lg bg-[#F0F4F2]/50 border border-[#E1E7E5]">
                      <p className="text-xs text-[#42524E] leading-relaxed mb-2">"{rev.text}"</p>
                      <span className="text-[11px] font-bold text-[#0B192C]">{rev.author}</span>
                    </div>
                  )) : <p className="text-sm text-[#74817D]">No endorsements provided.</p>}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Mentorship Request Modal */}
        {requestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/40 backdrop-blur-xs p-4">
            <div className="bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] shadow-2xl max-w-lg w-full p-6 sm:p-8">
              <div className="flex items-center justify-between pb-3 border-b border-[#E1E7E5] mb-4">
                <h2 className="text-xl font-bold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  Request Mentorship with {mentor?.name}
                </h2>
                <button onClick={() => setRequestModalOpen(false)} className="text-[#74817D] hover:text-[#0B192C]">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSendRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0B192C] mb-1">Primary Learning Goal</label>
                  <select
                    value={requestGoal}
                    onChange={e => setRequestGoal(e.target.value)}
                    className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-xs text-[#0B192C]"
                  >
                    <option>Clinical Reasoning & Case Reviews</option>
                    <option>Specialty Application & Career Guidance</option>
                    <option>Research Methodology & Publication</option>
                    <option>General Clinical Mentorship</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0B192C] mb-1">Introductory Note</label>
                  <textarea
                    rows={3}
                    placeholder="Briefly introduce your stage of training and what you hope to learn…"
                    value={requestNote}
                    onChange={e => setRequestNote(e.target.value)}
                    className="w-full rounded-lg border border-[#E1E7E5] bg-white px-4 py-2.5 text-xs text-[#0B192C]"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setRequestModalOpen(false)}
                    className="px-4 py-2 rounded-full text-xs font-bold text-[#52616C] hover:bg-[#F0F4F2]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRequest}
                    className="px-5 py-2 bg-[#0B192C] hover:bg-[#192B40] text-white text-xs font-bold rounded-full transition-colors cursor-pointer"
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
