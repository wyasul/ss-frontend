import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB_tjBwFOqNLehCwIMGQFW-ddLBqRbAx2k",
  authDomain: "stravastalker.firebaseapp.com",
  projectId: "stravastalker",
  storageBucket: "stravastalker.appspot.com",
  messagingSenderId: "898854611567",
  appId: "1:898854611567:web:67330c1ae7ab23f9867b9a",
  measurementId: "G-L8J6WRWPQ3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

export { auth, provider, db };