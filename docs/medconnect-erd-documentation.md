# MedConnect Entity-Relationship Diagram

## 1. Introduction

This document describes the logical data model implemented by MedConnect's
backend. The accompanying ERD summarizes the Mongoose models, their important
attributes, and the document references declared by the application. It is
intended to support technical review and inclusion in a college project report.

## 2. Database overview

The backend uses MongoDB through Mongoose. The production server connects using
`MONGO_URI`; its database name is selected from `MONGO_DB_NAME`, the database
name in the URI, or the fallback name `test`. The actual deployment database
name and contents cannot be established from the source code alone.

The backend defines 18 persistent Mongoose models: `User`, `NGO`, `Camp`,
`CampApplication`, `CampQuestion`, `CampAnnouncement`, `CampReport`,
`CaseStudy`, `Comment`, `ContentReport`, `MentorshipRequest`, `ForumPost`,
`Group`, `Event`, `Resource`, `Conversation`, `Message`, and `Notification`.
`Conversation` and `Message` are both registered as models in
`Backend/models/Message.js`. The `db.js` and `db/config.js` files contain
connection code, not additional data models.

No custom collection names are supplied in these schemas. The collection names
listed below are therefore Mongoose's default pluralized names, not a
verification of collections currently present in a live database.

| Model | Default collection |
|---|---|
| User | `users` |
| NGO | `ngos` |
| Camp | `camps` |
| CampApplication | `campapplications` |
| CampQuestion | `campquestions` |
| CampAnnouncement | `campannouncements` |
| CampReport | `campreports` |
| CaseStudy | `casestudies` |
| Comment | `comments` |
| ContentReport | `contentreports` |
| MentorshipRequest | `mentorshiprequests` |
| ForumPost | `forumposts` |
| Group | `groups` |
| Event | `events` |
| Resource | `resources` |
| Conversation | `conversations` |
| Message | `messages` |
| Notification | `notifications` |

## 3. Entity descriptions and attributes

Unless noted otherwise, every top-level model has a MongoDB `_id` identifier
of type `ObjectId` and Mongoose `createdAt` / `updatedAt` timestamps. “Required”
and “unique” below refer to schema declarations; unique indexes are ultimately
enforced by MongoDB only when the corresponding indexes exist and are built.
Fields not labelled required may be absent or have schema defaults.

### User (`users`)

Stores account, role, profile, authentication, and mentor information. The
`role` enum is `mentor`, `mentee`, `student`, `ngo`, or `admin`.

- `name: String` (required); `email: String` (required, unique); `password:
  String` (optional, minimum length 8); `googleId: String` (default `null`).
- `specialty`, `subspecialty`, `careerStage`, `goals`,
  `communicationPreference`, `institution`, `hospital`, `location`, `bio`,
  `degrees`, and `licenseNumber`: `String`.
- `dateOfBirth: Date`; `rating`, `reviewsCount`, `experienceYears`,
  `activeMenteesCount`, and `caseStudiesCount: Number`; `areasOfInterest:
  String[]`.
- `savedCaseStudies: ObjectId[]` references `CaseStudy`.
- `notificationPreferences`: embedded object with Boolean `mentorship`,
  `messages`, `caseComments`, and `community` fields.
- `publications`: embedded array with `title`, `journal`, and `year` strings.
  `reviews`: embedded array with `author`, `time`, and `text` strings and a
  `rating` number.
- `emailVerified: Boolean`; `emailVerificationToken: String`;
  `emailVerificationExpires: Date`; `mentorVerificationStatus: String` (enum
  `not_required`, `pending`, `verified`, `rejected`);
  `mentorCredentialPath: String`; `resetPasswordToken: String`;
  `resetPasswordExpires: Date`; `isBanned: Boolean`.

Email verification and password-reset tokens are fields on `User`; no separate
OTP or token collection is declared.

### NGO (`ngos`)

Stores an NGO profile and its verification and impact statistics.

- `owner: ObjectId` references `User` (required, unique, indexed); `name:
  String` (required, max 120); `mission: String` (required, max 2000);
  `location: String` (required, max 160).
- `logoUrl`, `website`, and `verificationDocPath: String`;
  `causeTags: String[]`; `isDemo: Boolean`.
- `verificationStatus: String` (enum `pending`, `verified`, `rejected`);
  `verificationDocStatus: String` (enum `unverified`, `pending_review`,
  `approved`, `rejected`).
- `beneficiariesServed`, `campsCompleted`, `volunteersEngaged`, and
  `totalVerifiedHours: Number` (minimum 0); `verifiedAt: Date`.
- `campaigns`: embedded array with `title: String` (required), `description:
  String`, and `status: String` (enum `active`, `completed`). The campaign
  sub-schema explicitly disables its own `_id`.

### Camp (`camps`)

Represents an NGO-organized volunteer camp.

- `ngo: ObjectId` references `NGO` (required, indexed); `title: String`
  (required, max 160); `causeCategory: String` (required, max 80);
  `description: String` (max 3000).
- `startAt`, `endAt: Date` (`startAt` required and indexed);
  `venue: String` (required, max 240); `latitude`, `longitude: Number`;
  `capacity: Number` (required, range 1–10000).
- `applicationsCount: Number`; `prerequisiteSkills: String[]`;
  `isPublished`, `isDemo: Boolean` (`isPublished` indexed).

### CampApplication (`campapplications`)

Records a user's application to a camp.

- `camp: ObjectId` references `Camp` (required, indexed);
  `student: ObjectId` references `User` (required, indexed);
  `statement: String` (required, max 1500).
- `status: String` (enum `consent_pending`, `pending`, `approved`, `rejected`,
  `waitlisted`, `completed`, `cancelled`; indexed);
  `consentStatus: String` (enum `not_required`, `pending_email`,
  `pending_document_review`, `approved`; indexed).
- `volunteerHours: Number`; `completedAt: Date`; `qrCode`, `qrTokenHash:
  String`; `checkedInAt: Date`; `badgeIssued: Boolean`; `guardianEmail:
  String`; `consentTokenHash: String`; `consentTokenExpiresAt: Date`;
  `consentDocumentPath: String`; `waitlistPosition: Number`.
- A compound unique index is declared on `(camp, student)`, allowing at most
  one application document per camp/user pair when the index is present.

### CampQuestion (`campquestions`)

Stores a question on a camp and its replies.

- `camp: ObjectId` references `Camp` (required, indexed);
  `author: ObjectId` references `User` (required);
  `authorName: String` (required); `body: String` (required, max 2000).
- `replies`: embedded array; each reply has its own generated `_id`, timestamps,
  required `author: ObjectId` reference to `User`, required `authorName:
  String`, required `authorRole: String`, and required `body: String` (max
  2000).

### CampAnnouncement (`campannouncements`)

Stores an announcement sent in relation to a camp.

- `camp: ObjectId` references `Camp` (required, indexed);
  `ngo: ObjectId` references `NGO` (required, indexed);
  `sentBy: ObjectId` references `User` (required).
- `subject: String` (required, max 200); `body: String` (required, max 3000);
  `recipientCount: Number`.

### CampReport (`campreports`)

Stores an NGO's report for a camp.

- `camp: ObjectId` references `Camp` (required, unique, indexed); `ngo:
  ObjectId` references `NGO` (required, indexed); `submittedBy: ObjectId`
  references `User` (required).
- `beneficiariesServed`, `volunteersAttended: Number` (required, minimum 0).
- `resourcesDistributed`: embedded object with `kits`, `medicines`, `books`,
  and `other: Number` (default 0, minimum 0).
- `successNotes: String` (required, max 5000); `photoUrls: String[]`;
  `attendeeApplicationIds: ObjectId[]` references `CampApplication`.

### CaseStudy (`casestudies`)

Stores a case study authored by a user, including clinical narrative fields.

- `title: String` (required); `specialty: String` (required, indexed);
  `subspecialty: String`; `author: ObjectId` references `User` (required).
- `authorName: String` (required); `authorRole`, `authorInitials: String`;
  `authorVerified: Boolean`; `preview: String` (required).
- `ageRange`, `sex`, `presentingComplaint`, `history`, `investigations`,
  `diagnosis`, `treatment`, `outcome: String`; `learningPoints: String[]`.
- `upvotes: ObjectId[]` references `User`; `upvotesCount`, `commentsCount:
  Number`; `status: String` (enum `published`, `draft`, `flagged`).
- A text index is declared on `title`, `preview`, and `diagnosis`.

### Comment (`comments`)

Stores a comment associated with a case study.

- `caseId: ObjectId` references `CaseStudy` (required, indexed);
  `author: ObjectId` references `User` (required);
  `authorName: String` (required); `authorRole: String`;
  `authorVerified: Boolean`; `initials: String`;
  `text: String` (required); `likes: ObjectId[]` references `User`;
  `likesCount: Number`.
- `moderationStatus: String` (enum `visible`, `hidden`; indexed).

### ContentReport (`contentreports`)

Stores a user's report concerning a case or comment.

- `reporter: ObjectId` references `User` (required, indexed);
  `targetType: String` (required; enum `case`, `comment`);
  `targetId: ObjectId` (required; no `ref` is declared);
  `caseId: ObjectId` references `CaseStudy` (required, indexed).
- `reason: String` (required; enum `Patient privacy concern`,
  `Harassment or abuse`, `Potentially unsafe content`, `Other`);
  `details: String` (max 1000); `status: String` (enum `pending`,
  `dismissed`, `actioned`; indexed).
- `reviewedBy: ObjectId` optionally references `User`; `reviewedAt: Date`.
- A non-unique compound index is declared on `(reporter, targetType, targetId,
  status)`.

### MentorshipRequest (`mentorshiprequests`)

Records a mentorship request between two users.

- `mentee`, `mentor: ObjectId` reference `User` (both required and indexed).
- `status: String` (enum `pending`, `accepted`, `declined`);
  `goals`, `note: String`.
- A non-unique compound index is declared on `(mentee, mentor)`.

### ForumPost (`forumposts`)

Stores a community forum post and its embedded replies.

- `title`, `content: String` (both required); `category: String` (enum
  `Career Guidance`, `Exam Prep`, `General Clinical`, `Research & Academic`,
  `Work-Life & Wellbeing`); `tags: String[]`.
- `author: ObjectId` references `User` (required); `authorName: String`
  (required); `authorRole`, `authorSpecialty`, `initials: String`;
  `authorVerified: Boolean`; `upvotes: Number`;
  `upvotedUsers: ObjectId[]` references `User`; `isPinned: Boolean`.
- `replies`: embedded array (each subdocument has a generated `_id`) with
  `author: ObjectId` reference to `User` (required), `authorName: String`
  (required), `authorRole`, `authorSpecialty`, `initials: String`,
  `authorVerified: Boolean`, `content: String` (required), `likes: ObjectId[]`
  referencing `User`, and `createdAt: Date`.

### Group (`groups`)

Stores a community group, membership references, and embedded group posts.

- `name`, `description: String` (both required); `specialty`, `icon: String`;
  `createdBy: ObjectId` references `User` (required);
  `memberIds: ObjectId[]` references `User`.
- `posts`: embedded array (with generated `_id` and timestamps); each post has
  `author: ObjectId` reference to `User` (required), `content: String`
  (required), and `likes: ObjectId[]` referencing `User`.

### Event (`events`)

Stores a community event and its user references.

- `title: String` (required); `description: String`; `speakerName: String`
  (required); `speakerTitle`, `speakerSpecialty`, `speakerHospital: String`;
  `date: Date` (required); `durationMinutes: Number`;
  `eventType: String` (enum `webinar`, `workshop`, `grand_rounds`,
  `journal_club`, `panel`); `specialty`, `meetingLink: String`.
- `host: ObjectId` references `User` (required);
  `attendeeIds: ObjectId[]` references `User`.

### Resource (`resources`)

Stores a shared resource and its uploader/like references.

- `title: String` (required); `description: String`;
  `resourceType: String` (enum `pdf`, `link`, `article`, `notes`, `guideline`);
  `url`, `fileName`, `fileSize`, `storageName`, `specialty: String`;
  `tags: String[]`; `downloadsCount: Number`.
- `uploader: ObjectId` references `User` (required);
  `likes: ObjectId[]` references `User`.

### Conversation (`conversations`)

Stores participants and summary state for a message thread.

- `participants: ObjectId[]` references `User` (each array element is declared
  required; the schema does not declare a minimum array length).
- `lastMessage: String`; `lastMessageAt: Date`;
  `unreadCounts: Map<Number>` (map keys are used as user identifiers by the
  application).

### Message (`messages`)

Stores an individual message in a conversation.

- `conversationId: ObjectId` references `Conversation` (required, indexed);
  `sender`, `recipient: ObjectId` references `User` (both required);
  `senderName: String`; `text: String` (required);
  `isRead: Boolean`.

### Notification (`notifications`)

Stores a notification for a user.

- `recipient: ObjectId` references `User` (required, indexed);
  `actor: ObjectId` optionally references `User`.
- `category: String` (required; enum `mentorship`, `messages`,
  `caseComments`, `community`); `title: String` (required, max 120);
  `message: String` (required, max 300); `page: String` (required; enum
  `messages`, `mentor-profile`, `case-detail`, `camps`);
  `targetId: String`; `readAt: Date`.
- A compound index is declared on `(recipient, createdAt)` with descending
  `createdAt`.

## 4. Relationship descriptions

All connections below are based on declared `ObjectId` references unless
explicitly called out as an array relationship. A reference records an
identifier in a document; it does not, by itself, establish referential
integrity.

- **User–NGO:** each NGO has one required owner, and `NGO.owner` is unique.
  Therefore a user can own zero or one NGO and an NGO has exactly one owner.
- **NGO–Camp:** each camp references one NGO; an NGO can organize multiple
  camps.
- **Camp–CampApplication / User–CampApplication:** each application references
  one camp and one student (`User`). A camp and a student can each be related
  to multiple applications. The unique `(camp, student)` index prevents
  duplicate pairs when built.
- **Camp–CampQuestion / User–CampQuestion:** each question references one camp
  and one author. A question can also contain multiple embedded replies with
  user-author references; replies are not a separate collection.
- **Camp–CampAnnouncement / NGO–CampAnnouncement / User–CampAnnouncement:**
  each announcement references one camp, NGO, and sending user. Each referenced
  entity can be associated with multiple announcements.
- **Camp–CampReport:** a report has one required, unique camp reference.
  Consequently each camp can have zero or one report, and each report belongs
  to one camp.
- **NGO–CampReport / User–CampReport:** each report references one NGO and one
  submitting user; each can be associated with multiple reports.
- **CampReport–CampApplication:** a report stores an array of application
  references. This is shown as a reference-array association. The schema does
  not constrain the referenced applications to the report's camp.
- **User–CaseStudy:** each case study has one required author; users can author
  multiple case studies. The case study's `upvotes` and user's
  `savedCaseStudies` are separate arrays of references, so the diagram also
  shows a many-to-many association for saved/upvoted case studies.
- **CaseStudy–Comment / User–Comment:** each comment references one case study
  and one author; a case study and a user can each be related to multiple
  comments. `Comment.likes` adds a many-to-many user-reference association.
- **User–ContentReport / CaseStudy–ContentReport:** every content report has a
  reporter and a required `caseId` reference to a case study. `reviewedBy` is
  optional and may reference a user.
- **User–MentorshipRequest:** each request has a required `mentee` and
  `mentor`, both referencing `User`. Each user can therefore appear in multiple
  requests in either role. A compound non-unique index is declared; the schema
  does not enforce one request per user pair.
- **User–ForumPost:** each post has one author; users can author multiple
  posts. `upvotedUsers`, embedded reply authors, and embedded reply likes
  contain additional user references.
- **User–Group:** each group has one creator. `memberIds` is an array of user
  references (many-to-many membership); embedded group-post authors and likes
  also reference users.
- **User–Event:** each event has one host; `attendeeIds` is an array of user
  references.
- **User–Resource:** each resource has one uploader; `likes` is an array of
  user references.
- **User–Conversation:** conversations store an array of user participants,
  representing a many-to-many association. The schema does not enforce a
  minimum participant count.
- **Conversation–Message:** each message references one conversation; a
  conversation can be associated with multiple messages.
- **User–Message:** each message has one sender and one recipient, both
  required user references; a user can send or receive multiple messages.
- **User–Notification:** each notification has one required recipient and an
  optional actor; users can be recipients or actors for multiple notifications.

## 5. MongoDB modelling notes

- Each model uses a MongoDB document `_id` of type `ObjectId`, automatically
  supplied by Mongoose unless a schema says otherwise. Mongoose timestamps add
  `createdAt` and `updatedAt` to all listed top-level models.
- `FK` in the diagram is a compact visual label for a field declared with
  `ref`. It means an application-level document reference, not a SQL foreign
  key or an automatically enforced MongoDB constraint.
- Arrays of references, including attendees, likes, participants, and saved
  case studies, remain fields on their owning documents; they are not join
  collections.
- Replies and group posts are embedded subdocuments. NGO campaigns,
  notification preferences, and report resource counts are embedded values.
  They are not independent persistent models.
- The NGO campaign sub-schema disables subdocument `_id`; other schema-array
  subdocuments use Mongoose's default generated `_id` unless specified
  otherwise.
- Some fields are denormalized display or count values (for example
  `authorName`, `likesCount`, and `applicationsCount`). They are stored
  attributes, not relationships.

## 6. Design assumptions and limitations

- The ERD includes only model schemas declared in the backend. No
  `Doctor`, `Patient`, appointment, or prescription model is declared in the
  inspected backend; the application contains user specialty and hospital
  profile fields, case studies, mentoring, and volunteer-community workflows.
- Authentication routes store email-verification and password-reset token data
  on `User`. No OTP model or separate OTP collection is declared.
- The source confirms Mongoose model names and does not specify custom
  collection names. Default collection names in this document are inferred
  from Mongoose naming behavior; live database collections were not inspected.
- `ContentReport.targetId` is a generic `ObjectId` without a schema `ref`.
  Although `targetType` distinguishes case and comment, only `caseId` is
  explicitly related to `CaseStudy`; the code does not establish a formal
  `Comment` reference for `targetId`.
- Application-level validation may impose extra business rules, but this ERD
  reports schema constraints and explicit references. It does not infer a
  relationship or constraint solely from the product domain.
- The diagram lists principal fields to remain readable. The entity descriptions
  in this document are the fuller attribute inventory. Neither the ERD nor
  this document reflects runtime database contents, index build state, or
  records created outside the application.

## 7. Diagram insertion guidance

To insert the generated PNG into Microsoft Word:

1. Open the report and select **Insert > Pictures > This Device**.
2. Choose `docs/medconnect-erd.png`.
3. Use **Layout Options** to select **In Line with Text** or a suitable
   **Square** wrapping option, then center the image.
4. Preserve the image's aspect ratio when resizing. Add a caption such as
   **Figure X: MedConnect Entity-Relationship Diagram** and refer to it in the
   report text.

To preview the source, open `docs/medconnect-erd.mmd` in an editor with Mermaid
support, or paste its contents into a trusted local Mermaid renderer. The SVG
companion can be used where scalable vector graphics are preferred.
