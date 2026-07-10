import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  const match = document.cookie.match(/(?:^|;\s*)CSRF_TOKEN=([^;]*)/);
  if (match) {
    config.headers["X-CSRF-Token"] = match[1];
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

function processQueue(error: unknown) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(null);
    }
  });
  failedQueue = [];
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest || originalRequest.url === "/auth/refresh") {
      window.location.href = "/login";
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          const match = document.cookie.match(/(?:^|;\s*)CSRF_TOKEN=([^;]*)/);
          if (match) {
            originalRequest.headers["X-CSRF-Token"] = match[1];
          }
          return axiosInstance(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axiosInstance.post("/auth/refresh");
        processQueue(null);
        const match = document.cookie.match(/(?:^|;\s*)CSRF_TOKEN=([^;]*)/);
        if (match) {
          originalRequest.headers["X-CSRF-Token"] = match[1];
        }
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
