// Authentication Configuration

export const AUTH_CONFIG = {
  routes: {
    login: "/login",
    register: "/register",
    forgotPassword: "/forgot-password",
    dashboard: "/",
  },
  publicPaths: ["/login", "/register", "/forgot-password"],
} as const;
