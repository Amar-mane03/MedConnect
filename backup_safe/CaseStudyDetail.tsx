import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import type { Page } from '../App';
import API from '../api';
import { useAuth } from '../context/AuthContext';

interface Props {
  navigate: (p: Page, meta?: any) => void;
  caseId?: string | null;
  onSelectMentor?: (id: string) => void;
}

interface CommentData {
  _id: string;
  author: string;
  role: string;
  verified?: boolean;
  text: string;
  likes: number;
  initials?: string;
  timeAgo?: string;
  likedUsers?: string[];
}

interface CaseFullData {
  _id: string;
  id?: string;
  title: string;
  specialty: string;
  subspecialty?: string;
  ageRange: string;
  sex: string;
  presentingComplaint: string;
  history: string;
  investigations: string;
  diagnosis: string;
  treatment: string;
  outcome: string;
  learningPoints: string[];
  author: string;
  authorId?: string;
  role: string;
  verified?: boolean;
  upvotes: number;
  upvotedUsers?: string[];
  comments: CommentData[];
  timeAgo?: string;
}

export default function CaseStudyDetailPage({ navigate, caseId, onSelectMentor }: Props) {
  const { user } = useAuth();
  const [caseData, setCaseData] = useState<CaseFullData | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isUpvoted, setIsUpvoted] = useState(false);
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());

  const myId = user?._id || user?.id;

  const loadCase = async () => {
    setLoading(true);
    try {
      let targetId = caseId;
      if (!targetId) {
        // Grab the first available case from the database
        const feedRes = await API.get('/cases');
        if (feedRes.data?.cases?.length > 0) {
          targetId = feedRes.data.cases[0].id || feedRes.data.cases[0]._id;
        }
      }

      if (targetId) {
        const res = await API.get(`/cases/${targetId}`);
        if (res.data) {
          const caseObj = res.data.case || res.data;
          const commentsArr = res.data.comments || caseObj.comments || [];
          const combined = { ...caseObj, comments: commentsArr };
          setCaseData(combined);
          if (myId && combined.upvotedUsers?.includes(myId)) {
            setIsUpvoted(true);
          }
          if (myId && commentsArr) {
            const liked = new Set<string>();
            commentsArr.forEach((c: any) => {
              if (c.likedUsers?.includes(myId)) {
                liked.add(c._id || c.id);
              }
            });
            setLikedCommentIds(liked);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load case detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const handleUpvote = async () => {
    if (!caseData) return;
    try {
      const res = await API.post(`/cases/${caseData._id}/upvote`);
      if (res.data) {
        setCaseData({ ...caseData, upvotes: res.data.upvotes });
        setIsUpvoted(res.data.isUpvoted);
      }
    } catch (err) {
      console.error('Failed to upvote case:', err);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!caseData) return;
    try {
      const res = await API.post(`/cases/${caseData._id}/comments/${commentId}/like`);
      if (res.data) {
        setCaseData({
          ...caseData,
          comments: caseData.comments.map(c =>
            c._id === commentId ? { ...c, likes: res.data.likes } : c
          ),
        });
        setLikedCommentIds(prev => {
          const next = new Set(prev);
          if (res.data.isLiked) next.add(commentId);
          else next.delete(commentId);
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to like comment:', err);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || !caseData) return;
    setSubmittingComment(true);
    try {
      const res = await API.post(`/cases/${caseData._id}/comments`, {
        text: commentText.trim(),
      });
      if (res.data?.comment) {
        setCaseData({
          ...caseData,
          comments: [...caseData.comments, res.data.comment],
        });
        setCommentText('');
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <Layout navigate={navigate} currentPage="dashboard">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="w-10 h-10 border-3 border-[#D86F52] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-[#183D3A]">Loading clinical case study…</p>
        </div>
      </Layout>
    );
  }

  if (!caseData) {
    return (
      <Layout navigate={navigate} currentPage="dashboard">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h2 className="text-xl font-bold text-[#183D3A] mb-2" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
            Case Study Not Found
          </h2>
          <p className="text-xs text-[#596965] mb-6">The requested clinical case could not be retrieved.</p>
          <button
            onClick={() => navigate('dashboard')}
            className="px-5 py-2.5 bg-[#D86F52] text-white text-xs font-bold rounded-full hover:bg-[#B9543D]"
          >
            ← Back to Feed
          </button>
        </div>
      </Layout>
    );
  }

  const authorInitials = caseData.author
    ? caseData.author.split(' ').map(w => w[0]).join('').slice(0, 2)
    : 'DR';

  const userInitials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2)
    : 'ME';

  return (
    <Layout navigate={navigate} currentPage="dashboard">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Back navigation button */}
        <button
          onClick={() => navigate('dashboard')}
          className="flex items-center gap-2 text-sm text-[#596965] hover:text-[#D86F52] transition-colors mb-6 font-semibold cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Clinical Feed
        </button>

        {/* Case Header Card */}
        <div className="bg-[#FFFCF8] rounded-2xl border border-[#D8D2C8] p-6 sm:p-8 mb-6 shadow-xs">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="text-xs font-bold bg-[#FBE5DC] text-[#B9543D] px-3 py-1 rounded-full">
              {caseData.specialty}
            </span>
            {caseData.subspecialty && (
              <span className="text-xs font-semibold text-[#71807C]">· {caseData.subspecialty}</span>
            )}
          </div>

          <h1
            className="text-2xl sm:text-4xl font-semibold text-[#183D3A] leading-tight mb-6"
            style={{ fontFamily: 'Fraunces, Georgia, serif' }}
          >
            {caseData.title}
          </h1>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#EAE5DC]">
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => {
                if (caseData.authorId) {
                  if (onSelectMentor) onSelectMentor(caseData.authorId);
                  else navigate('mentor-profile', { mentorId: caseData.authorId });
                }
              }}
            >
              <div className="w-11 h-11 rounded-full bg-[#183D3A] flex items-center justify-center text-white text-sm font-bold shadow-xs group-hover:ring-2 group-hover:ring-[#D86F52]/50 transition-all">
                {authorInitials}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-[#183D3A] group-hover:text-[#D86F52] transition-colors">
                    {caseData.author}
                  </span>
                  {caseData.verified && (
                    <svg className="w-4 h-4 text-[#D86F52]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-[#71807C]">{caseData.role} · {caseData.timeAgo || 'Recent'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold">
              <button
                onClick={handleUpvote}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                  isUpvoted
                    ? 'bg-[#D86F52] text-white shadow-xs'
                    : 'bg-[#FBE5DC] text-[#B9543D] hover:bg-[#F6D5C8]'
                }`}
              >
                <span>↑</span> {caseData.upvotes} Upvotes
              </button>
              <span className="bg-[#F1EEE8] text-[#183D3A] px-3 py-1.5 rounded-full">
                {caseData.comments?.length || 0} comments
              </span>
            </div>
          </div>
        </div>

        {/* Case Details Table */}
        <div className="bg-[#FFFCF8] rounded-2xl border border-[#D8D2C8] overflow-hidden mb-6 shadow-xs">
          <div className="px-6 py-4 border-b border-[#D8D2C8] bg-[#F1EEE8]">
            <h2 className="font-bold text-[#183D3A] text-base" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
              Clinical History & Investigations
            </h2>
          </div>

          <div className="divide-y divide-[#EAE5DC]">
            {[
              { label: 'Patient Demographics', value: `${caseData.ageRange || 'Adult'} · ${caseData.sex || 'Not specified'}` },
              { label: 'Presenting Complaint', value: caseData.presentingComplaint },
              { label: 'History & Risk Factors', value: caseData.history || 'No prior risk factors noted.' },
              { label: 'Investigations & Findings', value: caseData.investigations || 'Pending formal review.' },
            ].map(({ label, value }) => (
              <div key={label} className="px-6 py-4.5 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 hover:bg-[#FBF9F5] transition-colors">
                <div className="text-xs font-bold text-[#71807C] uppercase tracking-wider col-span-1">{label}</div>
                <div className="text-sm text-[#183D3A] leading-relaxed col-span-2 font-medium">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Diagnosis, Treatment, Outcome */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Diagnosis', value: caseData.diagnosis, topColor: 'border-t-[#D86F52]', tagColor: 'bg-[#FBE5DC] text-[#B9543D]' },
            { label: 'Treatment', value: caseData.treatment || 'Conservative management.', topColor: 'border-t-[#C27D38]', tagColor: 'bg-[#FAF0E6] text-[#C27D38]' },
            { label: 'Outcome', value: caseData.outcome || 'Patient stable upon discharge.', topColor: 'border-t-[#2E7D5A]', tagColor: 'bg-[#E4EAE3] text-[#2E7D5A]' },
          ].map(({ label, value, topColor, tagColor }) => (
            <div key={label} className={`bg-[#FFFCF8] rounded-2xl border border-[#D8D2C8] border-t-4 ${topColor} p-5 shadow-xs flex flex-col justify-between`}>
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mb-3 ${tagColor}`}>
                  {label}
                </span>
                <p className="text-xs sm:text-sm text-[#183D3A] leading-relaxed font-medium">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Learning Points Box */}
        {caseData.learningPoints && caseData.learningPoints.length > 0 && (
          <div className="bg-[#E4EAE3] border border-[#C8D6C7] rounded-2xl p-6 mb-8 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">💡</span>
              <h3 className="text-base font-bold text-[#183D3A]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                Key Clinical Takeaways
              </h3>
            </div>
            <ul className="space-y-3">
              {caseData.learningPoints.map((pt, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-[#183D3A]">
                  <span className="w-5 h-5 rounded-full bg-[#183D3A] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="font-medium leading-relaxed">{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Discussion / Comments Section */}
        <div className="bg-[#FFFCF8] rounded-2xl border border-[#D8D2C8] overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-[#D8D2C8] bg-[#F1EEE8] flex items-center justify-between">
            <h2 className="font-bold text-[#183D3A] text-base" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
              Peer Discussion ({caseData.comments?.length || 0})
            </h2>
            <span className="text-xs text-[#71807C]">Verified clinical exchange</span>
          </div>

          <div className="divide-y divide-[#EAE5DC]">
            {caseData.comments && caseData.comments.length > 0 ? (
              caseData.comments.map(c => {
                const commentId = c._id;
                const isLiked = likedCommentIds.has(commentId);
                const initials = c.author ? c.author.split(' ').map(w => w[0]).join('').slice(0, 2) : 'DR';
                return (
                  <div key={commentId} className="px-6 py-5 hover:bg-[#FBF9F5] transition-colors">
                    <div className="flex items-start gap-3.5">
                      <div className="w-9 h-9 rounded-full bg-[#183D3A] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span className="text-sm font-bold text-[#183D3A]">{c.author}</span>
                          {c.verified && (
                            <svg className="w-3.5 h-3.5 text-[#D86F52]" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span className="text-xs text-[#71807C]">· {c.role} · {c.timeAgo || 'Recent'}</span>
                        </div>

                        <p className="text-sm text-[#42524E] leading-relaxed mb-3">{c.text}</p>

                        <button
                          onClick={() => handleLikeComment(commentId)}
                          className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                            isLiked ? 'text-[#D86F52]' : 'text-[#71807C] hover:text-[#D86F52]'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                          </svg>
                          {c.likes} Helpful
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-[#71807C]">
                No comments yet. Start the clinical discussion below!
              </div>
            )}
          </div>

          {/* Comment Composer */}
          <div className="px-6 py-4.5 border-t border-[#D8D2C8] bg-[#F1EEE8]/70">
            <div className="flex gap-3 items-start">
              <div className="w-9 h-9 rounded-full bg-[#183D3A] flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                {userInitials}
              </div>
              <div className="flex-1">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Contribute your clinical insight, question or differential…"
                  rows={2}
                  className="w-full px-4 py-2.5 text-sm bg-white text-[#183D3A] rounded-xl border border-[#D8D2C8] focus:border-[#D86F52] focus:outline-none focus:ring-2 focus:ring-[#D86F52]/15 transition-all resize-none placeholder-[#71807C]"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handlePostComment}
                    disabled={submittingComment || !commentText.trim()}
                    className="px-5 py-2 bg-[#D86F52] hover:bg-[#B9543D] text-white text-xs font-bold rounded-full transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {submittingComment ? 'Posting…' : 'Post Comment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
