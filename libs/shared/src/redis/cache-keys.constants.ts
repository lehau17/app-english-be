/**
 * Cache Key Constants
 *
 * Centralized cache key prefixes for version-based caching.
 * Pattern: cache:{prefix}:v{version}:{key}
 *
 * When data changes, increment version to invalidate all cache for that prefix.
 * Old cache entries expire naturally based on TTL.
 */

// ==================== ATTENDANCE ====================
export const ATTENDANCE_CACHE = {
  /** Attendance list for a session */
  SESSION_ATTENDANCE: 'attendance:session',
  /** Attendance summary (stats) for a session */
  SESSION_SUMMARY: 'attendance:summary',
  /** Student attendance history in a classroom */
  STUDENT_HISTORY: 'attendance:student',
  /** Classroom attendance statistics */
  CLASSROOM_STATS: 'attendance:classroom',
} as const;

// ==================== CLASSROOM ====================
export const CLASSROOM_CACHE = {
  /** Classroom details */
  DETAIL: 'classroom:detail',
  /** Classroom list */
  LIST: 'classroom:list',
  /** Classroom schedule */
  SCHEDULE: 'classroom:schedule',
  /** Students in classroom */
  STUDENTS: 'classroom:students',
} as const;

// ==================== USER ====================
export const USER_CACHE = {
  /** User profile */
  PROFILE: 'user:profile',
  /** User list */
  LIST: 'user:list',
  /** Teacher list */
  TEACHERS: 'user:teachers',
  /** Student list */
  STUDENTS: 'user:students',
} as const;

// ==================== COURSE ====================
export const COURSE_CACHE = {
  /** Course details */
  DETAIL: 'course:detail',
  /** Course list */
  LIST: 'course:list',
  /** Course lessons */
  LESSONS: 'course:lessons',
} as const;

// ==================== ASSIGNMENT ====================
export const ASSIGNMENT_CACHE = {
  /** Assignment details */
  DETAIL: 'assignment:detail',
  /** Assignment list for classroom */
  LIST: 'assignment:list',
  /** Assignment submissions */
  SUBMISSIONS: 'assignment:submissions',
} as const;

// ==================== PROGRESS ====================
export const PROGRESS_CACHE = {
  /** Student progress */
  STUDENT: 'progress:student',
  /** Course progress */
  COURSE: 'progress:course',
  /** Activity progress */
  ACTIVITY: 'progress:activity',
} as const;

// ==================== GRADEBOOK ====================
export const GRADEBOOK_CACHE = {
  /** Student grade in a classroom */
  STUDENT_GRADE: 'gradebook:student',
  /** Classroom gradebook */
  CLASSROOM: 'gradebook:classroom',
} as const;

// ==================== CACHE TTL (seconds) ====================
export const CACHE_TTL = {
  /** Very short - 30 seconds */
  VERY_SHORT: 30,
  /** Short - 1 minute (default) */
  SHORT: 60,
  /** Medium - 2 minutes */
  MEDIUM: 120,
  /** Long - 5 minutes */
  LONG: 300,
  /** Very long - 10 minutes */
  VERY_LONG: 600,
  /** Extended - 30 minutes */
  EXTENDED: 1800,
  /** Hour - 1 hour */
  HOUR: 3600,
} as const;

// ==================== LOCK SETTINGS ====================
export const LOCK_CONFIG = {
  /** Lock TTL in seconds */
  TTL: 10,
  /** Maximum retry attempts */
  MAX_RETRIES: 100,
  /** Delay between retries in ms */
  RETRY_DELAY: 50,
} as const;

// ==================== TYPE EXPORTS ====================
export type AttendanceCacheKey =
  (typeof ATTENDANCE_CACHE)[keyof typeof ATTENDANCE_CACHE];
export type ClassroomCacheKey =
  (typeof CLASSROOM_CACHE)[keyof typeof CLASSROOM_CACHE];
export type UserCacheKey = (typeof USER_CACHE)[keyof typeof USER_CACHE];
export type CourseCacheKey = (typeof COURSE_CACHE)[keyof typeof COURSE_CACHE];
export type AssignmentCacheKey =
  (typeof ASSIGNMENT_CACHE)[keyof typeof ASSIGNMENT_CACHE];
export type ProgressCacheKey =
  (typeof PROGRESS_CACHE)[keyof typeof PROGRESS_CACHE];
export type GradebookCacheKey =
  (typeof GRADEBOOK_CACHE)[keyof typeof GRADEBOOK_CACHE];
export type CacheTTL = (typeof CACHE_TTL)[keyof typeof CACHE_TTL];
