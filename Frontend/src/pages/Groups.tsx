import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import type { Page } from '../App';
import API, { SOCKET_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { io, Socket } from 'socket.io-client';

interface GroupsProps {
  navigate: (p: Page, meta?: any) => void;
}

interface GroupPost {
  id?: string;
  _id?: string;
  author: string;
  authorId?: string;
  role: string;
  specialty?: string;
  verified?: boolean;
  initials?: string;
  content: string;
  likesCount: number;
  likes?: string[];
  timeAgo?: string;
}

interface CircleItem {
  id?: string;
  _id?: string;
  name: string;
  description: string;
  specialty: string;
  icon?: string;
  membersCount: number;
  postsCount: number;
  latestPostTime?: string;
  memberIds?: string[];
  posts?: GroupPost[];
}

const SPECIALTIES = [
  'All',
  'Cardiology',
  'Internal Medicine',
  'Neurology',
  'Emergency Medicine',
  'Oncology',
  'Paediatrics',
  'Surgery',
];

export default function GroupsPage({ navigate }: GroupsProps) {
  const { user } = useAuth();
  const [circles, setCircles] = useState<CircleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
  const [activeSpecialty, setActiveSpecialty] = useState('All');
  const [searchVal, setSearchVal] = useState('');

  // Selected Circle Detail / Feed State
  const [selectedCircle, setSelectedCircle] = useState<CircleItem | null>(null);
  const [loadingCircleDetail, setLoadingCircleDetail] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [posting, setPosting] = useState(false);

  // Create Circle Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSpecialty, setNewSpecialty] = useState('Cardiology');
  const [newIcon, setNewIcon] = useState('CA');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const currentUserId = (user?._id || user?.id || '').toString();

  // Fetch circles
  const fetchCircles = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (activeSpecialty !== 'All') params.specialty = activeSpecialty;
      if (searchVal.trim()) params.search = searchVal.trim();

      const res = await API.get('/groups', { params });
      if (res.data?.groups) {
        setCircles(res.data.groups);
      }
    } catch (err) {
      console.error('Failed to load circles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCircles();
  }, [activeSpecialty]);

  // Socket for live group feed
  useEffect(() => {
    let socket: Socket | null = null;
    try {
      socket = io(SOCKET_URL);
      socket.on('group_post_added', ({ groupId, post }: { groupId: string; post: GroupPost }) => {
        setSelectedCircle(current => {
          if (!current) return null;
          const currentId = current.id || current._id;
          if (currentId === groupId) {
            return {
              ...current,
              postsCount: (current.postsCount || 0) + 1,
              posts: [post, ...(current.posts || [])],
            };
          }
          return current;
        });

        setCircles(prev =>
          prev.map(c => {
            const cId = c.id || c._id;
            if (cId === groupId) {
              return {
                ...c,
                postsCount: (c.postsCount || 0) + 1,
                latestPostTime: 'Just now',
              };
            }
            return c;
          })
        );
      });
    } catch (e) {
      console.error('Socket error in Groups:', e);
    }
    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  // Open Circle Feed
  const handleOpenCircle = async (circle: CircleItem) => {
    const circleId = circle.id || circle._id;
    if (!circleId) return;

    setSelectedCircle(circle);
    setLoadingCircleDetail(true);

    try {
      const res = await API.get(`/groups/${circleId}`);
      if (res.data?.group) {
        setSelectedCircle(res.data.group);
      }
    } catch (err) {
      console.error('Failed to load circle detail:', err);
    } finally {
      setLoadingCircleDetail(false);
    }
  };

  // Join or Leave Circle
  const handleToggleJoin = async (circleId: string, isMember: boolean) => {
    try {
      const endpoint = isMember ? `/groups/${circleId}/leave` : `/groups/${circleId}/join`;
      const res = await API.post(endpoint);
      if (res.data) {
        setCircles(prev =>
          prev.map(c => {
            const id = c.id || c._id;
            if (id === circleId) {
              const currentMembers = c.memberIds || [];
              const updatedMemberIds = isMember
                ? currentMembers.filter(m => m !== currentUserId)
                : [...currentMembers, currentUserId];
              return {
                ...c,
                membersCount: res.data.membersCount,
                memberIds: updatedMemberIds,
              };
            }
            return c;
          })
        );

        if (selectedCircle && (selectedCircle.id === circleId || selectedCircle._id === circleId)) {
          const updatedMembers = isMember
            ? (selectedCircle.memberIds || []).filter(m => m !== currentUserId)
            : [...(selectedCircle.memberIds || []), currentUserId];
          setSelectedCircle({
            ...selectedCircle,
            membersCount: res.data.membersCount,
            memberIds: updatedMembers,
          });
        }
      }
    } catch (err) {
      console.error('Toggle join circle error:', err);
    }
  };

  // Submit Post to Circle Feed
  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !selectedCircle) return;
    const circleId = selectedCircle.id || selectedCircle._id;
    if (!circleId) return;

    setPosting(true);
    try {
      const res = await API.post(`/groups/${circleId}/posts`, {
        content: newPostContent.trim(),
      });
      if (res.data?.post) {
        setSelectedCircle(prev => {
          if (!prev) return null;
          return {
            ...prev,
            postsCount: (prev.postsCount || 0) + 1,
            posts: [res.data.post, ...(prev.posts || [])],
          };
        });
        setNewPostContent('');
      }
    } catch (err) {
      console.error('Failed to submit post to circle:', err);
    } finally {
      setPosting(false);
    }
  };

  // Like Circle Post
  const handleLikePost = async (postId: string) => {
    if (!selectedCircle) return;
    const circleId = selectedCircle.id || selectedCircle._id;
    if (!circleId) return;

    try {
      const res = await API.post(`/groups/${circleId}/posts/${postId}/like`);
      if (res.data) {
        setSelectedCircle(prev => {
          if (!prev || !prev.posts) return prev;
          return {
            ...prev,
            posts: prev.posts.map(p => {
              const pId = p.id || p._id;
              if (pId === postId) {
                return { ...p, likesCount: res.data.likesCount };
              }
              return p;
            }),
          };
        });
      }
    } catch (err) {
      console.error('Like circle post error:', err);
    }
  };

  // Create New Circle Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setCreateError('Please provide a name for the circle.');
      return;
    }
    if (!newDescription.trim()) {
      setCreateError('Please provide a description.');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const res = await API.post('/groups', {
        name: newName.trim(),
        description: newDescription.trim(),
        specialty: newSpecialty,
        icon: newIcon,
      });

      if (res.data?.group) {
        setCircles(prev => [res.data.group, ...prev]);
        setCreateModalOpen(false);
        setNewName('');
        setNewDescription('');
        handleOpenCircle(res.data.group);
      }
    } catch (err: any) {
      console.error('Create circle error:', err);
      setCreateError(err.response?.data?.message || 'Unable to create circle.');
    } finally {
      setCreating(false);
    }
  };

  const displayedCircles = circles.filter(c => {
    if (activeTab === 'my') {
      return (c.memberIds || []).includes(currentUserId);
    }
    return true;
  });

  return (
    <Layout navigate={navigate} currentPage="groups">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header Hero */}
        <div className="mb-8 flex flex-col gap-4 rounded-lg border border-[#E1E7E5] bg-white p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#F0F4F2] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#52616C]">
              Peer groups
            </div>
            <h1 className="text-2xl font-bold text-[#0B192C] sm:text-3xl lg:text-4xl" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Specialty Circles
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#52616C] sm:text-base">
              Join focused clinical networks, study cohorts, and departmental teams. Share clinical pearls and learn together.
            </p>
          </div>
          <button onClick={() => setCreateModalOpen(true)} className="self-start rounded-lg bg-[#0B192C] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#192B40] md:self-center">
            Create specialty circle
          </button>
        </div>

        {/* Tab & Filter Bar */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between border-b border-[#E1E7E5] pb-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveTab('all')}
                className={`text-sm font-bold pb-1 cursor-pointer transition-colors relative ${
                  activeTab === 'all' ? 'text-[#52796F]' : 'text-[#74817D] hover:text-[#0B192C]'
                }`}
              >
                All Circles ({circles.length})
                {activeTab === 'all' && (
                  <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-[#0B192C]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('my')}
                className={`text-sm font-bold pb-1 cursor-pointer transition-colors relative ${
                  activeTab === 'my' ? 'text-[#52796F]' : 'text-[#74817D] hover:text-[#0B192C]'
                }`}
              >
                My Circles ({circles.filter(c => (c.memberIds || []).includes(currentUserId)).length})
                {activeTab === 'my' && (
                  <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-[#0B192C]" />
                )}
              </button>
            </div>

            <form onSubmit={e => { e.preventDefault(); fetchCircles(); }} className="relative sm:w-64">
              <input
                type="text"
                placeholder="Search circles…"
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FFFFFF] rounded-full border border-[#E1E7E5] text-[#0B192C] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20"
              />
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#74817D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </form>
          </div>

          {/* Specialty Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {SPECIALTIES.map(sp => (
              <button
                key={sp}
                onClick={() => setActiveSpecialty(sp)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                  activeSpecialty === sp
                    ? 'bg-[#0B192C] text-white'
                    : 'bg-[#FFFFFF] text-[#52616C] border border-[#E1E7E5] hover:bg-[#F0F4F2]'
                }`}
              >
                {sp}
              </button>
            ))}
          </div>
        </div>

        {/* Circles Grid */}
        {loading ? (
          <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-12 text-center text-[#74817D]">
            <div className="animate-spin w-8 h-8 border-3 border-[#52796F] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm font-semibold">Loading specialty circles…</p>
          </div>
        ) : displayedCircles.length === 0 ? (
          <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-12 text-center">
            <svg className="mx-auto mb-3 h-8 w-8 text-[#52796F]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 19h6v-1a4 4 0 0 0-6.5-3.1M8 19H2v-1a4 4 0 0 1 6.5-3.1m0 0a4 4 0 1 1 7 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            <h3 className="text-lg font-bold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              No Circles Found
            </h3>
            <p className="text-sm text-[#74817D] mt-1 max-w-sm mx-auto">
              {activeTab === 'my'
                ? "You haven't joined any specialty circles yet. Explore and join a circle below!"
                : 'No circles matching your current specialty filter.'}
            </p>
            {activeTab === 'my' && (
              <button
                onClick={() => setActiveTab('all')}
                className="mt-4 px-4 py-2 rounded-full bg-[#0B192C] text-white text-xs font-bold hover:bg-[#0B192C] transition-colors cursor-pointer"
              >
                Browse All Circles
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedCircles.map(circle => {
              const cId = circle.id || circle._id || '';
              const isMember = (circle.memberIds || []).includes(currentUserId);

              return (
                <div
                  key={cId}
                  className="flex flex-col justify-between rounded-lg border border-[#E1E7E5] bg-white p-6 transition-all hover:border-[#B8CFCB] hover:bg-[#F7F9F8]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="w-12 h-12 rounded-lg bg-[#F0F4F2] flex items-center justify-center text-2xl">
                        <span className="text-sm font-bold text-[#35564E]">{circle.specialty.slice(0, 2).toUpperCase()}</span>
                      </div>
                      <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#E8F0EC] text-[#35564E]">
                        {circle.specialty}
                      </span>
                    </div>

                    <h3
                      className="font-bold text-[#0B192C] text-lg mb-2 cursor-pointer hover:text-[#52796F] transition-colors"
                      style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                      onClick={() => handleOpenCircle(circle)}
                    >
                      {circle.name}
                    </h3>

                    <p className="text-xs text-[#52616C] leading-relaxed line-clamp-3 mb-5">
                      {circle.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#E1E7E5] flex items-center justify-between">
                    <div className="text-xs text-[#74817D]">
                      <span className="font-bold text-[#0B192C]">{circle.membersCount}</span> members ·{' '}
                      <span className="font-semibold text-[#0B192C]">{circle.postsCount}</span> discussions
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleJoin(cId, isMember)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                          isMember
                            ? 'bg-[#F0F4F2] text-[#52616C] hover:bg-[#FDEEEB] hover:text-[#C04A36]'
                            : 'bg-[#0B192C] text-white hover:bg-[#0B192C]'
                        }`}
                      >
                        {isMember ? 'Joined ✓' : '+ Join'}
                      </button>

                      <button
                        onClick={() => handleOpenCircle(circle)}
                        className="text-xs font-bold px-3 py-1.5 rounded-full border border-[#52796F] text-[#52796F] hover:bg-[#E8F0EC] transition-colors cursor-pointer"
                      >
                        Feed →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Circle Discussion Feed Drawer / Modal */}
      {selectedCircle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] shadow-2xl max-w-3xl w-full p-6 sm:p-8 my-8 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#E1E7E5] mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#E8F0EC] text-xs font-bold text-[#35564E]">{selectedCircle.specialty.slice(0, 2).toUpperCase()}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-bold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                      {selectedCircle.name}
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F0EC] text-[#35564E]">
                      {selectedCircle.specialty}
                    </span>
                  </div>
                  <p className="text-xs text-[#74817D] mt-0.5">
                    {selectedCircle.membersCount} peers sharing clinical knowledge
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleJoin(selectedCircle.id || selectedCircle._id || '', (selectedCircle.memberIds || []).includes(currentUserId))}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full cursor-pointer ${
                    (selectedCircle.memberIds || []).includes(currentUserId)
                      ? 'bg-[#F0F4F2] text-[#52616C]'
                      : 'bg-[#0B192C] text-white hover:bg-[#0B192C]'
                  }`}
                >
                  {(selectedCircle.memberIds || []).includes(currentUserId) ? 'Joined ✓' : 'Join Circle'}
                </button>
                <button
                  onClick={() => setSelectedCircle(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#74817D] hover:bg-[#F0F4F2] hover:text-[#0B192C] transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable Feed */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-4">
              {/* Group Description Notice */}
              <div className="p-3.5 rounded-lg bg-[#F7F9F8]/60 border border-[#E1E7E5] text-xs text-[#52616C] leading-relaxed">
                {selectedCircle.description}
              </div>

              {/* Feed Posts */}
              {loadingCircleDetail ? (
                <div className="text-center py-8 text-xs text-[#74817D]">
                  <div className="animate-spin w-6 h-6 border-2 border-[#52796F] border-t-transparent rounded-full mx-auto mb-2" />
                  Loading circle discussions…
                </div>
              ) : !selectedCircle.posts || selectedCircle.posts.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#74817D]">
                  No discussions in this circle yet. Start the conversation with your peers below!
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedCircle.posts.map(p => {
                    const postId = p.id || p._id || '';
                    return (
                      <div key={postId} className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#0B192C] text-white flex items-center justify-center text-[10px] font-bold">
                              {p.initials || 'DR'}
                            </div>
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-bold text-[#0B192C]">{p.author}</span>
                                {p.verified && (
                                  <svg className="w-3 h-3 text-[#52796F]" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <span className="text-[10px] text-[#74817D]">
                                {p.role === 'mentor' ? 'Verified mentor' : p.specialty || 'Resident'}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] text-[#74817D]">{p.timeAgo || 'Recently'}</span>
                        </div>

                        <p className="text-xs sm:text-sm text-[#0B192C] leading-relaxed whitespace-pre-line pl-9">
                          {p.content}
                        </p>

                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => handleLikePost(postId)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-[#74817D] hover:text-[#52796F] cursor-pointer"
                          >
                            <span>👍 Helpful ({p.likesCount || 0})</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Feed Post Composer */}
              <form onSubmit={handlePostSubmit} className="pt-4 border-t border-[#E1E7E5] space-y-2">
                <label className="block text-xs font-bold text-[#0B192C]">
                  Post to {selectedCircle.name}
                </label>
                <textarea
                  rows={3}
                  value={newPostContent}
                  onChange={e => setNewPostContent(e.target.value)}
                  placeholder="Share a clinical case, question, or pearl with circle members…"
                  className="w-full p-3 text-xs sm:text-sm bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] text-[#0B192C] placeholder-[#74817D] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={posting || !newPostContent.trim()}
                    className="px-5 py-2 rounded-full bg-[#0B192C] text-white text-xs font-bold hover:bg-[#0B192C] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {posting ? 'Posting…' : 'Share with Circle'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Circle Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] shadow-2xl max-w-lg w-full p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#E1E7E5] mb-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#52796F]">
                  New Community Hub
                </span>
                <h2 className="text-2xl font-bold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  Create Specialty Circle
                </h2>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#74817D] hover:bg-[#F0F4F2] hover:text-[#0B192C] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 rounded-lg bg-[#FDEEEB] border border-[#C04A36]/30 text-xs font-semibold text-[#C04A36]">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1.5">Specialty</label>
                <select
                  value={newSpecialty}
                  onChange={e => { const specialty = e.target.value; setNewSpecialty(specialty); setNewIcon(specialty.slice(0, 2).toUpperCase()); }}
                  className="w-full p-3 text-xs bg-[#F0F4F2] rounded-lg border border-[#E1E7E5] text-[#0B192C] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20"
                >
                  {SPECIALTIES.filter(s => s !== 'All').map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 border border-[#E1E7E5] bg-[#F7F9F8] p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0B192C] text-xs font-bold text-white">{newIcon}</span>
                <p className="text-xs leading-5 text-[#52616C]">The group mark follows the selected specialty.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1.5">Circle Name</label>
                <input
                  type="text"
                  placeholder="e.g. Interventional Cardiology Study Group"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full p-3 text-xs sm:text-sm bg-[#F0F4F2] rounded-lg border border-[#E1E7E5] text-[#0B192C] placeholder-[#74817D] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1.5">Description & Purpose</label>
                <textarea
                  rows={4}
                  placeholder="Describe the clinical focus, target audience, and types of cases to discuss…"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className="w-full p-3 text-xs sm:text-sm bg-[#F0F4F2] rounded-lg border border-[#E1E7E5] text-[#0B192C] placeholder-[#74817D] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20 focus:bg-white"
                />
              </div>

              <div className="pt-4 border-t border-[#E1E7E5] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-bold text-[#52616C] hover:bg-[#F0F4F2] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2.5 rounded-full bg-[#0B192C] text-white text-xs font-bold hover:bg-[#192B40] shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {creating ? 'Creating…' : 'Create Circle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
