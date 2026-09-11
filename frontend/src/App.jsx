import React from 'react';
import MapComponent from './MapComponent';

function App() {
  return (
    <div className="app-container">
      <div className="map-container" style={{ width: '100%', height: '100vh' }}>
        <MapComponent />
      </div>
    </div>
  );
}

export default App;
