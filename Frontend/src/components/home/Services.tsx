type ServiceKind = 'case' | 'mentor' | 'community';

const services: { kind: ServiceKind; number: string; title: string; description: string; link: string }[] = [
  { kind: 'case', number: '01', title: 'Case-based learning', description: 'Explore de-identified clinical cases and compare thoughtful approaches with peers.', link: 'Read about case discussions' },
  { kind: 'mentor', number: '02', title: 'One-to-one mentorship', description: 'Build a professional connection around your goals, specialty, and career stage.', link: 'Explore mentorship' },
  { kind: 'community', number: '03', title: 'Specialty communities', description: 'Find focused groups for practical discussion, shared interests, and ongoing learning.', link: 'Browse specialties' },
];

function ServiceMark({ kind }: { kind: ServiceKind }) {
  const paths: Record<ServiceKind, string> = {
    case: 'M8 6h8M8 10h8M8 14h5m-8 6h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H7L3 8v10a2 2 0 0 0 2 2Z',
    mentor: 'M16 18h6v-1a4 4 0 0 0-6.5-3.1M16 18H8m8 0v-1c0-1.1-.45-2.1-1.2-2.83M8 18H2v-1a4 4 0 0 1 6.5-3.1M8 18v-1c0-1.1.45-2.1 1.2-2.83m0 0a4 4 0 1 1 5.6 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    community: 'M12 3v18m9-9H3m15.36-6.36L5.64 18.36m12.72 0L5.64 5.64',
  };

  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={paths[kind]} />
    </svg>
  );
}

interface ServicesProps {
  onConnect: () => void;
}

export default function Services({ onConnect }: ServicesProps) {
  return (
    <section id="services" className="bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-9 max-w-2xl">
          <p className="text-xs font-bold uppercase text-[#52796F]">Ways to grow together</p>
          <h2 className="mt-3 text-3xl leading-tight text-[#0B192C] sm:text-4xl" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
            Practical support for the work you do every day.
          </h2>
        </div>

        <div className="grid border-y border-[#E1E7E5] md:grid-cols-3 md:divide-x md:divide-[#E1E7E5]">
          {services.map((service) => (
            <article key={service.number} className="group py-7 md:px-7 md:py-8 first:md:pl-0 last:md:pr-0">
              <div className="flex items-center justify-between text-[#52796F]">
                <ServiceMark kind={service.kind} />
                <span className="text-xs font-semibold tabular-nums text-[#89948E]">{service.number}</span>
              </div>
              <h3 className="mt-6 text-xl font-bold text-[#0B192C]">{service.title}</h3>
              <p className="mt-3 min-h-14 text-sm leading-6 text-[#64727C]">{service.description}</p>
              <button onClick={onConnect} className="mt-5 text-left text-sm font-semibold text-[#35564E] underline decoration-[#A9BDB5] underline-offset-4 transition-colors hover:text-[#0B192C]">
                {service.link}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}