import { useEffect, useState } from 'react';
import type { Page } from '../App';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import BookingModal from '../components/home/BookingModal';
import Doctors, { type MentorPreview } from '../components/home/Doctors';
import Footer from '../components/home/Footer';
import Hero from '../components/home/Hero';
import Navbar from '../components/home/Navbar';
import Services from '../components/home/Services';
import TrustBanner from '../components/home/TrustBanner';

interface HomeProps {
  navigate: (page: Page, meta?: { caseId?: string; mentorId?: string }) => void;
  openAuth: (mode: 'login' | 'register') => void;
}

export default function HomePage({ navigate, openAuth }: HomeProps) {
  const { isAuthenticated } = useAuth();
  const [connectOpen, setConnectOpen] = useState(false);
  const [mentors, setMentors] = useState<MentorPreview[]>([]);
  const [loadingMentors, setLoadingMentors] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setMentors([]);
      return;
    }

    let active = true;
    setLoadingMentors(true);
    API.get('/mentors')
      .then((response) => {
        if (!active) return;
        const verifiedMentors = (response.data?.mentors || [])
          .filter((mentor: MentorPreview) => mentor.verified)
          .map((mentor: MentorPreview) => ({ ...mentor, id: String(mentor.id) }));
        setMentors(verifiedMentors);
      })
      .catch((error) => console.error('Failed to load mentor profiles:', error))
      .finally(() => { if (active) setLoadingMentors(false); });

    return () => { active = false; };
  }, [isAuthenticated]);

  const openConnection = () => setConnectOpen(true);

  return (
    <div className="min-h-screen bg-white text-[#0B192C]">
      <Navbar onConnect={openConnection} openAuth={openAuth} />
      <main>
        <Hero onConnect={openConnection} />
        <TrustBanner />
        <Services onConnect={openConnection} />
        <Doctors
          isAuthenticated={isAuthenticated}
          mentors={mentors}
          loading={loadingMentors}
          onJoin={openConnection}
          onSelectMentor={(mentorId) => navigate('mentor-profile', { mentorId })}
        />
        <section id="contact" className="bg-[#0B192C] px-5 py-14 text-white sm:px-8 sm:py-16 lg:px-12">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase text-[#A9C1B5]">Make your next connection count</p>
              <h2 className="mt-3 text-3xl leading-tight sm:text-4xl" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Good questions deserve thoughtful company.</h2>
              <p className="mt-3 text-sm leading-6 text-[#D6E0E5]">Join clinicians sharing experience, learning from cases, and supporting one another across specialties.</p>
            </div>
            <button onClick={openConnection} className="self-start rounded-md bg-white px-5 py-3 text-sm font-semibold text-[#0B192C] transition-colors hover:bg-[#EDF2EF] sm:self-auto">
              Find your community
            </button>
          </div>
        </section>
      </main>
      <Footer navigate={navigate} openAuth={openAuth} />
      <BookingModal
        isOpen={connectOpen}
        isAuthenticated={isAuthenticated}
        onClose={() => setConnectOpen(false)}
        navigate={navigate}
        openAuth={openAuth}
      />
    </div>
  );
}