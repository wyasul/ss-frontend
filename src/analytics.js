import { getAnalytics, isSupported, logEvent, setUserId, setUserProperties } from "firebase/analytics";
import { app } from "./firebase";

const analyticsReady = isSupported()
  .then((supported) => (supported ? getAnalytics(app) : null))
  .catch(() => null);

export const trackEvent = (name, params = {}) => {
  analyticsReady.then((analytics) => {
    if (analytics) logEvent(analytics, name, params);
  });
};

export const identifyUser = (uid, email) => {
  analyticsReady.then((analytics) => {
    if (!analytics) return;
    if (uid) setUserId(analytics, uid);
    if (email) setUserProperties(analytics, { email });
  });
};
