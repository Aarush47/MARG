import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { useUser, useAuth } from '@clerk/react';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { API_BASE_URL, WS_BASE_URL } from './api';
import VoiceAssistant from './VoiceAssistant';



// --- CUSTOM ICONS ---
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

function MapClickHandler({ setUserLocation, setRoutePath, setIncidentLocation }) {
  useMapEvents({
    click(e) {
      // Teleport the ambulance to clicked location for testing
      setUserLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      setRoutePath(null); // Clear any active route
      setIncidentLocation(null);
    }
  });
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


function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c;
}

function getInstructionText(step) {
  if (!step || !step.maneuver) return "Continue following route";
  const { type, modifier } = step.maneuver;
  let text = "";
  if (type === 'depart') text = "Head " + (modifier || "forward");
  else if (type === 'turn') text = "Turn " + modifier;
  else if (type === 'arrive') text = "Arrive at destination";
  else if (type === 'exit rotary' || type === 'roundabout') text = "Take the roundabout exit";
  else text = "Continue " + (modifier || "straight");
  
  if (step.name) text += ` onto ${step.name}`;
  return text;
}

function speakInstruction(text) {
  if (!window.speechSynthesis) return;
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = 'hi-IN'; // Indian English/Hindi accent preference
  window.speechSynthesis.speak(msg);
}

export default function DriverDashboard() {

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
  const [searchRadius, setSearchRadius] = useState(10);
  
  // Patient details state
  const [severity, setSeverity] = useState('serious'); // critical, serious, stable
  const [patientCount, setPatientCount] = useState(1);
  const [symptoms, setSymptoms] = useState('');
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [incidentLocation, setIncidentLocation] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [routePath, setRoutePath] = useState(null);
  const [routeDetails, setRouteDetails] = useState(null);
  const [mapTheme, setMapTheme] = useState('dark');
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const [routeSteps, setRouteSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [distanceToNextTurn, setDistanceToNextTurn] = useState(0);
  const [nextInstruction, setNextInstruction] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const spokenDistances = useRef({});
  const simulationInterval = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Phase 3 placeholder: send audioBlob to backend API for OpenAI Whisper transcription
        console.log("Audio recorded:", audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or not available", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const { user } = useUser();
  const { getToken } = useAuth();
  
  // Ref for Voice Assistant Actions
  const mapRef = useRef(null);
  const sidebarRef = useRef(null);

  // Global WebSocket for Control Center Sync
  const wsRef = useRef(null);

  // Fetch traffic lights on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/traffic-lights/all`)
      .then(res => res.json())
      .then(data => setTrafficLights(data.elements || []))
      .catch(e => console.error("Failed to fetch traffic lights:", e));
  }, []);
  
  const [rejectedHospitalName, setRejectedHospitalName] = useState(null);

  useEffect(() => {
    // Generate a random ambulance ID for demo if needed, or use Clerk ID
    const ambId = user?.id ? "amb-" + user.id.slice(-4) : "amb-" + Math.floor(Math.random() * 1000);
    wsRef.current = new WebSocket(`${WS_BASE_URL}/ws/ambulance/${ambId}`);
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'hospital_response' && data.ambulance_id === ambId) {
        if (data.action === 'reject') {
          // Trigger the reroute effect
          setRejectedHospitalName(data.target_hospital || "the hospital");
        }
      }
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [user]);

  // Handle hospital rejection auto-reroute
  useEffect(() => {
    if (rejectedHospitalName && facilities.length > 0 && incidentLocation) {
      alert(`URGENT: ${rejectedHospitalName} has REJECTED the ambulance (No Beds). Rerouting to next nearest hospital automatically!`);
      
      // Stop current simulation
      setIsSimulating(false);
      if (simulationInterval.current) clearInterval(simulationInterval.current);
      
      // Find the next nearest hospital that is NOT the rejected one
      const sortedHospitals = [...facilities].sort((a, b) => a.distance - b.distance);
      const nextHospital = sortedHospitals.find(h => h.tags?.name !== rejectedHospitalName && h.tags?.name !== incidentLocation?.name);
      
      if (nextHospital) {
        // Trigger click on the next hospital
        handleFacilityClick(nextHospital);
      } else {
        alert("CRITICAL: No other hospitals available in the immediate vicinity!");
      }
      
      setRejectedHospitalName(null);
    }
  }, [rejectedHospitalName, facilities, incidentLocation]);

  // Broadcast location when it changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && userLocation) {
      wsRef.current.send(JSON.stringify({
        lat: userLocation.lat,
        lon: userLocation.lng,
        status: routePath ? "en_route" : "idle",
        target_hospital: incidentLocation?.name || null,
        route: routePath, // Send full predicted path to control center
        driver_name: user?.fullName || "Unknown Driver",
        severity,
        patient_count: patientCount,
        symptoms
      }));
    }
  }, [userLocation, routePath, incidentLocation, user, severity, patientCount, symptoms]);

  const currentThemeLabel = THEME_GROUPS.flatMap(g => g.options).find(o => o.id === mapTheme)?.label || "Standard";

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });
  };

  const fetchFacilitiesForLocation = async (lat, lng) => {
    setLoadingFacilities(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/facilities?lat=${lat}&lng=${lng}&radius=${searchRadius}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server returned ${response.status}: ${text}`);
      }
      const data = await response.json();
      
      // The backend already calculates distances and sorts the array perfectly
      setFacilities(data.elements || []);
    } catch (e) {
      console.error("Failed to fetch nearby facilities:", e);
      alert(`Failed to load hospital data from the local database API. Details: ${e.message}`);
    } finally {
      setLoadingFacilities(false);
    }
  };

  
  const startSimulation = () => {
    if (isSimulating) {
      clearInterval(simulationInterval.current);
      setIsSimulating(false);
      return;
    }
    
    if (!routePath || routePath.length === 0) return;
    
    setIsSimulating(true);
    let pathIndex = 0;
    let stepIdx = 0;
    
    simulationInterval.current = setInterval(() => {
      if (pathIndex >= routePath.length - 1) {
        clearInterval(simulationInterval.current);
        setIsSimulating(false);
        speakInstruction("You have arrived at your destination.");
        return;
      }
      
      pathIndex += 2; // jump 2 points at a time for speed
      if (pathIndex >= routePath.length) pathIndex = routePath.length - 1;
      
      const currentPos = routePath[pathIndex];
      setUserLocation({ lat: currentPos[0], lng: currentPos[1] });
      
      // Update turn by turn logic
      if (routeSteps.length > 0 && stepIdx < routeSteps.length) {
         let nextStep = routeSteps[stepIdx + 1] || routeSteps[stepIdx];
         const turnLoc = nextStep.maneuver.location; // [lng, lat]
         const dist = haversine(currentPos[0], currentPos[1], turnLoc[1], turnLoc[0]) * 1000;
         setDistanceToNextTurn(dist);
         
         if (dist < 30 && stepIdx < routeSteps.length - 1) {
            stepIdx++;
            setCurrentStepIndex(stepIdx);
            const inst = getInstructionText(routeSteps[stepIdx + 1] || routeSteps[stepIdx]);
            setNextInstruction(inst);
            speakInstruction("Turn now. " + inst);
         } else if (dist < 100 && !spokenDistances.current['100_'+stepIdx]) {
            spokenDistances.current['100_'+stepIdx] = true;
            speakInstruction("In 100 metres, " + getInstructionText(nextStep));
         } else if (dist < 500 && dist >= 450 && !spokenDistances.current['500_'+stepIdx]) {
            spokenDistances.current['500_'+stepIdx] = true;
            speakInstruction("In 500 metres, " + getInstructionText(nextStep));
         }
      }
      
    }, 1000); // update every second
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
            const routeResponse = await fetch(`https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${targetLng},${targetLat}?overview=full&geometries=geojson&steps=true`);
            const routeData = await routeResponse.json();
            if (routeData.routes && routeData.routes.length > 0) {
              
              
        const coords = routeData.routes[0].geometry.coordinates;
        const leafletPath = coords.map(c => [c[1], c[0]]);
        setRoutePath(leafletPath);
        
        if (routeData.routes[0].legs && routeData.routes[0].legs[0].steps) {
           const steps = routeData.routes[0].legs[0].steps;
           setRouteSteps(steps);
           setCurrentStepIndex(0);
           if (steps.length > 0) {
              setNextInstruction(getInstructionText(steps[1] || steps[0]));
              setDistanceToNextTurn(steps[0].distance);
           }
           spokenDistances.current = {};
           speakInstruction("Route selected to hospital. " + getInstructionText(steps[0]));
        }

              
              if (routeData.routes[0].legs && routeData.routes[0].legs[0].steps) {
                 const steps = routeData.routes[0].legs[0].steps;
                 setRouteSteps(steps);
                 setCurrentStepIndex(0);
                 if (steps.length > 0) {
                    setNextInstruction(getInstructionText(steps[1] || steps[0]));
                    setDistanceToNextTurn(steps[0].distance);
                 }
                 spokenDistances.current = {};
                 speakInstruction("Route started. " + getInstructionText(steps[0]));
              }

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

  const handleVoiceCommand = async (command) => {
    console.log("Voice Command Received:", command);
    
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/ai/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ text: command })
      });
      
      const data = await res.json();
      if (data && data.actions) {
        for (const action of data.actions) {
          console.log("Executing AI Action:", action);
          switch(action.type) {
            case "SET_SEARCH_QUERY":
              setSearchQuery(action.payload);
              break;
            case "EXECUTE_SEARCH":
              // We simulate the form submission for search
              handleSearch({ preventDefault: () => {} });
              break;
            case "FIND_NEAREST":
              findNearestFacilities();
              break;
            case "SET_RADIUS":
              setSearchRadius(action.payload);
              break;
            case "START_NAVIGATION":
              startSimulation();
              break;
            case "CLEAR_ROUTE":
              setRouteDetails(null);
              setRoutePath(null);
              setIncidentLocation(null);
              setRouteSteps([]);
              clearInterval(simulationInterval.current);
              setIsSimulating(false);
              break;
            case "SET_SEVERITY":
              setSeverity(action.payload);
              break;
            case "SET_PATIENTS":
              setPatientCount(action.payload);
              break;
            case "SET_SYMPTOMS":
              setSymptoms(action.payload);
              break;
            case "SCROLL":
              if (sidebarRef.current) {
                const amount = action.payload === 'down' ? window.innerHeight * 0.5 : -window.innerHeight * 0.5;
                sidebarRef.current.scrollBy({ top: amount, behavior: 'smooth' });
              }
              break;
            case "MAP_ZOOM":
              if (mapRef.current) {
                const currentZoom = mapRef.current.getZoom();
                if (action.payload === 'in') {
                  mapRef.current.setZoom(currentZoom + 1);
                } else {
                  mapRef.current.setZoom(currentZoom - 1);
                }
              }
              break;
            default:
              console.warn("Unknown AI action:", action);
          }
        }
      }
    } catch (err) {
      console.error("Failed to process voice command with AI:", err);
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
      const routeResponse = await fetch(`https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${targetLng},${targetLat}?overview=full&geometries=geojson&steps=true`);
      const routeData = await routeResponse.json();
      if (routeData.routes && routeData.routes.length > 0) {
        
        const coords = routeData.routes[0].geometry.coordinates;
        const leafletPath = coords.map(c => [c[1], c[0]]);
        setRoutePath(leafletPath);
        
        if (routeData.routes[0].legs && routeData.routes[0].legs[0].steps) {
           const steps = routeData.routes[0].legs[0].steps;
           setRouteSteps(steps);
           setCurrentStepIndex(0);
           if (steps.length > 0) {
              setNextInstruction(getInstructionText(steps[1] || steps[0]));
              setDistanceToNextTurn(steps[0].distance);
           }
           spokenDistances.current = {};
           speakInstruction("Route selected to hospital. " + getInstructionText(steps[0]));
        }

        
        setRouteDetails({
          duration: Math.round(routeData.routes[0].duration / 60),
          distance: (routeData.routes[0].distance / 1000).toFixed(1),
          summary: routeData.routes[0].legs?.[0]?.summary || "Primary Route"
        });
      }
    } catch (routeErr) {
      console.error("OSRM Routing Error:", routeErr);
      alert("Failed to find a route to this facility: " + routeErr.message);
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
      
      {/* Voice Assistant Overlay */}
      <VoiceAssistant onCommand={handleVoiceCommand} />

      {/* Sidebar */}
      <div ref={sidebarRef} className="control-panel" style={{ width: '400px', height: '100%', overflowY: 'auto', borderRight: '1px solid var(--border)', zIndex: 10, flexShrink: 0 }}>
        
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
             <label style={{ fontSize: '12px', color: '#8b949e', display: 'flex', justifyContent: 'space-between' }}>
               <span>Search Radius</span>
               <span>{searchRadius} km</span>
             </label>
             <input 
               type="range" 
               min="1" 
               max="50" 
               step="1" 
               value={searchRadius}
               onChange={(e) => setSearchRadius(Number(e.target.value))}
               style={{ width: '100%' }}
             />
          </div>
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

             <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#0dcaf0' }}>Patient Details (Auto-syncs to Hospital)</h4>
                
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '4px' }}>Severity</label>
                    <select 
                      value={severity} 
                      onChange={e => setSeverity(e.target.value)}
                      style={{ width: '100%', padding: '8px', background: '#111', color: 'white', border: '1px solid #333', borderRadius: '4px' }}
                    >
                      <option value="stable">Stable</option>
                      <option value="serious">Serious</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div style={{ width: '80px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '4px' }}>Patients</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="10" 
                      value={patientCount} 
                      onChange={e => setPatientCount(parseInt(e.target.value) || 1)}
                      style={{ width: '100%', padding: '8px', background: '#111', color: 'white', border: '1px solid #333', borderRadius: '4px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '4px' }}>Symptoms/Condition (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Cardiac arrest, severe trauma..." 
                    value={symptoms} 
                    onChange={e => setSymptoms(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: '#111', color: 'white', border: '1px solid #333', borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                </div>
                
             </div>
             
             <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => { setRouteDetails(null); setRoutePath(null); setIncidentLocation(null); setRouteSteps([]); clearInterval(simulationInterval.current); }}
                  style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Clear Route
                </button>
                <button 
                  onClick={startSimulation}
                  style={{ flex: 1, padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {isSimulating ? 'Stop Simulation' : 'Start Simulation'}
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
                   <div style={{ flex: 1 }}>
                     <div style={{ fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                       {fac.tags?.name || (fac.tags?.amenity === 'hospital' ? 'Hospital' : 'Fire Station')}
                       {fac.tags?.has_icu && (
                         <span style={{ background: '#ff4444', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>ICU</span>
                       )}
                     </div>
                     <div style={{ fontSize: '12px', color: '#8b949e' }}>
                        {fac.distance ? `${fac.distance.toFixed(2)} km away` : 'OpenStreetMap Facility'}
                        {fac.tags?.phone && ` • ${fac.tags.phone}`}
                     </div>
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
          {/* Turn-by-Turn Guidance Panel */}
          {routePath && routeSteps.length > 0 && (
             <div style={{
               position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
               zIndex: 1000, background: '#1a1a1a', border: '2px solid #007bff',
               borderRadius: '12px', padding: '16px 24px', color: 'white',
               boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: '300px', textAlign: 'center',
               display: 'flex', flexDirection: 'column', alignItems: 'center'
             }}>
               <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                 {nextInstruction.toLowerCase().includes('right') ? '↪️' : nextInstruction.toLowerCase().includes('left') ? '↩️' : '⬆️'}
               </div>
               <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{nextInstruction.toUpperCase()}</div>
               <div style={{ fontSize: '20px', color: distanceToNextTurn < 100 ? '#ff4444' : '#00C851', marginTop: '4px', fontWeight: 'bold' }}>
                 IN {Math.round(distanceToNextTurn)} METRES
               </div>
               {distanceToNextTurn < 200 && trafficLights.length > 0 && (
                 <div style={{ marginTop: '12px', background: 'rgba(255, 193, 7, 0.2)', color: '#ffc107', padding: '8px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <span>⚠️</span> Emergency Junction Ahead <br/> 🟢 Coordination Planned
                 </div>
               )}
             </div>
          )}
        <MapContainer ref={mapRef} center={center} zoom={14} zoomControl={false} className="leaflet-container">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          <MapClickHandler 
            setUserLocation={setUserLocation} 
            setRoutePath={setRoutePath} 
            setIncidentLocation={setIncidentLocation} 
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
