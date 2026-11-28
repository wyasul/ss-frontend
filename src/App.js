import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import Login from "./components/Login";
import Report from "./components/Report";
import "./App.css";
import moment from "moment-timezone";
import { isMobileDevice } from "./utils";
import { inject } from '@vercel/analytics';
import { trackEvent, identifyUser } from './analytics';

// Inject Vercel Analytics
inject();

// Toggle off for now; keep modal/button code in place for when we need it again.
const SHOW_HELP_CTA = false;

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || 'https://stravastalker-05fece4b00b5.herokuapp.com';

// Deep links: ?place=..&activity=..&date=YYYY-MM-DD (validated; bad values ignored)
const VALID_PLACES = ['Jackson, WY', 'Salt Lake City, UT', 'Rogers Pass, BC'];
const VALID_ACTIVITIES = ['trail run', 'backcountry ski'];
const urlParams = new URLSearchParams(window.location.search);
const urlPlace = VALID_PLACES.includes(urlParams.get('place')) ? urlParams.get('place') : null;
const urlActivity = VALID_ACTIVITIES.includes(urlParams.get('activity')) ? urlParams.get('activity') : null;
const urlDate = /^\d{4}-\d{2}-\d{2}$/.test(urlParams.get('date') || '') ? urlParams.get('date') : null;

const DANGER_LABELS = { '-1': 'No rating', 1: 'Low', 2: 'Moderate', 3: 'Considerable', 4: 'High', 5: 'Extreme' };
const DANGER_COLORS = { '-1': '#888888', 0: '#888888', 1: '#50b848', 2: '#fff200', 3: '#f7941e', 4: '#ed1c24', 5: '#221e1f' };

// Simplified danger rose: a mountain split into three elevation bands,
// colored with the standard danger-scale colors (apex = alpine).
const AvyRose = ({ bands }) => {
  const edge = (y) => (45 * (y - 5)) / 80;
  const bandPath = (y1, y2) =>
    `M ${50 - edge(y2)} ${y2} L ${50 - edge(y1)} ${y1} L ${50 + edge(y1)} ${y1} L ${50 + edge(y2)} ${y2} Z`;
  const ys = [5, 32, 58, 85];
  return (
    <svg viewBox="0 0 100 90" className="avy-rose" aria-hidden="true">
      {['alp', 'tln', 'btl'].map((k, i) => (
        <path
          key={k}
          d={bandPath(ys[i], ys[i + 1])}
          fill={DANGER_COLORS[bands[k]?.level ?? -1]}
          stroke="rgba(0,0,0,0.55)"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
};

const App = () => {
  const [activity, setActivity] = useState(urlActivity || "backcountry ski");
  const [place, setPlace] = useState(urlPlace || "Salt Lake City, UT");
  const [date, setDate] = useState(urlDate || "");
  const [avy, setAvy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [user, setUser] = useState(null);
  const [showLastSkied, setShowLastSkied] = useState(false);
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [helpModalShouldShow, setHelpModalShouldShow] = useState(false);
  const [pulseDone, setPulseDone] = useState(false);
  const [helpVideoOk, setHelpVideoOk] = useState(true);

  const helpVideoSrc =
    process.env.REACT_APP_HELP_VIDEO_SRC || `${process.env.PUBLIC_URL}/help.mp4`;
  const helpVideoFallbackMov = `${process.env.PUBLIC_URL}/help.mov`;

  useEffect(() => {
    if (isMobileDevice()) {
      setIsMobile(true);
    }
    
    // Get current time in MST
    const nowMST = moment().tz('America/Denver');
    const hour = nowMST.hour();
    
    // If it's 8pm (20:00) or later, show today, otherwise show yesterday.
    // A date from the URL (deep link) wins over the default.
    const fallback = hour >= 20
      ? nowMST.format("YYYY-MM-DD")
      : nowMST.subtract(1, 'days').format("YYYY-MM-DD");
    setDate((prev) => prev || fallback);
  }, []);

  // Keep the URL shareable: reflect place/activity/date as query params
  useEffect(() => {
    if (!date) return;
    const params = new URLSearchParams({ place, activity, date });
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [place, activity, date]);

  // Today's avalanche forecast for the selected place (cached server-side)
  useEffect(() => {
    let cancelled = false;
    setAvy(null);
    fetch(`${API_BASE_URL}/api/avalanche/${encodeURIComponent(place)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setAvy(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [place]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        setUser(authUser);
        identifyUser(authUser.uid, authUser.email);
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

  const handleActivityChange = (e) => {
    setActivity(e.target.value);
    trackEvent('select_activity', { activity: e.target.value });
  };

  const handlePlaceChange = (e) => {
    setPlace(e.target.value);
    trackEvent('select_place', { place: e.target.value });
  };

  const handleDateChange = (e) => {
    const selectedDate = moment(e.target.value).format("YYYY-MM-DD");
    setDate(selectedDate);
    trackEvent('select_date', { date: selectedDate });

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

  const isSelectedDateYesterday = date === moment().tz('America/Denver').subtract(1, 'days').format("YYYY-MM-DD");

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
              {helpVideoOk && (
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
                    onError={() => setHelpVideoOk(false)}
                  >
                    <source
                      src={helpVideoSrc}
                      type={helpVideoSrc.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4"}
                    />
                    <source src={helpVideoFallbackMov} type="video/quicktime" />
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
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
                  <li>Click on the "Application" tab in the developer tools</li>
                  <li>In the left panel, expand "Cookies"</li>
                  <li>Click on "https://www.strava.com" (or "https://strava.com")</li>
                  <li>In the cookie table, use the filter/search box and type "strava4"</li>
                  <li>Click the "_strava4_session" row</li>
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

      {SHOW_HELP_CTA && (
        <button
          type="button"
          className="help-me-out-btn help-cta-button"
          onClick={() => setShowHelpModal(true)}
          disabled={loading}
        >
          Strava stalker is dying and needs help
        </button>
      )}

      <div className="select-container-wrapper">
        <div className="radio-groups">
          <div className="radio-group">
            <div className="radio-group-label">Activity</div>
            {/* Trail running deactivated — option stays visible but greyed out */}
            <div className="radio-option radio-option-disabled">
              <input
                type="radio"
                id="trail-run"
                name="activity"
                value="trail run"
                checked={activity === "trail run"}
                onChange={handleActivityChange}
                disabled
              />
              <label htmlFor="trail-run">Trail Running</label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                id="backcountry-ski"
                name="activity"
                value="backcountry ski"
                checked={activity === "backcountry ski"}
                onChange={handleActivityChange}
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
                onChange={handlePlaceChange}
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
                onChange={handlePlaceChange}
                disabled={loading}
              />
              <label htmlFor="slc">Salt Lake City, UT</label>
            </div>
            <div className={`radio-option${activity === "trail run" ? " radio-option-disabled" : ""}`}>
              <input
                type="radio"
                id="rogers-pass"
                name="place"
                value="Rogers Pass, BC"
                checked={place === "Rogers Pass, BC"}
                onChange={handlePlaceChange}
                disabled={loading || activity === "trail run"}
              />
              <label htmlFor="rogers-pass">Rogers Pass, BC</label>
            </div>
          </div>
        </div>
        <div className="date-select">
          <input
            type="date"
            value={date}
            onChange={handleDateChange}
            disabled={loading}
          />
          {isSelectedDateYesterday && (
            <div className="date-relative-label">(yesterday)</div>
          )}
        </div>
        <div className="cta-row">
          <button
            type="button"
            className="last-skied-cta"
            onClick={() => setShowLastSkied(true)}
            disabled={loading}
          >
            When was it last skied?
          </button>
          <button
            type="button"
            className="last-skied-cta"
            onClick={() => setShowAllRoutes(true)}
            disabled={loading}
          >
            All routes
          </button>
        </div>
        {avy && (
          <a
            className={`avy-banner avy-level-${avy.dangerLevel}`}
            href={avy.link}
            target="_blank"
            rel="noreferrer"
            title={avy.travelAdvice || ''}
          >
            <div className="avy-summary">
              <span className="avy-dot" />
              <span>
                Avalanche danger today:{' '}
                <strong>{DANGER_LABELS[avy.dangerLevel] || avy.danger}</strong>
                {avy.dangerLevel > 0 && ` (${avy.dangerLevel}/5)`}
                {' '}— {avy.zone} · {avy.source}
              </span>
            </div>
            {avy.bands && (
              <div className="avy-rose-row">
                <AvyRose bands={avy.bands} />
                <div className="avy-bands">
                  {['alp', 'tln', 'btl'].map((k) =>
                    avy.bands[k] ? (
                      <div key={k} className="avy-band-line">
                        <span
                          className="avy-band-dot"
                          style={{ background: DANGER_COLORS[avy.bands[k].level ?? -1] }}
                        />
                        {avy.bands[k].band}:{' '}
                        {avy.bands[k].rating || DANGER_LABELS[avy.bands[k].level] || '—'}
                      </div>
                    ) : null
                  )}
                  {avy.bandsAreOverall && (
                    <div className="avy-band-note">overall rating — per-elevation not published yet</div>
                  )}
                </div>
              </div>
            )}
          </a>
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
        submitterEmail={user?.email ?? null}
        onSelectDate={setDate}
        showLastSkied={showLastSkied}
        setShowLastSkied={setShowLastSkied}
        showAllRoutes={showAllRoutes}
        setShowAllRoutes={setShowAllRoutes}
      />
    </div>
  );
};

export default App;
