'use client';

import { useEffect, useRef } from 'react';

/**
 * HeartbeatListener component
 * 1. Monitors mouse movements, clicks, and keystrokes
 * 2. If user had activity in the last 10 minutes, sends active heartbeat to /api/attendance/heartbeat every 5 minutes
 * 3. Shows 'Did you remember to logout?' prompt on browser/tab close
 */
export function HeartbeatListener() {
  const lastActivityTimestamp = useRef<number>(Date.now());
  const lastHeartbeatTimestamp = useRef<number>(Date.now());

  useEffect(() => {
    // Record user activity timestamp on input events
    const handleUserActivity = () => {
      lastActivityTimestamp.current = Date.now();
    };

    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    window.addEventListener('click', handleUserActivity, { passive: true });
    window.addEventListener('scroll', handleUserActivity, { passive: true });

    // Warning prompt on tab or browser close
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const confirmationMessage = 'Did you remember to logout and save your daily note?';
      e.preventDefault();
      e.returnValue = confirmationMessage;
      return confirmationMessage;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Heartbeat loop every 5 minutes (300,000 ms)
    const HEARTBEAT_INTERVAL = 5 * 60 * 1000;
    const ACTIVITY_THRESHOLD = 10 * 60 * 1000; // 10 minutes

    const sendHeartbeat = async () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityTimestamp.current;
      const isActive = timeSinceLastActivity < ACTIVITY_THRESHOLD;
      const elapsedSinceLastPing = Math.floor((now - lastHeartbeatTimestamp.current) / 1000);
      lastHeartbeatTimestamp.current = now;

      try {
        await fetch('/api/attendance/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isActive,
            elapsedSeconds: isActive ? Math.min(elapsedSinceLastPing, 300) : 0,
          }),
        });
      } catch (err) {
        console.error('Failed to send heartbeat:', err);
      }
    };

    // Initial check after 30 seconds, then every 5 minutes
    const initialTimer = setTimeout(sendHeartbeat, 30 * 1000);
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return null;
}
