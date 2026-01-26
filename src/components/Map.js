import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { isMobileDevice } from '../utils'; // Import the utility function

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_API_KEY || '';

const calculateBearing = (start, end) => {
  const startLat = start[1];
  const startLng = start[0];
  const endLat = end[1];
  const endLng = end[0];

  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
  const bearing = Math.atan2(y, x) * (180 / Math.PI);

  return (bearing + 360) % 360; // Normalize to 0-360
};

const calculateAverageBearing = (polylines) => {
  const bearings = polylines.map(polyline => {
    const start = polyline[0];
    const midpointIndex = Math.floor(polyline.length / 2);
    const midpoint = polyline[midpointIndex];
    return calculateBearing(start, midpoint);
  });

  const sumX = bearings.reduce((sum, bearing) => sum + Math.cos(bearing * Math.PI / 180), 0);
  const sumY = bearings.reduce((sum, bearing) => sum + Math.sin(bearing * Math.PI / 180), 0);
  const averageBearing = Math.atan2(sumY, sumX) * (180 / Math.PI);

  return (averageBearing + 360) % 360; // Normalize to 0-360
};

const Map = ({ polylines, mapId, activityInfo, photos, displayImages, setDisplayImages }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const popupRef = useRef(null);
  const [is3D, setIs3D] = useState(true);
  const [isPhotoHovered, setIsPhotoHovered] = useState(false);
  const isPhotoHoveredRef = useRef(isPhotoHovered); // Ref to track hover state
  const lineColor = '#f75002';
  const selectedLineColor = '#1eff00';
  const [mapError, setMapError] = useState(null);

  useEffect(() => {
    if (map.current) return;

    const initializeMap = async () => {
      if (!mapContainer.current) return; // Ensure map container is available

      try {
        // Validate polylines data
        if (!polylines || polylines.length === 0) {
          throw new Error('No valid polylines data available');
        }

        const bounds = new mapboxgl.LngLatBounds();
        let hasValidPoints = false;

        polylines.forEach((polyline) => {
          if (polyline && polyline.length > 0) {
            polyline.forEach((point) => {
              if (point && point.length >= 2 && !isNaN(point[0]) && !isNaN(point[1])) {
                bounds.extend([point[1], point[0]]);
                hasValidPoints = true;
              }
            });
          }
        });

        if (!hasValidPoints) {
          throw new Error('No valid coordinates found in polylines');
        }

        const averageBearing = calculateAverageBearing(polylines);
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/satellite-v9',
          bounds: bounds,
          fitBoundsOptions: { padding: 75 },
          pitch: 45,
          bearing: averageBearing
        });

        map.current.on('load', () => {
          addMapSources();
          addMapLayers();
          setupPolylines();
          updateMarkers();
          toggle3D(true); // Initialize map in 3D view
        });
      } catch (error) {
        console.error('Error initializing map:', error);
        setMapError(`Map not displaying properly. Strava has rate limits 🤷‍♂️`);
      }
    };

    initializeMap();
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [polylines, mapId, activityInfo]);

  useEffect(() => {
    if (map.current) {
      updateMarkers();
    }
  }, [displayImages, photos]);

  useEffect(() => {
    isPhotoHoveredRef.current = isPhotoHovered;
  }, [isPhotoHovered]);

  const addMapSources = () => {
    if (!map.current) return;
    map.current.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.terrain-rgb',
      tileSize: 512,
      maxzoom: 14,
    });

    map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
  };

  const addMapLayers = () => {
    if (!map.current) return;
    map.current.addLayer({
      id: 'sky',
      type: 'sky',
      paint: {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [0.0, 0.0],
        'sky-atmosphere-sun-intensity': 15,
      },
    });
  };

  const setupPolylines = () => {
    if (!map.current) return;
    polylines.forEach((polyline, polylineIndex) => {
      const sourceId = `route-${mapId}-${polylineIndex}`;
      const layerId = `route-${mapId}-${polylineIndex}`;

      map.current.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {
            name: activityInfo[polylineIndex].activityName,
            activityId: `activity-${mapId}-${polylineIndex}`,
          },
          geometry: {
            type: 'LineString',
            coordinates: polyline.map(point => [point[1], point[0]]),
          },
        },
      });

      map.current.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': lineColor,
          'line-width': 4,
        },
      });

      setupPolylineInteractions(layerId, polylineIndex);
    });
  };

  const setupPolylineInteractions = (layerId, polylineIndex) => {
    if (!map.current || !mapContainer.current) return;
    map.current.on('mouseenter', layerId, e => {
      console.log('entering polyline, isPhotoHovered:', isPhotoHoveredRef.current);
      if (!isPhotoHoveredRef.current) {
        handleMouseEnter(e, layerId, polylineIndex);
      }
    });
    map.current.on('mouseleave', layerId, () => {
      console.log('exiting polyline, isPhotoHovered:', isPhotoHoveredRef.current);
      if (!isPhotoHoveredRef.current) {
        handleMouseLeave(layerId);
      }
    });
    map.current.on('click', layerId, () => handlePolylineClick(polylineIndex));

    mapContainer.current.addEventListener(`mouseenter-${mapId}-${polylineIndex}`, event => handleCustomMouseEnter(event, layerId));
    mapContainer.current.addEventListener(`mouseleave-${mapId}-${polylineIndex}`, event => handleCustomMouseLeave(event, layerId));

    photos.forEach((photo, k) => {
      mapContainer.current.addEventListener(`mouseenter-photo-${mapId}-${polylineIndex}-${k}`, event => handlePhotoMouseEnterGallery(event, layerId));
      mapContainer.current.addEventListener(`mouseleave-photo-${mapId}-${polylineIndex}-${k}`, event => handlePhotoMouseLeaveGallery(event, layerId));
    });
  };

  const handleMouseEnter = (e, layerId, polylineIndex) => {
    console.log('Entering polyline');
    resetPolylines();
    clearAllHoveredActivities();
    map.current.getCanvas().style.cursor = 'pointer';
    map.current.setPaintProperty(layerId, 'line-color', selectedLineColor);
    map.current.moveLayer(layerId);

    const coordinates = e.lngLat;
    const name = e.features[0].properties.name;
    const activityId = e.features[0].properties.activityId;

    highlightPhotos(activityInfo[polylineIndex].photos);
    highlightActivityElement(activityId);
    showPopup(coordinates, name);

    if (isPhotoHoveredRef.current) {
      map.current.on('mouseleave', layerId, () => handleMouseLeave(layerId));
    }
  };

  const handleMouseLeave = (layerId) => {
    console.log('mouse left polyline')
    map.current.getCanvas().style.cursor = '';
    map.current.setPaintProperty(layerId, 'line-color', lineColor);
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    if (!isPhotoHoveredRef.current) {
      clearAllHoveredActivities();
      resetPhotoHighlights();
    }
  };

  const handlePolylineClick = (polylineIndex) => {
    if (isPhotoHoveredRef.current) return;
    const activityUrl = activityInfo[polylineIndex].url;
    const stravaId = activityUrl.split('/')[4];
    console.log('activityUrl:', activityUrl)

    if (isMobileDevice()) {
      window.location.href = `strava://activities/${stravaId}`;
    } else {
      window.open(activityUrl, '_blank');
    }
  };

  const handleCustomMouseEnter = (event, layerId) => {
    resetPolylines();
    clearAllHoveredActivities();
    map.current.setPaintProperty(layerId, 'line-color', selectedLineColor);
    map.current.moveLayer(layerId);
    highlightPhotos(event.detail.photos);
  };

  const handleCustomMouseLeave = (event, layerId) => {
    map.current.setPaintProperty(layerId, 'line-color', lineColor);
    clearAllHoveredActivities();
    resetPhotoHighlights();
  };

  const handlePhotoMouseEnterGallery = (event, layerId) => {
    console.log('entered gallery')
    const photo = event.detail.photo;
    const polylineIndex = event.detail.polylineIndex;
    console.log('Photo marker mouse enter:', photo, polylineIndex);
    setIsPhotoHovered(true);

    const activityId = `activity-${mapId}-${polylineIndex}`;
    resetPolylines();
    clearAllHoveredActivities();
    map.current.setPaintProperty(layerId, 'line-color', selectedLineColor);
    map.current.moveLayer(layerId);
    highlightActivityElement(activityId);
    highlightPhotos([photo]);
  };

  const handlePhotoMouseLeaveGallery = (event, layerId) => {
    const polylineIndex = event.detail.polylineIndex;
    console.log('Photo marker mouse leave:', polylineIndex);
    setIsPhotoHovered(false);
    map.current.setPaintProperty(layerId, 'line-color', lineColor);
    clearAllHoveredActivities();
    resetPhotoHighlights();
  };

  const handlePhotoMouseEnterMap = (event, mapId) => {
    console.log('entered map photo')
    resetPolylines();
    clearAllHoveredActivities();
    const photo = event.detail.photo;
    const polylineIndex = event.detail.polylineIndex;
    console.log('Handling photo mouse enter map:', photo, polylineIndex);
    setIsPhotoHovered(true);
    console.log('isPhotoHoveredRef.current:', isPhotoHoveredRef.current); // Use the ref value for logging

    const activityId = `activity-${mapId}-${polylineIndex}`;
    console.log(activityId)

    resetPolylines();
    clearAllHoveredActivities();
    map.current.setPaintProperty(`route-${mapId}-${polylineIndex}`, 'line-color', selectedLineColor);
    map.current.moveLayer(`route-${mapId}-${polylineIndex}`);
    highlightActivityElement(activityId);
    highlightPhotos([photo]);
  };

  const handlePhotoMouseLeaveMap = (event, mapId) => {
    const polylineIndex = event.detail.polylineIndex;
    setIsPhotoHovered(false);
    console.log('isPhotoHoveredRef.current:', isPhotoHoveredRef.current);
    setTimeout(() => {
      if (!isPhotoHoveredRef.current) {
        map.current.setPaintProperty(`route-${mapId}-${polylineIndex}`, 'line-color', lineColor);
        clearAllHoveredActivities();
        resetPhotoHighlights();
      }
    }, 0); // Add a small delay to allow state to update
  };

  const resetPolylines = () => {
    polylines.forEach((_, index) => {
      const resetLayerId = `route-${mapId}-${index}`;
      if (map.current.getLayer(resetLayerId)) {
        map.current.setPaintProperty(resetLayerId, 'line-color', lineColor);
      }
    });
  };

  const clearAllHoveredActivities = () => {
    const hoveredElements = document.querySelectorAll('.hovered');
    hoveredElements.forEach(element => element.classList.remove('hovered'));
  };

  const highlightPhotos = (photos) => {
    photos.forEach(photo => {
      const photoMarkers = document.querySelectorAll(`.photo-marker[data-url="${photo.photo}"]`);
      photoMarkers.forEach(marker => marker.classList.add('highlighted-photo'));
    });
  };

  const resetPhotoHighlights = () => {
    const photoMarkers = document.querySelectorAll('.highlighted-photo');
    photoMarkers.forEach(marker => marker.classList.remove('highlighted-photo'));
  };

  const highlightActivityElement = (activityId) => {
    const activityElement = document.getElementById(activityId);
    if (activityElement) {
      activityElement.classList.add('hovered');
    }
  };

  const showPopup = (coordinates, name) => {
    if (popupRef.current) {
      popupRef.current.remove();
    }

    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
      .setLngLat(coordinates)
      .setHTML(`<p>${name}</p>`)
      .addTo(map.current);

    document.querySelector('.mapboxgl-popup-content').classList.add('custom-popup');
    popupRef.current = popup;
  };

  const removePopup = () => {
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  };

  const updateMarkers = () => {
    // Remove existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (displayImages && photos.length > 0) {
      photos.forEach((photo) => {
        console.log('photo', photo);
        if (photo.lat && photo.lng) {
          const el = document.createElement('div');
          el.className = 'photo-marker';
          el.style.backgroundImage = `url(${photo.photo})`;
          el.style.width = '30px';
          el.style.height = '30px';
          el.style.backgroundSize = 'cover';
          el.style.borderRadius = '50%';
          el.style.border = '2px solid orange';
          el.dataset.url = photo.photo;

          const marker = new mapboxgl.Marker(el)
            .setLngLat([photo.lng, photo.lat])
            .setPopup(
              new mapboxgl.Popup({ anchor: 'center' })
                .setHTML(`<img src="${photo.photo}" alt="Photo" style="width: 200px; height: 200px; border-radius: 10px;" />`)
            )
            .addTo(map.current);

          markersRef.current.push(marker);

          el.addEventListener('mouseenter', () => handlePhotoMouseEnterMap({ detail: { photo, polylineIndex: photo.polylineIndex } }, mapId));
          el.addEventListener('mouseleave', () => handlePhotoMouseLeaveMap({ detail: { photo, polylineIndex: photo.polylineIndex } }, mapId));
        }
      });
    }
  };

  const toggle3D = (enable3D) => {
    if (enable3D) {
      const averageBearing = calculateAverageBearing(polylines);
      map.current.easeTo({ pitch: 30, bearing: averageBearing });
      map.current.dragPan.enable(); // Enable drag pan for 3D
      map.current.dragRotate.enable(); // Enable drag rotate for 3D
    } else {
      map.current.easeTo({ pitch: 0, bearing: 0 });
      // map.current.dragPan.disable(); // Disable drag pan for 2D
      map.current.dragRotate.disable(); // Disable drag rotate for 2D
    }
    setIs3D(enable3D);
  };

  const photosWithCoordinates = photos.filter(photo => photo.lat && photo.lng);

  return (
    <div style={{ position: 'relative' }}>
      {mapError ? (
        <div className="map-error-message">{mapError}</div>
      ) : (
        <>
          <div id={`map-${mapId}`} ref={mapContainer} style={{ width: '100%', height: '400px' }} />
          {photosWithCoordinates.length > 0 && (
            <button
              className="toggle-button"
              onClick={() => setDisplayImages(!displayImages)}
            >
              {displayImages ? 'Hide Images' : 'Display Images'}
            </button>
          )}
          <button
            className="toggle-3d-button"
            onClick={() => toggle3D(!is3D)}
            style={{ top: photosWithCoordinates.length > 0 ? '40px' : '10px', left: '10px' }}
          >
            {is3D ? '2D Toggle' : '3D Toggle'}
          </button>
        </>
      )}
    </div>
  );
};

export default Map;