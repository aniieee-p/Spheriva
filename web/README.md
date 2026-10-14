# Spheriva Web Dashboard

React web application for trusted contacts to view emergency alerts and location information.

## Prerequisites

- Node.js v18+ installed
- Backend server running

## Setup Instructions

### 1. Install Dependencies

```bash
cd web
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and update `REACT_APP_API_URL` if your backend is running on a different port or domain.

### 3. Run the Development Server

```bash
npm start
```

The app will open at `http://localhost:3000`

## Project Structure

```
web/
├── public/             # Static assets
├── src/
│   ├── components/     # Reusable React components
│   ├── pages/          # Page components
│   ├── services/       # API service calls
│   ├── context/        # React Context (if needed)
│   ├── App.js          # Main app component
│   ├── index.js        # Entry point
│   └── index.css       # Global styles with Tailwind
├── tailwind.config.js  # Tailwind CSS configuration
└── package.json
```

## Available Routes

- `/` - Home page with project information
- `/dashboard/:sessionToken` - Emergency session dashboard (requires valid token)
- `*` - 404 Not Found page

## Current Features (Phase 1)

- Responsive layout with Tailwind CSS
- Basic routing structure
- API service configuration
- Home page and dashboard skeleton

## Upcoming Features

- Real-time emergency alert display
- Interactive map with location tracking
- Alert acknowledgment functionality
- Session timeline and history
- Real-time updates using WebSockets or polling

## Building for Production

```bash
npm run build
```

The production-ready files will be in the `build/` directory.

## Deployment

The web dashboard can be deployed to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Any static hosting service

Make sure to set the `REACT_APP_API_URL` environment variable to your production backend URL.

## Styling

This project uses Tailwind CSS for styling. Tailwind provides utility classes for rapid UI development.

Primary color: Indigo (#6366f1)

## Testing

```bash
npm test
```

Launches the test runner in interactive watch mode.
