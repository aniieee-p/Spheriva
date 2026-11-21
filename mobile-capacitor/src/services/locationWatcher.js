import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeGeolocation = registerPlugin('BackgroundGeolocation');

const webWatchers = new Map();
const pageInstanceId = crypto.randomUUID();
let nextWebWatcherId = 1;

export const LocationWatcher = {
  addWatcher: async (options, callback) => {
    if (Capacitor.isNativePlatform()) {
      return NativeGeolocation.addWatcher(options, callback);
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation ||
      !window.isSecureContext
    ) {
      throw new Error('Browser GPS requires a secure context and location support.');
    }

    if (document.visibilityState !== 'visible') {
      throw new Error('Keep the browser tab visible to start tracking.');
    }

    const id = `web-${pageInstanceId}-${nextWebWatcherId++}`;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!webWatchers.has(id)) return;

        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          time: position.timestamp
        });
      },
      (error) => {
        if (!webWatchers.has(id)) return;
        callback(null, {
          code: error.code,
          message: error.message
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000
      }
    );

    webWatchers.set(id, watchId);
    return id;
  },

  removeWatcher: async ({ id }) => {
    if (Capacitor.isNativePlatform()) {
      return NativeGeolocation.removeWatcher({ id });
    }

    if (!webWatchers.has(id)) {
      // Previous page's web watcher cannot survive a full reload.
      // Never mistake an old watcher ID for a current-page watcher.
      if (typeof id === 'string' && id.startsWith('web-')
          && !id.startsWith(`web-${pageInstanceId}-`)) {
        return;
      }
      throw new Error('Current browser watcher not found.');
    }

    navigator.geolocation.clearWatch(webWatchers.get(id));
    webWatchers.delete(id);
  }
};
