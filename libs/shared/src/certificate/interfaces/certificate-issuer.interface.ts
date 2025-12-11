/**
 * Interface for certificate issuance service
 * Allows dependency injection without tight coupling
 */
export interface ICertificateIssuer {
  issueCertificate(dto: {
    studentId: string;
    courseId: string;
    classroomId?: string;
    finalScore: number;
    progress: number;
    totalHours: number;
  }): Promise<any>;
}












