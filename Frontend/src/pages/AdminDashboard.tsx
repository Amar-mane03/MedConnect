import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import type { Page } from '../App';
import API from '../api';
import { useAuth } from '../context/AuthContext';

interface Props {
  navigate: (p: Page) => void;
}

interface PendingVerification {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  specialty: string;
  licenseNumber?: string;
  hospital?: string;
  institution?: string;
  careerStage?: string;
  submitted?: string;
  createdAt?: string;
  docs?: string[];
}

interface AdminStats {
  totalUsers: number;
  pendingVerifications: number;
  activeMentors: number;
  totalCases: number;
  totalComments: number;
}

interface ModerationReport {
  id: string;
  targetType: 'case' | 'comment';
  caseTitle: string;
  specialty: string;
  reason: string;
  details: string;
  reporter: string;
  content: string;
  createdAt: string;
}

function TotalUsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
function PendingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function ActiveMentorsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function CasesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export default function AdminDashboardPage({ navigate }: Props) {
  const { role } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    pendingVerifications: 0,
    activeMentors: 0,
    totalCases: 0,
    totalComments: 0,
  });
  const [pendingVerifications, setPendingVerifications] = useState<PendingVerification[]>([]);
  const [moderationReports, setModerationReports] = useState<ModerationReport[]>([]);
  const [actioned, setActioned] = useState<{ id: string; name: string; specialty: string; action: 'approved' | 'rejected' }[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, verifRes, reportsRes] = await Promise.all([
        API.get('/admin/stats'),
        API.get('/admin/verifications'),
        API.get('/admin/reports'),
      ]);

      if (statsRes.data?.stats) {
        setStats(statsRes.data.stats);
      }
      if (verifRes.data?.verifications) {
        setPendingVerifications(verifRes.data.verifications);
      }
      if (reportsRes.data?.reports) {
        setModerationReports(reportsRes.data.reports);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleAction = async (id: string, action: 'verified' | 'rejected') => {
    try {
      const res = await API.patch(`/admin/verifications/${id}`, { action });
      const targetDoc = pendingVerifications.find(v => (v.id || v._id) === id);

      if (targetDoc) {
        setActioned(prev => [
          {
            id,
            name: targetDoc.name,
            specialty: targetDoc.specialty,
            action: action === 'verified' ? 'approved' : 'rejected',
          },
          ...prev,
        ]);
      }

      setPendingVerifications(prev => prev.filter(v => (v.id || v._id) !== id));
      setStats(prev => ({
        ...prev,
        pendingVerifications: Math.max(0, prev.pendingVerifications - 1),
        activeMentors: action === 'verified' ? prev.activeMentors + 1 : prev.activeMentors,
      }));

      setToastMessage(res.data?.message || `Physician ${action === 'verified' ? 'Approved' : 'Rejected'}`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error('Failed to update verification status:', err);
      setToastMessage(err.response?.data?.message || 'Action failed.');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleReportAction = async (id: string, action: 'dismiss' | 'hide') => {
    try {
      const response = await API.patch(`/admin/reports/${id}`, { action });
      setModerationReports(prev => prev.filter(report => report.id !== id));
      setToastMessage(response.data?.message || (action === 'hide' ? 'Content hidden.' : 'Report dismissed.'));
      setTimeout(() => setToastMessage(null), 4000);
    } catch (error: any) {
      setToastMessage(error.response?.data?.message || 'Unable to review report.');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  if (role !== 'admin') {
    return (
      <Layout navigate={navigate} currentPage="dashboard">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#E8F0EC] flex items-center justify-center text-2xl text-[#52796F] mx-auto mb-4">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3Z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#0B192C] mb-2" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
            Administrator Portal Access
          </h1>
          <p className="text-sm text-[#52616C] mb-6">
            The platform governance and credential verification suite is restricted to authorized platform administrators.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate('dashboard')}
              className="px-5 py-2.5 bg-[#FFFFFF] border border-[#E1E7E5] text-xs font-bold text-[#0B192C] rounded-full hover:bg-[#F0F4F2]"
            >
              ← Back to Feed
            </button>
            <button
              onClick={() => navigate('login')}
              className="px-5 py-2.5 bg-[#0B192C] text-white text-xs font-bold rounded-full hover:bg-[#192B40]"
            >
              Sign In as Admin
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const statCards = [
    { label: 'Total Clinicians', value: stats.totalUsers.toLocaleString(), delta: 'MongoDB Atlas live', icon: TotalUsersIcon, color: 'text-[#52796F]', bg: 'bg-[#E8F0EC]' },
    { label: 'Pending Verifications', value: stats.pendingVerifications.toLocaleString(), delta: `${pendingVerifications.length} awaiting review`, icon: PendingIcon, color: 'text-[#C27D38]', bg: 'bg-[#FAF0E6]' },
    { label: 'Active Mentors', value: stats.activeMentors.toLocaleString(), delta: 'Verified doctors', icon: ActiveMentorsIcon, color: 'text-[#0B192C]', bg: 'bg-[#E8F0EC]' },
    { label: 'Clinical Cases', value: stats.totalCases.toLocaleString(), delta: `${stats.totalComments} peer comments`, icon: CasesIcon, color: 'text-[#52616C]', bg: 'bg-[#F0F4F2]' },
  ];

  return (
    <Layout navigate={navigate} currentPage="admin">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 border-b border-[#E1E7E5] pb-6">
          <div>
            <h1 className="text-3xl font-semibold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Admin Verification Hub
            </h1>
            <p className="text-sm text-[#52616C] mt-1">Review physician credentials, license records, and platform governance</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0B192C] bg-[#FFFFFF] border border-[#E1E7E5] px-4 py-2 rounded-full self-start sm:self-auto shadow-2xs">
            <div className="w-2.5 h-2.5 rounded-full bg-[#2E7D5A] animate-pulse" />
            MongoDB Connected · Live Production Hub
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="mb-6 p-4 rounded-lg bg-[#E8F0EC] border border-[#2E7D5A]/30 text-xs font-bold text-[#0B192C] flex items-center justify-between shadow-xs">
            <span>✓ {toastMessage}</span>
            <button onClick={() => setToastMessage(null)} className="text-[#0B192C] hover:opacity-70">✕</button>
          </div>
        )}

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map(({ label, value, delta, icon: Icon, color, bg }) => (
            <div key={label} className="bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] p-5 shadow-xs transition-transform hover:-translate-y-0.5">
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="text-2xl font-bold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                {loading ? '…' : value}
              </div>
              <div className="text-xs text-[#52616C] mt-0.5 font-medium">{label}</div>
              <div className={`text-xs font-semibold mt-1 ${color}`}>{delta}</div>
            </div>
          ))}
        </div>

        <section className="mb-8 border border-[#E1E7E5] bg-white" aria-labelledby="moderation-reports-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1E7E5] px-5 py-4">
            <div>
              <h2 id="moderation-reports-title" className="text-base font-bold text-[#0B192C]">Content reports</h2>
              <p className="mt-1 text-xs text-[#74817D]">{moderationReports.length} awaiting review</p>
            </div>
            <button onClick={fetchAdminData} className="text-xs font-semibold text-[#52796F] underline underline-offset-2">Refresh reports</button>
          </div>
          {moderationReports.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[#74817D]">No reports are awaiting review.</p>
          ) : (
            <div className="divide-y divide-[#E1E7E5]">
              {moderationReports.map(report => (
                <article key={report.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase text-[#52796F]">{report.targetType} report</span>
                      <span className="text-xs text-[#74817D]">{report.reason}</span>
                      <span className="text-xs text-[#74817D]">by {report.reporter}</span>
                    </div>
                    <h3 className="mt-2 text-sm font-bold text-[#0B192C]">{report.caseTitle}{report.specialty ? ` · ${report.specialty}` : ''}</h3>
                    <p className="mt-1 line-clamp-3 text-sm leading-6 text-[#52616C]">{report.content}</p>
                    {report.details && <p className="mt-2 border-l-2 border-[#E1E7E5] pl-3 text-xs leading-5 text-[#74817D]">Reporter note: {report.details}</p>}
                    <time className="mt-2 block text-[11px] text-[#74817D]" dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString()}</time>
                  </div>
                  <div className="flex gap-2 lg:justify-end">
                    <button onClick={() => handleReportAction(report.id, 'dismiss')} className="border border-[#E1E7E5] px-3 py-2 text-xs font-semibold text-[#52616C] hover:bg-[#F7F9F8]">Dismiss</button>
                    <button onClick={() => handleReportAction(report.id, 'hide')} className="bg-[#9B3F35] px-3 py-2 text-xs font-semibold text-white hover:bg-[#81332B]">Hide content</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Pending Verifications Table */}
        <div className="bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] overflow-hidden mb-8 shadow-xs">
          <div className="px-6 py-4 border-b border-[#E1E7E5] bg-[#F0F4F2] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-[#0B192C] text-base" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                Doctor Verification Queue
              </h2>
              <p className="text-xs text-[#74817D] mt-0.5">
                {pendingVerifications.length} physician applications awaiting GMC / licence validation
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchAdminData}
                className="text-xs font-bold text-[#0B192C] bg-white border border-[#E1E7E5] px-3.5 py-1.5 rounded-full hover:bg-[#F0F4F2] transition-colors cursor-pointer"
              >
                ↻ Refresh List
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#FBF9F5] border-b border-[#E1E7E5]">
                  {['Applicant', 'Specialty', 'Licence Number', 'Hospital / Trust', 'Stage', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-[10px] font-bold text-[#74817D] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7E5]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[#74817D]">
                      Loading verification queue…
                    </td>
                  </tr>
                ) : pendingVerifications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-[#74817D]">
                      🎉 All clinician applications have been reviewed! No pending doctor verifications.
                    </td>
                  </tr>
                ) : (
                  pendingVerifications.map(v => {
                    const id = v.id || v._id || '';
                    return (
                      <tr key={id} className="hover:bg-[#FBF9F5] transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#0B192C] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                              {v.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <span className="text-sm font-bold text-[#0B192C] block">{v.name}</span>
                              <span className="text-[11px] text-[#74817D]">{v.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs bg-[#E8F0EC] text-[#35564E] px-2.5 py-1 rounded-full font-semibold">
                            {v.specialty || 'General'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-[#52616C] font-medium">
                          {v.licenseNumber || 'Not provided'}
                        </td>
                        <td className="px-5 py-4 text-xs text-[#52616C]">
                          {v.hospital || v.institution || 'Not provided'}
                        </td>
                        <td className="px-5 py-4 text-xs text-[#74817D]">
                          {v.careerStage || 'Not provided'}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAction(id, 'verified')}
                              className="px-3.5 py-1 bg-[#2E7D5A] hover:bg-[#236347] text-white text-xs font-bold rounded-full transition-colors cursor-pointer shadow-2xs"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleAction(id, 'rejected')}
                              className="px-3 py-1 border border-[#52796F] text-[#52796F] hover:bg-[#E8F0EC] text-xs font-bold rounded-full transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recently Actioned Records */}
        {actioned.length > 0 && (
          <div className="bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-[#E1E7E5] bg-[#F0F4F2]">
              <h2 className="font-bold text-[#0B192C] text-base" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                Recently Actioned ({actioned.length})
              </h2>
            </div>
            <div className="divide-y divide-[#E1E7E5]">
              {actioned.map(v => (
                <div key={v.id} className="flex items-center justify-between px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#0B192C] flex items-center justify-center text-white text-[11px] font-bold">
                      {v.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-[#0B192C]">{v.name}</span>
                      <span className="text-xs text-[#74817D] ml-2">· {v.specialty}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    v.action === 'approved'
                      ? 'bg-[#E8F0EC] text-[#2E7D5A]'
                      : 'bg-[#FDEEEB] text-[#C04A36]'
                  }`}>
                    {v.action === 'approved' ? '✓ Verified & Promoted to Mentor' : '✕ Application Rejected'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
