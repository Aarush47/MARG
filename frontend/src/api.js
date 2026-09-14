const backendProtocol = window.location.protocol === 'https:' ? 'https' : 'http';
const websocketProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const backendHost = window.location.hostname || 'localhost';

export const API_BASE_URL = 'http://localhost:8000';
export const WS_BASE_URL = 'ws://localhost:8000';