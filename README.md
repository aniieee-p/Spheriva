# Spheriva — Privacy-First Personal Safety and Emergency Response System

**A B.Tech Computer Science Final Year Major Project**

Spheriva is a personal safety application that helps users leave uncomfortable situations discreetly, alert trusted contacts during emergencies, and share their location during authorized safety sessions.

## Features

- **Fake Incoming Call**: Simulated incoming call with configurable caller details and prerecorded audio
- **Trusted Contacts**: Manage up to 3 verified trusted contacts
- **Emergency SOS**: One-tap SOS alert with push notifications to trusted contacts
- **Real-Time Location Sharing**: GPS-based location sharing during active safety sessions
- **Session Management**: User-controlled emergency sessions with revocable access
- **Trusted Circle Dashboard**: Web dashboard for authorized contacts to view alerts and location
- **Safe Journey** (optional): Set destination, expected arrival, and check-in reminders

## Technology Stack

### Mobile Application
- React Native (JavaScript)
- Android platform
- Firebase Cloud Messaging (push notifications)
- Native modules (Kotlin) for fake call simulation

### Backend
- Node.js
- Express.js
- MongoDB Atlas with Mongoose
- JWT authentication
- Firebase Admin SDK

### Web Dashboard
- React.js
- Tailwind CSS
- Responsive design

## Project Structure

```
Spheriva/
├── mobile/         # React Native Android application
├── backend/        # Express.js API server
├── web/            # React web dashboard
└── docs/           # Additional documentation
```

## Getting Started

### Prerequisites

- Node.js v18+ and npm
- MongoDB Atlas account
- Android Studio (for mobile development)
- Firebase account (for push notifications)

### Installation

Detailed setup instructions for each component:

#### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Configure .env with your MongoDB URI and secrets
npm start
```

#### Mobile Setup
```bash
cd mobile
npm install
# Configure android/local.properties
npx react-native run-android
```

#### Web Setup
```bash
cd web
npm install
npm start
```

## Development Timeline

- **Phase 1**: Foundation and authentication (Weeks 1-4)
- **Phase 2**: Fake call simulation (Weeks 5-6)
- **Phase 3**: SOS and notifications (Weeks 7-9)
- **Phase 4**: Location sharing (Weeks 10-12)
- **Phase 5**: Web dashboard (Weeks 13-14)
- **Phase 6**: Testing and deployment (Weeks 15-16)
- **Phase 7**: Safe Journey (optional, Weeks 17-18)

**Submission Deadline**: 30 November 2026

## Security Considerations

- All passwords are hashed using bcrypt
- JWT-based authentication for API routes
- Environment variables for sensitive configuration
- Session-based location sharing with explicit user authorization
- No secrets in source control or frontend code

## Testing

- API testing: Postman collections
- Unit tests: Jest and Supertest
- Manual testing on physical Android devices

## License

This is an academic project developed for educational purposes.

## Author

Developed as a solo final-year B.Tech Computer Science major project.

---

**Status**: Phase 1 - Foundation setup in progress
