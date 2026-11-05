// Global fetch interceptor — installs once at app startup.
// Mirrors the axios response interceptor in services/api.js:
// on 401 from any non-auth API call, clear session and redirect to login.
// This fixes the "Invalid or expired token" loop for pages that use
// raw fetch() instead of the axios instance.

const isAuthRoute = (url) => {
  const u = String(url || "");
  return (
    u.includes("/auth/login")  ||
    u.includes("/auth/forgot") ||
    u.includes("/auth/reset")  ||
    u.includes("/auth/verify") ||
    // background badge count: an old server answers 401 for it, which must not sign the admin out
    u.includes("/portal/admin/counts")
  );
};

const handleUnauthorized = () => {
  try {
    localStorage.removeItem("nnc_token");
    localStorage.removeItem("nnc_auth");
    localStorage.removeItem("nnc_user");
  } catch {}
  // Avoid redirect loop if we are already on the login page.
  if (window.location.pathname !== "/") {
    window.location.href = "/";
  }
};

let installed = false;

export function installFetchInterceptor() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url;
    const response = await originalFetch(input, init);
    if (response.status === 401 && !isAuthRoute(url)) {
      handleUnauthorized();
    }
    return response;
  };
}
