import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Layout from '../components/Layout';
import type { Page } from '../App';
import API, { SOCKET_URL } from '../api';
import { useAuth } from '../context/AuthContext';

interface Props {
  navigate: (p: Page) => void;
}

interface Participant {
  _id: string;
  name: string;
  email: string;
  specialty?: string;
  role?: string;
}

interface ConversationItem {
  _id: string;
  participants: Participant[];
  lastMessage?: {
    content: string;
    createdAt: string;
  };
  otherUser?: Participant;
}

interface MessageItem {
  _id: string;
  conversationId: string;
  sender: Participant | string;
  content: string;
  createdAt: string;
  from?: 'me' | 'them';
}

export default function MessagesPage({ navigate }: Props) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingConv, setLoadingConv] = useState(true);
  const [availableMentors, setAvailableMentors] = useState<Participant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const myId = user?._id || user?.id;

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Connect Socket.io
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      auth: { token: localStorage.getItem('medconnect_token') },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      if (myId) {
        socket.emit('join_user', myId);
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('chat_message', (msg: MessageItem) => {
      if (msg.conversationId === activeConvId) {
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
      // Update conversations list last message
      setConversations(prev =>
        prev.map(c =>
          c._id === msg.conversationId
            ? { ...c, lastMessage: { content: msg.content, createdAt: msg.createdAt } }
            : c
        )
      );
    });

    socket.on('user_typing', (data: { isTyping: boolean }) => {
      setIsTyping(data.isTyping);
      setTimeout(() => setIsTyping(false), 3000);
    });

    return () => {
      socket.disconnect();
    };
  }, [activeConvId, myId]);

  // Fetch conversations and mentor contacts
  const fetchConversations = async () => {
    setLoadingConv(true);
    try {
      const [convRes, mentorsRes] = await Promise.all([
        API.get('/messages/conversations'),
        API.get('/mentors'),
      ]);

      if (convRes.data?.conversations) {
        const formatted = convRes.data.conversations.map((c: any) => {
          const other = c.participants.find((p: any) => (p._id || p.id) !== myId) || c.participants[0];
          return {
            ...c,
            otherUser: other,
          };
        });
        setConversations(formatted);
        if (formatted.length > 0 && !activeConvId) {
          setActiveConvId(formatted[0]._id);
        }
      }

      if (mentorsRes.data?.mentors) {
        setAvailableMentors(mentorsRes.data.mentors);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConv(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [myId]);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeConvId) return;

    if (socketRef.current) {
      socketRef.current.emit('join_conversation', activeConvId);
    }

    const fetchMessages = async () => {
      try {
        const res = await API.get(`/messages/conversations/${activeConvId}/messages`);
        if (res.data?.messages) {
          setMessages(res.data.messages);
        }
      } catch (err) {
        console.error('Failed to load messages for conversation:', err);
      }
    };

    fetchMessages();
  }, [activeConvId]);

  // Start new conversation with a mentor
  const startConversationWith = async (mentor: Participant) => {
    try {
      const res = await API.post('/messages/conversations', {
        recipientId: mentor._id,
      });
      if (res.data?.conversation) {
        const newConv = {
          ...res.data.conversation,
          otherUser: mentor,
        };
        setConversations(prev => [newConv, ...prev.filter(c => c._id !== newConv._id)]);
        setActiveConvId(newConv._id);
      }
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  // Send message
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || !activeConvId) return;

    const messageText = input.trim();
    setInput('');

    try {
      const res = await API.post(`/messages/conversations/${activeConvId}/messages`, {
        content: messageText,
      });
      if (res.data?.message) {
        setMessages(prev => [...prev, res.data.message]);
        setConversations(prev =>
          prev.map(c =>
            c._id === activeConvId
              ? { ...c, lastMessage: { content: messageText, createdAt: new Date().toISOString() } }
              : c
          )
        );
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    if (socketRef.current && activeConvId) {
      socketRef.current.emit('typing', { conversationId: activeConvId, isTyping: Boolean(val.trim()), userName: user?.name });
    }
  };

  const activeConv = conversations.find(c => c._id === activeConvId);
  const otherPerson = activeConv?.otherUser;

  const filteredConversations = conversations.filter(c => {
    const name = c.otherUser?.name || '';
    const spec = c.otherUser?.specialty || '';
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spec.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <Layout navigate={navigate} currentPage="messages">
      <div className="flex h-full overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>

        {/* Left: Conversations list */}
        <div className="w-80 bg-[#FFFFFF] border-r border-[#E1E7E5] flex flex-col shrink-0">
          <div className="p-4 border-b border-[#E1E7E5]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-[#0B192C] text-lg" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                Messages
              </h2>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2E7D5A]">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#2E7D5A] animate-pulse' : 'bg-[#0B192C]'}`} />
                {isConnected ? 'Socket.io live' : 'Connecting…'}
              </div>
            </div>

            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#74817D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search conversations…"
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#F0F4F2] text-[#0B192C] rounded-full border border-transparent focus:border-[#52796F] focus:bg-white focus:outline-none transition-all placeholder-[#74817D]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#E1E7E5]">
            {loadingConv ? (
              <div className="p-8 text-center text-xs text-[#74817D]">
                <div className="w-6 h-6 border-2 border-[#52796F] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading conversations…
              </div>
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map(c => {
                const isSelected = activeConvId === c._id;
                const other = c.otherUser;
                const initials = other?.name
                  ? other.name.split(' ').map(w => w[0]).join('').slice(0, 2)
                  : 'DR';
                return (
                  <button
                    key={c._id}
                    onClick={() => setActiveConvId(c._id)}
                    className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors relative cursor-pointer ${
                      isSelected ? 'bg-[#E8F0EC]/60' : 'hover:bg-[#F0F4F2]/60'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#0B192C]" />
                    )}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-[#0B192C] flex items-center justify-center text-white text-xs font-bold shadow-2xs">
                        {initials}
                      </div>
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#2E7D5A] rounded-full border-2 border-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-xs sm:text-sm font-bold truncate ${isSelected ? 'text-[#52796F]' : 'text-[#0B192C]'}`}>
                          {other?.name || 'Clinician'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#74817D] truncate mb-0.5">
                        {other?.specialty || 'General Medicine'}
                      </p>
                      <p className="text-xs text-[#52616C] truncate font-medium">
                        {c.lastMessage?.content || 'Started a conversation'}
                      </p>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-center text-xs text-[#74817D]">
                <p className="font-semibold text-[#0B192C] mb-1">No conversations yet</p>
                <p className="mb-4">Select a mentor below to begin a live clinical consultation.</p>
                <div className="space-y-2">
                  {availableMentors.map(m => (
                    <button
                      key={m._id}
                      onClick={() => startConversationWith(m)}
                      className="w-full text-left p-2.5 rounded-lg border border-[#E1E7E5] hover:border-[#52796F] hover:bg-[#E8F0EC]/30 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8F0EC] text-[10px] font-bold text-[#35564E]">
                        {m.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#0B192C] truncate">{m.name}</div>
                        <div className="text-[10px] text-[#74817D] truncate">{m.specialty}</div>
                      </div>
                      <span className="text-[10px] font-bold text-[#52796F]">Start →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Active Chat Area */}
        <div className="flex-1 flex flex-col bg-[#F7F9F8]">
          {activeConv && otherPerson ? (
            <>
              {/* Chat Header */}
              <div className="h-16 px-6 bg-[#FFFFFF] border-b border-[#E1E7E5] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0B192C] flex items-center justify-center text-white text-xs font-bold shadow-2xs">
                    {otherPerson.name ? otherPerson.name.split(' ').map(w => w[0]).join('').slice(0, 2) : 'DR'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                        {otherPerson.name}
                      </span>
                      <span className="w-2 h-2 rounded-full bg-[#2E7D5A]" />
                    </div>
                    <span className="text-[11px] text-[#74817D]">
                      {otherPerson.specialty || 'Clinician'} · Real-time Socket.io active
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => navigate('mentor-profile')}
                  className="px-3.5 py-1.5 rounded-full text-xs font-bold border border-[#E1E7E5] text-[#0B192C] hover:bg-[#F0F4F2] transition-colors cursor-pointer"
                >
                  View Profile
                </button>
              </div>

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#74817D]">
                    <div className="w-12 h-12 rounded-full bg-[#E8F0EC] flex items-center justify-center mx-auto mb-2 text-[#52796F]">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 5h16v12H9l-5 4V5Z" />
                      </svg>
                    </div>
                    <p className="font-semibold text-sm text-[#0B192C]">Real-time Clinician Chat</p>
                    <p className="mt-1">Messages sent here are delivered instantly via Socket.io.</p>
                  </div>
                ) : (
                  messages.map(m => {
                    const senderId = typeof m.sender === 'object' ? (m.sender._id || (m.sender as any).id) : m.sender;
                    const isMe = senderId === myId || m.from === 'me';
                    const timeStr = m.createdAt
                      ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Now';

                    return (
                      <div
                        key={m._id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-md rounded-lg px-4 py-3 text-sm shadow-2xs leading-relaxed ${
                            isMe
                              ? 'bg-[#0B192C] text-white rounded-br-xs'
                              : 'bg-[#FFFFFF] text-[#0B192C] border border-[#E1E7E5] rounded-bl-xs'
                          }`}
                        >
                          {m.content}
                        </div>
                        <span className="text-[10px] text-[#74817D] mt-1 px-1">{timeStr}</span>
                      </div>
                    );
                  })
                )}
                {isTyping && (
                  <div className="text-xs text-[#74817D] italic animate-pulse">
                    {otherPerson.name} is typing…
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 bg-[#FFFFFF] border-t border-[#E1E7E5]">
                <form onSubmit={handleSend} className="flex items-center gap-3">
                  <input
                    value={input}
                    onChange={e => handleInputChange(e.target.value)}
                    placeholder={`Message ${otherPerson.name}…`}
                    className="flex-1 px-4 py-2.5 text-sm bg-[#F0F4F2] text-[#0B192C] rounded-full border border-transparent focus:border-[#52796F] focus:bg-white focus:outline-none transition-all placeholder-[#74817D]"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="px-5 py-2.5 bg-[#0B192C] hover:bg-[#192B40] text-white text-xs font-bold rounded-full transition-all shadow-xs disabled:opacity-40 cursor-pointer"
                  >
                    Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-[#E8F0EC] flex items-center justify-center text-[#52796F] mb-3">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 5h16v12H9l-5 4V5Z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#0B192C]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                Select or Start a Conversation
              </h3>
              <p className="text-xs text-[#52616C] max-w-sm mt-1 mb-6">
                Connect in real time with senior clinical mentors and peers across hospitals.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {availableMentors.map(m => (
                  <button
                    key={m._id}
                    onClick={() => startConversationWith(m)}
                    className="px-4 py-2 rounded-full border border-[#E1E7E5] bg-white text-xs font-bold text-[#0B192C] hover:border-[#52796F] hover:bg-[#E8F0EC]/40 transition-all cursor-pointer"
                  >
                    Chat with {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
