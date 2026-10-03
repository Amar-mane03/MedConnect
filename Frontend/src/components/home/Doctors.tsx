export interface MentorPreview {
  id: string;
  name: string;
  specialty: string;
  hospital?: string;
  initials: string;
  verified: boolean;
}

interface DoctorsProps {
  isAuthenticated: boolean;
  mentors: MentorPreview[];
  loading: boolean;
  onJoin: () => void;
  onSelectMentor: (id: string) => void;
}

export default function Doctors({ isAuthenticated, mentors, loading, onJoin, onSelectMentor }: DoctorsProps) {
  return (
    <section id="mentors" className="bg-[#F5F7F6] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase text-[#52796F]">Clinician mentors</p>
            <h2 className="mt-3 text-3xl leading-tight text-[#0B192C] sm:text-4xl" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Guidance grounded in real clinical experience.
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#64727C]">Member profiles show verified specialties and the details clinicians have chosen to share.</p>
          </div>
          {!isAuthenticated && (
            <button onClick={onJoin} className="self-start rounded-md border border-[#52796F] px-5 py-3 text-sm font-semibold text-[#35564E] transition-colors hover:bg-white sm:self-auto">
              Join to meet mentors
            </button>
          )}
        </div>

        {!isAuthenticated ? (
          <div className="mt-8 border-y border-[#DCE5E1] py-6 text-sm leading-6 text-[#64727C]">
            Create a member account to view verified mentor profiles and request a mentorship connection.
          </div>
        ) : loading ? (
          <p className="mt-8 border-y border-[#DCE5E1] py-6 text-sm text-[#64727C]" role="status">Loading verified mentor profiles…</p>
        ) : mentors.length ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {mentors.map((mentor) => (
              <article key={mentor.id} className="flex min-w-0 gap-4 border border-[#DFE6E3] bg-white p-5 transition-shadow hover:shadow-[0_10px_28px_rgba(11,25,44,0.07)]">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#DCE5E1] bg-[#EFF4F1] text-sm font-bold text-[#35564E]" aria-label={`${mentor.name} profile initials`}>
                  {mentor.initials}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-[#0B192C]">{mentor.name}</h3>
                  <p className="mt-1 text-sm text-[#52616C]">{mentor.specialty}</p>
                  {mentor.hospital && <p className="mt-1 truncate text-xs text-[#74817D]">{mentor.hospital}</p>}
                  <p className="mt-2 text-xs font-semibold text-[#52796F]">Verified clinician mentor</p>
                  <button onClick={() => onSelectMentor(mentor.id)} className="mt-3 text-sm font-semibold text-[#0B192C] underline decoration-[#A9BDB5] underline-offset-4">
                    View profile
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-8 border-y border-[#DCE5E1] py-6 text-sm leading-6 text-[#64727C]">No verified mentor profiles are available yet.</p>
        )}
      </div>
    </section>
  );
}