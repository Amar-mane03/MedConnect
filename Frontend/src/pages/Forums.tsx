import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import type { Page } from '../App';
import API, { SOCKET_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { io, Socket } from 'socket.io-client';

interface ForumsProps {
  navigate: (page: Page, meta?: any) => void;
}

interface ReplyItem {
  id?: string;
  _id?: string;
  author: string;
  authorId?: string;
  role: string;
  specialty?: string;
  verified?: boolean;
  initials?: string;
  content: string;
  likes: number;
  likedUsers?: string[];
  timeAgo?: string;
  createdAt?: string;
}

interface ForumThread {
  id?: string;
  _id?: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  authorId?: string;
  role: string;
  specialty?: string;
  verified?: boolean;
  initials?: string;
  upvotes: number;
  upvotedUsers?: string[];
  repliesCount: number;
  isPinned?: boolean;
  timeAgo?: string;
  createdAt?: string;
  replies?: ReplyItem[];
}

const CATEGORIES = [
  'All',
  'Career Guidance',
  'Exam Prep',
  'General Clinical',
  'Research & Academic',
  'Work-Life & Wellbeing',
];

const categoryPillColors: Record<string, string> = {
  'Career Guidance': 'bg-[#E8F0EC] text-[#35564E] border-[#52796F]/30',
  'Exam Prep': 'bg-[#F0F4F2] text-[#52616C] border-[#52616C]/30',
  'General Clinical': 'bg-[#F0F4F2] text-[#52616C] border-[#52616C]/30',
  'Research & Academic': 'bg-[#FAF0E6] text-[#C27D38] border-[#C27D38]/30',
  'Work-Life & Wellbeing': 'bg-[#EFF4F1] text-[#3D7A68] border-[#3D7A68]/30',
};

export default function ForumsPage({ navigate }: ForumsProps) {
  const { user, role } = useAuth();
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');

  // Track upvoted threads and liked replies in local component state for instant snappy UI
  const [upvotedThreads, setUpvotedThreads] = useState<Set<string>>(new Set());
  const [likedReplies, setLikedReplies] = useState<Set<string>>(new Set());

  // Modal / Thread Detail State
  const [activeThread, setActiveThread] = useState<ForumThread | null>(null);
  const [loadingThreadDetail, setLoadingThreadDetail] = useState(false);
  const [newReplyContent, setNewReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // New Thread Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Career Guidance');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [submittingThread, setSubmittingThread] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Socket instance for real-time live events
  useEffect(() => {
    let socket: Socket | null = null;
    try {
      socket = io(SOCKET_URL);

      socket.on('new_forum_post', (newPost: ForumThread) => {
        setThreads((prev) => {
          const exists = prev.some((p) => (p.id || p._id) === (newPost.id || newPost._id));
          if (exists) return prev;
          return [newPost, ...prev];
        });
      });

      socket.on('new_forum_reply', ({ postId, reply, repliesCount }: { postId: string; reply: ReplyItem; repliesCount: number }) => {
        setThreads((prev) =>
          prev.map((t) => {
            const tId = t.id || t._id;
            if (tId === postId) {
              return { ...t, repliesCount };
            }
            return t;
          })
        );

        setActiveThread((current) => {
          if (!current) return null;
          const currentId = current.id || current._id;
          if (currentId === postId) {
            const alreadyHasReply = (current.replies || []).some((r) => (r.id || r._id) === (reply.id || reply._id));
            if (alreadyHasReply) return current;
            return {
              ...current,
              repliesCount,
              replies: [...(current.replies || []), reply],
            };
          }
          return current;
        });
      });

      socket.on('forum_upvoted', ({ postId, upvotes }: { postId: string; upvotes: number }) => {
        setThreads((prev) =>
          prev.map((t) => {
            const tId = t.id || t._id;
            if (tId === postId) {
              return { ...t, upvotes };
            }
            return t;
          })
        );

        setActiveThread((current) => {
          if (!current) return null;
          const currentId = current.id || current._id;
          if (currentId === postId) {
            return { ...current, upvotes };
          }
          return current;
        });
      });
    } catch (e) {
      console.error('Socket connection error in Forums:', e);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  // Fetch threads from backend
  const fetchThreads = async () => {
    setLoading(true);
    try {
      const params: any = { sort: sortBy };
      if (activeCategory !== 'All') params.category = activeCategory;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await API.get('/forums', { params });
      if (res.data?.posts) {
        setThreads(res.data.posts);

        const currentUserId = user?._id || user?.id;
        if (currentUserId) {
          const upvoted = new Set<string>();
          res.data.posts.forEach((p: any) => {
            if (p.upvotedUsers?.includes(currentUserId)) {
              upvoted.add(p.id || p._id);
            }
          });
          setUpvotedThreads(upvoted);
        }
      }
    } catch (err) {
      console.error('Failed to load forum threads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [activeCategory, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchThreads();
  };

  // Open Thread Details
  const handleOpenThread = async (thread: ForumThread) => {
    const threadId = thread.id || thread._id;
    if (!threadId) return;

    setLoadingThreadDetail(true);
    setActiveThread(thread);

    try {
      const res = await API.get(`/forums/${threadId}`);
      if (res.data?.post) {
        setActiveThread(res.data.post);

        const currentUserId = user?._id || user?.id;
        if (currentUserId && res.data.post.replies) {
          const liked = new Set<string>();
          res.data.post.replies.forEach((r: any) => {
            if (r.likedUsers?.includes(currentUserId)) {
              liked.add(r.id || r._id);
            }
          });
          setLikedReplies(liked);
        }
      }
    } catch (err) {
      console.error('Failed to load thread details:', err);
    } finally {
      setLoadingThreadDetail(false);
    }
  };

  // Toggle Upvote on Thread
  const handleToggleUpvote = async (threadId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await API.post(`/forums/${threadId}/upvote`);
      if (res.data) {
        const { isUpvoted, upvotes } = res.data;

        setUpvotedThreads((prev) => {
          const updated = new Set(prev);
          if (isUpvoted) updated.add(threadId);
          else updated.delete(threadId);
          return updated;
        });

        setThreads((prev) =>
          prev.map((t) => {
            const id = t.id || t._id;
            if (id === threadId) {
              return { ...t, upvotes };
            }
            return t;
          })
        );

        if (activeThread && (activeThread.id === threadId || activeThread._id === threadId)) {
          setActiveThread({ ...activeThread, upvotes });
        }
      }
    } catch (err) {
      console.error('Failed to toggle upvote:', err);
    }
  };

  // Toggle Like on Reply
  const handleToggleReplyLike = async (replyId: string) => {
    if (!activeThread) return;
    const threadId = activeThread.id || activeThread._id;
    if (!threadId) return;

    try {
      const res = await API.post(`/forums/${threadId}/reply/${replyId}/like`);
      if (res.data) {
        const { isLiked, likes } = res.data;

        setLikedReplies((prev) => {
          const updated = new Set(prev);
          if (isLiked) updated.add(replyId);
          else updated.delete(replyId);
          return updated;
        });

        setActiveThread((current) => {
          if (!current || !current.replies) return current;
          return {
            ...current,
            replies: current.replies.map((r) => {
              const rId = r.id || r._id;
              if (rId === replyId) {
                return { ...r, likes };
              }
              return r;
            }),
          };
        });
      }
    } catch (err) {
      console.error('Failed to like reply:', err);
    }
  };

  // Submit New Reply
  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReplyContent.trim() || !activeThread) return;
    const threadId = activeThread.id || activeThread._id;
    if (!threadId) return;

    setSubmittingReply(true);
    try {
      const res = await API.post(`/forums/${threadId}/reply`, {
        content: newReplyContent.trim(),
      });
      if (res.data?.reply) {
        const addedReply = res.data.reply;
        setActiveThread((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            repliesCount: res.data.repliesCount || (prev.replies?.length || 0) + 1,
            replies: [...(prev.replies || []), addedReply],
          };
        });
        setNewReplyContent('');
      }
    } catch (err: any) {
      console.error('Failed to submit reply:', err);
      alert(err.response?.data?.message || 'Unable to post reply. Please sign in.');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Submit New Thread
  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setErrorMessage('Please provide a descriptive title for your discussion.');
      return;
    }
    if (!newContent.trim()) {
      setErrorMessage('Please include your question or discussion context.');
      return;
    }

    setSubmittingThread(true);
    setErrorMessage(null);

    try {
      const res = await API.post('/forums', {
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory,
        tags: newTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });

      if (res.data?.post) {
        setThreads((prev) => [res.data.post, ...prev]);
        setCreateModalOpen(false);
        setNewTitle('');
        setNewContent('');
        setNewTags('');
        setNewCategory('Career Guidance');
      }
    } catch (err: any) {
      console.error('Failed to publish discussion thread:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to create discussion thread. Please ensure you are logged in.');
    } finally {
      setSubmittingThread(false);
    }
  };

  return (
    <Layout navigate={navigate} currentPage="forums">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header Hero Banner */}
        <div className="mb-8 flex flex-col gap-4 rounded-lg border border-[#E1E7E5] bg-white p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#E8F0EC] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#35564E]">
              Clinician discussions
            </div>
            <h1 className="text-2xl font-bold text-[#0B192C] sm:text-3xl lg:text-4xl" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Discussion Forums
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#52616C] sm:text-base">
              Engage in open peer dialogue on career transitions, exam prep, clinical dilemmas, and clinician wellbeing.
            </p>
          </div>
          <button onClick={() => setCreateModalOpen(true)} className="self-start rounded-lg bg-[#0B192C] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#192B40] md:self-center">
            Start new discussion
          </button>
        </div>

        {/* Filter Bar & Search */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between mb-6">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#0B192C] text-white shadow-xs'
                      : 'bg-[#FFFFFF] text-[#52616C] border border-[#E1E7E5] hover:bg-[#F0F4F2] hover:text-[#0B192C]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-3 shrink-0">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder="Search threads or tags…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 text-xs font-semibold bg-[#FFFFFF] border border-[#E1E7E5] rounded-full text-[#0B192C] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="popular">Most Upvoted</option>
            </select>
          </div>
        </div>

        {/* Main Grid: Thread List + Community Guidelines Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Thread List Column */}
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-12 text-center text-[#74817D]">
                <div className="animate-spin w-8 h-8 border-3 border-[#52796F] border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm font-semibold">Loading discussions…</p>
              </div>
            ) : threads.length === 0 ? (
              <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-12 text-center">
                <svg className="mx-auto mb-3 h-8 w-8 text-[#52796F]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5h16v12H9l-5 4V5Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9h8M8 13h5" />
                </svg>
                <h3 className="text-lg font-bold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  No Discussions Found
                </h3>
                <p className="text-sm text-[#74817D] mt-1 max-w-sm mx-auto">
                  {searchQuery
                    ? `No discussions matching "${searchQuery}". Try different keywords or select All.`
                    : 'Be the first clinician to spark a conversation in this topic!'}
                </p>
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="mt-5 px-5 py-2.5 rounded-full bg-[#0B192C] text-white text-xs font-bold hover:bg-[#192B40] transition-colors cursor-pointer"
                >
                  Start Discussion
                </button>
              </div>
            ) : (
              threads.map((thread) => {
                const threadId = thread.id || thread._id || '';
                const isUpvoted = upvotedThreads.has(threadId);

                return (
                  <div
                    key={threadId}
                    onClick={() => handleOpenThread(thread)}
                    className="group relative cursor-pointer rounded-lg border border-[#E1E7E5] bg-white p-5 transition-all hover:border-[#B8CFCB] hover:bg-[#F7F9F8] sm:p-6"
                  >
                    {/* Top Row: Category Pill & Pinned badge */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        {thread.isPinned && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FDEEEB] text-[#C04A36]">
                            📌 Pinned
                          </span>
                        )}
                        <span
                          className={`text-[11px] font-bold px-3 py-0.5 rounded-full border ${
                            categoryPillColors[thread.category] || 'bg-[#F0F4F2] text-[#52616C] border-[#E1E7E5]'
                          }`}
                        >
                          {thread.category}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-[#74817D]">{thread.timeAgo || 'Date unavailable'}</span>
                    </div>

                    {/* Title */}
                    <h3
                      className="font-bold text-[#0B192C] text-lg sm:text-xl leading-snug mb-2 group-hover:text-[#52796F] transition-colors"
                      style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                    >
                      {thread.title}
                    </h3>

                    {/* Excerpt */}
                    <p className="text-xs sm:text-sm text-[#52616C] leading-relaxed line-clamp-2 mb-4">
                      {thread.content}
                    </p>

                    {/* Tags */}
                    {thread.tags && thread.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {thread.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[11px] px-2.5 py-0.5 rounded-md bg-[#F0F4F2] text-[#52616C] font-medium"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer: Author Info + Upvote/Reply Counters */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#E1E7E5]">
                      {/* Author */}
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#0B192C] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                          {thread.initials || '—'}
                        </div>
                        <div className="leading-tight">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[#0B192C]">{thread.author}</span>
                            {thread.verified && (
                              <span title="Verified Clinician">
                                <svg className="w-3.5 h-3.5 text-[#52796F]" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[#74817D]">
                            {thread.role === 'mentor' ? 'Verified mentor' : thread.specialty || 'Resident'}
                          </span>
                        </div>
                      </div>

                      {/* Upvotes & Replies */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleToggleUpvote(threadId, e)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                            isUpvoted
                              ? 'bg-[#E8F0EC] text-[#52796F] border border-[#52796F]/40'
                              : 'text-[#74817D] hover:bg-[#F0F4F2] hover:text-[#52796F]'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill={isUpvoted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          <span>{thread.upvotes}</span>
                        </button>

                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-[#74817D]">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span>{thread.repliesCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Rail: Community Norms & Quick Pathways */}
          <div className="space-y-6">
            {/* Clinical Governance Notice */}
            <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <svg className="h-5 w-5 shrink-0 text-[#52796F]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3Z" />
                </svg>
                <h3 className="font-bold text-[#0B192C] text-base" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  Peer Discussion Standards
                </h3>
              </div>
              <ul className="text-xs text-[#52616C] space-y-2.5 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-[#52796F] font-bold">•</span>
                  <span><strong>Zero Identifiers:</strong> Do not include real patient names, NHS numbers, or identifiable clinical vignettes in forums. Use the Case Study feed for anonymized clinical records.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#52796F] font-bold">•</span>
                  <span><strong>Collegial & Evidence-Based:</strong> Back guidance with clinical guidelines (e.g. NICE, ESC, ACC/AHA) where relevant.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#52796F] font-bold">•</span>
                  <span><strong>Safe Space for Trainees:</strong> Junior residents and students can openly inquire without fear of judgement.</span>
                </li>
              </ul>
            </div>

            {/* Specialty Examination Prep Highlight */}
            <div className="rounded-lg bg-[#0B192C] text-white p-6 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-[#E8F0EC]">Exam Guidance</span>
              <h4 className="text-lg font-bold mt-1 mb-2" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                MRCP & Specialty Training
              </h4>
              <p className="text-xs text-white/80 leading-relaxed mb-4">
                Preparing for Part 1, Part 2, or PACES? Senior registrars and consultants regularly review mock cases and question banks here.
              </p>
              <button
                onClick={() => setActiveCategory('Exam Prep')}
                className="w-full py-2 bg-white text-[#0B192C] rounded-full text-xs font-bold hover:bg-[#E8F0EC] transition-colors cursor-pointer"
              >
                View Exam Prep Threads →
              </button>
            </div>

            {/* Quick Navigation Card */}
            <div className="rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] p-6 shadow-xs">
              <h3 className="font-bold text-[#0B192C] text-base mb-4" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                MedConnect Features
              </h3>
              <div className="space-y-2.5">
                <button
                  onClick={() => navigate('dashboard')}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-[#F0F4F2]/60 hover:bg-[#F0F4F2] text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div>
                      <div className="text-xs font-bold text-[#0B192C]">Clinical Case Feed</div>
                      <div className="text-[11px] text-[#74817D]">Structured diagnostic cases</div>
                    </div>
                  </div>
                  <span className="text-xs text-[#52796F] font-bold">→</span>
                </button>

                <button
                  onClick={() => navigate('mentor-profile')}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-[#F0F4F2]/60 hover:bg-[#F0F4F2] text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div>
                      <div className="text-xs font-bold text-[#0B192C]">Mentor Directory</div>
                      <div className="text-[11px] text-[#74817D]">Connect 1-on-1 with consultants</div>
                    </div>
                  </div>
                  <span className="text-xs text-[#52796F] font-bold">→</span>
                </button>

                <button
                  onClick={() => navigate('messages')}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-[#F0F4F2]/60 hover:bg-[#F0F4F2] text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div>
                      <div className="text-xs font-bold text-[#0B192C]">Private Messages</div>
                      <div className="text-[11px] text-[#74817D]">Direct mentorship chat</div>
                    </div>
                  </div>
                  <span className="text-xs text-[#52796F] font-bold">→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== VIEW THREAD DETAIL MODAL ===================== */}
      {activeThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] shadow-2xl max-w-3xl w-full p-6 sm:p-8 my-8 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#E1E7E5] mb-4 shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[11px] font-bold px-3 py-0.5 rounded-full border ${
                    categoryPillColors[activeThread.category] || 'bg-[#F0F4F2] text-[#52616C] border-[#E1E7E5]'
                  }`}
                >
                  {activeThread.category}
                </span>
                            <span className="text-xs text-[#74817D]">{activeThread.timeAgo || 'Date unavailable'}</span>
              </div>
              <button
                onClick={() => setActiveThread(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#74817D] hover:bg-[#F0F4F2] hover:text-[#0B192C] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-6">
              {/* Thread Title & Author */}
              <div>
                <h2
                  className="text-2xl sm:text-3xl font-bold text-[#0B192C] leading-tight mb-4"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                >
                  {activeThread.title}
                </h2>

                <div className="flex items-center justify-between pb-4 border-b border-[#E1E7E5]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#0B192C] text-white flex items-center justify-center text-xs font-bold">
                      {activeThread.initials || '—'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-[#0B192C]">{activeThread.author}</span>
                        {activeThread.verified && (
                          <span title="Verified Clinician">
                            <svg className="w-4 h-4 text-[#52796F]" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[#74817D]">
                        {activeThread.role === 'mentor' ? 'Verified mentor' : activeThread.specialty || 'Resident'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleUpvote(activeThread.id || activeThread._id || '')}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      upvotedThreads.has(activeThread.id || activeThread._id || '')
                        ? 'bg-[#E8F0EC] text-[#52796F] border border-[#52796F]/40'
                        : 'bg-[#F0F4F2] text-[#52616C] hover:bg-[#E8F0EC] hover:text-[#52796F]'
                    }`}
                  >
                    <svg className="w-4 h-4" fill={upvotedThreads.has(activeThread.id || activeThread._id || '') ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    <span>Helpful ({activeThread.upvotes})</span>
                  </button>
                </div>
              </div>

              {/* Full Content */}
              <div className="prose max-w-none text-[#0B192C] text-sm leading-relaxed whitespace-pre-line bg-[#F7F9F8]/50 p-5 rounded-lg border border-[#E1E7E5]">
                {activeThread.content}
              </div>

              {/* Tags */}
              {activeThread.tags && activeThread.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeThread.tags.map((tag) => (
                    <span key={tag} className="text-xs px-3 py-1 rounded-lg bg-[#F0F4F2] text-[#52616C] font-semibold">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Replies Section */}
              <div className="pt-4 border-t border-[#E1E7E5]">
                <h4 className="font-bold text-[#0B192C] text-lg mb-4" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  Peer Responses ({activeThread.replies?.length || 0})
                </h4>

                {loadingThreadDetail ? (
                  <div className="text-center py-6 text-xs text-[#74817D]">
                    <div className="animate-spin w-5 h-5 border-2 border-[#52796F] border-t-transparent rounded-full mx-auto mb-2" />
                    Loading responses…
                  </div>
                ) : !activeThread.replies || activeThread.replies.length === 0 ? (
                  <div className="p-6 rounded-lg bg-[#F7F9F8]/50 text-center text-xs text-[#74817D]">
                    No responses yet. Share your experience or clinical perspective below.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeThread.replies.map((reply) => {
                      const replyId = reply.id || reply._id || '';
                      const isLiked = likedReplies.has(replyId);

                      return (
                        <div key={replyId} className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E1E7E5] shadow-2xs">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-[#0B192C] text-white flex items-center justify-center text-[10px] font-bold">
                                {reply.initials || '—'}
                              </div>
                              <div>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-bold text-[#0B192C]">{reply.author}</span>
                                  {reply.verified && (
                                    <span title="Verified Clinician">
                                      <svg className="w-3 h-3 text-[#52796F]" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-[#74817D]">
                                  {reply.role === 'mentor' ? 'Verified mentor' : reply.specialty || 'Resident'}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] text-[#74817D]">{reply.timeAgo || 'Date unavailable'}</span>
                          </div>

                          <p className="text-xs sm:text-sm text-[#0B192C] leading-relaxed whitespace-pre-line pl-9">
                            {reply.content}
                          </p>

                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => handleToggleReplyLike(replyId)}
                              className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
                                isLiked ? 'bg-[#E8F0EC] text-[#52796F]' : 'text-[#74817D] hover:bg-[#F0F4F2] hover:text-[#0B192C]'
                              }`}
                            >
                              <span>👍</span> Helpful ({reply.likes})
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reply Composer Form */}
              <form onSubmit={handleSubmitReply} className="pt-4 border-t border-[#E1E7E5] space-y-3">
                <label className="block text-xs font-bold text-[#0B192C]">
                  Post a Peer Reply
                </label>
                <textarea
                  rows={3}
                  value={newReplyContent}
                  onChange={(e) => setNewReplyContent(e.target.value)}
                  placeholder="Share constructive guidance, clinical pearls, or relevant experiences…"
                  className="w-full p-3 text-xs sm:text-sm bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] text-[#0B192C] placeholder-[#74817D] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20 focus:border-[#52796F]"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingReply || !newReplyContent.trim()}
                    className="px-5 py-2 rounded-full bg-[#0B192C] text-white text-xs font-bold hover:bg-[#0B192C] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {submittingReply ? 'Posting…' : 'Submit Reply'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===================== CREATE DISCUSSION MODAL ===================== */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] rounded-lg border border-[#E1E7E5] shadow-2xl max-w-2xl w-full p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#E1E7E5] mb-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#52796F]">
                  New Discussion Thread
                </span>
                <h2 className="text-2xl font-bold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  Ask or Share with Peers
                </h2>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#74817D] hover:bg-[#F0F4F2] hover:text-[#0B192C] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-[#FDEEEB] border border-[#C04A36]/30 text-xs font-semibold text-[#C04A36]">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateThread} className="space-y-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1.5">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full p-3 text-xs bg-[#F0F4F2] rounded-lg border border-[#E1E7E5] text-[#0B192C] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20"
                >
                  <option value="Career Guidance">Career Guidance</option>
                  <option value="Exam Prep">Exam Prep (MRCP, USMLE, Boards)</option>
                  <option value="General Clinical">General Clinical Questions</option>
                  <option value="Research & Academic">Research & Academic Publishing</option>
                  <option value="Work-Life & Wellbeing">Work-Life & Clinician Wellbeing</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1.5">
                  Discussion Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tips for balancing acute rota shifts with MRCP revision?"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-3 text-xs sm:text-sm bg-[#F0F4F2] rounded-lg border border-[#E1E7E5] text-[#0B192C] placeholder-[#74817D] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20 focus:bg-white"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1.5">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. MRCP, Internal Medicine, Revision"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full p-3 text-xs bg-[#F0F4F2] rounded-lg border border-[#E1E7E5] text-[#0B192C] placeholder-[#74817D] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20 focus:bg-white"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-bold text-[#0B192C] mb-1.5">
                  Discussion Content / Question
                </label>
                <textarea
                  rows={6}
                  placeholder="Explain the background, key decisions, or specific guidance you are seeking from senior colleagues…"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full p-3 text-xs sm:text-sm bg-[#F0F4F2] rounded-lg border border-[#E1E7E5] text-[#0B192C] placeholder-[#74817D] focus:outline-none focus:ring-2 focus:ring-[#52796F]/20 focus:bg-white leading-relaxed"
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
                  disabled={submittingThread}
                  className="px-6 py-2.5 rounded-full bg-[#0B192C] text-white text-xs font-bold hover:bg-[#192B40] shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submittingThread ? 'Publishing…' : 'Publish Thread'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
