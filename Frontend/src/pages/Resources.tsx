import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import type { Page } from '../App';
import API, { SOCKET_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { io, Socket } from 'socket.io-client';

interface ResourcesProps {
  navigate: (p: Page, meta?: any) => void;
}

interface ResourceItem {
  id?: string;
  _id?: string;
  title: string;
  description: string;
  resourceType: 'pdf' | 'link' | 'article' | 'notes' | 'guideline';
  url: string;
  fileName?: string;
  fileSize?: string;
  isUploaded?: boolean;
  specialty: string;
  tags: string[];
  uploader: string;
  uploaderRole: string;
  uploaderSpecialty: string;
  verified?: boolean;
  initials?: string;
  downloadsCount: number;
  likesCount: number;
  likes?: string[];
  timeAgo?: string;
}

const SPECIALTIES = [
  'All',
  'Cardiology',
  'Neurology',
  'Internal Medicine',
  'Emergency Medicine',
  'Oncology',
  'Paediatrics',
  'Surgery',
];

const RESOURCE_TYPES = [
  { label: 'All Formats', value: 'All' },
  { label: 'PDFs & Documents', value: 'pdf' },
  { label: 'Clinical Guidelines', value: 'guideline' },
  { label: 'Study Notes', value: 'notes' },
  { label: 'Research Articles', value: 'article' },
  { label: 'External Links', value: 'link' },
];

const typeIcons: Record<string, string> = {
  pdf: 'PDF',
  guideline: 'GUIDE',
  notes: 'NOTES',
  article: 'RESEARCH',
  link: 'LINK',
};

const specialtyColors: Record<string, string> = {
  Cardiology: 'bg-[#E8F0EC] text-[#35564E] border-[#52796F]/30',
  Neurology: 'bg-[#F0F4F2] text-[#52616C] border-[#52616C]/30',
  Oncology: 'bg-[#FAF0E6] text-[#C27D38] border-[#C27D38]/30',
  'Emergency Medicine': 'bg-[#FDEEEB] text-[#C04A36] border-[#C04A36]/30',
  'Internal Medicine': 'bg-[#F0F4F2] text-[#52616C] border-[#52616C]/30',
  Paediatrics: 'bg-[#EFF4F1] text-[#3D7A68] border-[#3D7A68]/30',
  Surgery: 'bg-[#F0F4F2] text-[#52616C] border-[#52616C]/30',
};

export default function ResourcesPage({ navigate }: ResourcesProps) {
  const { user } = useAuth();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSpecialty, setActiveSpecialty] = useState('All');
  const [activeType, setActiveType] = useState('All');
  const [searchVal, setSearchVal] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'downloads'>('newest');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<'pdf' | 'link' | 'article' | 'notes' | 'guideline'>('pdf');
  const [newUrl, setNewUrl] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newSpecialty, setNewSpecialty] = useState('Cardiology');
  const [newTags, setNewTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const fetchResourcesRef = useRef<() => Promise<void>>(async () => {});

  // Fetch resources
  const fetchResources = async () => {
    setLoading(true);
    try {
      const params: any = { sort: sortBy };
      if (activeSpecialty !== 'All') params.specialty = activeSpecialty;
      if (activeType !== 'All') params.type = activeType;
      if (searchVal.trim()) params.search = searchVal.trim();

      const res = await API.get('/resources', { params });
      if (res.data?.resources) {
        setResources(res.data.resources);

        const currentUserId = user?._id || user?.id;
        if (currentUserId) {
          const liked = new Set<string>();
          res.data.resources.forEach((r: any) => {
            if (r.likes?.includes(currentUserId)) {
              liked.add(r.id || r._id);
            }
          });
          setLikedIds(liked);
        }
      }
    } catch (err) {
      console.error('Failed to load resources:', err);
    } finally {
      setLoading(false);
    }
  };
  fetchResourcesRef.current = fetchResources;

  useEffect(() => {
    fetchResources();
  }, [activeSpecialty, activeType, sortBy]);

  // Socket for live updates
  useEffect(() => {
    let socket: Socket | null = null;
    try {
      socket = io(SOCKET_URL);
      socket.on('new_resource_shared', () => { void fetchResourcesRef.current(); });
    } catch (e) {
      console.error('Socket error in Resources:', e);
    }
    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const handleLike = async (resourceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await API.post(`/resources/${resourceId}/like`);
      if (res.data) {
        const { isLiked, likesCount } = res.data;
        setLikedIds(prev => {
          const updated = new Set(prev);
          if (isLiked) updated.add(resourceId);
          else updated.delete(resourceId);
          return updated;
        });
        setResources(prev =>
          prev.map(r => {
            const id = r.id || r._id;
            if (id === resourceId) return { ...r, likesCount };
            return r;
          })
        );
      }
    } catch (err) {
      console.error('Like resource error:', err);
    }
  };

  const handleDownloadClick = async (resource: ResourceItem) => {
    const id = resource.id || resource._id;
    setDownloadError(null);
    if (resource.isUploaded && id) {
      try {
        const response = await API.get(`/resources/${id}/file`, { responseType: 'blob' });
        const downloadUrl = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = resource.fileName || resource.title;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
        setResources(prev =>
          prev.map(r => (r.id || r._id) === id ? { ...r, downloadsCount: (r.downloadsCount || 0) + 1 } : r)
        );
      } catch (err) {
        console.error('Download resource file error:', err);
        setDownloadError('Unable to download this document. Please try again.');
      }
      return;
    }

    if (id) {
      try {
        await API.post(`/resources/${id}/download`);
        setResources(prev =>
          prev.map(r => {
            if ((r.id || r._id) === id) return { ...r, downloadsCount: (r.downloadsCount || 0) + 1 };
            return r;
          })
        );
      } catch (err) {
        console.error('Download count error:', err);
        setDownloadError('Unable to open this resource. Please try again.');
        return;
      }
    }
    window.open(resource.url, '_blank');
  };

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setFormError('Please provide a title for the resource.');
      return;
    }
    if (newType === 'pdf' && !newFile) {
      setFormError('Choose a PDF or Word document to upload.');
      return;
    }
    if (newType !== 'pdf' && !newUrl.trim()) {
      setFormError('Enter a resource URL for the selected format.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const resourceDetails = {
        title: newTitle.trim(),
        description: newDescription.trim(),
        resourceType: newType,
        url: newType === 'pdf' ? '' : newUrl.trim(),
        specialty: newSpecialty,
        tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
      };
      let payload: FormData | typeof resourceDetails;
      if (newType === 'pdf' && newFile) {
        const formData = new FormData();
        Object.entries(resourceDetails).forEach(([key, value]) => {
          formData.append(key, key === 'tags' ? JSON.stringify(value) : String(value));
        });
        formData.append('file', newFile);
        payload = formData;
      } else {
        payload = resourceDetails;
      }
      const res = await API.post('/resources', payload, { timeout: 60_000 });

      if (res.data?.resource) {
        setShareModalOpen(false);
        setNewTitle('');
        setNewDescription('');
        setNewUrl('');
        setNewFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setNewTags('');
        await fetchResources();
      }
    } catch (err: any) {
      console.error('Share resource error:', err);
      setFormError(err.response?.data?.message || 'Failed to share resource. Please sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout navigate={navigate} currentPage="resources">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Hero Header */}
        <div className="mb-8 flex flex-col gap-4 rounded-lg border border-[#E1E7E5] bg-white p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#F0F4F2] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#52616C]">
              Clinical knowledge
            </div>
            <h1 className="text-2xl font-bold text-[#0B192C] sm:text-3xl lg:text-4xl" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Resource Library
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#52616C] sm:text-base">
              Access peer-reviewed guidelines, study notes, and useful clinical references organized by specialty.
            </p>
          </div>
          <button onClick={() => setShareModalOpen(true)} className="self-start rounded-lg bg-[#0B192C] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#192B40] md:self-center">
            Share material
          </button>
        </div>

        {downloadError && (
          <div role="alert" className="mb-6 flex items-center justify-between gap-3 border border-[#C04A36]/30 bg-[#FDEEEB] px-4 py-3 text-sm text-[#9B3F35]">
            <span>{downloadError}</span>
            <button type="button" onClick={() => setDownloadError(null)} aria-label="Dismiss download error">✕</button>
          </div>
        )}

        {/* Filter Bar: Specialties & Search */}
        <div className="space-y-4 mb-6">
          {/* Specialty Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {SPECIALTIES.map(sp => {
              const active = activeSpecialty === sp;
              return (
                <button
                  key={sp}
                  onClick={() => setActiveSpecialty(sp)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#0B192C] text-white shadow-xs'
                      : 'bg-[#FFFFFF] text-[#52616C] border border-[#E1E7E5] hover:bg-[#F0F4F2] hover:text-[#0B192C]'
                  }`}
                >
                  {sp}
                </button>
              );
            })}
          </div>

          {/* Type Pills + Search & Sort */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {RESOURCE_TYPES.map(t => {
                const active = activeType === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setActiveType(t.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#0B192C] text-white'
                        : 'bg-[#F0F4F2] text-[#52616C] hover:bg-[#E1E7E5] hover:text-[#0B192C]'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <form onSubmit={e => { e.preventDefault(); fetchResources(); }} className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  placeholder="Search resources, topics, tags…"
                  value={searchVal}
                  onChange={e => setSearchVal(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#FFFFFF] rounded-full border border-[#E1E7E5] text-[#0B192C] placeholder-[#74817D] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20 focus:border-[#52796F]"
                />
                <svg
                  className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#74817D]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </form>

              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="px-3 py-2 text-xs font-semibold bg-[#FFFFFF] border border-[#E1E7E5] rounded-full text-[#0B192C] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20 cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="popular">Most Liked</option>
                <option value="downloads">Most Downloaded</option>
              </select>
            </div>
          </div>
        </div>

        {/* Resources Grid */}
        {loading ? (
          <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-12 text-center text-[#74817D]">
            <div className="animate-spin w-8 h-8 border-3 border-[#52796F] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm font-semibold">Loading clinical resources…</p>
          </div>
        ) : resources.length === 0 ? (
          <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-12 text-center">
            <span className="mb-3 inline-flex border border-[#E1E7E5] px-3 py-2 text-xs font-bold uppercase text-[#52796F]">Library</span>
            <h3 className="text-lg font-bold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              No Resources Found
            </h3>
            <p className="text-sm text-[#74817D] mt-1 max-w-sm mx-auto">
              {searchVal
                ? `No results matching "${searchVal}". Try adjusting your specialty or format filters.`
                : 'Be the first doctor to upload a study guide or guideline for this specialty!'}
            </p>
            <button
              onClick={() => setShareModalOpen(true)}
              className="mt-5 px-5 py-2.5 rounded-full bg-[#0B192C] text-white text-xs font-bold hover:bg-[#192B40] transition-colors cursor-pointer"
            >
              Share First Resource
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resources.map(res => {
              const resId = res.id || res._id || '';
              const isLiked = likedIds.has(resId);

              return (
                <div
                  key={resId}
                  className="flex flex-col justify-between rounded-lg border border-[#E1E7E5] bg-white p-5 transition-all hover:border-[#B8CFCB] hover:bg-[#F7F9F8]"
                >
                  <div>
                    {/* Top Row: Format & Specialty */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-base" title={res.resourceType.toUpperCase()}>
                        {typeIcons[res.resourceType] || 'FILE'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          specialtyColors[res.specialty] || 'bg-[#F0F4F2] text-[#52616C] border-[#E1E7E5]'
                        }`}
                      >
                        {res.specialty}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      className="font-bold text-[#0B192C] text-base leading-snug mb-2 hover:text-[#52796F] transition-colors cursor-pointer"
                      style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                      onClick={() => handleDownloadClick(res)}
                    >
                      {res.title}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-[#52616C] leading-relaxed line-clamp-3 mb-4">
                      {res.description || 'No description provided.'}
                    </p>

                    {/* Tags */}
                    {res.tags && res.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {res.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-[#F0F4F2] text-[#52616C]">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Bottom: Uploader & Actions */}
                  <div className="pt-3 border-t border-[#E1E7E5] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#0B192C] text-white flex items-center justify-center text-[10px] font-bold">
                        {res.initials || '—'}
                      </div>
                      <div className="leading-tight">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-[#0B192C] truncate max-w-[100px]">{res.uploader}</span>
                          {res.verified && (
                            <svg className="w-3 h-3 text-[#52796F]" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className="text-[10px] text-[#74817D]">{res.timeAgo || 'Date unavailable'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => handleLike(resId, e)}
                        className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
                          isLiked ? 'bg-[#E8F0EC] text-[#52796F]' : 'text-[#74817D] hover:bg-[#F0F4F2] hover:text-[#0B192C]'
                        }`}
                        title="Helpful Resource"
                      >
                        <span>👍</span>
                        <span>{res.likesCount || 0}</span>
                      </button>

                      <button
                        onClick={() => handleDownloadClick(res)}
                        className="flex items-center gap-1 text-[11px] font-bold px-3 py-1 bg-[#0B192C] text-white rounded-full hover:bg-[#0B192C] transition-colors cursor-pointer"
                        title="View / Download"
                      >
                        <span>Access</span>
                        <span className="text-[10px] text-white/70">({res.downloadsCount || 0})</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Share Resource Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] shadow-2xl max-w-xl w-full p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#E1E7E5] mb-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#52796F]">
                  Clinical Resource Contribution
                </span>
                <h2 className="text-2xl font-bold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  Share Study Material
                </h2>
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#74817D] hover:bg-[#F0F4F2] hover:text-[#0B192C] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-[#FDEEEB] border border-[#C04A36]/30 text-xs font-semibold text-[#C04A36]">
                {formError}
              </div>
            )}

            <form onSubmit={handleShareSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1.5">Specialty</label>
                <select
                  value={newSpecialty}
                  onChange={e => setNewSpecialty(e.target.value)}
                  className="w-full p-3 text-xs bg-[#F0F4F2] rounded-lg border border-[#E1E7E5] text-[#0B192C] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20"
                >
                  {SPECIALTIES.filter(s => s !== 'All').map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1.5">Format Type</label>
                <select
                  value={newType}
                  onChange={e => {
                    const type = e.target.value as typeof newType;
                    setNewType(type);
                    if (type !== 'pdf') {
                      setNewFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }
                  }}
                  className="w-full p-3 text-xs bg-[#F0F4F2] rounded-lg border border-[#E1E7E5] text-[#0B192C] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20"
                >
                  <option value="pdf">PDF or Word Document</option>
                  <option value="guideline">Official Clinical Guideline</option>
                  <option value="notes">Examination Notes & Cheat Sheets</option>
                  <option value="article">Medical Research Paper</option>
                  <option value="link">Web Reference / Tool</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1.5">Resource Title</label>
                <input
                  type="text"
                  placeholder="e.g. Oxford Handbook of Clinical Medicine Summary Notes"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full p-3 text-xs sm:text-sm bg-[#F0F4F2] rounded-lg border border-[#E1E7E5] text-[#0B192C] placeholder-[#74817D] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20 focus:bg-white"
                />
              </div>

              {newType === 'pdf' ? (
                <div>
                  <label htmlFor="resource-document" className="block text-xs font-bold text-[#0B192C] mb-1.5">Upload a PDF or Word document (up to 10 MB)</label>
                  <input
                    ref={fileInputRef}
                    id="resource-document"
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={e => {
                      const file = e.target.files?.[0] || null;
                      if (file && file.size > 10 * 1024 * 1024) {
                        setFormError('Documents must be 10 MB or smaller.');
                        e.target.value = '';
                        setNewFile(null);
                        return;
                      }
                      setFormError(null);
                      setNewFile(file);
                    }}
                    className="w-full p-3 text-xs sm:text-sm bg-[#F0F4F2] rounded-lg border border-[#E1E7E5] text-[#0B192C] file:mr-3 file:rounded file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold"
                  />
                  {newFile && <p className="mt-1 text-xs text-[#52616C]">Selected: {newFile.name}</p>}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-[#0B192C] mb-1.5">Resource URL</label>
                  <input
                    type="url"
                    placeholder="https://example.org/clinical-resource"
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    className="w-full p-3 text-xs sm:text-sm bg-[#F0F4F2] rounded-lg border border-[#E1E7E5] text-[#0B192C] placeholder-[#74817D] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20 focus:bg-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1.5">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Cardiology, ECG, PACES, Acute Care"
                  value={newTags}
                  onChange={e => setNewTags(e.target.value)}
                  className="w-full p-3 text-xs bg-[#F0F4F2] rounded-lg border border-[#E1E7E5] text-[#0B192C] placeholder-[#74817D] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1.5">Brief Summary</label>
                <textarea
                  rows={3}
                  placeholder="Describe the clinical utility, target trainee level, or examination relevance…"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className="w-full p-3 text-xs sm:text-sm bg-[#F0F4F2] rounded-lg border border-[#E1E7E5] text-[#0B192C] placeholder-[#74817D] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20 focus:bg-white"
                />
              </div>

              <div className="pt-4 border-t border-[#E1E7E5] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShareModalOpen(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-bold text-[#52616C] hover:bg-[#F0F4F2] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-full bg-[#0B192C] text-white text-xs font-bold hover:bg-[#192B40] shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Sharing…' : 'Share with Peers'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
