import { PrismaRepository } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AssignmentType } from '@prisma/client';
import { NotificationService } from './notification.service';

@Injectable()
export class AssignmentReminderService {
  private readonly logger = new Logger(AssignmentReminderService.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Cronjob chạy mỗi 6 giờ để kiểm tra bài tập và bài kiểm tra sắp tới hạn
   */
  @Cron('0 */6 * * *', {
    timeZone: 'Asia/Ho_Chi_Minh',
    name: 'assignmentReminderCheck',
  })
  async checkUpcomingAssignments(): Promise<void> {
    this.logger.log('🕐 Starting assignment reminder check...');

    try {
      // Kiểm tra bài tập sắp tới hạn (trong 24h tới)
      await this.checkUpcomingAssignmentsIn24Hours();

      // Kiểm tra bài kiểm tra giữa kỳ và cuối kỳ ngày mai
      await this.checkExamsTomorrow();

      this.logger.log('Assignment reminder check completed successfully');
    } catch (error) {
      this.logger.error('Failed to check assignment reminders:', error);
    }
  }

  /**
   * Kiểm tra bài tập sắp tới hạn trong 24h tới
   */
  private async checkUpcomingAssignmentsIn24Hours(): Promise<void> {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Lấy tất cả bài tập có dueDate trong 24h tới
    const upcomingAssignments = await this.prisma.assignment.findMany({
      where: {
        dueDate: {
          gte: now,
          lte: tomorrow,
        },
        isPublished: true,
        type: {
          in: [AssignmentType.HOMEWORK, AssignmentType.QUIZ],
        },
      },
      include: {
        classroom: {
          include: {
            students: {
              include: {
                student: true,
              },
            },
            teacher: true,
          },
        },
      },
    });

    this.logger.log(
      `Found ${upcomingAssignments.length} assignments due in 24 hours`,
    );

    for (const assignment of upcomingAssignments) {
      await this.sendAssignmentReminderEmails(assignment, 'upcoming');
    }
  }

  /**
   * Kiểm tra bài kiểm tra giữa kỳ và cuối kỳ ngày mai
   */
  private async checkExamsTomorrow(): Promise<void> {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStart = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate(),
      0,
      0,
      0,
    );
    const tomorrowEnd = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate(),
      23,
      59,
      59,
    );

    // Lấy tất cả bài kiểm tra giữa kỳ và cuối kỳ ngày mai
    const tomorrowExams = await this.prisma.assignment.findMany({
      where: {
        startTime: {
          gte: tomorrowStart,
          lte: tomorrowEnd,
        },
        isPublished: true,
        type: {
          in: [AssignmentType.MIDTERM_EXAM, AssignmentType.FINAL_EXAM],
        },
      },
      include: {
        classroom: {
          include: {
            students: {
              include: {
                student: true,
              },
            },
            teacher: true,
          },
        },
      },
    });

    this.logger.log(`Found ${tomorrowExams.length} exams tomorrow`);

    for (const exam of tomorrowExams) {
      await this.sendAssignmentReminderEmails(exam, 'exam');
    }
  }

  /**
   * Gửi email thông báo cho học sinh và giáo viên
   */
  private async sendAssignmentReminderEmails(
    assignment: any,
    type: 'upcoming' | 'exam',
  ): Promise<void> {
    const classroom = assignment.classroom;
    const teacher = classroom.teacher;
    const students = classroom.students.map((cs: any) => cs.student);

    // Gửi email cho học sinh
    for (const student of students) {
      if (student.email) {
        try {
          await this.sendStudentReminderEmail(student, assignment, type);
        } catch (error) {
          this.logger.error(
            `Failed to send reminder email to student ${student.email}:`,
            error,
          );
        }
      }
    }

    // Gửi email cho giáo viên
    if (teacher.email) {
      try {
        await this.sendTeacherReminderEmail(
          teacher,
          assignment,
          type,
          students.length,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send reminder email to teacher ${teacher.email}:`,
          error,
        );
      }
    }
  }

  /**
   * Gửi email thông báo cho học sinh
   */
  private async sendStudentReminderEmail(
    student: any,
    assignment: any,
    type: 'upcoming' | 'exam',
  ): Promise<void> {
    const isExam = type === 'exam';
    const assignmentTypeText = this.getAssignmentTypeText(assignment.type);
    const timeInfo = this.getTimeInfo(assignment, isExam);

    const subject = isExam
      ? `Thông báo: ${assignmentTypeText} ngày mai - ${assignment.title}`
      : `Nhắc nhở: ${assignmentTypeText} sắp tới hạn - ${assignment.title}`;

    const template = isExam
      ? 'exam-reminder-student'
      : 'assignment-reminder-student';

    await this.notificationService.sendEmail({
      to: [student.email],
      subject,
      template,
      context: {
        studentName:
          student.displayName || `${student.firstName} ${student.lastName}`,
        assignmentTitle: assignment.title,
        assignmentType: assignmentTypeText,
        classroomName: assignment.classroom.name,
        timeInfo,
        dueDate: assignment.dueDate
          ? new Date(assignment.dueDate).toLocaleDateString('vi-VN')
          : 'N/A',
        startTime: assignment.startTime
          ? new Date(assignment.startTime).toLocaleDateString('vi-VN')
          : 'N/A',
        timeLimit: assignment.timeLimit
          ? `${assignment.timeLimit} phút`
          : 'Không giới hạn',
        totalPoints: assignment.totalPoints || 100,
        instructions: assignment.instructions || 'Không có hướng dẫn đặc biệt',
        isExam,
      },
    });

    this.logger.log(
      `📧 Sent ${type} reminder email to student: ${student.email}`,
    );
  }

  /**
   * Gửi email thông báo cho giáo viên
   */
  private async sendTeacherReminderEmail(
    teacher: any,
    assignment: any,
    type: 'upcoming' | 'exam',
    studentCount: number,
  ): Promise<void> {
    const isExam = type === 'exam';
    const assignmentTypeText = this.getAssignmentTypeText(assignment.type);
    const timeInfo = this.getTimeInfo(assignment, isExam);

    const subject = isExam
      ? `Thông báo: ${assignmentTypeText} ngày mai - ${assignment.title}`
      : `Nhắc nhở: ${assignmentTypeText} sắp tới hạn - ${assignment.title}`;

    const template = isExam
      ? 'exam-reminder-teacher'
      : 'assignment-reminder-teacher';

    await this.notificationService.sendEmail({
      to: [teacher.email],
      subject,
      template,
      context: {
        teacherName:
          teacher.displayName || `${teacher.firstName} ${teacher.lastName}`,
        assignmentTitle: assignment.title,
        assignmentType: assignmentTypeText,
        classroomName: assignment.classroom.name,
        studentCount,
        timeInfo,
        dueDate: assignment.dueDate
          ? new Date(assignment.dueDate).toLocaleDateString('vi-VN')
          : 'N/A',
        startTime: assignment.startTime
          ? new Date(assignment.startTime).toLocaleDateString('vi-VN')
          : 'N/A',
        timeLimit: assignment.timeLimit
          ? `${assignment.timeLimit} phút`
          : 'Không giới hạn',
        totalPoints: assignment.totalPoints || 100,
        instructions: assignment.instructions || 'Không có hướng dẫn đặc biệt',
        isExam,
      },
    });

    this.logger.log(
      `📧 Sent ${type} reminder email to teacher: ${teacher.email}`,
    );
  }

  /**
   * Lấy text mô tả loại bài tập
   */
  private getAssignmentTypeText(type: AssignmentType): string {
    switch (type) {
      case AssignmentType.HOMEWORK:
        return 'Bài tập về nhà';
      case AssignmentType.QUIZ:
        return 'Bài kiểm tra ngắn';
      case AssignmentType.MIDTERM_EXAM:
        return 'Bài thi giữa kỳ';
      case AssignmentType.FINAL_EXAM:
        return 'Bài thi cuối kỳ';
      default:
        return 'Bài tập';
    }
  }

  /**
   * Lấy thông tin thời gian
   */
  private getTimeInfo(assignment: any, isExam: boolean): string {
    if (isExam && assignment.startTime) {
      const startTime = new Date(assignment.startTime);
      const endTime = assignment.dueDate ? new Date(assignment.dueDate) : null;

      if (endTime) {
        return `Bắt đầu: ${startTime.toLocaleString('vi-VN')} - Kết thúc: ${endTime.toLocaleString('vi-VN')}`;
      } else {
        return `Bắt đầu: ${startTime.toLocaleString('vi-VN')}`;
      }
    } else if (assignment.dueDate) {
      return `Hạn nộp: ${new Date(assignment.dueDate).toLocaleString('vi-VN')}`;
    }

    return 'Không có thông tin thời gian';
  }
}
