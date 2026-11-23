import { getAnalytics, isSupported, logEvent, setUserId, setUserProperties } from "firebase/analytics";
import { doc, setDoc, increment, serverTimestamp } from "firebase/firestore";
import { app, db } from "./firebase";

const analyticsReady = isSupported()
  .then((supported) => (supported ? getAnalytics(app) : null))
  .catch(() => null);

let currentUid = null;

// Mirror usage onto the user's Firestore doc so "who uses the site most"
// is answerable by sorting the users collection (totalEvents / sessionCount).
const recordUsage = (fields) => {
  if (!currentUid) return;
  setDoc(doc(db, "users", currentUid), fields, { merge: true }).catch(() => {});
};

export const trackEvent = (name, params = {}) => {
  analyticsReady.then((analytics) => {
    if (analytics) logEvent(analytics, name, params);
  });
  recordUsage({
    totalEvents: increment(1),
    // setDoc treats dotted keys literally (unlike updateDoc), so nest the map
    eventCounts: { [name]: increment(1) },
    lastActive: serverTimestamp(),
  });
};

export const identifyUser = (uid, email) => {
  analyticsReady.then((analytics) => {
    if (!analytics) return;
    if (uid) setUserId(analytics, uid);
    if (email) setUserProperties(analytics, { email });
  });
  if (uid && uid !== currentUid) {
    currentUid = uid;
    recordUsage({
      sessionCount: increment(1),
      lastActive: serverTimestamp(),
    });
  }
};
