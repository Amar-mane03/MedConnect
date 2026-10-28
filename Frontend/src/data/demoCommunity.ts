export interface CommunityNGO {
  _id: string;
  name: string;
  mission: string;
  logoUrl: string;
  causeTags: string[];
  location: string;
  website?: string;
  campaigns: { title: string; description: string; status: string }[];
  verificationStatus: 'pending' | 'verified' | 'rejected';
  beneficiariesServed: number;
  campsCompleted: number;
  volunteersEngaged: number;
  totalVerifiedHours?: number;
  isDemo?: boolean;
}

export interface CommunityCamp {
  id: string;
  title: string;
  causeCategory: string;
  description: string;
  startAt: string;
  endAt: string;
  venue: string;
  capacity: number;
  applicationsCount: number;
  prerequisiteSkills: string[];
  latitude?: number | null;
  longitude?: number | null;
  isApplied?: boolean;
  isWaitlisted?: boolean;
  hasReport?: boolean;
  isDemo?: boolean;
  ngo?: { id?: string; name: string; logoUrl?: string; location?: string };
}

function futureDate(daysFromNow: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  return date;
}

export const DEMO_NGOS: CommunityNGO[] = [
  {
    _id: 'demo-ngo-sahyog',
    name: 'Sahyog Community Health (Demo)',
    mission: 'Fictional community organization sample demonstrating a verified NGO profile, health education activities, and local volunteer opportunities.',
    logoUrl: '',
    causeTags: ['Healthcare', 'Community Development'],
    location: 'Pune, Maharashtra',
    website: 'https://example.org/',
    campaigns: [
      {
        title: 'Neighborhood Wellness Days',
        description: 'Fictional sample campaign for community health education and resource navigation.',
        status: 'active',
      },
    ],
    verificationStatus: 'verified',
    beneficiariesServed: 480,
    campsCompleted: 12,
    volunteersEngaged: 36,
    totalVerifiedHours: 215,
    isDemo: true,
  },
  {
    _id: 'demo-ngo-bright-steps',
    name: 'Bright Steps Learning Network (Demo)',
    mission: 'Fictional organization sample focused on family learning activities, reading circles, and access to educational materials.',
    logoUrl: '',
    causeTags: ['Education', 'Community Development'],
    location: 'Pimpri-Chinchwad, Maharashtra',
    website: 'https://example.org/',
    campaigns: [
      {
        title: 'Weekend Reading Circles',
        description: 'Fictional sample campaign to demonstrate education-focused volunteer work.',
        status: 'active',
      },
    ],
    verificationStatus: 'verified',
    beneficiariesServed: 320,
    campsCompleted: 8,
    volunteersEngaged: 24,
    totalVerifiedHours: 148,
    isDemo: true,
  },
];

export const DEMO_CAMPS: CommunityCamp[] = [
  {
    id: 'demo-camp-aundh-wellness',
    title: 'Demo camp: Aundh Family Wellness Day',
    causeCategory: 'Healthcare',
    description: 'Fictional sample outreach day with supervised health education, family resource navigation, and a neighborhood information desk. This is not a real event.',
    startAt: futureDate(10, 9).toISOString(),
    endAt: futureDate(10, 14).toISOString(),
    venue: 'Aundh Community Hall, Pune (Demo Venue)',
    capacity: 24,
    applicationsCount: 7,
    prerequisiteSkills: ['Community engagement', 'Marathi or Hindi helpful', 'Respectful communication'],
    latitude: 18.559,
    longitude: 73.8077,
    isDemo: true,
    ngo: {
      id: 'demo-ngo-sahyog',
      name: 'Sahyog Community Health (Demo)',
      location: 'Pune, Maharashtra',
    },
  },
  {
    id: 'demo-camp-reading-circle',
    title: 'Demo camp: Saturday Reading Circle',
    causeCategory: 'Education',
    description: 'Fictional reading and activity session for families. Volunteers prepare materials and support small learning groups. This is not a real event.',
    startAt: futureDate(18, 10).toISOString(),
    endAt: futureDate(18, 14).toISOString(),
    venue: 'Pimpri Community Learning Room (Demo Venue)',
    capacity: 16,
    applicationsCount: 5,
    prerequisiteSkills: ['Reading with children', 'Patience', 'Activity facilitation'],
    latitude: 18.6298,
    longitude: 73.7997,
    isDemo: true,
    ngo: {
      id: 'demo-ngo-bright-steps',
      name: 'Bright Steps Learning Network (Demo)',
      location: 'Pimpri-Chinchwad, Maharashtra',
    },
  },
  {
    id: 'demo-camp-learning-materials',
    title: 'Demo camp: Learning Materials Preparation Day',
    causeCategory: 'Education',
    description: 'Fictional volunteer opportunity to sort donated books, prepare sample learning packs, and organize activity materials. This is not a real event.',
    startAt: futureDate(24, 9).toISOString(),
    endAt: futureDate(24, 14).toISOString(),
    venue: 'Chinchwad Neighborhood Library (Demo Venue)',
    capacity: 12,
    applicationsCount: 3,
    prerequisiteSkills: ['Organization', 'Book sorting'],
    latitude: 18.6492,
    longitude: 73.803,
    isDemo: true,
    ngo: {
      id: 'demo-ngo-bright-steps',
      name: 'Bright Steps Learning Network (Demo)',
      location: 'Pimpri-Chinchwad, Maharashtra',
    },
  },
];
