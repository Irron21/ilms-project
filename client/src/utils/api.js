import axios from 'axios';

// 1. Create the instance
const api = axios.create({
  baseURL: 'http://localhost:4000/api', // Make sure this matches your backend
  headers: {
    'Content-Type': 'application/json'
  }
});

// 2. Add the Interceptor (THIS IS THE MISSING LINK)
// This code runs before EVERY request to attach the token
api.interceptors.request.use((config) => {
  // Grab the token from storage
  const token = localStorage.getItem('token'); 
  
  if (token) {
    // Staple it to the request header
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;