# Spheriva Mobile App

React Native mobile application for Spheriva personal safety system.

## Prerequisites

Before running the mobile app, ensure you have:

1. **Node.js** v18+ installed
2. **Android Studio** installed with:
   - Android SDK
   - Android SDK Platform 34 (or latest)
   - Android SDK Build-Tools
   - Android Virtual Device (AVD) or physical Android device
3. **Java Development Kit (JDK)** 11 or newer

## Setup Instructions

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and update `API_BASE_URL`:
- For emulator: `http://10.0.2.2:5000/api`
- For physical device: `http://YOUR_COMPUTER_IP:5000/api`

### 3. Android Setup

For a full React Native Android setup, you'll need to initialize the Android project structure:

```bash
# This will create the necessary Android native code
npx react-native init SpherivaTempApp
# Then copy the android folder to this project
```

Alternatively, use Expo for easier development without native setup.

### 4. Run the App

```bash
# Start Metro bundler
npm start

# In another terminal, run on Android
npm run android
```

## Project Structure

```
mobile/
├── src/
│   ├── screens/        # Screen components
│   ├── components/     # Reusable components
│   ├── navigation/     # Navigation configuration
│   ├── services/       # API service calls
│   ├── context/        # React Context (Auth, etc.)
│   └── utils/          # Utility functions
├── android/            # Android native code
├── App.js              # Root component
└── index.js            # App entry point
```

## Current Features (Phase 1)

- User registration and login
- JWT authentication
- Persistent login state
- Profile management

## Upcoming Features

- Fake call simulation
- Trusted contacts management
- Emergency SOS
- Real-time location sharing
- Push notifications

## Testing on Physical Device

1. Enable Developer Options on your Android device
2. Enable USB Debugging
3. Connect device via USB
4. Run `adb devices` to verify connection
5. Update `.env` with your computer's local IP address
6. Run `npm run android`

## Troubleshooting

### Metro bundler errors
```bash
npm start -- --reset-cache
```

### Android build errors
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Connection issues
- Ensure backend server is running on the correct port
- Check firewall settings allow connections
- Verify IP address in `.env` is correct
