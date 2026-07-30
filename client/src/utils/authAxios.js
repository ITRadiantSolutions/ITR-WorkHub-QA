import axios from "axios";

// TimeFlow's original authAxios used an access/refresh token pair; our
// unified backend issues one longer-lived JWT (see AuthContext), so this is
// just a thin axios factory reading the same "token" key AuthContext uses.
const BASE = `${import.meta.env.VITE_API_URL}/api/`;

export function signOutAndRedirect(reason = "Session expired. Please sign in again.") {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = `/?reason=${encodeURIComponent(reason)}`;
}

export default async function getAuthAxios() {
  const token = localStorage.getItem("token");
  if (!token) {
    signOutAndRedirect("Please sign in.");
    return;
  }

  const api = axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });

  api.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401) signOutAndRedirect();
      return Promise.reject(err);
    },
  );

  return api;
}
