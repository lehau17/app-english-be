import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSessionScheduleDto, UpdateSessionScheduleDto } from '../dto/session-schedule.dto';
import { SessionScheduleRepository } from '../repository/session-schedule.repository';

@Injectable()
export class SessionScheduleService {
  constructor(
    private readonly sessionScheduleRepository: SessionScheduleRepository,
  ) {}

  async findByCourseId(courseId: string) {
    return this.sessionScheduleRepository.findByCourseId(courseId);
  }

  async createSessionSchedules(courseId: string, schedules: CreateSessionScheduleDto[]) {
    // Xóa tất cả lịch hiện có trước khi tạo mới
    await this.sessionScheduleRepository.deleteAllByCourseId(courseId);

    const createdSchedules = [];

    for (const schedule of schedules) {
      const sessionSchedule = await this.sessionScheduleRepository.create({
        course: {
          connect: { id: courseId },
        },
        sessionNumber: schedule.sessionNumber,
        title: schedule.title,
        description: schedule.description,
        activities: {
          create: schedule.activities.map((activity) => ({
            activity: { connect: { id: activity.activityId } },
            orderNo: activity.orderNo,
          })),
        },
      });

      createdSchedules.push(sessionSchedule);
    }

    return createdSchedules;
  }

  async updateSessionSchedule(
    courseId: string,
    sessionNumber: number,
    dto: UpdateSessionScheduleDto,
  ) {
    const sessions = await this.sessionScheduleRepository.findByCourseId(courseId);
    const session = sessions.find(s => s.sessionNumber === sessionNumber);

    if (!session) {
      throw new NotFoundException(`Không tìm thấy buổi học số ${sessionNumber} cho khóa học ${courseId}`);
    }

    // Xóa session cũ và tạo mới để đơn giản hóa logic
    await this.sessionScheduleRepository.deleteAllByCourseId(courseId);

    // Tạo lại tất cả session, cập nhật session được chỉ định
    for (const s of sessions) {
      if (s.sessionNumber === sessionNumber) {
        // Tạo session với dữ liệu mới
        await this.sessionScheduleRepository.create({
          course: {
            connect: { id: courseId },
          },
          sessionNumber: dto.sessionNumber || s.sessionNumber,
          title: dto.title || s.title,
          description: dto.description || s.description,
          activities: {
            create: (dto.activities || []).map((activity) => ({
              activity: { connect: { id: activity.activityId } },
              orderNo: activity.orderNo,
            })),
          },
        });
      } else {
        // Giữ nguyên session khác
        await this.sessionScheduleRepository.create({
          course: {
            connect: { id: courseId },
          },
          sessionNumber: s.sessionNumber,
          title: s.title,
          description: s.description,
          activities: {
            create: s.activities.map((activity) => ({
              activity: { connect: { id: activity.activity.id } },
              orderNo: activity.orderNo,
            })),
          },
        });
      }
    }

    return this.sessionScheduleRepository.findByCourseId(courseId);
  }
}
