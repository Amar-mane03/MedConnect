const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env.local") });
require("dotenv").config({ path: path.join(__dirname, ".env") });

function validateDemoEnvironment() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seeding is disabled when NODE_ENV=production.");
  }
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Set ALLOW_DEMO_SEED=true to confirm that demo data should be created.");
  }
  if (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 12) {
    throw new Error("Set DEMO_PASSWORD to a local-only password of at least 12 characters.");
  }

  const uri = process.env.DEMO_MONGO_URI;
  if (!uri) {
    throw new Error("Set DEMO_MONGO_URI to a local MongoDB connection string.");
  }

  let hostname;
  let databaseName;
  try {
    const parsedUri = new URL(uri);
    hostname = parsedUri.hostname.toLowerCase();
    databaseName = parsedUri.pathname.replace(/^\/|\/$/g, "");
  } catch {
    throw new Error("DEMO_MONGO_URI must be a valid local MongoDB connection string.");
  }

  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)) {
    throw new Error("Demo seeding only permits MongoDB on this computer (localhost).");
  }
  if (databaseName !== "medconnect_demo") {
    throw new Error("DEMO_MONGO_URI must target the medconnect_demo database.");
  }
}

async function seedDemoContent() {
  validateDemoEnvironment();

  const mongoose = require("mongoose");
  const bcrypt = require("bcryptjs");
  const User = require("./models/user");
  const CaseStudy = require("./models/CaseStudy");
  const Comment = require("./models/Comment");
  const ContentReport = require("./models/ContentReport");
  const ForumPost = require("./models/ForumPost");
  const Resource = require("./models/Resource");
  const Group = require("./models/Group");
  const Event = require("./models/Event");
  const MentorshipRequest = require("./models/MentorshipRequest");
  const Notification = require("./models/Notification");
  const { Conversation, Message } = require("./models/Message");
  const NGO = require("./models/NGO");
  const Camp = require("./models/Camp");
  const CampApplication = require("./models/CampApplication");
  const CampReport = require("./models/CampReport");
  const CampQuestion = require("./models/CampQuestion");

  try {
    await mongoose.connect(process.env.DEMO_MONGO_URI);
    const password = await bcrypt.hash(process.env.DEMO_PASSWORD, 10);
    const upsertUser = async (email, fields) => User.findOneAndUpdate(
      { email },
      { $set: { ...fields, email, password } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    const mentor = await upsertUser("mentor@demo.medconnect.test", {
      name: "Morgan Reed (Demo)",
      role: "mentor",
      specialty: "Cardiology",
      careerStage: "Consultant",
      hospital: "MedConnect Demo Hospital",
      institution: "MedConnect Demo Hospital",
      bio: "Fictional mentor profile for trying the MedConnect demo.",
      experienceYears: 8,
      mentorVerificationStatus: "verified",
      emailVerified: true,
      areasOfInterest: ["Cardiology", "Clinical teaching"],
    });
    const learner = await upsertUser("learner@demo.medconnect.test", {
      name: "Jamie Park (Demo)",
      role: "mentee",
      specialty: "Internal Medicine",
      careerStage: "Resident",
      hospital: "MedConnect Demo Hospital",
      institution: "MedConnect Demo Hospital",
      goals: "Build confidence presenting cases and planning learning goals.",
      emailVerified: true,
    });
    const pendingMentor = await upsertUser("pending.mentor@demo.medconnect.test", {
      name: "Riley Chen (Demo)",
      role: "mentor",
      specialty: "Emergency Medicine",
      careerStage: "Consultant",
      hospital: "MedConnect Demo Hospital",
      institution: "MedConnect Demo Hospital",
      bio: "Fictional profile to demonstrate credential review.",
      mentorVerificationStatus: "pending",
      emailVerified: true,
    });
    const admin = await upsertUser("admin@demo.medconnect.test", {
      name: "Demo Administrator",
      role: "admin",
      emailVerified: true,
    });
    const student = await upsertUser("student@demo.medconnect.test", {
      name: "Aarav Kulkarni (Demo)",
      role: "student",
      dateOfBirth: new Date("2003-04-12"),
      specialty: "Community Health",
      careerStage: "Public health student",
      location: "Pune, Maharashtra",
      institution: "Demo Institute of Community Health",
      goals: "Build supervised field experience in community outreach.",
      emailVerified: true,
    });
    const waitlistStudent = await upsertUser("waitlist.student@demo.medconnect.test", {
      name: "Nisha Rao (Demo)",
      role: "student",
      dateOfBirth: new Date("2002-11-09"),
      specialty: "Community Health",
      careerStage: "University student",
      location: "Pune, Maharashtra",
      institution: "Demo Institute of Community Health",
      emailVerified: true,
    });
    const minorStudent = await upsertUser("minor.student@demo.medconnect.test", {
      name: "Dev Mehta (Demo)",
      role: "student",
      dateOfBirth: new Date("2010-06-03"),
      specialty: "Community Health",
      careerStage: "High school student",
      location: "Pune, Maharashtra",
      institution: "Demo Secondary School",
      emailVerified: true,
    });
    const ngoRep = await upsertUser("ngo@demo.medconnect.test", {
      name: "Ananya Deshmukh (Demo)",
      role: "ngo",
      location: "Pune, Maharashtra",
      institution: "Sahyog Community Foundation (Demo)",
      emailVerified: true,
    });
    const secondNgoRep = await upsertUser("ngo.education@demo.medconnect.test", {
      name: "Kabir Shah (Demo)",
      role: "ngo",
      location: "Pimpri-Chinchwad, Maharashtra",
      institution: "BrightSteps Learning Collective (Demo)",
      emailVerified: true,
    });
    const pendingNgoRep = await upsertUser("pending.ngo@demo.medconnect.test", {
      name: "Mira Joshi (Demo)",
      role: "ngo",
      location: "Nashik, Maharashtra",
      institution: "Nayi Disha Outreach (Demo)",
      emailVerified: true,
    });

    const sahyog = await NGO.findOneAndUpdate(
      { owner: ngoRep._id },
      {
        $set: {
          owner: ngoRep._id,
          isDemo: true,
          name: "Sahyog Community Foundation (Demo)",
          mission: "A fictional Pune community organization supporting access to preventive health information, family wellbeing, and neighborhood outreach. This demo profile uses invented organization details and impact figures.",
          logoUrl: "",
          causeTags: ["Healthcare", "Community Development"],
          location: "Pune, Maharashtra",
          website: "https://example.org/sahyog-demo",
          campaigns: [
            { title: "Healthy Neighborhoods", description: "Monthly community education and referral events.", status: "active" },
            { title: "Winter Wellness Drive", description: "A completed seasonal outreach campaign used to demonstrate impact history.", status: "completed" },
          ],
          verificationStatus: "verified",
          beneficiariesServed: 428,
          campsCompleted: 6,
          volunteersEngaged: 53,
          totalVerifiedHours: 6,
          verifiedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
        },
      },
      { new: true, upsert: true, runValidators: true },
    );
    const brightSteps = await NGO.findOneAndUpdate(
      { owner: secondNgoRep._id },
      {
        $set: {
          owner: secondNgoRep._id,
          isDemo: true,
          name: "BrightSteps Learning Collective (Demo)",
          mission: "A fictional volunteer collective creating welcoming learning spaces and practical literacy support for children and families in Pimpri-Chinchwad.",
          logoUrl: "",
          causeTags: ["Education", "Community Development"],
          location: "Pimpri-Chinchwad, Maharashtra",
          website: "https://example.org/brightsteps-demo",
          campaigns: [
            { title: "Weekend Reading Circles", description: "Volunteer-led reading and learning activities in neighborhood spaces.", status: "active" },
          ],
          verificationStatus: "verified",
          beneficiariesServed: 186,
          campsCompleted: 3,
          volunteersEngaged: 24,
          verifiedAt: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000),
        },
      },
      { new: true, upsert: true, runValidators: true },
    );
    const pendingNgo = await NGO.findOneAndUpdate(
      { owner: pendingNgoRep._id },
      {
        $set: {
          owner: pendingNgoRep._id,
          isDemo: true,
          name: "Nayi Disha Outreach (Demo)",
          mission: "A fictional Nashik-based organization planning community learning and family-support activities. This application is included to demonstrate administrator review.",
          logoUrl: "",
          causeTags: ["Education", "Food Security"],
          location: "Nashik, Maharashtra",
          website: "https://example.org/nayi-disha-demo",
          campaigns: [
            { title: "Udaan Family Support Days", description: "Planned information and referral sessions for local families.", status: "active" },
          ],
          verificationStatus: "pending",
          beneficiariesServed: 0,
          campsCompleted: 0,
          volunteersEngaged: 0,
          verifiedAt: null,
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    const campDates = {
      completedStart: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      completedEnd: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
      healthStart: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      healthEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000),
      learningStart: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
      learningEnd: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
      secondHealthStart: new Date(Date.now() + 24 * 24 * 60 * 60 * 1000),
      secondHealthEnd: new Date(Date.now() + 24 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000),
      checkInStart: new Date(Date.now() - 60 * 60 * 1000),
      checkInEnd: new Date(Date.now() + 4 * 60 * 60 * 1000),
    };
    const campSpecs = [
      {
        ngo: sahyog._id,
        title: "Demo camp: Aundh Family Wellness Day",
        causeCategory: "Healthcare",
        description: "A fictional community outreach day with supervised health education, family resource navigation, and a neighborhood information desk. This listing is sample data, not a real event.",
        startAt: campDates.healthStart,
        endAt: campDates.healthEnd,
        venue: "Aundh Community Hall, Pune (Demo Venue)",
        capacity: 24,
        latitude: 18.5590,
        longitude: 73.8077,
        prerequisiteSkills: ["Community engagement", "Marathi or Hindi helpful", "Respectful communication"],
      },
      {
        ngo: sahyog._id,
        title: "Demo camp: Winter Wellness Resource Distribution",
        causeCategory: "Healthcare",
        description: "A completed fictional outreach camp with wellness information and family resource kits. Included to demonstrate attendance, service hours, and impact reporting.",
        startAt: campDates.completedStart,
        endAt: campDates.completedEnd,
        venue: "Baner Neighborhood Centre, Pune (Demo Venue)",
        capacity: 18,
        latitude: 18.5598,
        longitude: 73.7868,
        prerequisiteSkills: ["Teamwork", "Community outreach"],
      },
      {
        ngo: brightSteps._id,
        title: "Demo camp: Saturday Reading Circle",
        causeCategory: "Education",
        description: "A fictional hands-on reading and activity session for families. Volunteers help prepare materials and support small learning groups.",
        startAt: campDates.learningStart,
        endAt: campDates.learningEnd,
        venue: "Pimpri Community Learning Room (Demo Venue)",
        capacity: 16,
        latitude: 18.6298,
        longitude: 73.7997,
        prerequisiteSkills: ["Reading with children", "Patience", "Activity facilitation"],
      },
      {
        ngo: brightSteps._id,
        title: "Demo camp: Learning Materials Preparation Day",
        causeCategory: "Education",
        description: "A sample volunteer opportunity to sort donated books, prepare take-home learning packs, and organize activity materials.",
        startAt: campDates.secondHealthStart,
        endAt: campDates.secondHealthEnd,
        venue: "Chinchwad Neighborhood Library (Demo Venue)",
        capacity: 12,
        latitude: 18.6492,
        longitude: 73.8030,
        prerequisiteSkills: ["Organization", "Book sorting"],
      },
      {
        ngo: sahyog._id,
        title: "Demo camp: Live QR Check-In Practice",
        causeCategory: "Community Development",
        description: "A fictional event in progress for trying mobile QR check-in, volunteer badges, and organizer tools. This is a local demo event, not a real activity.",
        startAt: campDates.checkInStart,
        endAt: campDates.checkInEnd,
        venue: "Demo Field Practice Site, Pune",
        latitude: 18.5204,
        longitude: 73.8567,
        capacity: 12,
        prerequisiteSkills: ["QR check-in practice"],
      },
      {
        ngo: brightSteps._id,
        title: "Demo camp: Full Camp Waitlist Practice",
        causeCategory: "Education",
        description: "A fictional camp intentionally at capacity so the waitlist and promotion workflow can be demonstrated.",
        startAt: campDates.learningStart,
        endAt: campDates.learningEnd,
        venue: "Demo Learning Hub, Pune",
        latitude: 18.5209,
        longitude: 73.8500,
        capacity: 1,
        prerequisiteSkills: ["Teamwork"],
      },
    ];
    const demoCamps = [];
    for (const spec of campSpecs) {
      const camp = await Camp.findOneAndUpdate(
        { ngo: spec.ngo, title: spec.title },
        { $set: { ...spec, isDemo: true, applicationsCount: 0, isPublished: true } },
        { new: true, upsert: true, runValidators: true },
      );
      demoCamps.push(camp);
    }
    const [healthCamp, completedCamp, readingCamp, materialsCamp, checkInCamp, waitlistCamp] = demoCamps;
    const applicationSpecs = [
      {
        camp: healthCamp._id,
        student: student._id,
        status: "pending",
        statement: "I am a public health student interested in community outreach and supervised health education. I can help welcome families, organize materials, and support the team.",
        volunteerHours: 0,
        completedAt: null,
      },
      {
        camp: readingCamp._id,
        student: student._id,
        status: "approved",
        statement: "I enjoy working with children and would be glad to support the reading activities and prepare materials before the session.",
        volunteerHours: 0,
        completedAt: null,
      },
      {
        camp: completedCamp._id,
        student: student._id,
        status: "completed",
        statement: "I can support the outreach team with setup, respectful community conversations, and distribution of the prepared resource kits.",
        volunteerHours: 6,
        completedAt: campDates.completedEnd,
      },
      {
        camp: materialsCamp._id,
        student: learner._id,
        status: "rejected",
        statement: "I would like to help organize books and prepare learning packs for families in the neighborhood.",
        volunteerHours: 0,
        completedAt: null,
      },
      {
        camp: checkInCamp._id,
        student: student._id,
        status: "approved",
        statement: "I am trying the live QR check-in demo and can help with the volunteer registration desk.",
        volunteerHours: 0,
        completedAt: null,
      },
      {
        camp: waitlistCamp._id,
        student: student._id,
        status: "pending",
        statement: "I am the first demo volunteer holding this intentionally full camp's only place.",
        volunteerHours: 0,
        completedAt: null,
      },
    ];
    const demoApplications = [];
    for (const spec of applicationSpecs) {
      const application = await CampApplication.findOneAndUpdate(
        { camp: spec.camp, student: spec.student },
        { $set: spec },
        { new: true, upsert: true, runValidators: true },
      );
      demoApplications.push(application);
    }
    for (const camp of demoCamps) {
      const applicationsCount = await CampApplication.countDocuments({ camp: camp._id, status: { $in: ["pending", "approved", "completed"] } });
      await Camp.updateOne({ _id: camp._id }, { $set: { applicationsCount } });
    }
    await CampQuestion.findOneAndUpdate(
      { camp: healthCamp._id, author: student._id },
      {
        $set: {
          camp: healthCamp._id,
          author: student._id,
          authorName: student.name,
          body: "Demo question: What time should volunteers arrive for setup?",
          replies: [{
            author: ngoRep._id,
            authorName: ngoRep.name,
            authorRole: "ngo",
            body: "Demo reply: Please arrive 30 minutes before the listed start time.",
          }],
        },
      },
      { new: true, upsert: true, runValidators: true },
    );
    const completedApplication = demoApplications.find((application) => application.camp.toString() === completedCamp._id.toString());
    await CampReport.findOneAndUpdate(
      { camp: completedCamp._id },
      {
        $set: {
          camp: completedCamp._id,
          ngo: sahyog._id,
          beneficiariesServed: 74,
          volunteersAttended: 12,
          resourcesDistributed: { kits: 60, medicines: 0, books: 18, other: 25 },
          successNotes: "Fictional demo outcome: volunteers welcomed local families, shared general wellness information, and distributed prepared resource kits. The team recorded 74 beneficiary visits and identified follow-up topics for a future community session. These figures and activities are invented sample content, not verified real-world results.",
          photoUrls: [],
          attendeeApplicationIds: [completedApplication._id],
          submittedBy: ngoRep._id,
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    const caseStudy = await CaseStudy.findOneAndUpdate(
      { title: "Demo case: reviewing an elevated blood pressure", author: mentor._id },
      {
        $set: {
          title: "Demo case: reviewing an elevated blood pressure",
          specialty: "Cardiology",
          subspecialty: "Prevention",
          author: mentor._id,
          authorName: mentor.name,
          authorRole: "Consultant",
          authorVerified: true,
          authorInitials: "MR",
          preview: "A fictional teaching scenario about confirming an elevated reading and arranging appropriate follow-up. No real patient data is used.",
          ageRange: "40–49 years",
          sex: "Adult",
          presentingComplaint: "An elevated blood pressure reading at a routine review.",
          history: "The fictional patient feels well. The initial reading was taken shortly after arriving and has not yet been repeated.",
          investigations: "Repeat measurements and relevant clinical context are being reviewed before deciding on next steps.",
          diagnosis: "Elevated blood pressure reading; confirmation is pending.",
          treatment: "Discuss measurement technique, follow-up, and locally applicable guidance with the supervising clinical team.",
          outcome: "Follow-up is arranged. This synthetic example is for demonstrating the app, not clinical advice.",
          learningPoints: [
            "Confirm an unexpected measurement using an appropriate technique.",
            "Consider the clinical context before interpreting a single reading.",
            "Document a clear follow-up plan.",
          ],
          status: "published",
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    const comment = await Comment.findOneAndUpdate(
      { caseId: caseStudy._id, author: learner._id, text: "Demo comment: I would confirm the measurement and agree on a follow-up plan." },
      {
        $set: {
          caseId: caseStudy._id,
          author: learner._id,
          authorName: learner.name,
          authorRole: learner.role,
          authorVerified: false,
          initials: "JP",
          text: "Demo comment: I would confirm the measurement and agree on a follow-up plan.",
          moderationStatus: "visible",
        },
      },
      { new: true, upsert: true, runValidators: true },
    );
    await CaseStudy.updateOne({ _id: caseStudy._id }, { $set: { commentsCount: 1 } });

    await ForumPost.findOneAndUpdate(
      { title: "Demo discussion: making the most of a first rotation", author: learner._id },
      {
        $set: {
          title: "Demo discussion: making the most of a first rotation",
          content: "What small habits helped you get useful feedback during a new clinical rotation? This fictional demo thread is about learning, not a patient case.",
          category: "Career Guidance",
          tags: ["learning", "feedback", "rotation"],
          author: learner._id,
          authorName: learner.name,
          authorRole: learner.role,
          authorSpecialty: learner.specialty,
          authorVerified: false,
          initials: "JP",
          replies: [{
            author: mentor._id,
            authorName: mentor.name,
            authorRole: mentor.role,
            authorSpecialty: mentor.specialty,
            authorVerified: true,
            initials: "MR",
            content: "Demo reply: ask for one specific observation soon after a task, then reflect on what to try next.",
          }],
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    await Resource.findOneAndUpdate(
      { title: "Demo resource: NICE hypertension guidance", uploader: mentor._id },
      {
        $set: {
          title: "Demo resource: NICE hypertension guidance",
          description: "Example link to the official NICE guideline NG136. Always check the current guidance and your local policy.",
          resourceType: "guideline",
          url: "https://www.nice.org.uk/guidance/ng136",
          specialty: "Cardiology",
          tags: ["hypertension", "guideline", "demo"],
          uploader: mentor._id,
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    const group = await Group.findOneAndUpdate(
      { name: "Cardiology Peer Learning (Demo)", createdBy: mentor._id },
      {
        $set: {
          name: "Cardiology Peer Learning (Demo)",
          description: "A fictional sample circle for trying specialty groups, posts, and likes.",
          specialty: "Cardiology",
          icon: "CR",
          createdBy: mentor._id,
          memberIds: [mentor._id, learner._id],
          posts: [{
            author: mentor._id,
            content: "Welcome to the demo circle. Share general learning questions here; do not post patient-identifying information.",
          }],
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    await Event.findOneAndUpdate(
      { title: "Demo Grand Round: a structured ECG review", host: mentor._id },
      {
        $set: {
          title: "Demo Grand Round: a structured ECG review",
          description: "A fictional sample event to demonstrate browsing and RSVP. This listing is not a real invitation.",
          speakerName: mentor.name,
          speakerTitle: "Consultant Cardiologist (Demo)",
          speakerSpecialty: "Cardiology",
          speakerHospital: "MedConnect Demo Hospital",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          durationMinutes: 45,
          eventType: "grand_rounds",
          specialty: "Cardiology",
          meetingLink: "",
          host: mentor._id,
          attendeeIds: [learner._id],
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    const mentorshipRequest = await MentorshipRequest.findOneAndUpdate(
      { mentee: learner._id, mentor: mentor._id },
      {
        $set: {
          mentee: learner._id,
          mentor: mentor._id,
          status: "pending",
          goals: "Practise case presentations and plan a learning portfolio.",
          note: "This is a fictional request for trying the mentorship workflow.",
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    let conversation = await Conversation.findOne({
      participants: { $all: [learner._id, mentor._id], $size: 2 },
    });
    if (conversation) {
      conversation.participants = [learner._id, mentor._id];
      conversation.lastMessage = "Welcome to the demo conversation. Please keep messages fictional and non-identifying.";
      conversation.lastMessageAt = new Date();
      await conversation.save();
    } else {
      conversation = await Conversation.create({
        participants: [learner._id, mentor._id],
        lastMessage: "Welcome to the demo conversation. Please keep messages fictional and non-identifying.",
        lastMessageAt: new Date(),
      });
    }
    await Message.findOneAndUpdate(
      { conversationId: conversation._id, sender: mentor._id, text: "Welcome to the demo conversation. Please keep messages fictional and non-identifying." },
      {
        $set: {
          conversationId: conversation._id,
          sender: mentor._id,
          senderName: mentor.name,
          recipient: learner._id,
          text: "Welcome to the demo conversation. Please keep messages fictional and non-identifying.",
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    await Notification.findOneAndUpdate(
      { recipient: mentor._id, actor: learner._id, category: "mentorship", targetId: mentor._id.toString() },
      {
        $set: {
          recipient: mentor._id,
          actor: learner._id,
          category: "mentorship",
          title: "Demo mentorship request",
          message: `${learner.name} sent a fictional demo request.`,
          page: "mentor-profile",
          targetId: mentor._id.toString(),
          readAt: null,
        },
      },
      { new: true, upsert: true, runValidators: true },
    );
    await Notification.findOneAndUpdate(
      { recipient: learner._id, actor: mentor._id, category: "messages", targetId: conversation._id.toString() },
      {
        $set: {
          recipient: learner._id,
          actor: mentor._id,
          category: "messages",
          title: "Demo message",
          message: `${mentor.name} sent a fictional demo message.`,
          page: "messages",
          targetId: conversation._id.toString(),
          readAt: null,
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    await ContentReport.findOneAndUpdate(
      { reporter: learner._id, targetType: "comment", targetId: comment._id },
      {
        $set: {
          reporter: learner._id,
          targetType: "comment",
          targetId: comment._id,
          caseId: caseStudy._id,
          reason: "Other",
          details: "Fictional report record for trying the admin moderation screen.",
          status: "pending",
          reviewedBy: null,
          reviewedAt: null,
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    console.log("Demo data is ready in the local database.");
    console.log("Demo accounts (all use the password set in DEMO_PASSWORD):");
    console.log("  mentor@demo.medconnect.test");
    console.log("  learner@demo.medconnect.test");
    console.log("  pending.mentor@demo.medconnect.test");
    console.log("  admin@demo.medconnect.test");
    console.log("  student@demo.medconnect.test");
    console.log("  ngo@demo.medconnect.test");
    console.log("  ngo.education@demo.medconnect.test");
    console.log("  pending.ngo@demo.medconnect.test");
    console.log(`Created/updated sample group: ${group.name}`);
    console.log(`Created/updated pending mentorship request: ${mentorshipRequest._id}`);
    console.log(`Created/updated pending mentor for review: ${pendingMentor.email}`);
    console.log(`Created/updated demo administrator: ${admin.email}`);
    console.log(`Created/updated verified demo NGOs: ${sahyog.name}; ${brightSteps.name}`);
    console.log(`Created/updated NGO verification request: ${pendingNgo.name} (${pendingNgoRep.email})`);
    console.log(`Created/updated ${demoCamps.length} field camps and ${demoApplications.length} student applications.`);
    console.log("Added demo coordinates, camp Q&A, a live QR check-in camp, a full-capacity waitlist camp, and a minor-consent account.");
    console.log("Created/updated one completed camp impact report and a student volunteer certificate record.");
  } finally {
    await mongoose.disconnect();
  }
}

seedDemoContent().catch((error) => {
  console.error("Demo seeding failed:", error.message);
  process.exitCode = 1;
});
