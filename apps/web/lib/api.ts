import axios from 'axios';

const rawUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
const baseURL = rawUrl.endsWith('/api') ? rawUrl : `${rawUrl.replace(/\/+$/, '')}/api`;

export const api = axios.create({
  baseURL,
});

