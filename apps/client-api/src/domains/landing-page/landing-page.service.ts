import { PrismaRepository } from '@app/database';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    Classroom,
    ClassroomStatus,
    Course,
    DifficultyLevel,
    Prisma,
    Status,
    User,
    UserRole,
    Weekday,
} from '@prisma/client';
import { PaymentService } from '../payment/service/payment.service';
import {
    GuestEnrollmentDto,
    GuestEnrollmentRole,
    GuestPersonDto,
} from './dto/guest-enrollment.dto';

export interface LandingPageFeature {
  icon: string;
  title: string;
  description: string;
}

export interface LandingPageStat {
  number: string;
  label: string;
}

export interface LandingPageTestimonial {
  text: string;
  author: string;
  role: string;
  avatar: string;
}

export interface LandingPageClass {
  level: string;
  levelVi: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  duration: string;
  schedule: string;
  students: string;
  teacher: string;
  teacherFlag: string;
  price: string;
  features: string[];
  nextClass: string;
  popular?: boolean;
  paymentEligible?: boolean;
  courseId?: string;
  courseTitle?: string;
  classroomId?: string;
}

export interface LandingPageFooterSection {
  title: string;
  links: string[];
}

export interface LandingPageData {
  features: LandingPageFeature[];
  stats: LandingPageStat[];
  testimonials: LandingPageTestimonial[];
  classes: LandingPageClass[];
  classSchedule: LandingPageScheduleRow[];
  teachers: LandingPageTeacher[];
  footerSections: LandingPageFooterSection[];
}

export interface GuestEnrollmentResponse {
  paymentUrl: string;
  transactionId: string;
  studentId: string;
  parentId?: string | null;
  role: GuestEnrollmentRole;
}

export interface ContactFormPayload {
  name: string;
  phone: string;
  email: string;
  level?: string;
  goals?: string[];
}

export interface LandingPageTeacher {
  name: string;
  role: string;
  flag: string;
  experience?: string;
  specialty?: string;
  education?: string;
  bio?: string;
}

export interface LandingPageScheduleRow {
  time: string;
  days: Partial<Record<Weekday, string>>;
}

const FEATURE_CARDS: LandingPageFeature[] = [
  {
    icon: '🎯',
    title: 'Học theo mục tiêu',
    description:
      'Chương trình học được cá nhân hóa theo mục tiêu và trình độ của từng học viên, giúp tối ưu hóa quá trình học tập.',
  },
  {
    icon: '🗣️',
    title: 'Thực hành giao tiếp',
    description:
      'Môi trường thực hành tiếng Anh với giáo viên bản ngữ và AI thông minh, giúp cải thiện khả năng giao tiếp tự nhiên.',
  },
  {
    icon: '📱',
    title: 'Học mọi lúc mọi nơi',
    description:
      'Ứng dụng di động hiện đại cho phép bạn học tiếng Anh bất cứ lúc nào, bất cứ nơi đâu với các bài học ngắn gọn hiệu quả.',
  },
  {
    icon: '🏆',
    title: 'Chứng chỉ uy tín',
    description:
      'Nhận chứng chỉ được công nhận quốc tế sau khi hoàn thành khóa học, nâng cao cơ hội nghề nghiệp của bạn.',
  },
  {
    icon: '🎮',
    title: 'Học qua trò chơi',
    description:
      'Phương pháp gamification thú vị giúp việc học trở nên vui nhộn và dễ dàng ghi nhớ kiến thức lâu dài.',
  },
  {
    icon: '👥',
    title: 'Cộng đồng học tập',
    description:
      'Tham gia cộng đồng học viên sôi động, chia sẻ kinh nghiệm và cùng nhau tiến bộ trong hành trình học tiếng Anh.',
  },
];

const FOOTER_SECTIONS: LandingPageFooterSection[] = [
  {
    title: 'Khóa học',
    links: [
      'Tiếng Anh cơ bản',
      'Tiếng Anh giao tiếp',
      'IELTS/TOEIC',
      'Tiếng Anh thương mại',
    ],
  },
  {
    title: 'Hỗ trợ',
    links: ['Trung tâm trợ giúp', 'Liên hệ', 'FAQ', 'Chính sách bảo mật'],
  },
  {
    title: 'Liên hệ',
    links: [
      '📞 1900-1234',
      '✉️ support@englimaster.com',
      '📍 Hà Nội, Việt Nam',
    ],
  },
];

const FALLBACK_TESTIMONIALS: LandingPageTestimonial[] = [
  {
    text: 'EngliMaster đã thay đổi hoàn toàn cách tôi học tiếng Anh. Từ một người không dám nói tiếng Anh, giờ tôi đã tự tin giao tiếp với khách hàng quốc tế.',
    author: 'Anh Minh Tuấn',
    role: 'Nhân viên kinh doanh',
    avatar: 'MT',
  },
  {
    text: 'Chương trình học rất thú vị và hiệu quả. Tôi đã cải thiện điểm IELTS từ 5.5 lên 7.5 chỉ sau 4 tháng học với EngliMaster.',
    author: 'Chị Thanh Hương',
    role: 'Sinh viên',
    avatar: 'TH',
  },
  {
    text: 'Phương pháp gamification thật sự thu hút. Con tôi rất thích học và tiến bộ rõ rệt, từ việc ngại nói đến tự tin thuyết trình bằng tiếng Anh.',
    author: 'Bà Minh Châu',
    role: 'Phụ huynh',
    avatar: 'MC',
  },
];

const FALLBACK_CLASSES: LandingPageClass[] = [
  {
    level: 'Beginner',
    levelVi: 'Cơ bản',
    color: 'from-green-500 to-emerald-600',
    bgColor: 'from-green-50 to-emerald-50',
    borderColor: 'border-green-500',
    description: 'Dành cho người mới bắt đầu học tiếng Anh',
    duration: '3 tháng',
    schedule: 'Thứ 2, 4, 6 - 19:00-21:00',
    students: '8/12 học viên',
    teacher: 'Ms. Sarah Johnson',
    teacherFlag: '🇺🇸',
    price: '1.200.000đ',
    features: [
      'Học bảng chữ cái và phát âm cơ bản',
      'Từ vựng thiết yếu hàng ngày (500 từ)',
      'Ngữ pháp cơ bản (hiện tại đơn, quá khứ đơn)',
      'Giao tiếp cơ bản: chào hỏi, giới thiệu bản thân',
      'Luyện nghe với audio đơn giản',
    ],
    nextClass: '15/01/2025',
    paymentEligible: false,
  },
  {
    level: 'Intermediate',
    levelVi: 'Trung cấp',
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'from-blue-50 to-indigo-50',
    borderColor: 'border-blue-500',
    description: 'Cho học viên đã có kiến thức cơ bản',
    duration: '4 tháng',
    schedule: 'Thứ 3, 5, 7 - 19:30-21:30',
    students: '10/12 học viên',
    teacher: 'Mr. David Smith',
    teacherFlag: '🇬🇧',
    price: '1.500.000đ',
    features: [
      'Mở rộng từ vựng (1500+ từ theo chủ đề)',
      'Ngữ pháp nâng cao (thì hoàn thành, câu điều kiện)',
      'Luyện speaking với chủ đề đa dạng',
      'Đọc hiểu văn bản trung bình',
      'Viết email và thư từ đơn giản',
    ],
    nextClass: '22/01/2025',
    popular: true,
    paymentEligible: false,
  },
  {
    level: 'Advanced',
    levelVi: 'Nâng cao',
    color: 'from-purple-500 to-pink-600',
    bgColor: 'from-purple-50 to-pink-50',
    borderColor: 'border-purple-500',
    description: 'Hoàn thiện kỹ năng và chuẩn bị thi cử',
    duration: '6 tháng',
    schedule: 'Thứ 2, 4, 6 - 18:00-20:00',
    students: '6/12 học viên',
    teacher: 'Ms. Emma Wilson',
    teacherFlag: '🇦🇺',
    price: '2.000.000đ',
    features: [
      'Từ vựng chuyên ngành và thành ngữ',
      'Ngữ pháp phức tạp và cấu trúc câu nâng cao',
      'Thảo luận và tranh luận bằng tiếng Anh',
      'Đọc hiểu văn bản phức tạp, báo chí',
      'Viết essay, báo cáo chuyên nghiệp',
    ],
    nextClass: '29/01/2025',
    paymentEligible: false,
  },
];

const FALLBACK_SCHEDULE: LandingPageScheduleRow[] = [
  {
    time: '18:00-20:00',
    days: {
      mon: 'Advanced',
      wed: 'Advanced',
      fri: 'Advanced',
    },
  },
  {
    time: '19:00-21:00',
    days: {
      mon: 'Beginner',
      wed: 'Beginner',
      fri: 'Beginner',
    },
  },
  {
    time: '19:30-21:30',
    days: {
      tue: 'Intermediate',
      thu: 'Intermediate',
      sat: 'Intermediate',
    },
  },
];

const FALLBACK_TEACHERS: LandingPageTeacher[] = [
  {
    name: 'Ms. Sarah Johnson',
    role: 'Giám đốc học thuật',
    flag: '🇺🇸',
    experience: '8 năm kinh nghiệm',
    specialty: 'Phương pháp giao tiếp & phát âm',
    education: 'Thạc sĩ TESOL - Stanford University',
  },
  {
    name: 'Mr. David Smith',
    role: 'Trưởng khoa Intermediate',
    flag: '🇬🇧',
    experience: '6 năm kinh nghiệm',
    specialty: 'Ngữ pháp và luyện thi IELTS',
    education: 'Cử nhân Ngôn ngữ Anh - Cambridge',
  },
  {
    name: 'Ms. Emma Wilson',
    role: 'Chuyên gia Advanced',
    flag: '🇦🇺',
    experience: '10 năm kinh nghiệm',
    specialty: 'Business English & Academic Writing',
    education: 'Thạc sĩ Giáo dục - Melbourne University',
  },
];

type DifficultyLiteral = DifficultyLevel | 'default';

const DIFFICULTY_LABELS: Record<DifficultyLiteral, { en: string; vi: string }> =
  {
    [DifficultyLevel.beginner]: { en: 'Beginner', vi: 'Cơ bản' },
    [DifficultyLevel.elementary]: { en: 'Elementary', vi: 'Sơ cấp' },
    [DifficultyLevel.intermediate]: { en: 'Intermediate', vi: 'Trung cấp' },
    [DifficultyLevel.upper_intermediate]: {
      en: 'Upper Intermediate',
      vi: 'Khá',
    },
    [DifficultyLevel.advanced]: { en: 'Advanced', vi: 'Nâng cao' },
    [DifficultyLevel.expert]: { en: 'Expert', vi: 'Chuyên sâu' },
    default: { en: 'General', vi: 'Tổng hợp' },
  };

const DIFFICULTY_STYLES: Record<
  DifficultyLiteral,
  { color: string; bgColor: string; borderColor: string }
> = {
  [DifficultyLevel.beginner]: {
    color: 'from-green-500 to-emerald-600',
    bgColor: 'from-green-50 to-emerald-50',
    borderColor: 'border-green-500',
  },
  [DifficultyLevel.elementary]: {
    color: 'from-cyan-500 to-sky-600',
    bgColor: 'from-cyan-50 to-sky-50',
    borderColor: 'border-cyan-500',
  },
  [DifficultyLevel.intermediate]: {
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'from-blue-50 to-indigo-50',
    borderColor: 'border-blue-500',
  },
  [DifficultyLevel.upper_intermediate]: {
    color: 'from-amber-500 to-orange-600',
    bgColor: 'from-amber-50 to-orange-50',
    borderColor: 'border-amber-500',
  },
  [DifficultyLevel.advanced]: {
    color: 'from-purple-500 to-pink-600',
    bgColor: 'from-purple-50 to-pink-50',
    borderColor: 'border-purple-500',
  },
  [DifficultyLevel.expert]: {
    color: 'from-rose-500 to-red-600',
    bgColor: 'from-rose-50 to-red-50',
    borderColor: 'border-rose-500',
  },
  default: {
    color: 'from-indigo-500 to-purple-600',
    bgColor: 'from-indigo-50 to-purple-50',
    borderColor: 'border-indigo-500',
  },
};

const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: 'Thứ 2',
  tue: 'Thứ 3',
  wed: 'Thứ 4',
  thu: 'Thứ 5',
  fri: 'Thứ 6',
  sat: 'Thứ 7',
  sun: 'Chủ nhật',
};

@Injectable()
export class LandingPageService {
  private readonly logger = new Logger(LandingPageService.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly paymentService: PaymentService,
  ) {}

  async getLandingPageData(): Promise<LandingPageData> {
    try {
      const [stats, testimonials, classData, teachers] = await Promise.all([
        this.buildStats(),
        this.buildTestimonials(),
        this.buildClasses(),
        this.buildTeachers(),
      ]);

      return {
        features: FEATURE_CARDS,
        stats,
        testimonials,
        classes: classData.classes,
        classSchedule: classData.schedule,
        teachers,
        footerSections: FOOTER_SECTIONS,
      };
    } catch (error) {
      this.logger.error('Failed to build landing page data', error);
      return this.getFallbackData();
    }
  }

  async submitContactForm(
    payload: ContactFormPayload,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log({
      message: 'Landing page contact form received',
      payload: {
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        level: payload.level,
        goals: payload.goals,
      },
    });

    return {
      success: true,
      message: 'Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi trong vòng 2 giờ.',
    };
  }

  /**
   * Validate guest user email/phone before enrollment
   */
  async validateGuestUser(payload: GuestEnrollmentDto): Promise<{
    valid: boolean;
    message: string;
    conflicts?: {
      students?: Array<{ index: number; email?: boolean; phone?: boolean }>;
      parent?: { email?: boolean; phone?: boolean };
    };
  }> {
    const { role, students, parent } = payload;
    const conflicts: any = {};

    // Check students
    const studentConflicts: Array<{ index: number; email?: boolean; phone?: boolean }> = [];
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const conflict: any = { index: i };
      let hasConflict = false;

      // Check email
      const emailExists = await this.prisma.user.findFirst({
        where: { email: student.email },
      });
      if (emailExists) {
        conflict.email = true;
        hasConflict = true;
      }

      // Check phone
      const phoneExists = await this.prisma.user.findFirst({
        where: { phone: student.phone },
      });
      if (phoneExists) {
        conflict.phone = true;
        hasConflict = true;
      }

      if (hasConflict) {
        studentConflicts.push(conflict);
      }
    }

    if (studentConflicts.length > 0) {
      conflicts.students = studentConflicts;
    }

    // Check parent (only if role is parent)
    if (role === GuestEnrollmentRole.parent && parent) {
      const parentConflict: any = {};
      let hasParentConflict = false;

      // Check email
      const emailExists = await this.prisma.user.findFirst({
        where: { email: parent.email },
      });
      if (emailExists) {
        parentConflict.email = true;
        hasParentConflict = true;
      }

      // Check phone
      const phoneExists = await this.prisma.user.findFirst({
        where: { phone: parent.phone },
      });
      if (phoneExists) {
        parentConflict.phone = true;
        hasParentConflict = true;
      }

      if (hasParentConflict) {
        conflicts.parent = parentConflict;
      }
    }

    // Build response
    if (Object.keys(conflicts).length > 0) {
      return {
        valid: false,
        message: 'Email hoặc số điện thoại đã được sử dụng',
        conflicts,
      };
    }

    return {
      valid: true,
      message: 'Thông tin hợp lệ',
    };
  }

  async createGuestEnrollment(
    payload: GuestEnrollmentDto,
    ipAddress?: string,
  ): Promise<GuestEnrollmentResponse> {
    const role = payload.role;
    const studentsCount = payload.students?.length || 0;

    if (studentsCount === 0) {
      throw new BadRequestException('Vui lòng cung cấp ít nhất một học sinh');
    }

    this.logger.log({
      message: 'Guest enrollment request received',
      role,
      courseId: payload.courseId,
      classroomId: payload.classroomId,
      studentsCount,
      parentEmail: payload.parent?.email,
    });

    const course = await this.prisma.course.findUnique({
      where: { id: payload.courseId },
      select: {
        id: true,
        title: true,
        price: true,
        currency: true,
        isPublished: true,
      },
    });

    if (!course || !course.isPublished) {
      throw new NotFoundException(
        'Khóa học không tồn tại hoặc chưa mở đăng ký công khai',
      );
    }

    const classroom = await this.prisma.classroom.findUnique({
      where: { id: payload.classroomId },
      select: {
        id: true,
        courseId: true,
        isActive: true,
        status: true,
        maxStudents: true,
        name: true,
      },
    });

    if (!classroom || classroom.courseId !== course.id) {
      throw new NotFoundException(
        'Không tìm thấy lớp học tương ứng với khóa học đã chọn',
      );
    }

    if (
      !classroom.isActive ||
      (classroom.status !== ClassroomStatus.ongoing &&
        classroom.status !== ClassroomStatus.upcoming)
    ) {
      throw new BadRequestException(
        'Lớp học này hiện không mở để đăng ký mới. Vui lòng chọn lớp khác.',
      );
    }

    if (role === GuestEnrollmentRole.parent && !payload.parent) {
      throw new BadRequestException(
        'Vui lòng cung cấp thông tin phụ huynh khi đăng ký với tư cách phụ huynh',
      );
    }

    const returnUrl =
      payload.returnUrl ||
      process.env.LANDING_PAGE_PAYMENT_RETURN_URL ||
      'http://localhost:3000/payment/return';

    const supportNotes = this.buildSupportNote(payload);

    const studentUsers: User[] = [];
    let parentUser: User | null = null;

    await this.prisma.$transaction(async (tx) => {
      if (role === GuestEnrollmentRole.student) {
        // Role = student: Chỉ tạo students, không tạo parent
        for (const studentData of payload.students) {
          const studentUser = await this.ensureGuestUser(
            tx,
            studentData,
            UserRole.student,
            payload.source,
            supportNotes,
          );
          studentUsers.push(studentUser);
        }

        // Enroll tất cả students vào classroom
        for (const studentUser of studentUsers) {
          await this.ensureClassroomMembership(
            tx,
            classroom,
            studentUser.id,
            supportNotes,
          );
        }
      } else if (role === GuestEnrollmentRole.parent) {
        // Role = parent: Tạo parent trước, sau đó tạo students và link
        parentUser = await this.ensureGuestUser(
          tx,
          payload.parent!,
          UserRole.parent,
          payload.source,
          supportNotes,
        );

        // Tạo tất cả students
        for (const studentData of payload.students) {
          const studentUser = await this.ensureGuestUser(
            tx,
            studentData,
            UserRole.student,
            payload.source,
            supportNotes,
          );
          studentUsers.push(studentUser);

          // Link parent với student
          await this.ensureParentChildLink(tx, parentUser.id, studentUser.id);
        }

        // Enroll tất cả students vào classroom
        for (const studentUser of studentUsers) {
          await this.ensureClassroomMembership(
            tx,
            classroom,
            studentUser.id,
            supportNotes,
          );
        }
      }
    });    // Calculate total amount: price * number of students
    const baseAmount = course.price;
    if (!baseAmount || baseAmount <= 0) {
      throw new BadRequestException(
        'Khóa học chưa được cấu hình giá. Vui lòng liên hệ đội tư vấn.',
      );
    }

    const totalAmount = baseAmount * studentsCount;

    const description = payload.note
      ? `Thanh toán khóa học ${course.title} cho ${studentsCount} học sinh (${payload.note})`
      : `Thanh toán khóa học: ${course.title} (${studentsCount} học sinh)`;

    // Use first student as primary for payment
    const primaryStudent = studentUsers[0];

    const payment = await this.paymentService.createPayment(
      primaryStudent.id,
      {
        courseId: payload.courseId,
        classroomId: payload.classroomId,
        amount: totalAmount,
        currency: course.currency || 'VND',
        description,
        returnUrl,
        studentId: primaryStudent.id,
      },
      ipAddress,
      parentUser?.id ?? primaryStudent.id,
    );

    this.logger.log({
      message: 'Guest enrollment created successfully',
      transactionId: payment.transactionId,
      studentsCount,
      totalAmount,
      studentIds: studentUsers.map(s => s.id),
      parentId: parentUser?.id,
    });

    return {
      paymentUrl: payment.paymentUrl,
      transactionId: payment.transactionId,
      studentId: primaryStudent.id,
      parentId: parentUser?.id ?? null,
      role,
    };
  }

  private async buildStats(): Promise<LandingPageStat[]> {
    const [studentCount, courseCount, lessonCount, activeClassroomCount] =
      await Promise.all([
        this.prisma.user.count({ where: { role: UserRole.student } }),
        this.prisma.course.count({ where: { isPublished: true } }),
        this.prisma.lesson.count(),
        this.prisma.classroom.count({
          where: {
            status: {
              in: [ClassroomStatus.upcoming, ClassroomStatus.ongoing],
            },
          },
        }),
      ]);

    return [
      { number: formatCompactNumber(studentCount), label: 'Học viên đang học' },
      {
        number: formatCompactNumber(courseCount),
        label: 'Khóa học đang mở',
      },
      { number: formatCompactNumber(lessonCount), label: 'Bài học tương tác' },
      {
        number: formatCompactNumber(activeClassroomCount),
        label: 'Lớp học đang diễn ra',
      },
    ];
  }

  private async buildTestimonials(): Promise<LandingPageTestimonial[]> {
    const ratings = await this.prisma.courseRating.findMany({
      where: { comment: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    if (ratings.length === 0) {
      return FALLBACK_TESTIMONIALS;
    }

    const userIds = Array.from(new Set(ratings.map((rating) => rating.userId)));
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
    const userMap = new Map<string, User>(
      users.map((user) => [user.id, user as User]),
    );

    return ratings.slice(0, 3).map((rating) => {
      const user = userMap.get(rating.userId);
      const authorName = resolveUserName(user);

      return {
        text: rating.comment ?? 'Khóa học tuyệt vời và dễ theo dõi!',
        author: authorName,
        role: resolveUserRoleLabel(user?.role),
        avatar: buildAvatarInitials(authorName),
      };
    });
  }

  private async buildClasses(): Promise<{
    classes: LandingPageClass[];
    schedule: LandingPageScheduleRow[];
  }> {
    const courses = await this.prisma.course.findMany({
      where: { isPublished: true },
      orderBy: [{ orderNo: 'asc' }, { createdAt: 'desc' }],
      take: 6,
    });

    if (courses.length === 0) {
      return { classes: FALLBACK_CLASSES, schedule: FALLBACK_SCHEDULE };
    }

    const classrooms = await Promise.all(
      courses.map((course) =>
        this.prisma.classroom.findFirst({
          where: {
            courseId: course.id,
            isActive: true,
            status: {
              in: [ClassroomStatus.upcoming, ClassroomStatus.ongoing],
            },
          },
          orderBy: { periodStart: 'asc' },
          include: {
            teacher: {
              select: {
                displayName: true,
                firstName: true,
                lastName: true,
                nationality: true,
              },
            },
            students: {
              where: { isActive: true },
              select: { studentId: true },
            },
            slots: {
              select: {
                dayOfWeek: true,
                startMinuteOfDay: true,
                endMinuteOfDay: true,
              },
            },
          },
        }),
      ),
    );

    const classes: LandingPageClass[] = [];
    const scheduleMap = new Map<
      string,
      {
        start: number;
        end: number;
        days: Partial<Record<Weekday, string>>;
      }
    >();

    courses.forEach((course, index) => {
      const classroom = classrooms[index];
      if (!classroom) {
        return;
      }

      classes.push(
        this.mapCourseToLandingClass(course, classroom, index === 0),
      );

      classroom.slots.forEach((slot) => {
        const key = `${formatTime(slot.startMinuteOfDay)}-${formatTime(
          slot.endMinuteOfDay,
        )}`;
        const existing =
          scheduleMap.get(key) ??
          ({
            start: slot.startMinuteOfDay,
            end: slot.endMinuteOfDay,
            days: {},
          } as {
            start: number;
            end: number;
            days: Partial<Record<Weekday, string>>;
          });
        existing.days[slot.dayOfWeek] = classroom.name;
        scheduleMap.set(key, existing);
      });
    });

    const schedule =
      scheduleMap.size > 0
        ? Array.from(scheduleMap.entries())
            .sort((a, b) => a[1].start - b[1].start)
            .map(([time, value]) => ({
              time,
              days: value.days,
            }))
        : FALLBACK_SCHEDULE;

    return {
      classes: classes.length > 0 ? classes : FALLBACK_CLASSES,
      schedule,
    };
  }

  private async buildTeachers(): Promise<LandingPageTeacher[]> {
    const teachers = await this.prisma.user.findMany({
      where: { role: UserRole.teacher },
      select: {
        displayName: true,
        firstName: true,
        lastName: true,
        nationality: true,
        experience: true,
        highlights: true,
        bio: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 6,
    });

    if (teachers.length === 0) {
      return FALLBACK_TEACHERS;
    }

    return teachers.map((teacher) => ({
      name: resolveTeacherName(teacher),
      role: teacher.highlights?.[0] ?? 'Giáo viên EngliMaster',
      flag: resolveTeacherFlag(teacher.nationality),
      experience:
        teacher.experience != null
          ? `${teacher.experience} năm kinh nghiệm`
          : undefined,
      specialty: teacher.highlights?.[1],
      education: teacher.highlights?.[2],
      bio: teacher.bio ?? undefined,
    }));
  }

  private async ensureGuestUser(
    tx: Prisma.TransactionClient,
    person: GuestPersonDto,
    role: UserRole,
    source?: string,
    note?: string | null,
  ): Promise<User> {
    const email = person.email?.trim().toLowerCase();

    if (!email) {
      throw new BadRequestException('Email không được bỏ trống');
    }

    const existing = await tx.user.findUnique({
      where: { email },
    });

    if (existing) {
      if (existing.role !== role) {
        throw new ConflictException(
          `Email ${email} đã đăng ký với vai trò khác (${existing.role}). Vui lòng dùng email khác.`,
        );
      }

      const updateData: Prisma.UserUpdateInput = {};

      if (!existing.firstName && person.firstName) {
        updateData.firstName = person.firstName;
      }

      if (!existing.lastName && person.lastName) {
        updateData.lastName = person.lastName;
      }

      if (!existing.displayName) {
        updateData.displayName =
          person.displayName ||
          this.buildDisplayName(person.firstName, person.lastName, email);
      }

      if (!existing.phone && person.phone) {
        await this.ensurePhoneAvailable(tx, person.phone, existing.id);
        updateData.phone = person.phone;
      }

      if (Object.keys(updateData).length > 0) {
        updateData.preferences = this.mergePreferences(
          existing.preferences,
          source,
          note,
        );
        return tx.user.update({
          where: { id: existing.id },
          data: updateData,
        });
      }

      if (source || note) {
        await tx.user.update({
          where: { id: existing.id },
          data: {
            preferences: this.mergePreferences(
              existing.preferences,
              source,
              note,
            ),
          },
        });
      }

      return existing;
    }

    if (person.phone) {
      await this.ensurePhoneAvailable(tx, person.phone);
    }

    return tx.user.create({
      data: {
        email,
        phone: person.phone,
        firstName: person.firstName,
        lastName: person.lastName,
        displayName:
          person.displayName ||
          this.buildDisplayName(person.firstName, person.lastName, email),
        role,
        status: Status.pending,
        provider: 'local',
        preferences: this.mergePreferences(null, source, note),
      },
    });
  }

  private async ensurePhoneAvailable(
    tx: Prisma.TransactionClient,
    phone: string,
    ignoreUserId?: string,
  ) {
    const existing = await tx.user.findUnique({
      where: { phone },
      select: { id: true },
    });

    if (existing && existing.id !== ignoreUserId) {
      throw new ConflictException(
        'Số điện thoại này đã được sử dụng cho tài khoản khác.',
      );
    }
  }

  private buildDisplayName(
    firstName?: string,
    lastName?: string,
    fallbackEmail?: string,
  ): string {
    const parts = [firstName, lastName].filter(
      (part) => part && part.trim().length > 0,
    );
    if (parts.length > 0) {
      return parts.join(' ').trim();
    }
    if (fallbackEmail) {
      return fallbackEmail.split('@')[0];
    }
    return 'Guest';
  }

  private mergePreferences(
    current: unknown,
    source?: string,
    note?: string | null,
  ) {
    const existing =
      typeof current === 'object' && current !== null
        ? { ...(current as any) }
        : {};
    if (source) {
      existing.landingSource = source;
    }
    if (note) {
      existing.landingNote = note;
    }
    existing.lastLandingSignupAt = new Date().toISOString();
    return existing;
  }

  private async ensureParentChildLink(
    tx: Prisma.TransactionClient,
    parentId: string,
    childId: string,
  ) {
    await tx.parentChild.upsert({
      where: {
        parentId_childId: { parentId, childId },
      },
      update: {
        createdAt: new Date(),
      },
      create: {
        parentId,
        childId,
      },
    });
  }

  private async ensureClassroomMembership(
    tx: Prisma.TransactionClient,
    classroom: Pick<Classroom, 'id' | 'maxStudents' | 'name'>,
    studentId: string,
    note?: string | null,
  ) {
    const existing = await tx.classroomStudent.findUnique({
      where: {
        classroomId_studentId: {
          classroomId: classroom.id,
          studentId,
        },
      },
    });

    if (existing) {
      if (existing.isPurchased) {
        throw new ConflictException(
          'Học viên đã hoàn tất thanh toán cho lớp này trước đó.',
        );
      }

      if (!existing.isActive) {
        await tx.classroomStudent.update({
          where: {
            classroomId_studentId: {
              classroomId: classroom.id,
              studentId,
            },
          },
          data: {
            isActive: true,
            notes: note ?? existing.notes,
          },
        });
      } else if (note && note !== existing.notes) {
        await tx.classroomStudent.update({
          where: {
            classroomId_studentId: {
              classroomId: classroom.id,
              studentId,
            },
          },
          data: {
            notes: note,
          },
        });
      }
      return;
    }

    if (classroom.maxStudents) {
      const activeCount = await tx.classroomStudent.count({
        where: {
          classroomId: classroom.id,
          isActive: true,
        },
      });

      if (activeCount >= classroom.maxStudents) {
        throw new ConflictException(
          `Lớp ${classroom.name} đã đủ sĩ số. Vui lòng chọn lớp khác.`,
        );
      }
    }

    await tx.classroomStudent.create({
      data: {
        classroomId: classroom.id,
        studentId,
        isActive: true,
        isPurchased: false,
        notes: note ?? undefined,
      },
    });
  }

  private buildSupportNote(payload: GuestEnrollmentDto): string | null {
    const segments: string[] = [];

    if (payload.supportNeeds && payload.supportNeeds.length > 0) {
      segments.push(`Nhu cầu: ${payload.supportNeeds.join(', ')}`);
    }

    if (payload.note) {
      segments.push(`Ghi chú: ${payload.note}`);
    }

    if (payload.consentToContact) {
      segments.push('Khách đồng ý nhận tư vấn');
    }

    if (segments.length === 0) {
      return null;
    }

    return segments.join(' | ');
  }

  private mapCourseToLandingClass(
    course: Course,
    classroom: Classroom & {
      teacher: Pick<
        User,
        'displayName' | 'firstName' | 'lastName' | 'nationality'
      > | null;
      students: Array<{ studentId: string }>;
      slots: Array<{
        dayOfWeek: Weekday;
        startMinuteOfDay: number;
        endMinuteOfDay: number;
      }>;
    },
    markPopular: boolean,
  ): LandingPageClass {
    const difficultyKey = (course.difficulty ?? 'default') as DifficultyLiteral;
    const labels =
      DIFFICULTY_LABELS[difficultyKey] ?? DIFFICULTY_LABELS.default;
    const style = DIFFICULTY_STYLES[difficultyKey] ?? DIFFICULTY_STYLES.default;
    const currentStudents = classroom.students.length;
    const capacity = classroom.maxStudents ?? course.maxStudents ?? null;

    return {
      level: labels.en,
      levelVi: labels.vi,
      color: style.color,
      bgColor: style.bgColor,
      borderColor: style.borderColor,
      description:
        course.description ??
        'Chương trình được thiết kế lộ trình rõ ràng, phù hợp với mục tiêu học tập của bạn.',
      duration: formatCourseDuration(course),
      schedule: formatClassSchedule(classroom.slots),
      students:
        capacity && capacity > 0
          ? `${currentStudents}/${capacity} học viên`
          : `${currentStudents} học viên`,
      teacher: resolveTeacherName(classroom.teacher),
      teacherFlag: resolveTeacherFlag(classroom.teacher?.nationality),
      price: formatCurrency(course.price ?? 0, course.currency ?? 'VND'),
      features: buildClassFeatures(course),
      nextClass: formatDate(classroom.periodStart),
      popular: markPopular || undefined,
      paymentEligible: true,
      courseId: course.id,
      courseTitle: course.title ?? course.name ?? labels.vi,
      classroomId: classroom.id,
    };
  }

  private getFallbackData(): LandingPageData {
    return {
      features: FEATURE_CARDS,
      stats: [
        { number: '50K+', label: 'Học viên đã tham gia' },
        { number: '95%', label: 'Học viên hài lòng' },
        { number: '500+', label: 'Bài học tương tác' },
        { number: '24/7', label: 'Hỗ trợ liên tục' },
      ],
      testimonials: FALLBACK_TESTIMONIALS,
      classes: FALLBACK_CLASSES,
      classSchedule: FALLBACK_SCHEDULE,
      teachers: FALLBACK_TEACHERS,
      footerSections: FOOTER_SECTIONS,
    };
  }
}

function formatCompactNumber(value: number): string {
  const formatter = new Intl.NumberFormat('vi-VN', {
    notation: 'compact',
    compactDisplay: 'short',
  });
  return formatter.format(value);
}

function resolveUserName(
  user?: Pick<User, 'displayName' | 'firstName' | 'lastName'> | null,
) {
  if (!user) return 'Học viên EngliMaster';
  if (user.displayName) return user.displayName;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name.length > 0 ? name : 'Học viên EngliMaster';
}

function resolveUserRoleLabel(role?: UserRole): string {
  switch (role) {
    case UserRole.parent:
      return 'Phụ huynh';
    case UserRole.teacher:
      return 'Giáo viên';
    default:
      return 'Học viên';
  }
}

function buildAvatarInitials(name: string): string {
  const words = name.split(' ').filter(Boolean);
  if (words.length === 0) return 'HV';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function resolveTeacherName(
  teacher?: Pick<User, 'displayName' | 'firstName' | 'lastName'> | null,
): string {
  if (!teacher) return 'Giáo viên EngliMaster';
  if (teacher.displayName) return teacher.displayName;
  const name = [teacher.firstName, teacher.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name.length > 0 ? name : 'Giáo viên EngliMaster';
}

function resolveTeacherFlag(nationality?: string | null): string {
  if (!nationality) return '🌐';
  const country = nationality.toLowerCase();
  if (country.includes('viet')) return '🇻🇳';
  if (country.includes('united states') || country.includes('usa')) return '🇺🇸';
  if (country.includes('england') || country.includes('united kingdom'))
    return '🇬🇧';
  if (country.includes('australia')) return '🇦🇺';
  if (country.includes('canada')) return '🇨🇦';
  return '🌐';
}

function formatCourseDuration(course: Course): string {
  if (course.plannedSessions && course.estimatedHours) {
    return `${course.plannedSessions} buổi (~${Math.round(
      course.estimatedHours,
    )} giờ)`;
  }
  if (course.plannedSessions) {
    return `${course.plannedSessions} buổi`;
  }
  if (course.estimatedHours) {
    return `~${Math.round(course.estimatedHours)} giờ học`;
  }
  return 'Theo lộ trình cá nhân';
}

function formatClassSchedule(
  slots: Array<{
    dayOfWeek: Weekday;
    startMinuteOfDay: number;
    endMinuteOfDay: number;
  }>,
): string {
  if (!slots || slots.length === 0) {
    return 'Lịch học linh hoạt';
  }

  return slots
    .map((slot) => {
      const day = WEEKDAY_LABEL[slot.dayOfWeek];
      return `${day} ${formatTime(slot.startMinuteOfDay)}-${formatTime(
        slot.endMinuteOfDay,
      )}`;
    })
    .join(', ');
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const mins = (minutes % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
}

function formatDate(date?: Date | null): string {
  if (!date) return 'Đang cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatCurrency(amount: number, currency: string): string {
  if (amount <= 0) return 'Miễn phí';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildClassFeatures(course: Course): string[] {
  const features: string[] = [];

  if (course.tags && course.tags.length > 0) {
    features.push(...course.tags.slice(0, 2).map((tag) => `Chủ đề: ${tag}`));
  }

  features.push(
    `Lộ trình ${course.plannedSessions ?? 8} buổi`,
    'Theo sát lộ trình cá nhân',
    'Bài tập tương tác & phản hồi nhanh',
  );

  if (course.estimatedHours) {
    features.push(`Tổng thời lượng ~${Math.round(course.estimatedHours)} giờ`);
  }

  return features.slice(0, 5);
}
