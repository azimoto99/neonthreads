const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('neonThreadsToken');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

export async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token expired or invalid
    localStorage.removeItem('neonThreadsToken');
    localStorage.removeItem('neonThreadsUserId');
    throw new Error('Authentication required');
  }

  return response;
}

export { API_BASE_URL };

