import { useEffect, useState } from "react";

const STORAGE_KEY = "study-desk:api-base-url";
const DEFAULT_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export function useApiBaseUrl() {
  const [baseUrl, setBaseUrl] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_URL;
    } catch {
      return DEFAULT_URL;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, baseUrl);
    } catch {
      // localStorage unavailable — the URL just won't persist across reloads
    }
  }, [baseUrl]);

  return [baseUrl.replace(/\/$/, ""), setBaseUrl];
}
