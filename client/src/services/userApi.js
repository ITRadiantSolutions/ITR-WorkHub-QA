import { API } from './api.js';

export const checkUserStatus = (email) =>
  API.get(`/auth/status/${encodeURIComponent(email)}`);

export const getPendingUsers = () => API.get('/auth/pending-users');

export const approveUser = (id) => API.put(`/auth/${id}/approve`);

export const rejectUser = (id) => API.put(`/auth/${id}/reject`);

export const getAllUsers = () => API.get('/users');

export const updateUser = (id, userData) => API.put(`/users/${id}`, userData);

export const deleteUser = (id) => API.delete(`/users/${id}`);

