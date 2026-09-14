import React, { useState } from 'react';
import DriverDashboard from './DriverDashboard';
import ControlCenterDashboard from './ControlCenterDashboard';
import HospitalDashboard from './HospitalDashboard';
import ErrorBoundary from './ErrorBoundary';
import { Show, SignIn, UserButton, useUser } from '@clerk/react';

function DashboardRouter() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role || 'driver'; // Default unknown users to driver
  
  let DashboardComponent = DriverDashboard;
  if (role === 'control') DashboardComponent = ControlCenterDashboard;
  if (role === 'hospital') DashboardComponent = HospitalDashboard;

  return (
    <div className="app-container" style={{ position: 'relative', width: '100%', height: '100vh' }}>
      
      {/* Top right floating controls */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 1000 }}>
        <UserButton />
      </div>

      <ErrorBoundary>
        <DashboardComponent />
      </ErrorBoundary>
      
    </div>
  );
}

function App() {
  return (
    <>
      <Show when="signed-out">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: '#1a1a1a' }}>
          <SignIn routing="hash" />
        </div>
      </Show>
      
      <Show when="signed-in">
        <DashboardRouter />
      </Show>
    </>
  );
}

export default App;
