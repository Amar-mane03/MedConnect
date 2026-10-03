interface HeroProps {
  onConnect: () => void;
}

export default function Hero({ onConnect }: HeroProps) {
  return (
    <section id="top" className="bg-white px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-16 lg:px-12 lg:py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div className="flex flex-col justify-center">
          <p className="mb-5 text-xs font-bold uppercase text-[#52796F]">A community for clinicians and trainees</p>
          <h1 className="max-w-xl text-4xl leading-[1.08] text-[#0B192C] sm:text-5xl xl:text-6xl" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
            Better medicine grows through shared experience.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#52616C] sm:text-lg">
            Find trusted mentors, discuss de-identified cases, and learn alongside clinicians who understand your work.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button onClick={onConnect} className="rounded-md bg-[#0B192C] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#192B40]">
              Find a mentor
            </button>
            <a href="#services" className="rounded-md border border-[#52796F] px-6 py-3.5 text-center text-sm font-semibold text-[#35564E] transition-colors hover:bg-[#F3F7F5]">
              Explore the community
            </a>
          </div>

          <blockquote className="mt-10 max-w-lg border-l-2 border-[#A9BDB5] pl-5">
            <p className="text-lg leading-7 text-[#263847]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              “Every doctor carries something worth sharing. I built this because one of them changed how I see everything.”
            </p>
            <footer className="mt-3 text-sm font-semibold text-[#65736F]">Dr. Pratha · Oncology</footer>
          </blockquote>
        </div>

        <div className="relative min-w-0 pb-5 sm:pb-6">
          <div className="overflow-hidden rounded-lg border border-[#DCE5E1] bg-[#F3F6F4] p-2 shadow-[0_18px_55px_rgba(11,25,44,0.09)]">
            <img src="/doctor-hands.jpg" alt="Clinician in a white coat holding a phone, with a stethoscope visible" className="aspect-[4/3] w-full rounded-lg object-cover object-center sm:aspect-[1.18/1]" />
          </div>
          <div className="absolute bottom-0 left-4 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-lg border border-[#E1E8E4] bg-white px-4 py-3 shadow-[0_8px_28px_rgba(11,25,44,0.11)] sm:left-7 sm:px-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F0EC] text-[#52796F]" aria-hidden="true">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m9 12.75 2.25 2.25L15 9.75m6 .75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold leading-5 text-[#0B192C]">Verified clinician mentors</span>
              <span className="block text-xs leading-5 text-[#65736F]">Credential review is part of mentor verification</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}