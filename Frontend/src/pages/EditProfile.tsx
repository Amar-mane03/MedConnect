import { useState, type FormEvent } from 'react';
import type { Page } from '../App';
import Layout from '../components/Layout';
import API from '../api';
import { useAuth } from '../context/AuthContext';

interface EditProfileProps {
  navigate: (page: Page) => void;
}

export default function EditProfilePage({ navigate }: EditProfileProps) {
  const { user, role, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    bio: user?.bio || '',
    location: user?.location || '',
    specialty: user?.specialty || '',
    subspecialty: user?.subspecialty || '',
    careerStage: user?.careerStage || '',
    institution: user?.institution || '',
    hospital: user?.hospital || '',
    degrees: user?.degrees || '',
    goals: user?.goals || '',
    communicationPreference: user?.communicationPreference || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isMentor = role === 'mentor';
  const setField = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const payload = isMentor
      ? { name: form.name, bio: form.bio, location: form.location, specialty: form.specialty, subspecialty: form.subspecialty, hospital: form.hospital, degrees: form.degrees }
      : { name: form.name, bio: form.bio, location: form.location, specialty: form.specialty, careerStage: form.careerStage, institution: form.institution, goals: form.goals, communicationPreference: form.communicationPreference };

    try {
      const response = await API.patch('/auth/profile', payload);
      updateUser(response.data.user);
      setNotice(response.data.message || 'Profile updated successfully.');
    } catch (requestError) {
      if (typeof requestError === 'object' && requestError !== null && 'response' in requestError) {
        const response = (requestError as { response?: { data?: { message?: string } } }).response;
        setError(response?.data?.message || 'Could not update your profile. Please try again.');
      } else {
        setError('Could not update your profile. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'mt-1.5 w-full rounded-lg border border-[#DCE5E1] bg-white px-3.5 py-2.5 text-sm text-[#0B192C] outline-none focus:border-[#52796F] focus:ring-2 focus:ring-[#52796F]/15';

  return (
    <Layout navigate={navigate} currentPage="profile">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#52796F]">Account settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0B192C] sm:text-4xl" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Edit your profile</h1>
        <p className="mt-3 text-sm leading-6 text-[#64727C]">Keep your professional and learning details current. Your email and account role cannot be changed here.</p>

        {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

        <form onSubmit={(event) => void saveProfile(event)} className="mt-6 space-y-5 rounded-xl border border-[#E1E7E5] bg-white p-5 shadow-sm sm:p-7">
          <label className="block text-xs font-bold text-[#263847]">Full name
            <input required minLength={2} maxLength={100} value={form.name} onChange={(event) => setField('name', event.target.value)} className={fieldClass} autoComplete="name" />
          </label>

          {isMentor ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-bold text-[#263847]">Specialty<input maxLength={120} value={form.specialty} onChange={(event) => setField('specialty', event.target.value)} className={fieldClass} /></label>
                <label className="block text-xs font-bold text-[#263847]">Subspecialty<input maxLength={120} value={form.subspecialty} onChange={(event) => setField('subspecialty', event.target.value)} className={fieldClass} /></label>
                <label className="block text-xs font-bold text-[#263847]">Hospital / clinic<input maxLength={160} value={form.hospital} onChange={(event) => setField('hospital', event.target.value)} className={fieldClass} /></label>
                <label className="block text-xs font-bold text-[#263847]">Location<input maxLength={120} value={form.location} onChange={(event) => setField('location', event.target.value)} className={fieldClass} /></label>
              </div>
              <label className="block text-xs font-bold text-[#263847]">Degrees and qualifications
                <input maxLength={240} value={form.degrees} onChange={(event) => setField('degrees', event.target.value)} className={fieldClass} placeholder="e.g. MBBS, MD" />
              </label>
              <label className="block text-xs font-bold text-[#263847]">Professional biography
                <textarea maxLength={1000} rows={5} value={form.bio} onChange={(event) => setField('bio', event.target.value)} className={fieldClass} />
              </label>
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-bold text-[#263847]">Career stage<input maxLength={120} value={form.careerStage} onChange={(event) => setField('careerStage', event.target.value)} className={fieldClass} placeholder="e.g. Medical student, Year 3" /></label>
                <label className="block text-xs font-bold text-[#263847]">Specialty of interest<input maxLength={120} value={form.specialty} onChange={(event) => setField('specialty', event.target.value)} className={fieldClass} /></label>
                <label className="block text-xs font-bold text-[#263847]">Institution<input maxLength={160} value={form.institution} onChange={(event) => setField('institution', event.target.value)} className={fieldClass} /></label>
                <label className="block text-xs font-bold text-[#263847]">Location<input maxLength={120} value={form.location} onChange={(event) => setField('location', event.target.value)} className={fieldClass} /></label>
              </div>
              <label className="block text-xs font-bold text-[#263847]">Learning and mentorship goals
                <textarea maxLength={1000} rows={4} value={form.goals} onChange={(event) => setField('goals', event.target.value)} className={fieldClass} />
              </label>
              <label className="block text-xs font-bold text-[#263847]">About you
                <textarea maxLength={1000} rows={4} value={form.bio} onChange={(event) => setField('bio', event.target.value)} className={fieldClass} />
              </label>
              <label className="block text-xs font-bold text-[#263847]">Communication preference
                <input maxLength={120} value={form.communicationPreference} onChange={(event) => setField('communicationPreference', event.target.value)} className={fieldClass} placeholder="e.g. Messages through MedConnect" />
              </label>
            </>
          )}

          <div className="flex flex-wrap gap-3 border-t border-[#E8ECEA] pt-5">
            <button type="submit" disabled={saving} className="rounded-lg bg-[#0B192C] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#192B40] disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving…' : 'Save profile'}</button>
            <button type="button" onClick={() => navigate('dashboard')} className="rounded-lg border border-[#DCE5E1] px-5 py-2.5 text-sm font-semibold text-[#52616C] transition hover:bg-[#F7F9F8]">Back to workspace</button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
