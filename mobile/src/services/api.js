import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOKEN_STORAGE_KEY = '@cloudpool_jwt_token';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api');

let unauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const isAuthRoute = error?.config?.url?.includes('/auth/');

    if (status === 401 && !isAuthRoute) {
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
      if (typeof unauthorizedHandler === 'function') {
        unauthorizedHandler();
      }
    }

    const message =
      error?.response?.data?.error ||
      error?.message ||
      'Network error. Please check your connection.';

    return Promise.reject(new Error(message));
  }
);

export const authApi = {
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data),
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data),
};

export const kitchenApi = {
  getMe: () => api.get('/kitchens/me').then((r) => r.data),
  verifyLocation: (payload) => api.patch('/kitchens/me/location', payload).then((r) => r.data),
  updatePushToken: (expoPushToken) =>
    api.patch('/kitchens/me/push-token', { expoPushToken }).then((r) => r.data),
  getNearby: (radiusMeters = 3000) =>
    api.get('/kitchens/nearby', { params: { radiusMeters } }).then((r) => r.data),
};

export const catalogApi = {
  list: (params = {}) => api.get('/catalog', { params }).then((r) => r.data),
  getById: (commodityId, radiusMeters = 3000) =>
    api.get(`/catalog/${commodityId}`, { params: { radiusMeters } }).then((r) => r.data),
};

export const poolApi = {
  getNearby: (params = {}) => api.get('/pools/nearby', { params }).then((r) => r.data),
  getById: (poolId) => api.get(`/pools/${poolId}`).then((r) => r.data),
  seedPool: (payload, idempotencyKey) =>
    api
      .post('/pools/seed', payload, {
        headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {},
      })
      .then((r) => r.data),
};

export default api;
