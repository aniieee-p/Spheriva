import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics } from '@capacitor/haptics';

export default function useFakeCallAlert() {
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const [soundOn, setSoundOn] = useState(false);

  const stopAlert = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const audio = audioRef.current;
    audioRef.current = null;

    if (audio) {
      audio.close().catch(() => {});
    }

    if (Capacitor.isNativePlatform()) {
      Haptics.vibrate({ duration: 1 }).catch(() => {});
    } else if (typeof navigator !== 'undefined') {
      navigator.vibrate?.(0);
    }

    setSoundOn(false);
  }, []);

  const startAlert = useCallback(async () => {
    stopAlert();

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    const audio = new AudioContextClass();
    audioRef.current = audio;

    try {
      await audio.resume();

      if (audio.state !== 'running' || audioRef.current !== audio) {
        return;
      }

      setSoundOn(true);

      const ring = () => {
        if (audio.state !== 'running') return;

        [0, 0.3, 0.6].forEach((delay) => {
          const oscillator = audio.createOscillator();
          const gain = audio.createGain();

          oscillator.type = 'sine';
          oscillator.frequency.value = 750;

          gain.gain.setValueAtTime(0.0001, audio.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(
            0.12,
            audio.currentTime + delay + 0.02
          );
          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            audio.currentTime + delay + 0.23
          );

          oscillator.connect(gain);
          gain.connect(audio.destination);
          oscillator.start(audio.currentTime + delay);
          oscillator.stop(audio.currentTime + delay + 0.25);
        });

        if (Capacitor.isNativePlatform()) {
          Haptics.vibrate({ duration: 350 }).catch(() => {});
        } else {
          navigator.vibrate?.(350);
        }
      };

      ring();
      timerRef.current = setInterval(ring, 2200);
    } catch (error) {
      console.warn('Fake call ringtone unavailable:', error);
      if (audioRef.current === audio) {
        stopAlert();
      }
    }
  }, [stopAlert]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
      audioRef.current?.close().catch(() => {});
      if (Capacitor.isNativePlatform()) {
        Haptics.vibrate({ duration: 1 }).catch(() => {});
      } else {
        navigator.vibrate?.(0);
      }
    };
  }, []);

  return { startAlert, stopAlert, soundOn };
}
