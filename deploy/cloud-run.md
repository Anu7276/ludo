# Cloud Run Deployment

This project deploys as two Cloud Run services:

- `ludo-service`: Socket.IO realtime game server with Firestore snapshots.
- `ludo-web`: Next.js frontend.

## Current Deployment

Project: `gen-lang-client-0234977408`
Region: `asia-south1`

- Web app: `https://ludo-web-illg3ukkca-el.a.run.app`
- Realtime service: `https://ludo-service-illg3ukkca-el.a.run.app`

Cloud Run supports WebSockets, but each connection is a long-running request. For a small friend group, keep the realtime service on one instance so all players in a room share the same in-memory Socket.IO process.

## Prerequisites

1. Install the Google Cloud CLI.
2. Run `gcloud auth login`.
3. Run `gcloud auth application-default login` for local Firestore testing.
4. Create or choose a Firebase/Google Cloud project and enable Firestore.

## Variables

```sh
PROJECT_ID="your-gcp-project-id"
REGION="us-central1"
```

## Enable APIs

```sh
gcloud services enable run.googleapis.com cloudbuild.googleapis.com firestore.googleapis.com --project "$PROJECT_ID"
```

## Deploy Realtime Service

```sh
gcloud run deploy ludo-service \
  --source mini-services/ludo-service \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars FIREBASE_PROJECT_ID="$PROJECT_ID" \
  --min-instances 1 \
  --max-instances 1 \
  --concurrency 100
```

Copy the deployed service URL from the command output.

## Deploy Web App

```sh
LUDO_SERVICE_URL="https://your-ludo-service-url"

gcloud run deploy ludo-web \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_LUDO_SOCKET_URL="$LUDO_SERVICE_URL",NEXT_PUBLIC_LUDO_SOCKET_PATH="/"
```

Open the `ludo-web` URL, create a room, and share the room code with friends.

Note: `NEXT_PUBLIC_*` values are normally baked into the client bundle at build time. The app also includes a Cloud Run fallback to the current `ludo-service` URL so the deployed frontend can connect even when Cloud Run runtime env vars are not available during the Next.js build.

## Firebase Rules

The app writes Firestore only through the Admin SDK in Cloud Run, so client access is denied by default in `firestore.rules`.

## Optional GitHub Actions Deploy

The repo includes `.github/workflows/deploy-cloud-run.yml` for a manual deploy button in GitHub Actions.

Add these repository secrets before running it:

```sh
GCP_PROJECT_ID=your-gcp-project-id
GCP_SERVICE_ACCOUNT=github-deployer@your-gcp-project-id.iam.gserviceaccount.com
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID
```

The service account needs permission to deploy Cloud Run services and write Cloud Build artifacts. If you prefer a quick first deploy, use the `gcloud run deploy` commands above from your own machine after installing the Google Cloud CLI.
