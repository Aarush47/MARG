import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/react';
import { WS_BASE_URL } from './api';

export default function HospitalDashboard() {
  const { user } = useUser();
  const [ambulances, setAmbulances] = useState({});
  const [beds, setBeds] = useState({ icu: 4, general: 15 });
  
  const wsRef = useRef(null);

  useEffect(() => {
    wsRef.current = new WebSocket(`${WS_BASE_URL}/ws/control`);
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ambulance_location') {
        // Only keep track if they have a target hospital
        if (data.target_hospital) {
          setAmbulances(prev => ({
            ...prev,
            [data.ambulance_id]: {
              ...data,
              // Calculate a mock ETA based on remaining route steps or distance, for demo we'll use a random 3-15 min if not provided
              eta: prev[data.ambulance_id]?.eta || Math.floor(Math.random() * 12) + 3,
            }
          }));
        } else {
          // If they no longer have a target hospital, remove them from the incoming list
          setAmbulances(prev => {
            const next = { ...prev };
            delete next[data.ambulance_id];
            return next;
          });
        }
      }
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleResponse = (ambulance_id, target_hospital, action) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "hospital_response",
        ambulance_id,
        target_hospital,
        action // 'accept' or 'reject'
      }));
      
      // Optimistically remove from queue if rejected
      if (action === 'reject') {
        setAmbulances(prev => {
          const next = { ...prev };
          delete next[ambulance_id];
          return next;
        });
      } else {
        alert("Ambulance accepted! Preparing bed...");
      }
    }
  };

  const incoming = Object.values(ambulances).sort((a, b) => (b.urgency_score || 0) - (a.urgency_score || 0));

  return (
    <div style={{ height: '100vh', width: '100%', background: '#121212', color: 'white', padding: '30px', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#0dcaf0' }}>Hospital Dashboard</h1>
          <p style={{ margin: '5px 0 0 0', color: '#888' }}>Incoming Emergency Queue & Bed Management</p>
        </div>
        
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ background: '#222', padding: '15px 25px', borderRadius: '8px', border: '1px solid #333', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#aaa' }}>Available ICU Beds</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: beds.icu > 2 ? '#00C851' : '#ff4444' }}>{beds.icu}</div>
          </div>
          <div style={{ background: '#222', padding: '15px 25px', borderRadius: '8px', border: '1px solid #333', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#aaa' }}>Available General Beds</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0dcaf0' }}>{beds.general}</div>
          </div>
        </div>
      </div>
      
      <h2>Incoming Ambulances ({incoming.length})</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {incoming.map(amb => (
          <div key={amb.ambulance_id} style={{ background: '#1e1e1e', borderLeft: `5px solid ${amb.severity === 'critical' ? '#ff4444' : amb.severity === 'serious' ? '#ffc107' : '#00C851'}`, padding: '20px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                Ambulance #{amb.ambulance_id.toUpperCase()}
                {amb.urgency_score >= 3 && <span style={{ background: '#ff4444', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>HIGH URGENCY ({amb.urgency_score})</span>}
              </h3>
              <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px' }}>Driver: {amb.driver_name} • Targeting: {amb.target_hospital}</div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', fontSize: '14px' }}>
                <span style={{ color: amb.severity === 'critical' ? '#ff4444' : amb.severity === 'serious' ? '#ffc107' : '#00C851', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {amb.severity}
                </span>
                <span style={{ margin: '0 10px', color: '#666' }}>|</span>
                <span>{amb.patient_count} Patient{amb.patient_count > 1 ? 's' : ''}</span>
                {amb.symptoms && (
                  <>
                    <span style={{ margin: '0 10px', color: '#666' }}>|</span>
                    <span style={{ fontStyle: 'italic', color: '#ccc' }}>{amb.symptoms}</span>
                  </>
                )}
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffcc00' }}>{amb.eta} min</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Live ETA</div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => handleResponse(amb.ambulance_id, amb.target_hospital, 'accept')} style={{ padding: '10px 20px', background: '#00C851', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                Accept & Prepare
              </button>
              <button onClick={() => handleResponse(amb.ambulance_id, amb.target_hospital, 'reject')} style={{ padding: '10px 20px', background: 'transparent', color: '#ff4444', border: '1px solid #ff4444', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                Reject (No Beds)
              </button>
            </div>
          </div>
        ))}
        {incoming.length === 0 && <p style={{ color: '#666' }}>No incoming emergencies.</p>}
      </div>
    </div>
  );
}
