# Deploying MedConnect on Render

The Render Blueprint builds the React frontend and serves it from the Node API in one web service. The website is served at /, API routes remain under /api, Socket.IO uses the same origin, and the health check is /health.

Connect Amar-mane03/MedConnect in Render as a Blueprint and deploy the main branch. Do not commit secrets.

Create a MongoDB Atlas database, allow the Render service to connect in Atlas Network Access, and configure these API environment variables in Render:

- MONGO_URI
- EMAIL_USER and EMAIL_PASS
- JWT_SECRET and ADMIN_SECRET (long, unique random values)
- FRONTEND_URL (the combined service public origin, without a trailing slash)
- GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_ID (the same client ID, if Google sign-in is enabled)

For Google sign-in, add the combined service public origin to the OAuth client authorized JavaScript origins.

**Uploaded clinician credentials need persistent storage.** The API currently writes them to Backend/uploads/credentials, but Render local filesystem is ephemeral. Configure persistent object storage before relying on production uploads.
