import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import Login from "./components/Login";
import Report from "./components/Report";
import "./App.css";
import moment from "moment-timezone";
import { isMobileDevice } from "./utils";
import { inject } from '@vercel/analytics';

// Inject Vercel Analytics
inject();

const App = () => {
  const [activity, setActivity] = useState("backcountry ski");
  const [place, setPlace] = useState("Jackson, WY");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [user, setUser] = useState(null);
  const [showDateHint, setShowDateHint] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [helpModalShouldShow, setHelpModalShouldShow] = useState(false);
  const [pulseDone, setPulseDone] = useState(false);

  useEffect(() => {
    if (isMobileDevice()) {
      setIsMobile(true);
    }
    
    // Get current time in MST
    const nowMST = moment().tz('America/Denver');
    const hour = nowMST.hour();
    
    // If it's 8pm (20:00) or later, show today, otherwise show yesterday
    if (hour >= 20) {
      setDate(nowMST.format("YYYY-MM-DD"));
    } else { 
      setDate(nowMST.subtract(1, 'days').format("YYYY-MM-DD"));
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        setUser(authUser);
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);


  useEffect(() => {
    if (!showHelpModal) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') setShowHelpModal(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showHelpModal]);

  // Show modal when requested
  useEffect(() => {
    if (showHelpModal) {
      setHelpModalVisible(true);
      requestAnimationFrame(() => setHelpModalShouldShow(true)); // force reflow for fade-in
    } else {
      setHelpModalShouldShow(false);
      setTimeout(() => setHelpModalVisible(false), 400); // match CSS transition
    }
  }, [showHelpModal]);

  useEffect(() => {
    setPulseDone(false);
    const timer = setTimeout(() => setPulseDone(true), 2400);
    return () => clearTimeout(timer);
  }, []);

  const handleDateChange = (e) => {
    const selectedDate = moment(e.target.value).format("YYYY-MM-DD");
    setDate(selectedDate);
    setShowDateHint(false);

    if (isMobile) {
      e.target.blur();
    }
  };

  // Fade-out logic
  const handleCloseHelpModal = () => {
    setShowHelpModal(false);
    setTimeout(() => setHelpModalVisible(false), 200); // match CSS transition
  };

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-container">
      {/* Help Modal */}
      {helpModalVisible && (
        <div
          className={`help-modal-overlay${showHelpModal ? ' help-modal-overlay-show' : ' help-modal-overlay-hidden'}`}
          onClick={handleCloseHelpModal}
        >
          <div
            className={`help-modal-content${showHelpModal ? ' help-modal-content-show' : ' help-modal-content-hidden'}`}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={handleCloseHelpModal}
              aria-label="Close"
            >
              ×
            </button>
            <h1 style={{
              color: "#ff6b00",
              fontSize: window.innerWidth < 768 ? "1.5rem" : "2rem",
              marginBottom: "2rem",
              textAlign: "center",
              maxWidth: "1200px",
              margin: "1.5rem auto",
              padding: window.innerWidth < 768 ? "0 1rem" : "0"
            }}>
              Strava has limited data scraping, and I need your help.
            </h1>
            <div style={{
              display: "flex",
              flexDirection: window.innerWidth < 768 ? "column" : "row",
              maxWidth: "1600px",
              margin: "0 auto",
              gap: window.innerWidth < 768 ? "2rem" : "3rem",
              padding: window.innerWidth < 768 ? "0 1rem" : "0 2rem",
              alignItems: "flex-start"
            }}>
              {/* Left column - Video */}
              <div style={{
                flex: window.innerWidth < 768 ? "1" : "1.5",
                width: "100%"
              }}>
                <video
                  controls
                  width="100%"
                  style={{
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                    backgroundColor: "rgba(0, 0, 0, 0.2)",
                    minHeight: window.innerWidth < 768 ? "200px" : "auto",
                    objectFit: "cover",
                    border: window.innerWidth < 768 ? "2px solid #ff6b00" : "none"
                  }}
                  preload="metadata"
                  playsInline
                >
                  <source src="8FFB1301-69B8-4690-863B-BFB3A791F1C7.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
              {/* Right column - Instructions */}
              <div style={{
                flex: "1",
                color: "#ff6b00",
                fontSize: window.innerWidth < 768 ? "0.9rem" : "1.1rem",
                lineHeight: "1.6",
                textAlign: "left",
                width: window.innerWidth < 768 ? "100%" : "auto"
              }}>
                <h2 style={{
                  marginTop: 0,
                  marginBottom: "1rem",
                  textAlign: "left",
                  fontSize: window.innerWidth < 768 ? "1.2rem" : "1.5rem"
                }}>
                  HOW TO SAVE STRAVASTALKER (with a premium account):
                </h2>
                <ol style={{
                  paddingLeft: "1.5rem",
                  margin: 0,
                  textAlign: "left",
                  paddingRight: window.innerWidth < 768 ? "1rem" : "0"
                }}>
                  <li>Go to strava.com on Google Chrome browser, and log in to your premium account</li>
                  <li>Right-click anywhere on the page and select "Inspect" (or press Ctrl+Shift+I)</li>
                  <li>Click on the "Network" tab in the developer tools</li>
                  <li>Refresh the page</li>
                  <li>In the search box, type "strava4"</li>
                  <li>Look for "_strava4_session" in the right panel under "Cookies"</li>
                  <li>Copy the entire cookie value</li>
                  <li>Email the cookie to{" "}
                    <a href="mailto:wyattsullivan02@gmail.com"
                      style={{ color: "#ff6b00", textDecoration: "underline" }}>
                      wyattsullivan02@gmail.com
                    </a>
                    {" "}or text it to{" "}
                    <a href="sms:3076992974"
                      style={{ color: "#ff6b00", textDecoration: "underline" }}>
                      307-699-2974
                    </a>
                  </li>
                </ol>
                <p style={{
                  marginTop: "1rem",
                  fontSize: window.innerWidth < 768 ? "0.8rem" : "1rem",
                  opacity: 0.9,
                  textAlign: "left"
                }}>
                  Your cookie will be used in a rotation with other premium accounts to keep this site running. Premium accounts are the only ones that can scrape the public data this site relies on. I'd rather not buy multiple premium accounts, so this is the only way.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="select-container-wrapper">
        <div className="radio-groups">
          <div className="radio-group">
            <div className="radio-group-label">Activity</div>
            <div className="radio-option">
              <input
                type="radio"
                id="trail-run"
                name="activity"
                value="trail run"
                checked={activity === "trail run"}
                onChange={(e) => setActivity(e.target.value)}
                disabled={loading}
              />
              <label htmlFor="trail-run">Trail Running <span className="activity-inactive-label">not active</span></label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                id="backcountry-ski"
                name="activity"
                value="backcountry ski"
                checked={activity === "backcountry ski"}
                onChange={(e) => setActivity(e.target.value)}
                disabled={loading}
              />
              <label htmlFor="backcountry-ski">Backcountry Skiing</label>
            </div>
          </div>
          <div className="radio-group">
            <div className="radio-group-label">Place</div>
            <div className="radio-option">
              <input
                type="radio"
                id="jackson"
                name="place"
                value="Jackson, WY"
                checked={place === "Jackson, WY"}
                onChange={(e) => setPlace(e.target.value)}
                disabled={loading}
              />
              <label htmlFor="jackson">Jackson, WY</label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                id="slc"
                name="place"
                value="Salt Lake City, UT"
                checked={place === "Salt Lake City, UT"}
                onChange={(e) => setPlace(e.target.value)}
                disabled={loading}
              />
              <label htmlFor="slc">Salt Lake City, UT</label>
            </div>
          </div>
        </div>
        <div className="date-select">
          <input
            type="date"
            value={date}
            onChange={handleDateChange}
            onFocus={() => setShowDateHint(false)}
            disabled={loading}
          />
        </div>
        {showDateHint && (
          <div className="date-hint">
            <span className="arrow">↑</span>
            <span>change date</span>
          </div>
        )}
      </div>
      <Report
        activity={activity}
        place={place}
        date={date}
        setLoading={setLoading}
        loading={loading}
        isMobile={isMobile}
        hideNavbar={showHelpModal}
      />
    </div>
  );
};

export default App;