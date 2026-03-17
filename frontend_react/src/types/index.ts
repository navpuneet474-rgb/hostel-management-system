export type UserType = "student" | "staff";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  userType: UserType;
}

export interface ApiResponse<T = unknown> {
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface MessageRecord {
  message_id?: string;
  content: string;
  ai_response?: string;
  created_at?: string;
}
