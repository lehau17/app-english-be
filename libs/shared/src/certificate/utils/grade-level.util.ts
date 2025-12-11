/**
 * Grade level classification utilities
 */

export type GradeLevel = 'Xuất sắc' | 'Giỏi' | 'Khá' | 'Trung bình' | 'Yếu';

/**
 * Get grade level from final grade
 * @param finalGrade Final grade (0-100)
 * @returns Grade level string
 */
export function getGradeLevel(finalGrade: number): GradeLevel {
  if (finalGrade >= 90) return 'Xuất sắc';
  if (finalGrade >= 80) return 'Giỏi';
  if (finalGrade >= 70) return 'Khá';
  if (finalGrade >= 60) return 'Trung bình';
  return 'Yếu';
}

/**
 * Check if grade level is eligible for certificate
 * Only Xuất sắc, Giỏi, Khá are eligible (>= 70)
 * @param gradeLevel Grade level string
 * @returns true if eligible, false otherwise
 */
export function isEligibleForCertificate(gradeLevel: GradeLevel): boolean {
  return ['Xuất sắc', 'Giỏi', 'Khá'].includes(gradeLevel);
}

/**
 * Get minimum score required for certificate
 */
export const MIN_CERTIFICATE_SCORE = 70;
















