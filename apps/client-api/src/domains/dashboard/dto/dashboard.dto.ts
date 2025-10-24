import { ApiProperty } from '@nestjs/swagger';
import { User } from '@prisma/client';

class RegistrationTrendPoint {
    @ApiProperty()
    date: string;

    @ApiProperty()
    count: number;
}

class CourseDistributionPoint {
    @ApiProperty()
    label: string;

    @ApiProperty()
    value: number;
}

class UpcomingClassItem {
    @ApiProperty()
    id: string;

    @ApiProperty()
    classroomName: string;

    @ApiProperty({ required: false })
    courseTitle?: string;

    @ApiProperty()
    teacherName: string;

    @ApiProperty()
    startTime: string;

    @ApiProperty()
    endTime: string;

    @ApiProperty({ required: false })
    roomName?: string | null;

    @ApiProperty()
    activeStudents: number;

    @ApiProperty({ required: false })
    maxStudents?: number | null;
}

class DashboardNotificationItem {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty({ required: false })
    message?: string | null;

    @ApiProperty({ enum: ['success', 'warning', 'error', 'info'] })
    type: 'success' | 'warning' | 'error' | 'info';

    @ApiProperty()
    createdAt: string;
}

export class DashboardDto {
    @ApiProperty()
    totalStudents: number;

    @ApiProperty()
    totalCourses: number;

    @ApiProperty()
    totalLessons: number;

    @ApiProperty()
    totalActivities: number;

    @ApiProperty({ type: () => 'User' }) // Use a string to avoid circular dependency issues if User DTO is complex
    recentStudents: Partial<User>[];

    @ApiProperty({ type: [RegistrationTrendPoint] })
    registrationTrend: RegistrationTrendPoint[];

    @ApiProperty({ type: [CourseDistributionPoint] })
    courseDistribution: CourseDistributionPoint[];

    @ApiProperty({ type: [UpcomingClassItem] })
    upcomingClasses: UpcomingClassItem[];

    @ApiProperty({ type: [DashboardNotificationItem] })
    notifications: DashboardNotificationItem[];

    static defaultValueResponse(): DashboardDto {
        return {
            totalStudents: 0,
            totalCourses: 0,
            totalLessons: 0,
            totalActivities: 0,
            recentStudents: [],
            registrationTrend: [],
            courseDistribution: [],
            upcomingClasses: [],
            notifications: [],
        } as DashboardDto;
    }
}

// ==================== TEACHER DASHBOARD DTOs ====================

class TeacherClassroomItem {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    classCode: string;

    @ApiProperty({ enum: ['upcoming', 'ongoing', 'completed', 'cancelled'] })
    status: string;

    @ApiProperty()
    studentsCount: number;

    @ApiProperty({ required: false })
    maxStudents?: number | null;

    @ApiProperty({ required: false })
    courseName?: string;

    @ApiProperty({ required: false })
    nextSessionTime?: string | null;
}

class TeacherUpcomingSessionItem {
    @ApiProperty()
    id: string;

    @ApiProperty()
    classroomId: string;

    @ApiProperty()
    classroomName: string;

    @ApiProperty()
    startTime: string;

    @ApiProperty()
    endTime: string;

    @ApiProperty({ required: false })
    roomName?: string | null;

    @ApiProperty()
    studentsCount: number;

    @ApiProperty({ enum: ['scheduled', 'ongoing', 'completed', 'cancelled'] })
    status: string;
}

class TeacherPendingSubmissionItem {
    @ApiProperty()
    id: string;

    @ApiProperty()
    assignmentId: string;

    @ApiProperty()
    assignmentTitle: string;

    @ApiProperty()
    studentName: string;

    @ApiProperty()
    studentEmail: string;

    @ApiProperty()
    submittedAt: string;

    @ApiProperty()
    classroomName: string;
}

export class TeacherDashboardDto {
    @ApiProperty({ description: 'Tổng số lớp đang dạy (active)' })
    totalActiveClassrooms: number;

    @ApiProperty({ description: 'Tổng số học sinh trong tất cả lớp' })
    totalStudents: number;

    @ApiProperty({ description: 'Số buổi học sắp tới (trong 7 ngày)' })
    upcomingSessionsCount: number;

    @ApiProperty({ description: 'Số bài nộp chưa chấm' })
    pendingSubmissionsCount: number;

    @ApiProperty({ type: [TeacherClassroomItem], description: 'Danh sách lớp học đang dạy' })
    activeClassrooms: TeacherClassroomItem[];

    @ApiProperty({ type: [TeacherUpcomingSessionItem], description: 'Lịch dạy sắp tới (24h)' })
    upcomingSessions: TeacherUpcomingSessionItem[];

    @ApiProperty({ type: [TeacherPendingSubmissionItem], description: 'Bài tập cần chấm (10 bài gần nhất)' })
    pendingSubmissions: TeacherPendingSubmissionItem[];

    @ApiProperty({ type: [DashboardNotificationItem], description: 'Thông báo gần đây' })
    recentNotifications: DashboardNotificationItem[];

    static defaultValueResponse(): TeacherDashboardDto {
        return {
            totalActiveClassrooms: 0,
            totalStudents: 0,
            upcomingSessionsCount: 0,
            pendingSubmissionsCount: 0,
            activeClassrooms: [],
            upcomingSessions: [],
            pendingSubmissions: [],
            recentNotifications: [],
        } as TeacherDashboardDto;
    }
}
