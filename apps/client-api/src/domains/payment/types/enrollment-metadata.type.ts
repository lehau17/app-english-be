import { GuestEnrollmentRole } from "../../landing-page/dto/guest-enrollment.dto";

interface StudentInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface ParentInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

/**
 * Core enrollment metadata content
 * Hỗ trợ 3 luồng:
 * 1. Guest enrollment (landing page) - emailVerified = true
 * 2. Existing user enrollment (app) - existingUser = true
 * 3. Legacy guest enrollment - có role + students (backward compat)
 */
export interface EnrollmentMetadata {
  // ========== Flow Flags ==========
  emailVerified?: boolean; // true = guest enrollment qua landing page (email verified)
  existingUser?: boolean; // true = existing user enrollment qua app (đã login)

  // ========== Guest Enrollment Data ==========
  role?: GuestEnrollmentRole;
  students?: StudentInfo[];
  parent?: ParentInfo;

  // ========== Existing User Data ==========
  userId?: string; // ID của user đã login (khi existingUser=true)

  // ========== Common Metadata ==========
  courseId: string;
  classroomId: string;
  courseName: string;
  classroomName: string;
  source?: string; // Nguồn: facebook, google, organic, landing-page, app
  note?: string; // Ghi chú từ user
}

/**
 * Transaction.responseData structure (NESTED)
 * Đây là structure CHUẨN được lưu vào Transaction.responseData
 */
export interface TransactionResponseData {
  enrollmentMetadata?: EnrollmentMetadata;
  // Có thể thêm fields khác trong tương lai
}

/**
 * Type guard: Check if responseData is nested structure (preferred)
 */
export function isNestedMetadata(data: any): data is TransactionResponseData {
  return (
    data &&
    typeof data === 'object' &&
    'enrollmentMetadata' in data &&
    data.enrollmentMetadata !== null
  );
}

/**
 * Type guard: Check if responseData is legacy flat structure
 * Legacy structure: { role, students, parent, courseId, ... } (không có wrapper)
 */
export function isLegacyFlatMetadata(data: any): data is EnrollmentMetadata {
  return (
    data &&
    typeof data === 'object' &&
    'role' in data &&
    'students' in data &&
    !('enrollmentMetadata' in data) // Không có wrapper = legacy
  );
}

/**
 * Helper: Extract enrollment metadata từ any structure
 * Hỗ trợ cả nested (mới) và flat (legacy)
 */
export function extractEnrollmentMetadata(
  responseData: any,
): EnrollmentMetadata | null {
  if (!responseData) return null;

  // Try nested structure first (preferred)
  if (isNestedMetadata(responseData)) {
    return responseData.enrollmentMetadata || null;
  }

  // Try legacy flat structure
  if (isLegacyFlatMetadata(responseData)) {
    return responseData;
  }

  return null;
}

/**
 * Helper: Determine enrollment flow type
 */
export type EnrollmentFlowType =
  | 'existing-user' // User đã đăng nhập, thanh toán qua app
  | 'guest-verified' // Guest, đã verify email qua landing page
  | 'guest-legacy' // Guest, format cũ (backward compat)
  | 'unknown'; // Không xác định được

export function getEnrollmentFlowType(
  metadata: EnrollmentMetadata | null,
): EnrollmentFlowType {
  if (!metadata) return 'unknown';

  // Check existing user flow
  if (metadata.existingUser && metadata.userId) {
    return 'existing-user';
  }

  // Check guest verified flow
  if (metadata.emailVerified && metadata.students && metadata.students.length > 0) {
    return 'guest-verified';
  }

  // Check legacy guest flow
  if (metadata.role && metadata.students && metadata.students.length > 0) {
    return 'guest-legacy';
  }

  return 'unknown';
}
