// Authentication Types

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthSession {
  user: User;
  token: string; // Placeholder for future JWT/Session token
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface RegisterPayload {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
}
