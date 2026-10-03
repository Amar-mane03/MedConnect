import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import type { Page } from '../App';
import API, { SOCKET_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { io, Socket } from 'socket.io-client';

interface EventsProps {
  navigate: (p: Page, meta?: any) => void;
}

interface EventItem {
  id?: string;
  _id?: string;
  title: string;
  description: string;
  speakerName: string;
  speakerTitle: string;
  speakerSpecialty: string;
  speakerHospital: string;
  date: string;
  formattedDate?: string;
  durationMinutes: number;
  eventType: 'webinar' | 'workshop' | 'grand_rounds' | 'journal_club' | 'panel';
  specialty: string;
  meetingLink: string;
  attendeesCount: number;
  attendeeIds?: string[];
  maxCapacity: number;
  isLive?: boolean;
  isPast?: boolean;
}

const SPECIALTIES = [
  'All',
  'Cardiology',
  'Internal Medicine',
  'Neurology',
  'Emergency Medicine',
  'Oncology',
  'Paediatrics',
  'Surgery',
];

const EVENT_TYPES = [
  { label: 'All Sessions', value: 'All' },
  { label: '🎙️ Grand Rounds', value: 'grand_rounds' },
  { label: '💻 Interactive Webinars', value: 'webinar' },
  { label: '🛠️ Clinical Workshops', value: 'workshop' },
  { label: '📖 Journal Clubs', value: 'journal_club' },
  { label: '👥 Expert Panels', value: 'panel' },
];

export default function EventsPage({ navigate }: EventsProps) {
  const { user, role } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'upcoming' | 'past'>('upcoming');
  const [activeSpecialty, setActiveSpecialty] = useState('All');
  const [activeType, setActiveType] = useState('All');
  const [searchVal, setSearchVal] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Host modal state
  const [hostModalOpen, setHostModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSpeakerName, setNewSpeakerName] = useState(user?.name || '');
  const [newSpeakerSpecialty, setNewSpeakerSpecialty] = useState(user?.specialty || 'Cardiology');
  const [newDate, setNewDate] = useState('');
  const [newDuration, setNewDuration] = useState(60);
  const [newType, setNewType] = useState<'webinar' | 'workshop' | 'grand_rounds' | 'journal_club' | 'panel'>('webinar');
  const [newSpecialty, setNewSpecialty] = useState('Cardiology');
  const [newMeetingLink, setNewMeetingLink] = useState('https://meet.google.com/medconnect-live');
  const [submitting, setSubmitting] = useState(false);
  const [hostError, setHostError] = useState<string | null>(null);

  const currentUserId = (user?._id || user?.id || '').toString();

  // Fetch events
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params: any = { filter: activeFilter };
      if (activeSpecialty !== 'All') params.specialty = activeSpecialty;
      if (activeType !== 'All') params.type = activeType;
      if (searchVal.trim()) params.search = searchVal.trim();

      const res = await API.get('/events', { params });
      if (res.data?.events) {
        setEvents(res.data.events);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [activeFilter, activeSpecialty, activeType]);

  // Socket for live RSVP and new events
  useEffect(() => {
    let socket: Socket | null = null;
    try {
      socket = io(SOCKET_URL);
      socket.on('event_rsvp_updated', ({ eventId, attendeesCount }: { eventId: string; attendeesCount: number }) => {
        setEvents(prev =>
          prev.map(e => {
            const id = e.id || e._id;
            if (id === eventId) return { ...e, attendeesCount };
            return e;
          })
        );
      });

      socket.on('new_event_scheduled', (newEvent: EventItem) => {
        setEvents(prev => [newEvent, ...prev]);
      });
    } catch (e) {
      console.error('Socket error in Events:', e);
    }
    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  // Toggle RSVP
  const handleToggleRsvp = async (event: EventItem) => {
    const eventId = event.id || event._id;
    if (!eventId) return;

    const isRsvp = (event.attendeeIds || []).includes(currentUserId);

    try {
      const res = await API.post(`/events/${eventId}/rsvp`);
      if (res.data) {
        setEvents(prev =>
          prev.map(e => {
            const id = e.id || e._id;
            if (id === eventId) {
              const currentList = e.attendeeIds || [];
              const updatedList = isRsvp
                ? currentList.filter(id => id !== currentUserId)
                : [...currentList, currentUserId];
              return {
                ...e,
                attendeesCount: res.data.attendeesCount,
                attendeeIds: updatedList,
              };
            }
            return e;
          })
        );

        setToastMessage(res.data.message);
        setTimeout(() => setToastMessage(null), 3500);
      }
    } catch (err: any) {
      console.error('RSVP error:', err);
      setToastMessage(err.response?.data?.message || 'Unable to update RSVP.');
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Submit Host Event
  const handleHostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setHostError('Please provide an event title.');
      return;
    }
    if (!newDate) {
      setHostError('Please set a valid date and time.');
      return;
    }

    setSubmitting(true);
    setHostError(null);

    try {
      const res = await API.post('/events', {
        title: newTitle.trim(),
        description: newDescription.trim(),
        speakerName: newSpeakerName.trim() || user?.name,
        speakerTitle: role === 'mentor' ? 'Consultant' : 'Clinical Fellow',
        speakerSpecialty: newSpeakerSpecialty,
        speakerHospital: user?.hospital || 'Teaching Hospital',
        date: newDate,
        durationMinutes: newDuration,
        eventType: newType,
        specialty: newSpecialty,
        meetingLink: newMeetingLink.trim(),
      });

      if (res.data?.event) {
        setEvents(prev => [res.data.event, ...prev]);
        setHostModalOpen(false);
        setNewTitle('');
        setNewDescription('');
        setToastMessage('Event scheduled and added to the clinical community calendar!');
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err: any) {
      console.error('Host event error:', err);
      setHostError(err.response?.data?.message || 'Failed to schedule event.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout navigate={navigate} currentPage="events">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Hero Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-[#FFFCF8] p-6 sm:p-8 rounded-3xl border border-[#D8D2C8] shadow-xs">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF0E6] text-[#C27D38] text-xs font-bold mb-2">
              <span>📅</span> Live Grand Rounds & Clinical Webinars
            </div>
            <h1
              className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#183D3A] tracking-tight"
              style={{ fontFamily: 'Fraunces, Georgia, serif' }}
            >
              Events & Grand Rounds
            </h1>
            <p className="text-sm sm:text-base text-[#596965] mt-1.5 max-w-2xl">
              Attend live clinical case conferences, PACES preparation masterclasses, and keynote lectures hosted by consultant mentors from leading hospitals.
            </p>
          </div>
          {(role === 'mentor' || role === 'admin') && (
            <button
              onClick={() => setHostModalOpen(true)}
              className="self-start md:self-center px-5 py-3 rounded-full bg-[#D86F52] text-white text-sm font-bold shadow-sm hover:bg-[#B9543D] transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Host a Grand Round / Webinar
            </button>
          )}
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-[#E4EAE3] border border-[#2E7D5A]/30 text-xs font-bold text-[#183D3A] flex items-center justify-between shadow-xs">
            <span>✓ {toastMessage}</span>
            <button onClick={() => setToastMessage(null)} className="text-[#183D3A] hover:opacity-70">✕</button>
          </div>
        )}

        {/* Tab & Filter Bar */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between border-b border-[#D8D2C8] pb-3">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setActiveFilter('upcoming')}
                className={`text-sm font-bold pb-1 cursor-pointer transition-colors relative ${
                  activeFilter === 'upcoming' ? 'text-[#D86F52]' : 'text-[#71807C] hover:text-[#183D3A]'
                }`}
              >
                Upcoming Sessions
                {activeFilter === 'upcoming' && (
                  <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-[#D86F52]" />
                )}
              </button>
              <button
                onClick={() => setActiveFilter('past')}
                className={`text-sm font-bold pb-1 cursor-pointer transition-colors relative ${
                  activeFilter === 'past' ? 'text-[#D86F52]' : 'text-[#71807C] hover:text-[#183D3A]'
                }`}
              >
                Past Archives
                {activeFilter === 'past' && (
                  <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-[#D86F52]" />
                )}
              </button>
            </div>

            <form onSubmit={e => { e.preventDefault(); fetchEvents(); }} className="relative sm:w-64">
              <input
                type="text"
                placeholder="Search lectures, speakers…"
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FFFCF8] rounded-full border border-[#D8D2C8] text-[#183D3A] focus:outline-none focus:ring-2 focus:ring-[#D86F52]/20"
              />
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71807C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </form>
          </div>

          {/* Specialties Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {SPECIALTIES.map(sp => (
              <button
                key={sp}
                onClick={() => setActiveSpecialty(sp)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                  activeSpecialty === sp
                    ? 'bg-[#183D3A] text-white'
                    : 'bg-[#FFFCF8] text-[#596965] border border-[#D8D2C8] hover:bg-[#F1EEE8]'
                }`}
              >
                {sp}
              </button>
            ))}
          </div>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="rounded-3xl bg-[#FFFCF8] border border-[#D8D2C8] p-12 text-center text-[#71807C]">
            <div className="animate-spin w-8 h-8 border-3 border-[#D86F52] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm font-semibold">Loading clinical schedule…</p>
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-3xl bg-[#FFFCF8] border border-[#D8D2C8] p-12 text-center">
            <span className="text-4xl mb-2 block">📅</span>
            <h3 className="text-lg font-bold text-[#183D3A]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
              No Events Scheduled
            </h3>
            <p className="text-sm text-[#71807C] mt-1 max-w-sm mx-auto">
              {searchVal
                ? `No sessions matching "${searchVal}".`
                : 'Check back soon or explore our previous session recordings!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map(event => {
              const eventId = event.id || event._id || '';
              const isRsvp = (event.attendeeIds || []).includes(currentUserId);

              return (
                <div
                  key={eventId}
                  className="rounded-3xl bg-[#FFFCF8] border border-[#D8D2C8] p-6 hover:shadow-md hover:border-[#D86F52] transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Specialty + Live indicator */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        {event.isLive ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#FDEEEB] text-[#C04A36] animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-[#C04A36]" />
                            LIVE NOW
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#FAF0E6] text-[#C27D38]">
                            {event.eventType.replace('_', ' ').toUpperCase()}
                          </span>
                        )}
                        <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#E8F1F5] text-[#34657F]">
                          {event.specialty}
                        </span>
                      </div>
                    </div>

                    {/* Date & Time Highlight */}
                    <div className="text-xs font-bold text-[#D86F52] mb-1.5">
                      🗓️ {event.formattedDate || new Date(event.date).toLocaleDateString()} · {event.durationMinutes} min
                    </div>

                    {/* Title */}
                    <h3
                      className="font-bold text-[#183D3A] text-lg mb-2"
                      style={{ fontFamily: 'Fraunces, Georgia, serif' }}
                    >
                      {event.title}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-[#596965] leading-relaxed line-clamp-3 mb-5">
                      {event.description}
                    </p>

                    {/* Speaker Info */}
                    <div className="p-3 rounded-2xl bg-[#F5F1EA]/60 border border-[#EAE5DC] flex items-center gap-3 mb-5">
                      <div className="w-9 h-9 rounded-full bg-[#183D3A] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {event.speakerName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#183D3A] truncate">{event.speakerName}</div>
                        <div className="text-[10px] text-[#71807C] truncate">{event.speakerTitle} · {event.speakerHospital}</div>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions & Live Counter */}
                  <div className="pt-4 border-t border-[#EAE5DC] flex items-center justify-between">
                    <div className="text-xs font-semibold text-[#71807C]">
                      <span className="text-[#183D3A] font-bold">👥 {event.attendeesCount}</span> clinicians registered
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleRsvp(event)}
                        className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                          isRsvp
                            ? 'bg-[#E4EAE3] text-[#2E7D5A] border border-[#2E7D5A]/30'
                            : 'bg-[#183D3A] text-white hover:bg-[#D86F52]'
                        }`}
                      >
                        {isRsvp ? 'RSVP Confirmed ✓' : 'RSVP'}
                      </button>

                      <a
                        href={event.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold px-3 py-1.5 rounded-full border border-[#D86F52] text-[#D86F52] hover:bg-[#FBE5DC] transition-colors"
                      >
                        Join Room →
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Host Event Modal */}
      {hostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#183D3A]/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#FFFCF8] rounded-3xl border border-[#D8D2C8] shadow-2xl max-w-xl w-full p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#D8D2C8] mb-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#D86F52]">
                  Mentor Clinical Leadership
                </span>
                <h2 className="text-2xl font-bold text-[#183D3A]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                  Schedule Grand Rounds / Webinar
                </h2>
              </div>
              <button
                onClick={() => setHostModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#71807C] hover:bg-[#F1EEE8] hover:text-[#183D3A] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {hostError && (
              <div className="mb-4 p-3 rounded-xl bg-[#FDEEEB] border border-[#C04A36]/30 text-xs font-semibold text-[#C04A36]">
                {hostError}
              </div>
            )}

            <form onSubmit={handleHostSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#183D3A] mb-1.5">Session Title</label>
                <input
                  type="text"
                  placeholder="e.g. Acute SCAD Case Review: Multimodality Imaging Pearls"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full p-3 text-xs sm:text-sm bg-[#F1EEE8] rounded-xl border border-[#D8D2C8] text-[#183D3A] focus:outline-none focus:ring-2 focus:ring-[#D86F52]/20 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#183D3A] mb-1.5">Session Format</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as any)}
                    className="w-full p-3 text-xs bg-[#F1EEE8] rounded-xl border border-[#D8D2C8] text-[#183D3A] focus:outline-none focus:ring-2 focus:ring-[#D86F52]/20"
                  >
                    <option value="grand_rounds">Grand Rounds</option>
                    <option value="webinar">Clinical Webinar</option>
                    <option value="workshop">Interactive Workshop</option>
                    <option value="journal_club">Journal Club</option>
                    <option value="panel">Panel Discussion</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#183D3A] mb-1.5">Specialty</label>
                  <select
                    value={newSpecialty}
                    onChange={e => setNewSpecialty(e.target.value)}
                    className="w-full p-3 text-xs bg-[#F1EEE8] rounded-xl border border-[#D8D2C8] text-[#183D3A] focus:outline-none focus:ring-2 focus:ring-[#D86F52]/20"
                  >
                    {SPECIALTIES.filter(s => s !== 'All').map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#183D3A] mb-1.5">Date & Start Time</label>
                  <input
                    type="datetime-local"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full p-3 text-xs bg-[#F1EEE8] rounded-xl border border-[#D8D2C8] text-[#183D3A] focus:outline-none focus:ring-2 focus:ring-[#D86F52]/20 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#183D3A] mb-1.5">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={newDuration}
                    onChange={e => setNewDuration(Number(e.target.value))}
                    min={15}
                    max={240}
                    className="w-full p-3 text-xs bg-[#F1EEE8] rounded-xl border border-[#D8D2C8] text-[#183D3A] focus:outline-none focus:ring-2 focus:ring-[#D86F52]/20 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#183D3A] mb-1.5">Meeting / Stream Link</label>
                <input
                  type="url"
                  placeholder="https://meet.google.com/medconnect-live"
                  value={newMeetingLink}
                  onChange={e => setNewMeetingLink(e.target.value)}
                  className="w-full p-3 text-xs sm:text-sm bg-[#F1EEE8] rounded-xl border border-[#D8D2C8] text-[#183D3A] focus:outline-none focus:ring-2 focus:ring-[#D86F52]/20 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#183D3A] mb-1.5">Clinical Syllabus & Objectives</label>
                <textarea
                  rows={4}
                  placeholder="Summarize the core clinical takeaways, target learning points, and audience level…"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className="w-full p-3 text-xs sm:text-sm bg-[#F1EEE8] rounded-xl border border-[#D8D2C8] text-[#183D3A] placeholder-[#71807C] focus:outline-none focus:ring-2 focus:ring-[#D86F52]/20 focus:bg-white"
                />
              </div>

              <div className="pt-4 border-t border-[#D8D2C8] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setHostModalOpen(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-bold text-[#596965] hover:bg-[#F1EEE8] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-full bg-[#D86F52] text-white text-xs font-bold hover:bg-[#B9543D] shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Scheduling…' : 'Publish to Calendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
