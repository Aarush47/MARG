import React from 'react';
import { Play, Pause, AlertTriangle } from 'lucide-react';

export default function ControlPanel({ simState, onStartDemo, onPauseDemo }) {
  const vehicles = Object.values(simState?.vehicles || {});
  const isRunning = simState?.running;
  
  return (
    <div className="control-panel">
      <div className="panel-header">
        <h1 className="panel-title">MARG</h1>
        <p className="panel-subtitle">Emergency Priority Engine</p>
      </div>

      <button className="btn" onClick={onStartDemo}>
        <Play size={20} /> Run Canonical Demo
      </button>

      {vehicles.length > 0 && (
        <button className={`btn btn-secondary`} onClick={onPauseDemo}>
          {isRunning ? <><Pause size={20} /> Pause Demo</> : <><Play size={20} /> Resume Demo</>}
        </button>
      )}

      {/* Vehicle Cards */}
      {vehicles.map(v => (
        <div key={v.id} className="card">
          <div className="card-title">
            {v.type === 'Ambulance' ? '🚑' : '🚒'} {v.type}
          </div>
          <div className="stat-row">
            <span className="stat-label">Severity (40%)</span>
            <span className="stat-value">{v.severity.toFixed(2)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Lives at Risk (30%)</span>
            <span className="stat-value">{v.lives_at_risk.toFixed(2)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Proximity (20%)</span>
            <span className="stat-value">{v.proximity_score.toFixed(2)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">ETA Urgency (10%)</span>
            <span className="stat-value">{v.eta_urgency.toFixed(2)}</span>
          </div>
          <div className={`priority-score ${v.status === 'rerouted' ? 'score-loser' : 'score-winner'}`}>
            Score: {v.score.toFixed(2)}
          </div>
          {v.status === 'rerouted' && (
            <div style={{color: '#f85149', fontSize: 12, marginTop: 4, textAlign: 'right'}}>
              Rerouted (A*)
            </div>
          )}
        </div>
      ))}

      {/* Conflicts */}
      {simState?.conflicts && simState.conflicts.length > 0 && (
        <div style={{marginTop: 20}}>
          <h3 style={{marginBottom: 10, fontSize: 16}}>Conflict Log</h3>
          {simState.conflicts.map((c, i) => (
            <div key={i} className="card conflict-alert pulse">
              <div style={{display: 'flex', alignItems: 'center', gap: 8, color: '#f85149', marginBottom: 8}}>
                <AlertTriangle size={18} /> Conflict at {c.junction}
              </div>
              <div className="stat-row">
                <span className="stat-label">Winner</span>
                <span className="score-winner">{c.winner} ({c.winner_score})</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Loser</span>
                <span className="score-loser">{c.loser} ({c.loser_score})</span>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
