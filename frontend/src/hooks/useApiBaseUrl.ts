import { useEffect, useState } from "react";

const STORAGE_KEY = "study-desk:api-base-url";
const DEFAULT_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export function useApiBaseUrl() {
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem(STORAGE_KEY) ?? DEFAULT_URL);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, baseUrl);
  }, [baseUrl]);

  return [baseUrl.replace(/\/$/, ""), setBaseUrl] as const;
}
