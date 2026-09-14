import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Polyline } from 'react-leaflet';
import { API_BASE_URL, WS_BASE_URL } from './api';

export default function ControlCenterDashboard() {
  const [ambulances, setAmbulances] = useState({});
  const [activeTab, setActiveTab] = useState('map'); // map, users
  
  // User Management State
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Traffic Lights
  const [trafficLights, setTrafficLights] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/traffic-lights/all`)
      .then(res => res.json())
      .then(data => setTrafficLights(data.elements || []))
      .catch(e => console.error(e));
  }, []);

  const createTrafficLightIcon = () => {
    return window.L ? new window.L.divIcon({
      className: 'custom-marker-traffic',
      html: `<div style="background-color: #ffcc00; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(255, 204, 0, 0.8);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    }) : null;
  };
  
  // WebSocket ref
  const wsRef = useRef(null);

  // Connect to WebSocket for live ambulance updates
  useEffect(() => {
    wsRef.current = new WebSocket(`${WS_BASE_URL}/ws/control`);
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ambulance_location') {
        setAmbulances(prev => ({
          ...prev,
          [data.ambulance_id]: {
            lat: data.lat,
            lon: data.lon,
            status: data.status,
            target_hospital: data.target_hospital,
            route: data.route,
            severity: data.severity,
            patient_count: data.patient_count,
            urgency_score: data.urgency_score
          }
        }));
      }
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Fetch Users
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`);
      const data = await res.json();
      if (data.users) setUsers(data.users);
      else console.error(data.error);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Update Role
  const updateRole = async (userId, newRole) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (data.status === 'success') {
        // Optimistically update UI
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } else {
        alert("Failed to update role: " + data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const activeAmbulanceList = Object.entries(ambulances).sort((a, b) => (b[1].urgency_score || 0) - (a[1].urgency_score || 0));

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: '#1a1a1a', color: 'white' }}>
      
      {/* Left Sidebar */}
      <div style={{ width: '350px', background: '#222', borderRight: '1px solid #333', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ color: '#007bff' }}>Control Center</h2>
        <p style={{ color: '#888' }}>Superadmin Dashboard</p>
        
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px', marginBottom: '20px' }}>
          <button 
            onClick={() => setActiveTab('map')}
            style={{ flex: 1, padding: '10px', background: activeTab === 'map' ? '#007bff' : '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Live Map
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            style={{ flex: 1, padding: '10px', background: activeTab === 'users' ? '#007bff' : '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Manage Users
          </button>
        </div>
        
        {activeTab === 'map' && (
          <>
            <div style={{ marginTop: '20px', flex: 1, overflowY: 'auto' }}>
              <h3>Active Ambulances</h3>
              {activeAmbulanceList.length === 0 ? (
                <p style={{ color: '#666' }}>No active units broadcasting.</p>
              ) : (
                activeAmbulanceList.map(([id, amb]) => (
                  <div key={id} style={{ background: '#333', padding: '10px', borderRadius: '8px', marginBottom: '10px', borderLeft: `4px solid ${amb.severity === 'critical' ? '#ff4444' : amb.severity === 'serious' ? '#ffc107' : '#00C851'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#007bff' }}>{id.toUpperCase()}</strong>
                      {amb.urgency_score >= 3 && <span style={{ background: '#ff4444', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>URGENCY: {amb.urgency_score}</span>}
                    </div>
                    <div style={{ fontSize: '14px', color: '#ccc', marginTop: '4px' }}>Status: {amb.status}</div>
                    {amb.target_hospital && <div style={{ fontSize: '14px', color: '#ffcc00' }}>To: {amb.target_hospital}</div>}
                    <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                      <span style={{ textTransform: 'uppercase' }}>{amb.severity}</span> • {amb.patient_count} patient(s)
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div style={{ borderTop: '1px solid #333', paddingTop: '20px' }}>
              <h3>Analytics Overview</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span>Avg Response:</span> <strong style={{ color: '#00C851' }}>12.4 min</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Active Alerts:</span> <strong style={{ color: '#ff4444' }}>0</strong>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Main Content Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {activeTab === 'map' ? (
          <MapContainer center={[30.7333, 76.7794]} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
            {trafficLights.map((light, idx) => (
              light.lat && light.lon ? (
                <Marker 
                  key={`tl-${idx}`} 
                  position={[light.lat, light.lon]}
                  icon={createTrafficLightIcon()}
                >
                  <Tooltip>Traffic Signal {light.tags?.name ? `(${light.tags.name})` : ''}</Tooltip>
                </Marker>
              ) : null
            ))}
            {activeAmbulanceList.map(([id, amb]) => (
              <React.Fragment key={id}>
                {amb.lat && amb.lon && (
                  <Marker position={[amb.lat, amb.lon]}>
                    <Tooltip permanent direction="top">{id}</Tooltip>
                  </Marker>
                )}
                {amb.route && amb.route.length > 0 && (
                  <Polyline positions={amb.route} color="#007bff" weight={4} opacity={0.6} dashArray="10, 10" />
                )}
              </React.Fragment>
            ))}
          </MapContainer>
        ) : (
          <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', overflowY: 'auto', height: '100%' }}>
            <h1 style={{ borderBottom: '1px solid #333', paddingBottom: '10px' }}>User Management</h1>
            <p style={{ color: '#888', marginBottom: '30px' }}>
              Assign roles to users. Users must refresh their browser for role changes to take effect.
            </p>
            
            {loadingUsers ? <p>Loading users from Clerk...</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {users.map(u => (
                  <div key={u.id} style={{ background: '#222', padding: '20px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      {u.image_url ? (
                        <img src={u.image_url} alt="profile" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                      ) : (
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#444' }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{u.name}</div>
                        <div style={{ color: '#888', fontSize: '14px' }}>{u.email}</div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '14px', color: '#ccc' }}>Role:</span>
                      <select 
                        value={u.role || 'driver'}
                        onChange={(e) => updateRole(u.id, e.target.value)}
                        style={{ padding: '8px 12px', background: '#111', color: 'white', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        <option value="driver">Driver</option>
                        <option value="hospital">Hospital</option>
                        <option value="control">Control Center (Admin)</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
    </div>
  );
}
