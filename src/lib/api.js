import axios from 'axios'
import { tokenStorage } from '../context/AuthContext'

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
  timeout: 15000,
})

// Attach Bearer token to every request
api.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// Global response error handling
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      // Session expired — clear token and reload to show login
      tokenStorage.clear()
      window.location.reload()
    }
    console.error('[API Error]', err.response?.status, err.message)
    return Promise.reject(err)
  }
)

export default api
