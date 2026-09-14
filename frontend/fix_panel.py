with open('src/MapComponent.jsx', 'r') as f:
    lines = f.readlines()

panel_start = -1
panel_end = -1
for i, line in enumerate(lines):
    if '{/* Turn-by-Turn Guidance Panel */}' in line:
        panel_start = i
    if panel_start != -1 and ')}' in line and i > panel_start + 20: # wait for end of block
        panel_end = i
        break

if panel_start != -1 and panel_end != -1:
    panel_lines = lines[panel_start:panel_end+1]
    del lines[panel_start:panel_end+1]
    
    map_container_idx = -1
    for i, line in enumerate(lines):
        if '<MapContainer' in line:
            map_container_idx = i
            break
            
    if map_container_idx != -1:
        lines = lines[:map_container_idx] + panel_lines + lines[map_container_idx:]
        
with open('src/MapComponent.jsx', 'w') as f:
    f.writelines(lines)
