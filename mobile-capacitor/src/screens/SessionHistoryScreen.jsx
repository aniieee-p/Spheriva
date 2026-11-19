
/**
 * Session History Screen
 * Lists the user's safety sessions (newest first) from GET /api/sessions.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '../services/api.service';

// Cache location names to avoid repeated API requests
const locationNameCache = new Map();
const pendingGeocodingRequests = new Map();

let geocodeQueue = Promise.resolve();
let lastGeocodeTime = 0;

const getLocationName = (latitude, longitude) => {
  const cacheKey = `${latitude},${longitude}`;

  if (locationNameCache.has(cacheKey)) {
    return Promise.resolve(locationNameCache.get(cacheKey));
  }

  if (pendingGeocodingRequests.has(cacheKey)) {
    return pendingGeocodingRequests.get(cacheKey);
  }

  const request = geocodeQueue.then(async () => {
    // Keep requests at least 1.1 seconds apart
    const delay = Math.max(
      0,
      1100 - (Date.now() - lastGeocodeTime)
    );

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    lastGeocodeTime = Date.now();

    const url = new URL(
      'https://nominatim.openstreetmap.org/reverse'
    );

    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', latitude);
    url.searchParams.set('lon', longitude);
    url.searchParams.set('zoom', '10');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Location lookup failed');
    }

    const data = await response.json();
    const address = data.address || {};

    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county;

    const locationName = [
      city,
      address.state,
      address.country,
    ]
      .filter(Boolean)
      .join(', ') || data.display_name;

    if (!locationName) {
      throw new Error('Location name not found');
    }

    locationNameCache.set(cacheKey, locationName);
    return locationName;
  });

  pendingGeocodingRequests.set(cacheKey, request);

  geocodeQueue = request.catch(() => {});

  request.finally(() => {
    pendingGeocodingRequests.delete(cacheKey);
  }).catch(() => {});

  return request;
};

const formatDateTime = (value) => {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDuration = (start, end) => {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();

  if (
    Number.isNaN(startMs) ||
    Number.isNaN(endMs) ||
    endMs < startMs
  ) {
    return '-';
  }

  const totalMinutes = Math.floor(
    (endMs - startMs) / 60000
  );

  if (totalMinutes < 1) return 'Less than a minute';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0
    ? `${hours} h ${minutes} min`
    : `${minutes} min`;
};

const SessionCard = ({ session }) => {
  const isActive = session.status === 'active';
  const location = session.latestLocation;

  const [locationName, setLocationName] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadLocationName = async () => {
      if (
        !location ||
        location.latitude == null ||
        location.longitude == null
      ) {
        setLocationName('');
        return;
      }

      const latitude = Number(location.latitude);
      const longitude = Number(location.longitude);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        setLocationName('');
        return;
      }

      setLocationLoading(true);

      try {
        const name = await getLocationName(
          latitude,
          longitude
        );

        if (isMounted) {
          setLocationName(name);
        }
      } catch (error) {
        console.warn(
          'Could not get location name:',
          error.message
        );

        if (isMounted) {
          setLocationName('');
        }
      } finally {
        if (isMounted) {
          setLocationLoading(false);
        }
      }
    };

    loadLocationName();

    return () => {
      isMounted = false;
    };
  }, [location?.latitude, location?.longitude]);

  const coordinates =
    location &&
    Number.isFinite(Number(location.latitude)) &&
    Number.isFinite(Number(location.longitude))
      ? `${Number(location.latitude).toFixed(4)}, ${Number(
          location.longitude
        ).toFixed(4)}`
      : '';

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-gray-800">
          {formatDateTime(session.startedAt)}
        </p>

        <span
          className={`text-xs font-medium px-3 py-1 rounded-full ${
            isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {isActive ? 'Active' : 'Ended'}
        </span>
      </div>

      <dl className="text-sm text-gray-600 space-y-1">
        <div className="flex justify-between">
          <dt>Ended</dt>
          <dd className="text-gray-800">
            {isActive
              ? 'In progress'
              : formatDateTime(session.endedAt)}
          </dd>
        </div>

        <div className="flex justify-between">
          <dt>Duration</dt>
          <dd className="text-gray-800">
            {formatDuration(
              session.startedAt,
              session.endedAt
            )}
          </dd>
        </div>

        <div className="flex justify-between gap-4">
          <dt>Last location</dt>

          <dd className="text-gray-800 text-right max-w-[65%]">
            {coordinates ? (
              <div>
                <a
                  href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  {locationLoading
                    ? 'Finding location...'
                    : locationName || coordinates}
                </a>

                {locationName && (
                  <p className="text-xs text-gray-500 mt-1">
                    {coordinates}
                  </p>
                )}
              </div>
            ) : (
              'Not recorded'
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
};

const SessionHistoryScreen = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiService.getSessions();
      setSessions(response.data?.sessions || []);
    } catch (err) {
      setError(
        err.message || 'Could not load session history.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return (
    <div>
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Session History
            </h1>
            <p className="text-sm opacity-90">
              Your past safety sessions
            </p>
          </div>

          <button
            onClick={loadSessions}
            disabled={loading}
            className="bg-white/20 hover:bg-white/30 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6">
        <section className="bg-white rounded-xl shadow-md p-5">
          {loading ? (
            <div className="text-center py-10 text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="mt-3 text-sm">
                Loading sessions...
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 text-sm mb-3">
                {error}
              </p>

              <button
                onClick={loadSessions}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Try again
              </button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-5xl mb-3">🕒</div>
              <h3 className="font-semibold text-gray-700">
                No sessions yet
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                Start a safety session from Home and it will show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <SessionCard
                  key={session._id}
                  session={session}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default SessionHistoryScreen;
