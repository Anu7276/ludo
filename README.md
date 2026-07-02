# Ludo Online

A real-time online Ludo game built with Next.js, Socket.IO, Cloud Run, and Firestore. Create a room, share the code with friends, and play together from different locations.

## Live App

https://ludo-web-illg3ukkca-el.a.run.app

## Features

- Real-time multiplayer Ludo
- Create private rooms
- Join with room code
- Play with friends online
- Add bots
- Live dice rolls and piece movement
- Turn timer
- In-game chat
- Firestore-backed room snapshots
- Cloud Run deployment for web and realtime services

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Socket.IO
- Firebase Firestore
- Google Cloud Run
- Docker

## Project Structure

```txt
src/
  app/
  components/ludo/
  stores/
  lib/ludo/

mini-services/
  ludo-service/
    index.ts
    Dockerfile

deploy/
  cloud-run.md

  Local Development
Install dependencies:
npm install
cd mini-services/ludo-service
npm install
Start the realtime service:
cd mini-services/ludo-service
npm run dev
Start the Next.js app in another terminal:
npm run dev
Open:
http://localhost:3000
Environment Variables
Frontend:
NEXT_PUBLIC_LUDO_SOCKET_URL=http://localhost:3003
NEXT_PUBLIC_LUDO_SOCKET_PATH=/
Realtime service:
PORT=3003
FIREBASE_PROJECT_ID=your-firebase-project-id
FIRESTORE_DISABLED=false
For offline local testing without Firestore:
FIRESTORE_DISABLED=true
Build
npm run build
Lint
npm run lint
Deploy
The app is deployed as two Cloud Run services:
ludo-service for Socket.IO realtime gameplay
ludo-web for the Next.js frontend
See:
deploy/cloud-run.md
Current deployment:
Web: https://ludo-web-illg3ukkca-el.a.run.app
Realtime: https://ludo-service-illg3ukkca-el.a.run.app
GitHub Actions
A manual deploy workflow is included:
.github/workflows/deploy-cloud-run.yml
Required GitHub secrets:
GCP_PROJECT_ID
GCP_SERVICE_ACCOUNT
GCP_WORKLOAD_IDENTITY_PROVIDER
Notes
Cloud Run supports WebSockets. The realtime service is configured with one max instance so players in the same room stay on the same Socket.IO process.
Firestore is used for room snapshots and chat persistence. Live gameplay is handled through Socket.IO for low-latency updates.
