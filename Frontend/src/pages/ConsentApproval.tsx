import { useState } from 'react';
import API from '../api';

function errorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return 'Unable to record consent. The link may have expired.';
}

export default function ConsentApproval() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [acknowledged, setAcknowledged] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const approve = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await API.post(`/community/consent/guardian/${encodeURIComponent(token)}`);
      setMessage(response.data.message);
      setCompleted(true);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return <main className="flex min-h-screen items-center justify-center bg-[#F7F9F8] px-4 py-10 text-[#0B192C]">
    <section className="w-full max-w-xl rounded-2xl border border-[#E1E7E5] bg-white p-7 shadow-sm sm:p-10">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#52796F]">Good Neighbors · Student volunteering</p>
      <h1 className="mt-3 text-3xl font-semibold" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Guardian consent</h1>
      {completed ? <p role="status" className="mt-5 rounded-lg bg-green-50 p-4 text-sm leading-6 text-green-900">{message}</p> : <>
        <p className="mt-4 text-sm leading-6 text-[#52616C]">A student has requested your consent to participate in a community camp. Confirm only if you are their parent, legal guardian, or institutional coordinator and have reviewed the activity details with them.</p>
        <p className="mt-3 text-xs text-[#64727C]">This private link expires after 72 hours and can be used once.</p>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <label className="mt-5 flex gap-3 text-sm leading-5"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 accent-[#52796F]" />I have authority to provide consent and agree to the student's participation.</label>
        <div className="mt-6"><button type="button" disabled={!token || !acknowledged || busy} onClick={() => void approve()} className="rounded-lg bg-[#0B192C] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Recording consent…' : 'Approve participation'}</button></div>
        {!token && <p className="mt-4 text-sm text-red-700">This consent link is invalid or incomplete.</p>}
      </>}
    </section>
  </main>;
}
