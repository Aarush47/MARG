const backendProtocol = window.location.protocol === 'https:' ? 'https' : 'http';
const websocketProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const backendHost = window.location.hostname || 'localhost';

export const API_BASE_URL = 'https://marg-backend-50043834330.development.catalystappsail.in';
export const WS_BASE_URL = 'wss://marg-backend-50043834330.development.catalystappsail.in';