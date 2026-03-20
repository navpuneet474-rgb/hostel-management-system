export type UserType = "student" | "warden" | "security" | "maintenance" | "admin" | "staff";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  userType: UserType;
  firstName?: string;
  lastName?: string;
  profile?: UserProfile;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  phone: string;
  avatar?: string;
  // Role-specific fields
  studentId?: string;
  roomNumber?: string;
  department?: string;
  employeeId?: string;
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

export interface GuestRequest {
  id?: string;
  student_id?: string;
  guest_name: string;
  guest_phone: string;
  guest_photo?: File | string;
  purpose: string;
  from_time: string;
  to_time: string;
  qr_code?: string;
  verification_code?: string;
  status?: GuestStatus;
  entry_time?: string;
  exit_time?: string;
  verified_by?: string;
  created_at?: string;
}

export type GuestStatus = 
  | 'pending'
  | 'approved'
  | 'active'
  | 'completed'
  | 'expired'
  | 'cancelled';

export interface Complaint {
  id?: string;
  ticket_number?: string;
  student_id?: string;
  room_number?: string;
  category: ComplaintCategory;
  title: string;
  description: string;
  priority: ComplaintPriority;
  photos?: File[] | string[];
  status?: ComplaintStatus;
  assigned_to?: string;
  resolution?: string;
  resolution_photos?: File[] | string[];
  created_at?: string;
  resolved_at?: string;
  rating?: number;
  feedback?: string;
}

export type ComplaintCategory =
  | 'electrical'
  | 'plumbing'
  | 'furniture'
  | 'cleaning'
  | 'internet'
  | 'security'
  | 'other';

export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ComplaintStatus =
  | 'submitted'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'closed';
