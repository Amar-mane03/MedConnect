# MedConnect User Guide

MedConnect is a professional learning and mentorship community for clinicians. It brings together de-identified teaching cases, peer discussion, mentor connections, study resources, specialty groups, and clinical events.

> **Important:** MedConnect is not a patient-care clinic or appointment service. Do not share patient names, NHS numbers, or other identifying health information. Keep cases and discussion posts de-identified.

## Who can use MedConnect?

- **Mentees** (for example, medical students, residents, and registrars) can explore cases and resources, find mentors, request mentorship, join discussions and specialty circles, message clinicians, and RSVP to events.
- **Mentors** (for example, attending physicians and consultants) can do those things as well as publish case teaching and host events. Mentor credentials can be submitted for administrator review; verified mentors receive a verification status on their profile.
- **Administrators** have access to platform governance tools, including mentor credential review, content moderation, and user account management.

## Getting started

1. Open the MedConnect home page and choose **Create Account** (or use **Sign in** if you already have an account).
2. Select **Mentee** or **Mentor**, enter the requested account details, and complete the profile questions. Mentees are asked about career stage and learning goals. Mentors can provide professional details and submit a credential or licence document for review.
3. Follow the email verification instructions to activate your account. If you need a new verification email, use **Resend verification email** on the sign-in screen.
4. Sign in to open your dashboard. If you forget your password, choose **Forgot password?** on the sign-in form.

Some pages require an account. If you open one while signed out, MedConnect will ask you to sign in and then return you to the page.

To start the frontend locally, open a terminal in `Frontend` and run `npm start` (or `npm run dev`). Start the backend from `Backend` with `npm start` and ensure MongoDB is running at the host configured by `MONGO_URI`.

For a deployed frontend and backend on different hosts, configure `VITE_API_URL` as the backend API origin ending in `/api` and `VITE_SOCKET_URL` as the backend origin in the frontend hosting environment, then rebuild and redeploy the frontend. If the backend is served from the same origin as the site, these settings can be omitted. Configure the backend's `FRONTEND_URL` to the deployed frontend origin and ensure its MongoDB service is reachable. Vite embeds these frontend settings at build time; `127.0.0.1` is only used as the development backend default.

### Community hub

Choose **Community** on the home page or open `/community` to access the community hub (`/demo` remains as a backward-compatible URL). Signed-in members see recent live teaching cases, discussions, resources, learning groups, and upcoming events from the configured backend, with links into the full feature pages to read, post, join, share, or RSVP. If a section cannot load, the hub displays an error and lets you retry. Signing in is required for these community features; visitors can continue to browse the public NGO directory and volunteer camp calendar before creating an account. Public NGO and camp pages show only records returned by the live backend; when there are no records, they explain how verified organizations can publish real opportunities instead of substituting fictional samples. If the database contains demo NGO or camp records, a persistent site banner warns that the listings and activity are fictional, and each such record is marked **Demo Test**.

## Local demo accounts and sample content

For a local walkthrough, start a local MongoDB instance and seed a small set of fictional accounts and content. The seed command refuses production mode and remote MongoDB hosts; it never falls back to the database URL in `MONGO_URI`. Seeding is manual, not automatic: run it once and MongoDB retains those records across backend and computer restarts. Keep `MONGO_URI` set to `mongodb://127.0.0.1:27017/medconnect_demo` when running the local app so it reconnects to the seeded database.

Run backend API checks from `Backend` with `npm test`.

The backend loads local development overrides from the git-ignored `Backend/.env.local` first, then uses `Backend/.env` for settings not specified locally. This lets the demo database and admin secret remain local and uncommitted. Without a database name in `MONGO_URI`, the backend uses `test` and logs the selected database at startup. Do not point a production deployment at the demo database.

In PowerShell, from `Backend`:

```powershell
@'
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/medconnect_demo
MONGO_DB_NAME=medconnect_demo
DEMO_MONGO_URI=mongodb://127.0.0.1:27017/medconnect_demo
ALLOW_DEMO_SEED=true
DEMO_PASSWORD=replace-with-your-own-local-password-at-least-12-characters
'@ | Add-Content .env.local
npm run seed:demo
npm start
```

If `Backend/.env.local` already exists, add the settings to it without overwriting its existing values (for example, `ADMIN_SECRET`). Use your own local demo password and keep `.env.local` private. You must have a local MongoDB server running before seeding.

Use the password you chose with any of these local-only accounts:

- `learner@demo.medconnect.test` — mentee account with a sample case, discussion, group, event, mentorship request, message, and notification.
- `mentor@demo.medconnect.test` — verified mentor account with sample teaching content and an incoming mentorship request.
- `pending.mentor@demo.medconnect.test` — mentor awaiting verification, for the review workflow.
- `admin@demo.medconnect.test` — administrator account with a sample moderation report.
- `student@demo.medconnect.test` — student volunteer with pending, approved, and completed field-camp applications plus a downloadable sample service certificate.
- `ngo@demo.medconnect.test` — verified NGO representative with upcoming and completed camps, volunteer applications, and a printable impact report.
- `ngo.education@demo.medconnect.test` — second verified NGO representative with education-focused camp opportunities.
- `pending.ngo@demo.medconnect.test` — NGO representative with an organization waiting in the admin verification queue.

All demo accounts use the password selected in `DEMO_PASSWORD`. NGO names, student identities, camp locations and details, photos, and impact figures are fictional sample content and do not describe verified real-world activity. The seed script is idempotent; rerunning it refreshes the demo records. Do not use these accounts or the seed command in production.

### Creating a local development administrator

The public account form intentionally has no administrator role. When running the frontend in Vite development mode, choose **Administrator** on the registration form and enter the development `ADMIN_SECRET`. Configure a strong, private `ADMIN_SECRET` value in the git-ignored `Backend/.env.local` file first, then restart the backend. If email delivery is not configured, the local registration screen provides a development-only verification link after signup. Verify the email, then sign in normally. Never expose this secret in frontend environment variables or use the development registration flow on a public site.

## Finding your way around

On desktop, use the left navigation for the clinical feed, mentors, forums, and messages. On mobile, use the bottom navigation or the menu button. The dashboard also provides links to events, resources, and specialty circles. Use the profile menu to return home, open the mentor directory, sign out, or (for administrators) open the Admin Portal.

## Features and how to use them

### Clinical case feed

Browse the feed by specialty, or search case titles, diagnoses, and summaries. Apply topic and date filters to narrow results, and use **Saved cases** to see cases you have bookmarked. Open a case to read its teaching content, comment, and upvote it. Mentors can use **Publish case** to share a teaching case; the form asks the author to confirm that patient-identifying details have been removed.

### Mentor directory and mentorship

Open **Mentors Directory** (or **Find mentor** from the dashboard) to browse clinicians and open a profile for more information, such as specialty, experience, biography, and publications when provided. Mentees can select **Request Mentorship**, add an introductory note and goals, and send the request. Mentors can review incoming requests from their dashboard and accept or decline them. A mentee can also use **Send Direct Message** from a mentor profile.

### Discussion forums

Choose a topic category, search threads or tags, and sort by newest or most upvoted. Open a thread to read and reply; use the available upvote and like actions to react. Choose **Start new discussion** to post a topic for the community.

**Forum privacy rule:** Do not include real patient names, NHS numbers, or identifiable clinical vignettes. Use the case feed for appropriately de-identified clinical teaching cases.

### Messages

Open **Messages** to view existing conversations. Select a conversation to continue it, or choose a mentor from the available list to start one. Messages are delivered in real time when the connection is active. Keep all messages professional and do not include patient-identifying information.

### Resource library

Browse shared study notes, guidelines, articles, and clinical references. Filter by specialty or resource type, search titles/topics/tags, and sort by newest, most liked, or most downloaded. Each format filter shows resources in that format. Use **Access** to download an uploaded document or open an external link, and the like button to recommend useful material. To contribute, choose **Share material**, provide the specialty, format, title, tags, and a short summary. The form changes with the selected format: **PDF or Word Document** shows a file picker for PDF, DOC, or DOCX files up to 10 MB; other formats show a URL field. Choose **Share with Peers** to publish it.

### Specialty circles

Search circles and filter them by specialty. Use **Join** to join a circle, then open its **Feed** to read and contribute to group discussions. Switch between **All Circles** and **My Circles** to browse or return to groups you have joined. Choose **Create specialty circle** to set up a circle with a specialty, name, and description.

### Events and Grand Rounds

Browse upcoming sessions or past event listings, then filter by specialty or search for a lecture or speaker. Choose **RSVP** to register or cancel your registration. If the host has supplied a meeting link, choose **Join Room** to open it. Mentors and administrators can choose **Host a Grand Round / Webinar** and enter the session details and meeting link.

### Notifications

Use the bell in the top bar to review activity about mentorship requests, messages, and case replies. Open an item to go to the related area, or choose **Mark all read**. Under **Preferences**, choose which of those activity categories appear in your notifications.

### Admin Portal

The Admin Portal is restricted to administrator accounts. Administrators can view platform activity, review pending mentor credentials, and inspect user accounts. They can also review reported cases or comments, then dismiss a report or hide the reported content. Use these tools to support safe, professional community participation.

## Privacy and good community practice

- Never post patient names, contact details, record numbers, dates or combinations of facts that could identify a patient.
- Only share cases after removing patient-identifying information.
- Keep conversations professional and use the platform for education, peer learning, and mentorship—not for urgent clinical decisions or patient care.
- Report content that appears unsafe or includes identifying information so it can be reviewed.

## NGO community and field training

The public **NGO Directory** and **Upcoming Camps** pages can be browsed without signing in. Search verified organizations by cause or location, open a profile to review its mission, campaigns, and impact metrics, and view camps by cause. Camps with venue coordinates also appear on an interactive map. Volunteers apply to individual camps; browsing an NGO profile does not automatically create an NGO membership. Selecting **Sign in to apply** while signed out opens an inline sign-in or student-registration prompt. Directory and camp listings provide retry controls when the live backend cannot be reached. An empty list means there are currently no matching verified organizations or published camps in the configured database.

### Student / volunteer

Create an account as **Student / Volunteer**, then use **Upcoming Camps** to select a camp and submit a short volunteer statement. Your date of birth is requested when applying. Volunteers under 18 must either request email sign-off from a parent, guardian, or faculty coordinator, or upload a signed consent form. The linked consent template is a PDF; uploaded forms are reviewed by an administrator. An application to a full camp is added to its waitlist.

**My Activities** shows application and waitlist status, check-in QR codes for approved camps, attendance badges, and completed verified hours. Cancel an active application to release its place; the first eligible waitlisted volunteer is promoted automatically. Use **Download verified transcript (PDF)** to export completed camps and verified hours.

### NGO representative

Create an account as an **NGO Representative** and open the NGO dashboard. Submit your organization name, mission, location, causes, and optional campaign details. An optional registration certificate or license can be uploaded after creating the profile; it is stored privately and starts in **Pending review**. A platform administrator must verify the profile before it appears in public search or can publish camps.

Verified representatives can create and edit camps, add venue coordinates for map discovery, review applications, send in-app and email announcements to approved volunteers, and reply to volunteer questions on the camp details page. During a camp, open **QR check-in** to scan volunteer codes using a mobile camera or paste QR contents.

The post-camp report records beneficiaries served, volunteers attended, resources distributed, success notes, optional photo URLs, and checked-in student volunteers. Verified hours are recorded for checked-in participants when the report is submitted. The report can be printed or saved as a PDF, and includes participant names plus signature and organization stamp areas. Public NGO profiles show a summary ticker for beneficiaries, completed camps, and verified volunteer hours.

### Administrator

Use **NGO Verification** to approve or reject organization profiles and to review optional private organization documents. The same page includes a queue for uploaded minor consent forms. Only approved organizations are visible in the public directory and permitted to publish or manage camps.

### NGO platform API

Community data is served under `/api/community`: public NGO and camp discovery, private document and consent workflows, camp Q&A and announcements, waitlists, QR attendance, student transcript exports, post-camp reports, and administrator-only verification queues. Role checks are enforced by the backend as well as the role-specific navigation.
