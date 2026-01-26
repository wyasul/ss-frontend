import React, { useState, useEffect } from "react";
import { auth, provider, db } from "../firebase";
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { FaGoogle } from "react-icons/fa"; // Import the Google icon
import "./Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        handleEmailAuth();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [email, password, isSignUp]); // Dependencies to watch for changes

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        await setDoc(userDocRef, {
          lastLogin: new Date()
        }, { merge: true });
      } else {
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          firstLogin: new Date(),
          lastLogin: new Date()
        });
      }

      console.log("User signed in and data stored in Firestore:", user);
    } catch (error) {
      console.error("Error during sign-in:", error);
      setError("Failed to sign in with Google.");
    }
  };

  const handleEmailAuth = async () => {
    setError("");  // Reset error message
    try {
      if (isSignUp) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;

        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          firstLogin: new Date(),
          lastLogin: new Date()
        });

        console.log("User signed up and data stored in Firestore:", user);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const user = result.user;

        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
          lastLogin: new Date()
        }, { merge: true });

        console.log("User signed in and data stored in Firestore:", user);
      }
    } catch (error) {
      console.error("Error during email authentication:", error);
      setError("Invalid email or password. Please try again.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-content">
        <h1>Welcome to Strava Stalker</h1>
        <button onClick={handleLogin} className="login-button google-button">
          Continue with Google <FaGoogle className="google-icon" />
        </button>
        <div className="separator">Or login with email and password:</div>
        <div className="email-auth">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
          />
          {error && <div className="error-message">{error}</div>}
          <button onClick={handleEmailAuth} className="auth-button">
            {isSignUp ? "Sign Up" : "Sign In"}
          </button>
          <button onClick={() => setIsSignUp(!isSignUp)} className="toggle-signup-button">
            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;