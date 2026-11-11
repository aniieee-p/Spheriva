# Spheriva – Privacy-First Personal Safety and Emergency Response System

**A Final-Year Major Project**

Spheriva is a privacy-focused personal safety application designed to help users handle uncomfortable or potentially unsafe situations discreetly. It aims to provide emergency assistance through trusted contacts, SOS alerts, location sharing, and simulated incoming calls.

The project combines a mobile application, backend API, and web-based Trusted Circle Dashboard to support communication between users and their authorized emergency contacts.

## Key Features

- **User Authentication:** Registration, login, and authenticated access.
- **Fake Incoming Call:** Simulated incoming calls to help users discreetly leave uncomfortable situations.
- **Trusted Contacts:** Add and manage trusted emergency contacts.
- **Emergency SOS:** Send emergency alerts to trusted contacts.
- **Real-Time Location Sharing:** Share location during an active safety session.
- **Safety Session Management:** Start, manage, and end authorized safety sessions.
- **Trusted Circle Dashboard:** Web interface for authorized contacts to view emergency alerts and shared location.
- **Safe Journey:** Planned functionality for destination tracking, arrival estimates, and check-in reminders.

> Note: Features are being developed and integrated in phases. Not all listed features are currently complete.

## Technology Stack

### Mobile Application
- React.js
- JavaScript
- Vite
- Capacitor
- Android Studio
- Java/Kotlin for native Android integration

### Backend
- Node.js
- Express.js
- MongoDB Atlas
- Mongoose
- JWT Authentication
- Firebase Admin SDK (planned/integration dependent)

### Web Dashboard
- React.js
- Tailwind CSS
- JavaScript

### Development Tools
- Git and GitHub
- Android Studio
- Visual Studio Code
- Postman
- ClickUp

## Project Structure

```text
Spheriva/
│
├── backend/                 # Node.js and Express backend
│
├── mobile-capacitor/        # Current Capacitor-based mobile application
│   ├── src/                 # React application source
│   └── android/             # Native Android project
│
├── mobile/                  # Earlier React Native implementation
│
├── web/                     # Web dashboard
│
├── README.md
└── .gitignore
```

The `mobile-capacitor/` directory is the current mobile implementation under development. The earlier `mobile/` implementation is retained separately.

## Getting Started

### Prerequisites

Install the following tools before setting up the project:

- Node.js (18 or later)
- npm
- Git
- MongoDB Atlas account
- Android Studio
- Android SDK
- Java Development Kit (JDK)
- Visual Studio Code (recommended)

### 1. Clone the Repository

```bash
git clone https://github.com/aniieee-p/Spheriva.git
cd Spheriva
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory and configure the environment variables required by the backend.

These may include:
- MongoDB connection URI
- JWT secret
- Server port
- Firebase configuration, if enabled

Start the backend using the configured project script:

```bash
npm start
```

### 3. Mobile Application Setup

Open a new terminal from the project root:

```bash
cd mobile-capacitor
npm install
```

Configure the API base URL to point to the backend server.

For local development, use an accessible backend address. For deployed testing, the configured backend URL is:

```text
https://spheriva-backend.onrender.com/api
```

Build the application:

```bash
npm run build
```

Synchronize the web application with the Android project:

```bash
npx cap sync android
```

Open the Android project in Android Studio:

```bash
npx cap open android
```

From Android Studio, build and run the application using an emulator or a connected Android device.

### 4. Web Dashboard Setup

```bash
cd web
npm install
```

Start the web application using the development script configured in the package:

```bash
npm run dev
```

## Project Modules

The project is divided into the following major areas:

| Module | Responsibility |
|---|---|
| Module 1 | Mobile application foundation, authentication, API integration, Android configuration, and overall integration |
| Module 2 | Safety session and background location tracking |
| Module 3 | Emergency contacts and SOS functionality |
| Module 4 | Trusted Circle Dashboard and emergency response workflow |
| Module 5 | Fake incoming call and supporting safety features |

*Module responsibilities may be refined as implementation and integration progress.*

## Development Roadmap

- **Phase 1 – Foundation:** Project setup, authentication, backend connectivity, and mobile application configuration.
- **Phase 2 – Safety Sessions:** Session creation, management, and recovery.
- **Phase 3 – Location Tracking:** Location permissions, foreground/background tracking, and location updates.
- **Phase 4 – Emergency Response:** Trusted contacts, SOS alerts, and notification integration.
- **Phase 5 – Web Dashboard:** Trusted Circle Dashboard and emergency response interface.
- **Phase 6 – Fake Call:** Simulated incoming call and native Android integration.
- **Phase 7 – Testing and Deployment:** Integration testing, bug fixing, and final deployment.

**Target Submission Date:** 30 November 2026

## Security and Privacy

Spheriva is designed with user privacy and controlled emergency access in mind.

- Passwords are securely hashed on the backend.
- JWT authentication is used for protected API endpoints.
- Sensitive configuration is maintained through environment variables.
- Location sharing is intended to operate during authorized safety sessions.
- Emergency access is intended for user-selected trusted contacts.
- Sensitive credentials and secrets must not be committed to the GitHub repository.

## Testing

Testing activities include:

- API testing using Postman.
- Authentication and session workflow testing.
- Android emulator testing.
- Mobile-to-backend connectivity testing.
- Location permission and background tracking testing.
- Integration testing across mobile and web components.

## Deployment

- **GitHub Repository:** https://github.com/aniieee-p/Spheriva
- **Backend API:** https://spheriva-backend.onrender.com
- **Web Application:** https://spheriva.vercel.app

## Project Status

**Current Stage:** Foundation development and integration.

The mobile application foundation, authentication screens, API service structure, backend connectivity configuration, and Android project setup are under development and testing. Additional safety features and end-to-end workflows are being integrated progressively.

## License

This project is developed for academic and educational purposes.

---

**Spheriva – Your Safety, Your Circle, Your Control.**