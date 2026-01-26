import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import Map from './Map';
import { isMobileDevice } from '../utils';

const emojiSets = {
  'trail run': ["🏃‍♂️", "🏃‍♀️"],
  'backcountry ski': ["⛷️", "🏂"], // skier, snowboarder
  'mountain bike': ["🚵‍♂️", "🚵‍♀️"], // man/woman mountain biking
  // Add more if you have more activities
};

const Report = ({ activity, place, date, setLoading, loading, isMobile, hideNavbar }) => {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [displayImagesState, setDisplayImagesState] = useState({});
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showMap, setShowMap] = useState({}); // State to track map visibility
  const routeRefs = useRef({});
  console.log(place)

  useEffect(() => {
    if (!date) return;
    
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiBaseUrl = 'https://stravastalker-05fece4b00b5.herokuapp.com';
        // const apiBaseUrl = 'http://localhost:3000';

        const response = await axios.get(`${apiBaseUrl}/api/report/${place}/${activity}?date=${date}`);
        if (response.data === 'No activities yet today.') {
          setReport(null);
          setError('No activities from this date.');
          return;
        }

        let processedReport = { ...response.data };
        Object.keys(processedReport).forEach((route) => {
          const activityInfo = processedReport[route].activityInfo;
          const photos = processedReport[route].photos;
          let polylineIndex = 0;

          activityInfo.forEach((activity, activityIndex) => {
            activity.activityUrls.forEach((activityUrl) => {
              activityUrl.polylineIndex = polylineIndex;
              polylineIndex++;

              const filteredPhotos = photos.filter((photo) => photo.activityUrl === activityUrl.url);
              activityUrl.photos = filteredPhotos.map((photo, photoIndex) => ({
                ...photo,
                mapId: route,
                polylineIndex,
                photoIndex,
                activityIndex,
              }));

              activityUrl.photos.forEach((photo) => {
                photo.polylineIndex = activityUrl.polylineIndex;
              });
            });
            polylineIndex++;
          });

          photos.forEach((photo) => {
            const matchingActivityUrl = activityInfo.flatMap((info) => info.activityUrls).find((url) => url.url === photo.activityUrl);
            if (matchingActivityUrl) {
              photo.polylineIndex = matchingActivityUrl.polylineIndex;
            }
          });

          processedReport[route].activityInfo = activityInfo;
          processedReport[route].photos = photos;
        });

        const routesWithPhotoCounts = Object.keys(processedReport).map((route) => {
          const totalPhotos = processedReport[route].photos.length;
          return { route, totalPhotos };
        });

        routesWithPhotoCounts.sort((a, b) => b.totalPhotos - a.totalPhotos);

        const sortedProcessedReport = {};
        routesWithPhotoCounts.forEach((item) => {
          sortedProcessedReport[item.route] = processedReport[item.route];
        });

        setReport(sortedProcessedReport);

        const initialDisplayImagesState = {};
        Object.keys(processedReport).forEach((route) => {
          initialDisplayImagesState[route] = true;
        });

        setDisplayImagesState(initialDisplayImagesState);
      } catch (err) {
        console.log(err)
        if (date === new Date().toISOString().split('T')[0]) {
          setReport(null);
          setError('No activities yet today, check back later!');
        } else if (err.response && err.response.data && err.response.data.error === 'NoReportFound') {
          setReport(null);
          setError('No Strava records for this date');
        } else {
          setError('An error occurred while fetching the report: ' + err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [activity, place, date, setLoading]);

  if (!date) {
    return (
      <div className="no-reports-container">
        <h2 className="no-reports-message">Please select a date to view the report.</h2>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="no-reports-container">
        <h2 className="no-reports-message">{error}</h2>
      </div>
    );
  }

  const clearAllHoveredActivities = () => {
    const hoveredElements = document.querySelectorAll('.hovered');
    hoveredElements.forEach((element) => {
      element.classList.remove('hovered');
    });
  };

  const handleLinkClick = (url) => {
    const stravaId = url.split('/')[4];
    const appUrl = `strava://activities/${stravaId}`;
    const fallbackUrl = url;

    if (isMobileDevice()) {
      let appOpened = false;
      const start = Date.now();

      // Attempt to open the Strava app using the custom URL scheme
      window.location.href = appUrl;

      // Add an event listener to detect if the page visibility changes
      const handleVisibilityChange = () => {
        if (document.hidden) {
          appOpened = true;
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Use a timeout to check if the app opened
      setTimeout(() => {
        // If the time elapsed is less than a threshold, assume the app did not open
        if (!appOpened && Date.now() - start < 1500) {
          window.location.href = fallbackUrl;
        }
      }, 3000);
    } else {
      window.open(url, '_blank');
    }
  };

  let displayActivity = activity;
  if (activity === 'trail run') {
    displayActivity = 'Trail Running';
  }
  if (activity === 'backcountry ski') {
    displayActivity = 'Backcountry Skiing';
  }
  if (activity === 'mountain bike') {
    displayActivity = 'Mountain Biking';
  }

  const toggleMap = (routeName) => {
    setShowMap((prevState) => ({
      ...prevState,
      [routeName]: !prevState[routeName],
    }));
  };

  const sanitizeId = (str) => {
    return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  };

  return (
    <div className="content-container">
      <div className={`navbar${(isMobile && selectedRoute) || hideNavbar ? ' navbar-hidden' : ''}`}>
        <h1>Routes</h1>
        <p style={{ fontSize: '12px', color: '#ffffff', margin: '5px 0' }}>
          {isMobile ? (
            <>
            Routes populate for the day at 7:30pm
            </>
          ) : (
            'Click a route to see people who skied it'
          )}
        </p>
        <ul>
          {report &&
            Object.keys(report).map((routeName, index) => (
              <li key={index}>
                <div className="route-bar">
                  <a
                    href={`#${routeName}`}
                    onClick={(e) => {
                      e.preventDefault();
                      if (isMobile) {
                        setSelectedRoute(routeName);
                      } else {
                        routeRefs.current[routeName].scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    {routeName}
                  </a>
                  {isMobile && (
                    <button className="more-info-button" onClick={() => setSelectedRoute(routeName)}>
                      details
                    </button>
                  )}
                </div>
                {isMobile && (
                  <>
                    {report[routeName].photos.length > 0 && (
                      <div className="photos-slideshow">
                        {report[routeName].photos.map((photo, k) => (
                          <div
                            key={k}
                            className="photo-item"
                            onClick={() => handleLinkClick(photo.activityUrl)}
                          >
                            <img src={photo.photo} alt={`Photo ${k + 1}`} loading="lazy" />
                          </div>
                        ))}
                      </div>
                    )}
                    {report[routeName].activityInfo[0].conditions.length > 0 && (
                      <p className="route-conditions">{report[routeName].activityInfo[0].conditions.join(', ')}</p>
                    )}
                  </>
                )}
              </li>
            ))}
        </ul>
      </div>

      {isMobile && selectedRoute && (
        <div className={`report-view ${selectedRoute ? 'report-view-active' : ''}`}>
          <button className="back-button" onClick={() => setSelectedRoute(null)}>
            {"Back to routes"}
          </button>
          <div className="report-content">
            <div className="route-section" ref={(el) => (routeRefs.current[selectedRoute] = el)}>
              <h2>{selectedRoute}</h2>
              {report[selectedRoute].activityInfo.map((activityInfo, i) => (
                <div key={i} className="activity-info">
                  {activityInfo.conditions.length > 0 && <p>{activityInfo.conditions.join(', ')}</p>}
                  <Map
                    polylines={activityInfo.activityUrls
                      .map((urlData) => urlData.polyline)
                      .filter((polyline) => polyline && polyline.length > 0)}
                    mapId={sanitizeId(selectedRoute)}
                    activityInfo={activityInfo.activityUrls}
                    photos={report[selectedRoute].photos}
                    displayImages={displayImagesState[selectedRoute]}
                    setDisplayImages={(newValue) =>
                      setDisplayImagesState((prev) => ({ ...prev, [selectedRoute]: newValue }))
                    }
                  />
                  <h4>{activityInfo.activityUrls.length} activity link{activityInfo.activityUrls.length === 1 ? '' : 's'}:</h4>
                  <ul>
                    {activityInfo.activityUrls.map((url, j) => (
                      <li
                        key={j}
                        id={`activity-${sanitizeId(selectedRoute)}-${j}`}
                        onMouseEnter={() => {
                          const mapElement = document.querySelector(`#map-${sanitizeId(selectedRoute)}`);
                          if (mapElement) {
                            const event = new CustomEvent(`mouseenter-${sanitizeId(selectedRoute)}-${j}`, { detail: { photos: url.photos } });
                            mapElement.dispatchEvent(event);
                          }
                        }}
                        onMouseLeave={() => {
                          const mapElement = document.querySelector(`#map-${sanitizeId(selectedRoute)}`);
                          if (mapElement) {
                            const event = new CustomEvent(`mouseleave-${sanitizeId(selectedRoute)}-${j}`, { detail: { photos: url.photos } });
                            mapElement.dispatchEvent(event);
                          }
                        }}
                        onClick={() => handleLinkClick(url.url)}
                      >
                        <a href="#" onClick={(e) => e.preventDefault()}>
                          <span>"{url.activityName}"</span>
                          <span
                            className="glow-emoji"
                            role="img"
                            aria-label={
                              activity === "trail run"
                                ? (j % 2 === 0 ? "man running" : "woman running")
                                : activity === "backcountry ski"
                                ? (j % 2 === 0 ? "skier" : "snowboarder")
                                : activity === "mountain bike"
                                ? (j % 2 === 0 ? "man biking" : "woman biking")
                                : "activity"
                            }
                          >
                            {emojiSets[activity] ? emojiSets[activity][j % 2] : "❓"}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="photos-section">
                <div className="photos-slideshow">
                  {report[selectedRoute].photos.map((photo, k) => (
                    <div
                      key={k}
                      className="photo-item"
                      onClick={() => handleLinkClick(photo.activityUrl)}
                      onMouseEnter={() => {
                        const mapElement = document.querySelector(`#map-${sanitizeId(selectedRoute)}`);
                        if (mapElement) {
                          const event = new CustomEvent(`mouseenter-photo-${sanitizeId(selectedRoute)}-${k}`, {
                            detail: { photo, mapId: sanitizeId(selectedRoute), polylineIndex: photo.polylineIndex, photoIndex: k },
                          });
                          mapElement.dispatchEvent(event);
                        }
                      }}
                      onMouseLeave={() => {
                        const mapElement = document.querySelector(`#map-${sanitizeId(selectedRoute)}`);
                        if (mapElement) {
                          const event = new CustomEvent(`mouseleave-photo-${sanitizeId(selectedRoute)}-${k}`, {
                            detail: { photo, mapId: sanitizeId(selectedRoute), polylineIndex: photo.polylineIndex, photoIndex: k },
                          });
                          mapElement.dispatchEvent(event);
                        }
                      }}
                    >
                      <img src={photo.photo} alt={`Photo ${k + 1}`} loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="report-container">
          {report ? (
            Object.keys(report).length > 0 ? (
              <div className="report-content">
                {Object.keys(report).map((route, index) => (
                  <div
                    key={index}
                    id={route}
                    className="route-section"
                    ref={(el) => (routeRefs.current[route] = el)}
                  >         
                    <div className="route-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2>{route}</h2>
                      <button
                        className="show-map-button"
                        onClick={() => toggleMap(route)}
                      >
                        {showMap[route] ? 'Hide Map' : 'Show Map'}
                      </button>
                    </div>
                    <div className="photos-section">
                      <div className="photos-slideshow">
                        {report[route].photos.map((photo, k) => (
                          <div
                            key={k}
                            className="photo-item"
                            onClick={() => handleLinkClick(photo.activityUrl)}
                            onMouseEnter={() => {
                              const mapElement = document.querySelector(`#map-${sanitizeId(route)}`);
                              if (mapElement) {
                                const event = new CustomEvent(`mouseenter-photo-${sanitizeId(route)}-${k}`, {
                                  detail: { photo, mapId: sanitizeId(route), polylineIndex: photo.polylineIndex, photoIndex: k },
                                });
                                mapElement.dispatchEvent(event);
                              }
                            }}
                            onMouseLeave={() => {
                              const mapElement = document.querySelector(`#map-${sanitizeId(route)}`);
                              if (mapElement) {
                                const event = new CustomEvent(`mouseleave-photo-${sanitizeId(route)}-${k}`, {
                                  detail: { photo, mapId: sanitizeId(route), polylineIndex: photo.polylineIndex, photoIndex: k },
                                });
                                mapElement.dispatchEvent(event);
                              }
                            }}
                          >
                            <img src={photo.photo} alt={`Photo ${k + 1}`} loading="lazy" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="activities-container">
                      {showMap[route] && (
                        <div className="map-container">
                          <Map
                            polylines={report[route].activityInfo.flatMap(activityInfo => 
                              activityInfo.activityUrls
                                .map((urlData) => urlData.polyline)
                                .filter((polyline) => polyline && polyline.length > 0)
                            )}
                            mapId={sanitizeId(route)}
                            activityInfo={report[route].activityInfo.flatMap(info => info.activityUrls)}
                            photos={report[route].photos}
                            displayImages={displayImagesState[route]}
                            setDisplayImages={(newValue) =>
                              setDisplayImagesState((prev) => ({ ...prev, [route]: newValue }))
                            }
                          />
                        </div>
                      )}
                      {report[route].activityInfo.map((activityInfo, i) => (
                        <div key={i} className="activity-info">
                          {activityInfo.conditions.length > 0 && <p>{activityInfo.conditions.join(', ')}</p>}
                          <ul>
                            {activityInfo.activityUrls.map((url, j) => (
                              <li
                                key={j}
                                id={`activity-${sanitizeId(route)}-${j}`}
                                onMouseEnter={() => {
                                  const mapElement = document.querySelector(`#map-${sanitizeId(route)}`);
                                  if (mapElement) {
                                    const event = new CustomEvent(`mouseenter-${sanitizeId(route)}-${j}`, { detail: { photos: url.photos } });
                                    mapElement.dispatchEvent(event);
                                  }
                                }}
                                onMouseLeave={() => {
                                  const mapElement = document.querySelector(`#map-${sanitizeId(route)}`);
                                  if (mapElement) {
                                    const event = new CustomEvent(`mouseleave-${sanitizeId(route)}-${j}`, { detail: { photos: url.photos } });
                                    mapElement.dispatchEvent(event);
                                  }
                                }}
                                onClick={() => handleLinkClick(url.url)}
                              >
                                <a href="#" onClick={(e) => e.preventDefault()}>
                                  <span>"{url.activityName}"</span>
                                  <span
                                    className="glow-emoji"
                                    role="img"
                                    aria-label={
                                      activity === "trail run"
                                        ? (j % 2 === 0 ? "man running" : "woman running")
                                        : activity === "backcountry ski"
                                        ? (j % 2 === 0 ? "skier" : "snowboarder")
                                        : activity === "mountain bike"
                                        ? (j % 2 === 0 ? "man biking" : "woman biking")
                                        : "activity"
                                    }
                                  >
                                    {emojiSets[activity] ? emojiSets[activity][j % 2] : "❓"}
                                  </span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>No report available</p>
            )
          ) : (
            <p>Loading...</p>
          )}
        </div>
      )}
      {/* Contact Info Section */}
      <div className="contact-info" style={{ 
        color: 'white',
        backgroundColor: '#1e1e1e',
        fontSize: '14px',
        border: '2px solid white',
        padding: '15px',
        borderRadius: '5px',
        marginTop: '20px'
      }}>
        <h1>You no likey?</h1>
        <p style={{ fontWeight: 'bold' }}>Email: wyattsullivan02@gmail.com</p>
        <p style={{ fontWeight: 'bold' }}>Phone: (307) 699-2974</p>
      </div>
    </div>
  );
};

export default Report;