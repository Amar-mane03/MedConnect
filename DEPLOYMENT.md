# Deploying MedConnect on Render

The `render.yaml` blueprint creates a Node API and a static React frontend.
Connect `Amar-mane03/MedConnect` in Render as a Blueprint and deploy the `main`
branch. Enter the environment variables requested by Render in the service
dashboards; do not commit secrets to this repository.

Before the API can start, create a MongoDB Atlas database, allow the Render
service to connect in Atlas Network Access, and set these API environment
variables:

- `MONGO_URI`
- `EMAIL_USER` and `EMAIL_PASS`
- `JWT_SECRET` and `ADMIN_SECRET` (use long, unique random values)
- `FRONTEND_URL` (the deployed frontend origin, without a trailing slash)
- `GOOGLE_CLIENT_ID` (if Google sign-in is enabled)

On the frontend service, set:

- `VITE_API_URL` to the API's public URL followed by `/api`
- `VITE_SOCKET_URL` to the API's public URL without `/api`
- `VITE_GOOGLE_CLIENT_ID` to the same Google client ID, if Google sign-in is enabled

After changing frontend `VITE_` variables, redeploy the frontend. For Google
sign-in, add the deployed frontend origin to the OAuth client's authorized
JavaScript origins.

**Uploaded clinician credentials need persistent storage.** The API currently
writes them to `Backend/uploads/credentials`, but Render's local filesystem is
ephemeral. Configure persistent object storage before relying on production
uploads.
