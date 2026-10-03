import { useState } from 'react';
import type { Page } from '../App';

interface HomeProps {
  navigate: (page: Page) => void;
  openAuth: (mode: 'login' | 'register') => void;
}

const benefits = [
  { number: '01', title: 'Ask the question', description: 'Bring the question that has stayed with you after rounds, clinic, or a long night on call.' },
  { number: '02', title: 'Meet the experience', description: 'Find clinicians who have navigated the same decisions, detours, and first difficult steps.' },
  { number: '03', title: 'Keep the conversation going', description: 'Return to a community where learning is generous, practical, and grounded in real care.' },
];

const specialties = ['Cardiology', 'Neurology', 'Emergency medicine', 'Paediatrics', 'Oncology', 'Neurosurgery', 'Internal medicine'];

export default function HomePage({ navigate, openAuth }: HomeProps) {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="min-h-screen overflow-hidden bg-[#F5F1EA] text-[#183D3A]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#D8D2C8] bg-[#F5F1EA]/95 backdrop-blur-xs px-5 py-4 sm:px-8 lg:px-12 transition-all">
        <nav className="mx-auto flex max-w-7xl items-center justify-between" aria-label="Main navigation">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 transition-transform hover:scale-[1.02]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D86F52] text-lg font-extrabold text-white shadow-xs">
              M
            </span>
            <span className="text-xl font-bold tracking-tight text-[#183D3A]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
              MedConnect
            </span>
          </button>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-8 text-sm font-semibold text-[#596965] md:flex">
            <a href="#why-medconnect" className="transition-colors hover:text-[#D86F52]">Why MedConnect</a>
            <a href="#how-it-works" className="transition-colors hover:text-[#D86F52]">How it works</a>
            <a href="#community" className="transition-colors hover:text-[#D86F52]">Community</a>
            <button onClick={() => navigate('dashboard')} className="transition-colors hover:text-[#D86F52] cursor-pointer">Clinical Feed</button>
            <button onClick={() => navigate('forums')} className="transition-colors hover:text-[#D86F52] cursor-pointer">Forums</button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => openAuth('login')}
              className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-[#38605A] hover:text-[#183D3A] transition-colors sm:px-4 sm:text-sm cursor-pointer"
            >
              Sign in
            </button>
            <button
              onClick={() => openAuth('register')}
              className="whitespace-nowrap rounded-full bg-[#183D3A] px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-[#D86F52] hover:shadow-md sm:px-5 sm:text-sm cursor-pointer"
            >
              Create account
            </button>
            {/* Mobile Nav Toggle */}
            <button
              onClick={() => setMobileNav(!mobileNav)}
              className="md:hidden p-2 rounded-lg text-[#596965] hover:bg-[#EAE5DC]"
              aria-label="Toggle Navigation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileNav ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </nav>

        {/* Mobile dropdown */}
        {mobileNav && (
          <div className="md:hidden pt-4 pb-2 border-t border-[#D8D2C8] mt-3 space-y-2">
            <a href="#why-medconnect" onClick={() => setMobileNav(false)} className="block px-3 py-2 text-sm font-medium text-[#596965] hover:bg-[#EAE5DC] rounded-lg">Why MedConnect</a>
            <a href="#how-it-works" onClick={() => setMobileNav(false)} className="block px-3 py-2 text-sm font-medium text-[#596965] hover:bg-[#EAE5DC] rounded-lg">How it works</a>
            <a href="#community" onClick={() => setMobileNav(false)} className="block px-3 py-2 text-sm font-medium text-[#596965] hover:bg-[#EAE5DC] rounded-lg">Community</a>
            <button onClick={() => { setMobileNav(false); navigate('dashboard'); }} className="block w-full text-left px-3 py-2 text-sm font-semibold text-[#D86F52] hover:bg-[#EAE5DC] rounded-lg cursor-pointer">
              Explore Live Clinical Feed →
            </button>
            <button onClick={() => { setMobileNav(false); navigate('forums'); }} className="block w-full text-left px-3 py-2 text-sm font-semibold text-[#183D3A] hover:bg-[#EAE5DC] rounded-lg cursor-pointer">
              Discussion Forums →
            </button>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section className="px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-20 lg:px-12">
          <div className="mx-auto grid max-w-7xl items-stretch gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D86F52]" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D86F52]">
                  For the people behind the scrubs
                </p>
              </div>

              <h1
                className="max-w-2xl text-5xl font-semibold leading-[1.02] tracking-[-0.03em] text-[#183D3A] sm:text-7xl"
                style={{ fontFamily: 'Fraunces, Georgia, serif' }}
              >
                Medicine is learned together.
              </h1>

              <p className="mt-7 max-w-lg text-base leading-7 text-[#596965] sm:text-lg">
                A thoughtful place for students, residents, and clinicians to share what the textbooks leave out.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => openAuth('register')}
                  className="rounded-full bg-[#D86F52] px-7 py-3.5 text-sm font-bold text-white transition-all hover:bg-[#B9543D] hover:shadow-lg hover:shadow-[#D86F52]/20"
                >
                  Join the community
                </button>
                <a
                  href="#how-it-works"
                  className="px-4 py-3.5 text-sm font-bold text-[#38605A] underline decoration-[#D86F52] decoration-2 underline-offset-4 hover:text-[#183D3A] transition-colors"
                >
                  See how it works
                </a>
                <button
                  onClick={() => navigate('dashboard')}
                  className="px-4 py-3.5 text-sm font-bold text-[#183D3A] hover:text-[#D86F52] transition-colors flex items-center gap-1.5"
                >
                  Browse platform feed <span>→</span>
                </button>
              </div>

              <div className="mt-14 flex items-center gap-8 sm:gap-12 border-t border-[#D8D2C8] pt-6 text-xs font-semibold uppercase tracking-[0.12em] text-[#71807C]">
                <span>
                  <strong className="block text-2xl font-bold tracking-normal text-[#183D3A]">2.4K</strong> Mentors
                </span>
                <span>
                  <strong className="block text-2xl font-bold tracking-normal text-[#183D3A]">18+</strong> Specialties
                </span>
                <span>
                  <strong className="block text-2xl font-bold tracking-normal text-[#183D3A]">8K</strong> Case Studies
                </span>
              </div>
            </div>

            {/* Hero Image Showcase */}
            <div className="relative min-h-[460px] overflow-hidden rounded-2xl bg-[#D8E2DC] shadow-md lg:min-h-[580px]">
              <img
                src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=85"
                alt="A clinician speaking with a colleague"
                className="h-full min-h-[460px] w-full object-cover object-center grayscale-[12%] transition-transform duration-700 hover:scale-[1.02]"
              />
              <div className="absolute bottom-5 left-5 right-5 sm:right-auto max-w-sm rounded-xl border border-[#D8D2C8]/80 bg-[#F5F1EA]/95 backdrop-blur-sm p-5 sm:bottom-8 sm:left-8 shadow-xl">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D86F52]">
                  A place to begin
                </p>
                <p className="mt-2 text-lg leading-snug text-[#183D3A]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                  “Every doctor carries something worth sharing. I built this because one of them changed how I see everything.”
                </p>
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[#71807C]">
                  Dr. Pratha · Oncology
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Why MedConnect */}
        <section id="why-medconnect" className="border-y border-[#D8D2C8] bg-[#FBF9F5] px-5 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D86F52]">Make room for better questions</p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight text-[#183D3A]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                The part of medicine that happens between the lines.
              </h2>
            </div>
            <div className="mt-12 grid gap-8 border-t border-[#D8D2C8] pt-8 md:grid-cols-3">
              {benefits.map((benefit) => (
                <article key={benefit.number} className="border-l-2 border-[#D86F52] pl-6 transition-all hover:translate-x-1">
                  <span className="text-sm font-bold text-[#D86F52]">{benefit.number}</span>
                  <h3 className="mt-4 text-xl font-bold text-[#183D3A]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>{benefit.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#596965]">{benefit.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="px-5 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D86F52]">Simple by design</p>
              <h2 className="mt-3 text-4xl font-semibold text-[#183D3A]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                Start with what you need today.
              </h2>
              <p className="mt-4 text-sm leading-6 text-[#596965]">
                Whether you are looking for guidance or ready to share your own experience, MedConnect gives you a focused place to begin.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['01', 'Create your profile', 'Tell us about your specialty and goals.'],
                ['02', 'Find your people', 'Explore mentors and conversations that fit.'],
                ['03', 'Keep growing', 'Learn, connect, and give back.'],
              ].map(([number, title, text]) => (
                <div key={number} className="rounded-2xl bg-[#183D3A] p-6 text-white shadow-sm transition-transform hover:-translate-y-1">
                  <span className="text-xs font-bold text-[#F0B28A]">{number}</span>
                  <h3 className="mt-8 text-base font-bold" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-[#C6D5D0]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Community Specialties */}
        <section id="community" className="border-y border-[#D8D2C8] bg-[#E4EAE3] px-5 py-16 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D86F52]">Find your field</p>
                <h3 className="text-2xl font-bold text-[#183D3A] mt-1" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                  Peer groups across 18+ disciplines
                </h3>
              </div>
              <button
                onClick={() => navigate('dashboard')}
                className="text-xs font-bold text-[#183D3A] hover:text-[#D86F52] underline decoration-[#D86F52] underline-offset-4 self-start sm:self-auto"
              >
                View all disciplines in Feed →
              </button>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {specialties.map((specialty) => (
                <button
                  key={specialty}
                  onClick={() => navigate('dashboard')}
                  className="rounded-full bg-[#FFFCF8] border border-[#D8D2C8] px-5 py-2.5 text-base font-semibold text-[#183D3A] hover:border-[#D86F52] hover:text-[#D86F52] hover:bg-[#FBE5DC]/40 transition-all cursor-pointer shadow-2xs"
                  style={{ fontFamily: 'Fraunces, Georgia, serif' }}
                >
                  {specialty}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Call to Action Banner */}
        <section className="px-5 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto flex max-w-4xl flex-col items-center rounded-3xl bg-[#183D3A] px-6 py-16 text-center text-white sm:px-14 shadow-xl relative overflow-hidden">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border-[28px] border-[#D86F52]/20" />
            <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full border-[28px] border-[#F0B28A]/15" />
            
            <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-[#F0B28A]">
              Your next conversation matters
            </p>
            <h2 className="relative mt-4 text-4xl font-semibold leading-tight sm:text-5xl" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
              Build a career with people who believe in your growth.
            </h2>
            <p className="relative mt-5 max-w-xl text-sm leading-6 text-[#C6D5D0]">
              Join a professional community shaped by curiosity, generosity, and better clinical care.
            </p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => openAuth('register')}
                className="rounded-full bg-[#D86F52] px-8 py-3.5 text-sm font-bold text-white transition-all hover:bg-[#B9543D] hover:shadow-lg"
              >
                Create your free account
              </button>
              <button
                onClick={() => navigate('dashboard')}
                className="rounded-full border border-white/30 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Explore clinical discussions
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#D8D2C8] bg-[#F5F1EA] px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-[#71807C] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#D86F52] text-xs font-bold text-white">M</span>
            <span className="font-bold text-[#183D3A] text-sm" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>MedConnect</span>
          </div>
          <span>A private, thoughtful space for medical learning and clinical mentorship.</span>
          <span>© 2026 MedConnect. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
