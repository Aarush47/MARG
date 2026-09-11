import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';



const createFacilityIcon = (type) => {
  const emoji = type === 'hospital' ? '🏥' : '🚒';
  const bgColor = type === 'hospital' ? '#fff' : '#ffd5d5';
  return L.divIcon({
    html: `<div style="background:${bgColor};border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.3);font-size:16px;">${emoji}</div>`,
    className: 'custom-marker-facility',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

const createTrafficLightIcon = () => {
  return L.divIcon({
    html: `<div style="background:#333;border:2px solid #fff;border-radius:4px;width:16px;height:36px;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;box-shadow:0 2px 5px rgba(0,0,0,0.5);">
             <div style="background:#ff3b30;width:10px;height:10px;border-radius:50%;"></div>
             <div style="background:#ffcc00;width:10px;height:10px;border-radius:50%;"></div>
             <div style="background:#34c759;width:10px;height:10px;border-radius:50%;"></div>
           </div>`,
    className: 'custom-marker-traffic',
    iconSize: [16, 36],
    iconAnchor: [8, 18],
  });
};

const createUserLocationIcon = () => {
  return L.divIcon({
    html: `<div style="background:#007bff;border:3px solid white;border-radius:50%;width:20px;height:20px;box-shadow:0 0 15px rgba(0,123,255,0.8);"></div>`,
    className: 'custom-marker-user',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

const createIncidentIcon = () => {
  return L.divIcon({
    html: `<div style="background:#ffc107;border:3px solid #dc3545;border-radius:50%;width:26px;height:26px;box-shadow:0 0 15px rgba(220,53,69,0.8);display:flex;align-items:center;justify-content:center;font-size:14px;">🚨</div>`,
    className: 'custom-marker-incident',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};



function LocationFitter({ userLocation }) {
  const map = useMap();
  useEffect(() => {
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 12, { duration: 1.5 });
    }
  }, [userLocation, map]);
  return null;
}

function RouteFitter({ routePath }) {
  const map = useMap();
  useEffect(() => {
    if (routePath && routePath.length > 0) {
      const bounds = L.latLngBounds(routePath);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routePath, map]);
  return null;
}

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; // Distance in km
};

export default function MapComponent() {

  const THEME_GROUPS = [
    {
      category: "Light Themes",
      options: [
        { id: "standard", label: "Standard" },
        { id: "silver", label: "Silver" }
      ]
    },
    {
      category: "Dark Themes",
      options: [
        { id: "dark", label: "Dark" },
        { id: "night", label: "Night" }
      ]
    },
    {
      category: "Creative Themes",
      options: [
        { id: "retro", label: "Retro" },
        { id: "aubergine", label: "Aubergine" }
      ]
    }
  ];

  const [facilities, setFacilities] = useState([]);
  const [loadingFacilities, setLoadingFacilities] = useState(false);
  const [trafficLights, setTrafficLights] = useState([]);
  const [loadingLights, setLoadingLights] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [incidentLocation, setIncidentLocation] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [routePath, setRoutePath] = useState(null);
  const [routeDetails, setRouteDetails] = useState(null);
  const [mapTheme, setMapTheme] = useState('dark');
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);

  const currentThemeLabel = THEME_GROUPS.flatMap(g => g.options).find(o => o.id === mapTheme)?.label || "Standard";

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });
  };

  const fetchFacilitiesForLocation = async (lat, lng) => {
    setLoadingFacilities(true);
    
    try {
      const response = await fetch(`http://localhost:8000/api/facilities?lat=${lat}&lng=${lng}&radius=10`);
      const data = await response.json();
      
      // The backend already calculates distances and sorts the array perfectly
      setFacilities(data.elements || []);
    } catch (e) {
      console.error("Failed to fetch nearby facilities:", e);
      alert("Failed to load hospital data from the local database API.");
    } finally {
      setLoadingFacilities(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const targetLat = parseFloat(data[0].lat);
        const targetLng = parseFloat(data[0].lon);
        setIncidentLocation({ lat: targetLat, lng: targetLng, name: data[0].display_name });
        
        try {
          const position = await getCurrentLocation();
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          setUserLocation({ lat: userLat, lng: userLng });

          try {
            const routeResponse = await fetch(`https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${targetLng},${targetLat}?overview=full&geometries=geojson`);
            const routeData = await routeResponse.json();
            if (routeData.routes && routeData.routes.length > 0) {
              const coords = routeData.routes[0].geometry.coordinates;
              const leafletPath = coords.map(c => [c[1], c[0]]);
              setRoutePath(leafletPath);
              setRouteDetails({
                duration: Math.round(routeData.routes[0].duration / 60),
                distance: (routeData.routes[0].distance / 1000).toFixed(1),
                summary: routeData.routes[0].legs?.[0]?.summary || "Primary Route"
              });
            }
          } catch (routeErr) {
            console.error("OSRM Routing Error:", routeErr);
          }
        } catch (locErr) {
          console.error("Error getting live location:", locErr);
          alert("Could not get your location for routing. Please ensure location permissions are granted.");
        }
      } else {
        alert("Address not found.");
      }
    } catch (error) {
      console.error("Search error:", error);
      alert("Failed to search address.");
    } finally {
      setIsSearching(false);
    }
  };

  const findNearestFacilities = () => {
    if (facilities.length > 0) {
      setFacilities([]);
      setIncidentLocation(null);
      setRoutePath(null);
      setRouteDetails(null);
      return;
    }
    
    const fetchWithLocation = async (lat, lng) => {
      setLoadingFacilities(true);
      await fetchFacilitiesForLocation(lat, lng);
    };

    if (userLocation) {
      fetchWithLocation(userLocation.lat, userLocation.lng);
    } else {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
      }
      setLoadingFacilities(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLocation({ lat, lng });
          fetchWithLocation(lat, lng);
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Could not get your location. Please ensure location permissions are granted.");
          setLoadingFacilities(false);
        }
      );
    }
  };



  const handleFacilityClick = async (fac) => {
    if (!userLocation) {
      alert("We need your live location first to draw a route.");
      return;
    }
    
    const targetLat = fac.lat;
    const targetLng = fac.lon;
    const facName = fac.tags?.name || (fac.tags?.amenity === 'hospital' ? 'Hospital' : 'Fire Station');
    
    setIncidentLocation({ lat: targetLat, lng: targetLng, name: facName });
    
    try {
      const routeResponse = await fetch(`https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${targetLng},${targetLat}?overview=full&geometries=geojson`);
      const routeData = await routeResponse.json();
      if (routeData.routes && routeData.routes.length > 0) {
        const coords = routeData.routes[0].geometry.coordinates;
        const leafletPath = coords.map(c => [c[1], c[0]]);
        setRoutePath(leafletPath);
        
        setRouteDetails({
          duration: Math.round(routeData.routes[0].duration / 60),
          distance: (routeData.routes[0].distance / 1000).toFixed(1),
          summary: routeData.routes[0].legs?.[0]?.summary || "Primary Route"
        });
        
        // Auto-fetch traffic lights along this route bounding box
        const lats = coords.map(c => c[1]);
        const lons = coords.map(c => c[0]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        
        setLoadingLights(true);
        const query = `
          [out:json][timeout:25];
          node["highway"="traffic_signals"](${minLat},${minLon},${maxLat},${maxLon});
          out center;
        `;
        
        fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: "data=" + encodeURIComponent(query)
        })
        .then(r => r.json())
        .then(data => setTrafficLights(data.elements || []))
        .catch(e => console.error(e))
        .finally(() => setLoadingLights(false));
      }
    } catch (routeErr) {
      console.error("OSRM Routing Error:", routeErr);
      alert("Failed to find a route to this facility.");
    }
  };

  // Default Center (New Delhi)
  const center = [28.6328, 77.2197];

  useEffect(() => {
    // Automatically get the user's live location on startup
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLocation({ lat, lng });
        },
        (error) => {
          console.error("Error getting initial location:", error);
        }
      );
    }
  }, []);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      
      {/* Sidebar */}
      <div className="control-panel" style={{ width: '400px', height: '100%', overflowY: 'auto', borderRight: '1px solid var(--border)', zIndex: 10, flexShrink: 0 }}>
        
        <div style={{ marginBottom: '24px' }}>
          <h2 className="panel-title">MARG Navigator</h2>
          <p className="panel-subtitle">Search and route emergency vehicles.</p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} style={{ display: 'flex', marginBottom: '20px' }}>
          <input 
            type="text" 
            placeholder="Search places, roads..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '12px 15px',
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-color)',
              outline: 'none',
              borderTopLeftRadius: '8px',
              borderBottomLeftRadius: '8px',
              fontSize: '14px'
            }}
          />
          <button 
            type="submit"
            disabled={isSearching}
            style={{
              padding: '12px 15px',
              background: 'var(--accent-color)',
              color: '#fff',
              border: 'none',
              cursor: isSearching ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              borderTopRightRadius: '8px',
              borderBottomRightRadius: '8px',
            }}
          >
            {isSearching ? '...' : 'Search'}
          </button>
        </form>

        {/* Map Theme Selector (Nested Menu) */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '8px' }}>Map Theme</label>
          <div className="dropdown-container">
            <button 
              type="button"
              className="dropdown-button"
              onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
            >
              {currentThemeLabel} <span>{isThemeDropdownOpen ? '▲' : '▼'}</span>
            </button>
            
            {isThemeDropdownOpen && (
              <div className="dropdown-menu">
                {THEME_GROUPS.map((group, idx) => (
                  <div key={idx}>
                    <div className="dropdown-category">
                      {group.category}
                    </div>
                    {group.options.map(option => (
                      <div 
                        key={option.id} 
                        className="dropdown-option"
                        onClick={() => {
                          setMapTheme(option.id);
                          setIsThemeDropdownOpen(false);
                        }}
                      >
                        {option.label} {mapTheme === option.id && "✓"}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <button className="btn" onClick={findNearestFacilities} style={{ margin: 0 }}>
             {loadingFacilities ? 'Locating...' : facilities.length > 0 ? 'Clear Hospitals' : 'Find Nearby Hospitals'}
          </button>
        </div>

        {/* Route Details Panel (Google Maps Style) */}
        {routeDetails && (
          <div style={{ marginTop: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px', borderLeft: '4px solid #007bff' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>via {routeDetails.summary}</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffcc00' }}>
                   {routeDetails.duration >= 60 
                     ? `${Math.floor(routeDetails.duration/60)} hr ${routeDetails.duration%60} min`
                     : `${routeDetails.duration} min`}
                </div>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', color: '#8b949e', fontSize: '14px' }}>
                <div>Fastest route now.</div>
                <div>{routeDetails.distance} km</div>
             </div>
             <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => { setRouteDetails(null); setRoutePath(null); setIncidentLocation(null); }}
                  style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Clear Route
                </button>
             </div>
          </div>
        )}

        {/* Facility Results */}
        {!routeDetails && facilities.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '12px', color: '#8b949e' }}>Nearby Facilities ({facilities.length})</h3>
            {facilities.map((fac, idx) => (
              <div key={`card-${idx}`} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                   <span style={{ fontSize: '24px' }}>{fac.tags?.amenity === 'hospital' ? '🏥' : '🚒'}</span>
                   <div>
                     <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{fac.tags?.name || (fac.tags?.amenity === 'hospital' ? 'Hospital' : 'Fire Station')}</div>
                     <div style={{ fontSize: '12px', color: '#8b949e' }}>{fac.distance ? `${fac.distance.toFixed(2)} km away` : 'OpenStreetMap Facility'}</div>
                   </div>
                </div>
                <button 
                  onClick={() => handleFacilityClick(fac)}
                  style={{
                    padding: '8px',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'var(--text-color)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
                  onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                >
                  Get Route
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Map Area */}
      <div className={`theme-${mapTheme}`} style={{ flex: 1, position: 'relative', height: '100%' }}>
        <MapContainer center={center} zoom={14} zoomControl={false} className="leaflet-container">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          {userLocation && !routePath && <LocationFitter userLocation={userLocation} />}
          {incidentLocation && !routePath && <LocationFitter userLocation={incidentLocation} />}
          {routePath && <RouteFitter routePath={routePath} />}
          
          {/* Render Ambulance Route (OSRM) */}
          {routePath && (
            <Polyline 
              positions={routePath} 
              color="#0dcaf0" 
              weight={8} 
              opacity={0.8} 
            />
          )}
          
          {userLocation && (
            <Marker 
              position={[userLocation.lat, userLocation.lng]}
              icon={createUserLocationIcon()}
            >
              <Tooltip permanent direction="top" offset={[0, -10]}>You Are Here</Tooltip>
            </Marker>
          )}

          {incidentLocation && (
            <Marker 
              position={[incidentLocation.lat, incidentLocation.lng]}
              icon={createIncidentIcon()}
            >
              <Tooltip permanent direction="top" offset={[0, -10]}>Target: {incidentLocation.name}</Tooltip>
            </Marker>
          )}

          {facilities.length > 0 && (
            <MarkerClusterGroup chunkedLoading={true} maxClusterRadius={40}>
              {facilities.map((fac, idx) => (
                <Marker 
                  key={`fac-${fac.id || idx}`} 
                  position={[fac.lat, fac.lon]} 
                  icon={createFacilityIcon(fac.tags?.amenity)}
                  eventHandlers={{ click: () => handleFacilityClick(fac) }}
                >
                  <Tooltip>{fac.tags?.name || (fac.tags?.amenity === 'hospital' ? 'Hospital' : 'Fire Station')}</Tooltip>
                </Marker>
              ))}
            </MarkerClusterGroup>
          )}

          {trafficLights.length > 0 && (
            <MarkerClusterGroup chunkedLoading={true} maxClusterRadius={30}>
              {trafficLights.map((light, idx) => (
                <Marker 
                  key={`tl-${light.id || idx}`} 
                  position={[light.lat, light.lon]} 
                  icon={createTrafficLightIcon()}
                >
                  <Tooltip>Traffic Signal {light.tags?.name ? `(${light.tags.name})` : ''}</Tooltip>
                </Marker>
              ))}
            </MarkerClusterGroup>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
