import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
});

export const fetchGraph = (nodeId) =>
  api.get('/graph', { params: nodeId ? { node_id: nodeId } : {} });
export const fetchNode = (nodeId) => api.get(`/nodes/${nodeId}`);
export const fetchCentrality = (nodeId) => api.get(`/nodes/${nodeId}/centrality`);
export const fetchRiskQueue = () => api.get('/risk-queue');
export const confirmRisk = (edgeId) => api.post(`/risk-queue/${edgeId}/confirm`);
export const dismissRisk = (edgeId) => api.post(`/risk-queue/${edgeId}/dismiss`);
export const fetchCommunities = () => api.get('/communities');
export const fetchRootCause = (eventId) => api.get(`/root-cause/${eventId}`);
export const fetchLedger = (page) => api.get('/ledger', { params: { page } });
export const verifyLedger = () => api.get('/ledger/verify');
export const fetchStats = () => api.get('/stats');
