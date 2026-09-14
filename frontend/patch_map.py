import re

with open('src/MapComponent.jsx', 'r') as f:
    content = f.read()

# Add states
state_injection = """
  const [routeSteps, setRouteSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [distanceToNextTurn, setDistanceToNextTurn] = useState(0);
  const [nextInstruction, setNextInstruction] = useState("");
  const spokenDistances = useRef({});
  const simulationInterval = useRef(null);
"""
content = re.sub(r'const \[mapTheme, setMapTheme\] = useState\("dark"\);', r'const [mapTheme, setMapTheme] = useState("dark");\n' + state_injection, content)

# Add haversine and instruction functions if not exists
helpers = """
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
"""
content = content.replace("export default function MapComponent() {", helpers + "\nexport default function MapComponent() {")

# Update fetch URLs to include steps=true
content = content.replace("overview=full&geometries=geojson`", "overview=full&geometries=geojson&steps=true`")

# Capture steps in handleSearch
handle_search_replacement = """
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
                 speakInstruction("Route started. " + getInstructionText(steps[0]));
              }
"""
content = re.sub(r'const coords = routeData\.routes\[0\]\.geometry\.coordinates;[\s\S]*?setRoutePath\(leafletPath\);', handle_search_replacement, content, count=1)

# Capture steps in handleFacilityClick
handle_fac_replacement = """
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
"""
content = re.sub(r'const coords = routeData\.routes\[0\]\.geometry\.coordinates;[\s\S]*?setRoutePath\(leafletPath\);', handle_fac_replacement, content)


# Add Turn by Turn UI Panel over the Map
turn_ui = """
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
"""
content = content.replace("{/* Render Ambulance Route (OSRM) */}", turn_ui + "\n          {/* Render Ambulance Route (OSRM) */}")

# Add simulation button to the Route Details Panel
sim_button = """
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
"""
content = re.sub(r'<div style=\{\{ marginTop: \'16px\', display: \'flex\', gap: \'10px\' \}\}>[\s\S]*?<\/div>', sim_button, content)


# Add simulation function inside component
sim_func = """
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
"""
content = content.replace("const handleSearch = async (e) => {", sim_func + "\n  const handleSearch = async (e) => {")

with open('src/MapComponent.jsx', 'w') as f:
    f.write(content)
