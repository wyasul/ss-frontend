import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { FiMaximize2 } from 'react-icons/fi';
import Map from './Map';
import { isMobileDevice } from '../utils';

const emojiSets = {
  'trail run': ["🏃‍♂️", "🏃‍♀️"],
  'backcountry ski': ["⛷️", "🏂"],
  'mountain bike': ["🚵‍♂️", "🚵‍♀️"],
};

// Conditions block: use data[route].routeConditions (or routeCondition) from backend.
// activityInfo is only { date, activityUrls }; no per-activity conditions.
const getRouteConditionsText = (routeData) => {
  if (!routeData || typeof routeData !== 'object') return null;
  const s = routeData.routeConditions ?? routeData.routeCondition;
  if (s == null) return null;
  const t = String(s).trim();
  return t === '' ? null : t;
};

// Show conditions block only when we have real text (hide when value is N/A or empty).
const shouldShowConditions = (routeData) => {
  const t = getRouteConditionsText(routeData);
  return t != null && t.toUpperCase() !== 'N/A';
};

const reportHasActivityData = (report, reportOrder) => {
  if (!report || typeof report !== 'object' || !Array.isArray(reportOrder)) return false;
  return reportOrder.some((routeName) => {
    const r = report[routeName];
    if (!r || typeof r !== 'object') return false;
    const urlCount = Array.isArray(r.activityInfo)
      ? r.activityInfo.reduce(
          (n, info) => n + (Array.isArray(info?.activityUrls) ? info.activityUrls.length : 0),
          0
        )
      : 0;
    const photoCount = Array.isArray(r.photos) ? r.photos.length : 0;
    return urlCount > 0 || photoCount > 0;
  });
};

const Report = ({ activity, place, date, setLoading, loading, isMobile, hideNavbar }) => {
  const [report, setReport] = useState(null);
  const [reportOrder, setReportOrder] = useState([]); // explicit order: most photos first, 10420 last
  const [error, setError] = useState(null);
  const [displayImagesState, setDisplayImagesState] = useState({});
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showMap, setShowMap] = useState({}); // State to track map visibility
  const [showActivityDescriptions, setShowActivityDescriptions] = useState({}); // per-route: show Strava description under each activity
  const [showRateLimitInfo, setShowRateLimitInfo] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [expandedPhotoSrc, setExpandedPhotoSrc] = useState(null);
  const routeRefs = useRef({});
  console.log(place)

  useEffect(() => {
    if (!expandedPhotoSrc) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setExpandedPhotoSrc(null);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [expandedPhotoSrc]);

  useEffect(() => {
    if (!date) return;
    
    const fetchReport = async () => {
      setExpandedPhotoSrc(null);
      setLoading(true);
      setError(null);
      try {
        const apiBaseUrl = 'https://stravastalker-05fece4b00b5.herokuapp.com';
        // const apiBaseUrl = 'http://localhost:3000';

        const response = await axios.get(`${apiBaseUrl}/api/report/${place}/${activity}?date=${date}`);
        if (response.data === 'No activities yet today.') {
          setReport({});
          setReportOrder([]);
          setDisplayImagesState({});
          setError(null);
          return;
        }

        // API returns { report: { _id, date, reportNumber, place, activity }, data: { [routeName]: RoutePayload } }
        const body = response.data;
        console.log('[Report] Payload from backend:', body);
        const reportMeta = body?.report ?? null;
        const routePayload = body?.data != null && typeof body.data === 'object' ? body.data : body;

        let processedReport = { ...routePayload };
        Object.keys(processedReport).forEach((route) => {
          const routeData = processedReport[route];
          if (!routeData || typeof routeData !== 'object') {
            processedReport[route] = { activityInfo: [], photos: [] };
            return;
          }

          const activityInfo = Array.isArray(routeData.activityInfo) ? routeData.activityInfo : [];
          const photos = Array.isArray(routeData.photos) ? routeData.photos : [];
          let polylineIndex = 0;

          activityInfo.forEach((act, activityIndex) => {
            const activityUrls = Array.isArray(act?.activityUrls) ? act.activityUrls : [];
            activityUrls.forEach((activityUrl) => {
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
            const matchingActivityUrl = activityInfo
              .flatMap((info) => (Array.isArray(info?.activityUrls) ? info.activityUrls : []))
              .find((url) => url.url === photo.activityUrl);
            if (matchingActivityUrl) {
              photo.polylineIndex = matchingActivityUrl.polylineIndex;
            }
          });

          processedReport[route].activityInfo = activityInfo
            .filter((info) => info != null && typeof info === 'object')
            .map((info) => ({
              ...info,
              activityUrls: Array.isArray(info.activityUrls) ? info.activityUrls : [],
            }));
          processedReport[route].photos = photos;
        });

        const routesWithPhotoCounts = Object.keys(processedReport).map((route) => {
          const ph = processedReport[route]?.photos;
          const totalPhotos = Array.isArray(ph) ? ph.length : 0;
          return { route, totalPhotos };
        });

        const ROUTE_10420 = '10420';
        routesWithPhotoCounts.sort((a, b) => {
          // Move 10420 to the bottom (API may return route as number or string)
          if (String(a.route) === ROUTE_10420) return 1;
          if (String(b.route) === ROUTE_10420) return -1;
          // Sort by photo count: most photos first, then least
          const aPhotos = a.totalPhotos ?? 0;
          const bPhotos = b.totalPhotos ?? 0;
          return bPhotos - aPhotos;
        });

        const sortedProcessedReport = {};
        const order = [];
        routesWithPhotoCounts.forEach((item) => {
          sortedProcessedReport[item.route] = processedReport[item.route];
          order.push(item.route);
        });

        setReport(sortedProcessedReport);
        setReportOrder(order);

        const initialDisplayImagesState = {};
        Object.keys(processedReport).forEach((route) => {
          initialDisplayImagesState[route] = true;
        });

        setDisplayImagesState(initialDisplayImagesState);
      } catch (err) {
        console.log(err)
        if (date === new Date().toISOString().split('T')[0]) {
          setReport(null);
          setReportOrder([]);
          setError('No activities yet today, check back later!');
        } else if (err.response && err.response.data && err.response.data.error === 'NoReportFound') {
          setReport({});
          setReportOrder([]);
          setError(null);
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

  if (report === null) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  if (!reportHasActivityData(report, reportOrder)) {
    return (
      <div className="no-reports-container">
        <h2 className="no-reports-message">No activities for this date.</h2>
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

  const toggleActivityDescriptions = (route) => {
    setShowActivityDescriptions((prev) => ({ ...prev, [route]: !prev[route] }));
  };

  const getActivityDescription = (url) => {
    if (!url || url.description == null) return null;
    const t = String(url.description).trim();
    return t === '' ? null : t;
  };

  const sanitizeId = (str) => {
    return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  };

  const renderPhotoTileSimple = (photo, k) => (
    <div key={k} className="photo-item">
      <button
        type="button"
        className="expand-icon"
        aria-label="Expand photo"
        onClick={(e) => {
          e.stopPropagation();
          setExpandedPhotoSrc(photo.photo);
        }}
      >
        <FiMaximize2 size={16} aria-hidden />
      </button>
      <img
        src={photo.photo}
        alt={`Photo ${k + 1}`}
        loading="lazy"
        onClick={() => handleLinkClick(photo.activityUrl)}
      />
    </div>
  );

  const renderPhotoTileWithMap = (photo, k, route) => (
    <div
      key={k}
      className="photo-item"
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
      <button
        type="button"
        className="expand-icon"
        aria-label="Expand photo"
        onClick={(e) => {
          e.stopPropagation();
          setExpandedPhotoSrc(photo.photo);
        }}
      >
        <FiMaximize2 size={16} aria-hidden />
      </button>
      <img
        src={photo.photo}
        alt={`Photo ${k + 1}`}
        loading="lazy"
        onClick={() => handleLinkClick(photo.activityUrl)}
      />
    </div>
  );

  return (
    <div className="content-container">
      {showHowItWorks && (
        <div
          className="rate-limit-modal-overlay"
          onClick={() => setShowHowItWorks(false)}
          role="dialog"
          aria-label="How it works"
        >
          <div className="rate-limit-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="rate-limit-modal-close"
              onClick={() => setShowHowItWorks(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="rate-limit-modal-title">How does it work?</h3>
            <p className="rate-limit-modal-text">
              Pick a place (e.g. Jackson, WY), activity type (e.g. backcountry ski), and date. We fetch Strava activities for that day and show you routes with photos and maps. Routes are ordered by how many photos they have. Strava limits how much data we can request, so sometimes not every activity will show up.
            </p>
          </div>
        </div>
      )}
      {showRateLimitInfo && (
        <div
          className="rate-limit-modal-overlay"
          onClick={() => setShowRateLimitInfo(false)}
          role="dialog"
          aria-label="Rate limit info"
        >
          <div className="rate-limit-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="rate-limit-modal-close"
              onClick={() => setShowRateLimitInfo(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="rate-limit-modal-title">About missing activities</h3>
            <p className="rate-limit-modal-text">
              Strava applies rate limits to web scraping and API access. If you can’t find your activity or an activity you expected on a given day, it may be because of these limits. We only fetch a limited amount of data per request, so some activities might not appear even though they exist on Strava.
            </p>
          </div>
        </div>
      )}
      <div className={`navbar${(isMobile && selectedRoute) || hideNavbar ? ' navbar-hidden' : ''}`}>
        <h1>Routes</h1>
        <p style={{ fontSize: '12px', color: '#ffffff', margin: '5px 0' }}>
          {isMobile ? (
            <>
            Routes populate for the day at 7:30pm
            </>
          ) : (
            'Click a route to see who skied it'
          )}
        </p>
        <ul>
          {report &&
            reportOrder.map((routeName, index) => (
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
                    <span className="route-hit-count">{report[routeName].activityInfo.flatMap((info) => info.activityUrls).length}</span>
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
                        {report[routeName].photos.map((photo, k) => renderPhotoTileSimple(photo, k))}
                      </div>
                    )}
                    {shouldShowConditions(report[routeName]) && (
                      <div className="description-container">
                        <p className="route-description">AI conditions: {getRouteConditionsText(report[routeName])}</p>
                      </div>
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
              <div className="mobile-map-button-container">
                <button
                  className="show-map-button mobile-show-map-button"
                  onClick={() => toggleMap(selectedRoute)}
                >
                  {showMap[selectedRoute] ? 'Hide Map' : 'Show Map'}
                </button>
              </div>
              {showMap[selectedRoute] && (
                <div className="mobile-map-container">
                  <Map
                    polylines={report[selectedRoute].activityInfo.flatMap(activityInfo =>
                      activityInfo.activityUrls
                        .map((urlData) => urlData.polyline)
                        .filter((polyline) => polyline && polyline.length > 0)
                    )}
                    mapId={sanitizeId(selectedRoute)}
                    activityInfo={report[selectedRoute].activityInfo.flatMap(info => info.activityUrls)}
                    photos={report[selectedRoute].photos}
                    displayImages={displayImagesState[selectedRoute]}
                    setDisplayImages={(newValue) =>
                      setDisplayImagesState((prev) => ({ ...prev, [selectedRoute]: newValue }))
                    }
                  />
                </div>
              )}
              {shouldShowConditions(report[selectedRoute]) && (
                <div className="description-container">
                  <p className="route-description">AI conditions: {getRouteConditionsText(report[selectedRoute])}</p>
                </div>
              )}
              <div className="activity-descriptions-toggle">
                <button
                  type="button"
                  className="description-toggle"
                  onClick={() => toggleActivityDescriptions(selectedRoute)}
                >
                  {showActivityDescriptions[selectedRoute] ? '▼ Hide descriptions' : '▶ Show descriptions'}
                </button>
              </div>
              {report[selectedRoute].activityInfo.map((activityInfo, i) => (
                <div key={i} className="activity-info">
                  {!isMobile && (
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
                  )}
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
                        </a>
                        {showActivityDescriptions[selectedRoute] && (
                          <div className="activity-strava-description">
                            {getActivityDescription(url) ?? <em>No description</em>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="photos-section">
                <div className="photos-slideshow">
                  {report[selectedRoute].photos.map((photo, k) => renderPhotoTileWithMap(photo, k, selectedRoute))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="report-container">
          <div className="report-content">
                {reportOrder.map((route, index) => (
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
                        {report[route].photos.map((photo, k) => renderPhotoTileWithMap(photo, k, route))}
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
                      {shouldShowConditions(report[route]) && (
                        <div className="description-container">
                          <p className="route-description">AI conditions: {getRouteConditionsText(report[route])}</p>
                        </div>
                      )}
                      <div className="activity-descriptions-toggle">
                        <button
                          type="button"
                          className="description-toggle"
                          onClick={() => toggleActivityDescriptions(route)}
                        >
                          {showActivityDescriptions[route] ? '▼ Hide descriptions' : '▶ Show descriptions'}
                        </button>
                      </div>
                      {report[route].activityInfo.map((activityInfo, i) => (
                        <div key={i} className="activity-info">
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
                                </a>
                                {showActivityDescriptions[route] && (
                                  <div className="activity-strava-description">
                                    {getActivityDescription(url) ?? <em>No description</em>}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
          </div>
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
      <div className="help-buttons-container">
        <button
          type="button"
          className="rate-limit-help-button"
          onClick={() => setShowHowItWorks(true)}
        >
          How does it work?
        </button>
        <button
          type="button"
          className="rate-limit-help-button"
          onClick={() => setShowRateLimitInfo(true)}
        >
          Not seeing the activities you expected?
        </button>
      </div>
      {expandedPhotoSrc && (
        <div
          className="photo-lightbox-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded photo"
          onClick={() => setExpandedPhotoSrc(null)}
        >
          <button
            type="button"
            className="photo-lightbox-close"
            aria-label="Close expanded photo"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedPhotoSrc(null);
            }}
          >
            ×
          </button>
          <img
            src={expandedPhotoSrc}
            alt=""
            className="photo-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default Report;