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
  const [actioned, setActioned] = useState<{ id: string; name: string; specialty: string; action: 'approved' | 'rejected' }[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, verifRes] = await Promise.all([
        API.get('/admin/stats'),
        API.get('/admin/verifications'),
      ]);

      if (statsRes.data?.stats) {
        setStats(statsRes.data.stats);
      }
      if (verifRes.data?.verifications) {
        setPendingVerifications(verifRes.data.verifications);
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

  if (role !== 'admin') {
    return (
      <Layout navigate={navigate} currentPage="dashboard">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#FBE5DC] flex items-center justify-center text-2xl text-[#D86F52] mx-auto mb-4">
            🛡️
          </div>
          <h1 className="text-2xl font-bold text-[#183D3A] mb-2" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
            Administrator Portal Access
          </h1>
          <p className="text-sm text-[#596965] mb-6">
            The platform governance and credential verification suite is restricted to authorized platform administrators.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate('dashboard')}
              className="px-5 py-2.5 bg-[#FFFCF8] border border-[#D8D2C8] text-xs font-bold text-[#183D3A] rounded-full hover:bg-[#F1EEE8]"
            >
              ← Back to Feed
            </button>
            <button
              onClick={() => navigate('login')}
              className="px-5 py-2.5 bg-[#D86F52] text-white text-xs font-bold rounded-full hover:bg-[#B9543D]"
            >
              Sign In as Admin
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const statCards = [
    { label: 'Total Clinicians', value: stats.totalUsers.toLocaleString(), delta: 'MongoDB Atlas live', icon: TotalUsersIcon, color: 'text-[#D86F52]', bg: 'bg-[#FBE5DC]' },
    { label: 'Pending Verifications', value: stats.pendingVerifications.toLocaleString(), delta: `${pendingVerifications.length} awaiting review`, icon: PendingIcon, color: 'text-[#C27D38]', bg: 'bg-[#FAF0E6]' },
    { label: 'Active Mentors', value: stats.activeMentors.toLocaleString(), delta: 'Verified doctors', icon: ActiveMentorsIcon, color: 'text-[#183D3A]', bg: 'bg-[#E4EAE3]' },
    { label: 'Clinical Cases', value: stats.totalCases.toLocaleString(), delta: `${stats.totalComments} peer comments`, icon: CasesIcon, color: 'text-[#34657F]', bg: 'bg-[#E8F1F5]' },
  ];

  return (
    <Layout navigate={navigate} currentPage="admin">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 border-b border-[#D8D2C8] pb-6">
          <div>
            <h1 className="text-3xl font-semibold text-[#183D3A]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
              Admin Verification Hub
            </h1>
            <p className="text-sm text-[#596965] mt-1">Review physician credentials, license records, and platform governance</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#183D3A] bg-[#FFFCF8] border border-[#D8D2C8] px-4 py-2 rounded-full self-start sm:self-auto shadow-2xs">
            <div className="w-2.5 h-2.5 rounded-full bg-[#2E7D5A] animate-pulse" />
            MongoDB Connected · Live Production Hub
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-[#E4EAE3] border border-[#2E7D5A]/30 text-xs font-bold text-[#183D3A] flex items-center justify-between shadow-xs">
            <span>✓ {toastMessage}</span>
            <button onClick={() => setToastMessage(null)} className="text-[#183D3A] hover:opacity-70">✕</button>
          </div>
        )}

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map(({ label, value, delta, icon: Icon, color, bg }) => (
            <div key={label} className="bg-[#FFFCF8] rounded-2xl border border-[#D8D2C8] p-5 shadow-xs transition-transform hover:-translate-y-0.5">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="text-2xl font-bold text-[#183D3A]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                {loading ? '…' : value}
              </div>
              <div className="text-xs text-[#596965] mt-0.5 font-medium">{label}</div>
              <div className={`text-xs font-semibold mt-1 ${color}`}>{delta}</div>
            </div>
          ))}
        </div>

        {/* Pending Verifications Table */}
        <div className="bg-[#FFFCF8] rounded-2xl border border-[#D8D2C8] overflow-hidden mb-8 shadow-xs">
          <div className="px-6 py-4 border-b border-[#D8D2C8] bg-[#F1EEE8] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-[#183D3A] text-base" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                Doctor Verification Queue
              </h2>
              <p className="text-xs text-[#71807C] mt-0.5">
                {pendingVerifications.length} physician applications awaiting GMC / licence validation
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchAdminData}
                className="text-xs font-bold text-[#183D3A] bg-white border border-[#D8D2C8] px-3.5 py-1.5 rounded-full hover:bg-[#F1EEE8] transition-colors cursor-pointer"
              >
                ↻ Refresh List
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#FBF9F5] border-b border-[#EAE5DC]">
                  {['Applicant', 'Specialty', 'Licence Number', 'Hospital / Trust', 'Stage', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-[10px] font-bold text-[#71807C] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE5DC]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[#71807C]">
                      Loading verification queue…
                    </td>
                  </tr>
                ) : pendingVerifications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-[#71807C]">
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
                            <div className="w-8 h-8 rounded-full bg-[#183D3A] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                              {v.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <span className="text-sm font-bold text-[#183D3A] block">{v.name}</span>
                              <span className="text-[11px] text-[#71807C]">{v.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs bg-[#FBE5DC] text-[#B9543D] px-2.5 py-1 rounded-full font-semibold">
                            {v.specialty || 'General'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-[#596965] font-medium">
                          {v.licenseNumber || 'GMC Submitted'}
                        </td>
                        <td className="px-5 py-4 text-xs text-[#596965]">
                          {v.hospital || v.institution || 'Teaching NHS Trust'}
                        </td>
                        <td className="px-5 py-4 text-xs text-[#71807C]">
                          {v.careerStage || 'Consultant'}
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
                              className="px-3 py-1 border border-[#D86F52] text-[#D86F52] hover:bg-[#FBE5DC] text-xs font-bold rounded-full transition-colors cursor-pointer"
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
          <div className="bg-[#FFFCF8] rounded-2xl border border-[#D8D2C8] overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-[#D8D2C8] bg-[#F1EEE8]">
              <h2 className="font-bold text-[#183D3A] text-base" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                Recently Actioned ({actioned.length})
              </h2>
            </div>
            <div className="divide-y divide-[#EAE5DC]">
              {actioned.map(v => (
                <div key={v.id} className="flex items-center justify-between px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#183D3A] flex items-center justify-center text-white text-[11px] font-bold">
                      {v.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-[#183D3A]">{v.name}</span>
                      <span className="text-xs text-[#71807C] ml-2">· {v.specialty}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    v.action === 'approved'
                      ? 'bg-[#E4EAE3] text-[#2E7D5A]'
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
