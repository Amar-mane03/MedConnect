import { useEffect, useState } from 'react';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import type { Page } from '../App';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

type SectionId = 'cases' | 'forums' | 'resources' | 'groups' | 'events';

interface CommunityItem {
  id: string;
  title: string;
  category: string;
  summary: string;
  details: string;
}

interface CaseRecord {
  id?: string;
  _id?: string;
  title: string;
  specialty?: string;
  preview?: string;
  author?: string;
  timeAgo?: string;
}

interface ForumRecord {
  id?: string;
  _id?: string;
  title: string;
  category?: string;
  content?: string;
  author?: string;
  repliesCount?: number;
  timeAgo?: string;
}

interface ResourceRecord {
  id?: string;
  _id?: string;
  title: string;
  resourceType?: string;
  specialty?: string;
  description?: string;
  uploader?: string;
  timeAgo?: string;
}

interface GroupRecord {
  id?: string;
  _id?: string;
  name: string;
  specialty?: string;
  description?: string;
  membersCount?: number;
  postsCount?: number;
}

interface EventRecord {
  id?: string;
  _id?: string;
  title: string;
  eventType?: string;
  specialty?: string;
  description?: string;
  formattedDate?: string;
  date?: string;
  speakerName?: string;
}

interface SectionData {
  items: CommunityItem[];
  error: string | null;
}

interface SectionDefinition {
  id: SectionId;
  title: string;
  description: string;
  page: Page;
}

interface CommunityHubProps {
  navigate: (page: Page) => void;
  openAuth: (mode: 'login' | 'register') => void;
}

const sections: SectionDefinition[] = [
  { id: 'cases', title: 'Teaching cases', description: 'Browse teaching cases and clinical learning prompts.', page: 'dashboard' },
  { id: 'forums', title: 'Discussions', description: 'Ask questions, share experience, and learn from the community.', page: 'forums' },
  { id: 'resources', title: 'Resources', description: 'Find and share study guides, notes, and clinical resources.', page: 'resources' },
  { id: 'groups', title: 'Learning groups', description: 'Connect with peers in specialty and study circles.', page: 'groups' },
  { id: 'events', title: 'Events', description: 'Discover upcoming webinars, workshops, and teaching sessions.', page: 'events' },
];

const emptySections: Record<SectionId, SectionData> = {
  cases: { items: [], error: null },
  forums: { items: [], error: null },
  resources: { items: [], error: null },
  groups: { items: [], error: null },
  events: { items: [], error: null },
};

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || 'The server could not be reached.';
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

function mapRecords<T>(
  records: T[] | undefined,
  section: string,
  mapRecord: (record: T, index: number) => CommunityItem,
): CommunityItem[] {
  if (!Array.isArray(records)) {
    throw new Error(`The ${section} endpoint returned an invalid response.`);
  }
  return records.slice(0, 4).map(mapRecord);
}

function settledSection(result: PromiseSettledResult<CommunityItem[]>): SectionData {
  return result.status === 'fulfilled'
    ? { items: result.value, error: null }
    : { items: [], error: errorMessage(result.reason) };
}

function recordId(id: string | undefined, fallback: string, index: number): string {
  return id || `${fallback}-${index}`;
}

function eventDateLabel(event: EventRecord): string {
  if (event.formattedDate) return event.formattedDate;
  if (!event.date) return 'Date to be announced';
  const date = new Date(event.date);
  return Number.isNaN(date.getTime()) ? 'Date to be announced' : date.toLocaleString();
}

export default function CommunityHub({ navigate, openAuth }: CommunityHubProps) {
  const { role, isAuthenticated } = useAuth();
  const [activeSectionId, setActiveSectionId] = useState<SectionId>('forums');
  const [communityData, setCommunityData] = useState(emptySections);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0];
  const activeData = communityData[activeSectionId];
  const workspacePage: Page = role === 'admin'
    ? 'ngo-admin'
    : role === 'ngo'
      ? 'ngo-dashboard'
      : role === 'student' || role === 'mentee'
        ? 'dashboard'
        : 'dashboard';

  useEffect(() => {
    if (!isAuthenticated) {
      setCommunityData(emptySections);
      setLoading(false);
      return;
    }

    let current = true;
    setLoading(true);

    const requests = Promise.allSettled([
      API.get<{ cases: CaseRecord[] }>('/cases').then(({ data }: AxiosResponse<{ cases: CaseRecord[] }>) =>
        mapRecords(data.cases, 'case studies', (item, index) => ({
          id: recordId(item.id || item._id, 'case', index),
          title: item.title,
          category: item.specialty || 'Teaching case',
          summary: item.preview || 'Open this case to read its teaching notes and join the discussion.',
          details: [item.author, item.timeAgo].filter(Boolean).join(' · '),
        })),
      ),
      API.get<{ posts: ForumRecord[] }>('/forums').then(({ data }: AxiosResponse<{ posts: ForumRecord[] }>) =>
        mapRecords(data.posts, 'discussions', (item, index) => ({
          id: recordId(item.id || item._id, 'forum', index),
          title: item.title,
          category: item.category || 'Community discussion',
          summary: item.content || 'Open the discussion to read the full post and replies.',
          details: [item.author, `${item.repliesCount || 0} replies`, item.timeAgo].filter(Boolean).join(' · '),
        })),
      ),
      API.get<{ resources: ResourceRecord[] }>('/resources').then(({ data }: AxiosResponse<{ resources: ResourceRecord[] }>) =>
        mapRecords(data.resources, 'resources', (item, index) => ({
          id: recordId(item.id || item._id, 'resource', index),
          title: item.title,
          category: [item.resourceType, item.specialty].filter(Boolean).join(' · ') || 'Learning resource',
          summary: item.description || 'Open this resource to view its details and available files.',
          details: [item.uploader, item.timeAgo].filter(Boolean).join(' · '),
        })),
      ),
      API.get<{ groups: GroupRecord[] }>('/groups').then(({ data }: AxiosResponse<{ groups: GroupRecord[] }>) =>
        mapRecords(data.groups, 'learning groups', (item, index) => ({
          id: recordId(item.id || item._id, 'group', index),
          title: item.name,
          category: item.specialty || 'Peer learning',
          summary: item.description || 'Join this circle to connect with peers and share learning.',
          details: `${item.membersCount || 0} members · ${item.postsCount || 0} posts`,
        })),
      ),
      API.get<{ events: EventRecord[] }>('/events', { params: { filter: 'upcoming' } }).then(({ data }: AxiosResponse<{ events: EventRecord[] }>) =>
        mapRecords(data.events, 'events', (item, index) => ({
          id: recordId(item.id || item._id, 'event', index),
          title: item.title,
          category: [item.eventType?.replace(/_/g, ' '), item.specialty].filter(Boolean).join(' · ') || 'Community event',
          summary: item.description || 'Open this event to see the session details and RSVP.',
          details: [eventDateLabel(item), item.speakerName].filter(Boolean).join(' · '),
        })),
      ),
    ]);

    void requests.then((results) => {
      if (!current) return;
      setCommunityData({
        cases: settledSection(results[0]),
        forums: settledSection(results[1]),
        resources: settledSection(results[2]),
        groups: settledSection(results[3]),
        events: settledSection(results[4]),
      });
      setLoading(false);
    });

    return () => {
      current = false;
    };
  }, [isAuthenticated, refreshKey]);

  const openSection = (section: SectionDefinition) => navigate(section.page);
  const openCommunity = () => isAuthenticated ? navigate(workspacePage) : openAuth('register');

  const content = (
    <main className="min-h-screen bg-[#F7F9F8] px-5 py-8 text-[#0B192C] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <button onClick={() => navigate(isAuthenticated ? workspacePage : 'home')} className="text-sm font-bold text-[#35564E] hover:underline">
            ← {isAuthenticated ? 'Back to workspace' : 'Good Neighbors'}
          </button>
          <div className="flex items-center gap-3">
            {!isAuthenticated && (
              <button onClick={() => openAuth('login')} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[#35564E] hover:bg-white">
                Sign in
              </button>
            )}
            <button onClick={openCommunity} className="rounded-lg bg-[#0B192C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#192B40]">
              {isAuthenticated ? 'Open workspace' : 'Join the community'}
            </button>
          </div>
        </header>

        <section className="rounded-2xl bg-[#0B192C] p-6 text-white sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A9C1B5]">
            {isAuthenticated ? 'Your community · Live activity' : 'Good Neighbors · Community hub'}
          </p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
            Learn, share, and grow together
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-white/80">
            {isAuthenticated
              ? 'Discover the latest teaching cases, discussions, learning resources, peer groups, and upcoming events from your community.'
              : 'Connect with people who care about community work. Sign in to explore real discussions, learning resources, peer groups, and events.'}
          </p>
          {!isAuthenticated && (
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => openAuth('register')} className="rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-[#0B192C] hover:bg-[#E8F0EC]">
                Create your account
              </button>
              <button onClick={() => navigate('camps')} className="rounded-lg border border-white/40 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
                Explore volunteer camps
              </button>
              <button onClick={() => navigate('ngos')} className="rounded-lg border border-white/40 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
                Find an organization
              </button>
            </div>
          )}
        </section>

        <section className="mt-8" aria-label="Community features">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {sections.map((section) => {
              const sectionData = communityData[section.id];
              const isActive = activeSectionId === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => isAuthenticated ? setActiveSectionId(section.id) : openSection(section)}
                  aria-pressed={isAuthenticated ? isActive : undefined}
                  className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${isActive && isAuthenticated ? 'border-[#35564E] bg-[#E8F0EC]' : 'border-[#E1E7E5] bg-white hover:border-[#A9C1B5]'}`}
                >
                  <span className="block text-sm font-bold">{section.title}</span>
                  <span className="mt-2 block text-xs leading-5 text-[#64727C]">{section.description}</span>
                  <span className="mt-3 block text-xs font-semibold text-[#35564E]">
                    {!isAuthenticated
                      ? 'Sign in to explore'
                      : loading
                        ? 'Loading live content…'
                        : sectionData.error
                          ? 'Content unavailable'
                          : `${sectionData.items.length} recent ${section.id === 'cases' ? 'cases' : section.id} shown`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {isAuthenticated ? (
          <section className="mt-8" aria-labelledby="community-feed-heading">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="community-feed-heading" className="text-2xl font-semibold" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  {activeSection.title}
                </h2>
                <p className="mt-2 text-sm text-[#64727C]">{activeSection.description}</p>
              </div>
              <button onClick={() => openSection(activeSection)} className="rounded-lg border border-[#52796F] px-4 py-2.5 text-sm font-semibold text-[#35564E] hover:bg-white">
                Browse all {activeSection.title.toLowerCase()}
              </button>
            </div>

            {loading ? (
              <p role="status" className="rounded-xl border border-[#E1E7E5] bg-white p-6 text-sm text-[#64727C]">Loading community activity…</p>
            ) : activeData.error ? (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6">
                <p className="font-semibold text-amber-950">Couldn’t load {activeSection.title.toLowerCase()}.</p>
                <p className="mt-1 text-sm text-amber-900">{activeData.error} Check that the server is available, then try again.</p>
                <button onClick={() => setRefreshKey((value) => value + 1)} className="mt-4 rounded-lg border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100">
                  Try again
                </button>
              </div>
            ) : activeData.items.length === 0 ? (
              <div className="rounded-xl border border-[#E1E7E5] bg-white p-6">
                <h3 className="font-semibold">Nothing here yet</h3>
                <p className="mt-1 text-sm text-[#64727C]">Be one of the first to explore or contribute to this part of the community.</p>
                <button onClick={() => openSection(activeSection)} className="mt-4 rounded-lg bg-[#35564E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#29453E]">
                  Open {activeSection.title.toLowerCase()}
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {activeData.items.map((item) => (
                  <article key={item.id} className="rounded-xl border border-[#E1E7E5] bg-white p-5 shadow-[0_8px_25px_rgba(11,25,44,0.035)]">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#52796F]">{item.category}</p>
                    <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#52616C]">{item.summary}</p>
                    {item.details && <p className="mt-3 text-xs text-[#74817D]">{item.details}</p>}
                    <button onClick={() => openSection(activeSection)} className="mt-5 text-sm font-bold text-[#35564E] underline underline-offset-4 hover:text-[#0B192C]">
                      Open in {activeSection.title.toLowerCase()}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="mt-8 rounded-xl border border-[#E1E7E5] bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>A real community, built around participation</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64727C]">
              Create an account to join discussions, save learning resources, participate in peer groups, and RSVP to events. Public organization and camp listings are available to browse before you sign up.
            </p>
            <button onClick={() => openAuth('register')} className="mt-5 rounded-lg bg-[#0B192C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#192B40]">
              Join the community
            </button>
          </section>
        )}

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[#DCE5E1] pt-6">
          <p className="text-sm text-[#64727C]">
            {isAuthenticated
              ? 'Your community content is live. Choose a section above to discover more.'
              : 'Good Neighbors · A community for service and learning.'}
          </p>
          <button onClick={() => navigate(isAuthenticated ? workspacePage : 'home')} className="text-sm font-semibold text-[#35564E] hover:underline">
            {isAuthenticated ? 'Back to workspace' : 'Back to home'}
          </button>
        </footer>
      </div>
    </main>
  );
  return isAuthenticated ? <Layout navigate={navigate} currentPage="community">{content}</Layout> : content;
}
