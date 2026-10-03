const assurances = [
  { title: 'Verified mentorship', detail: 'Mentor credentials are reviewed before verification.' },
  { title: 'De-identified learning', detail: 'Case discussions are designed around privacy-conscious sharing.' },
  { title: 'Across specialties', detail: 'Learn with peers at different stages of clinical practice.' },
];

export default function TrustBanner() {
  return (
    <section id="approach" className="border-y border-[#E1E7E5] bg-[#F7F9F8] px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-7xl divide-y divide-[#DCE5E1] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {assurances.map((assurance) => (
          <div key={assurance.title} className="py-5 sm:px-7 sm:py-2 first:sm:pl-0 last:sm:pr-0">
            <h2 className="text-sm font-bold text-[#0B192C]">{assurance.title}</h2>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-[#64727C]">{assurance.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}