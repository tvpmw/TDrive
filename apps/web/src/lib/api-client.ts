"use client";

import axios from "axios";

let csrfToken: string | null = null;

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/tdrive_csrf=([^;]+)/);
  csrfToken = match?.[1] ?? null;
  return csrfToken;
}

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api",
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase();
  if (method && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = getCsrfToken();
    if (token) {
      config.headers["X-CSRF-Token"] = token;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
