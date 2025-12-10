import { PrismaRepository } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import { AssignmentType } from '@prisma/client';
import { ClassroomRepository } from '../repository/classroom.repository';

export interface AutoExamCreationOptions {
  classroomId: string;
  courseId: string;
  teacherId: string;
  totalSessions: number;
  periodStart: Date; // Kept for backward compatibility, not used in calculation
  periodEnd: Date; // Kept for backward compatibility, not used in calculation
  slots: Array<{
    dayOfWeek: string;
    startMinuteOfDay: number;
    endMinuteOfDay: number;
  }>; // Kept for backward compatibility, not used in calculation
}

@Injectable()
export class AutoExamCreationService {
  private readonly logger = new Logger(AutoExamCreationService.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly classroomRepository: ClassroomRepository,
  ) {}

  /**
   * Tự động tạo bài thi giữa kỳ và cuối kỳ cho classroom
   * - Bài thi giữa kỳ: 60% thời gian (session tại 60% vị trí)
   * - Bài thi cuối kỳ: 100% thời gian (session cuối cùng)
   * - Sử dụng thời gian thực tế của session (startTime, endTime)
   */
  async createAutoExams(options: AutoExamCreationOptions): Promise<void> {
    const {
      classroomId,
      courseId,
      teacherId,
      totalSessions,
    } = options;

    this.logger.log(
      `Creating auto exams for classroom ${classroomId} with ${totalSessions} sessions`,
    );

    // Query sessions sau khi đã được tạo
    const sessions = await this.classroomRepository.getClassroomSessions(classroomId);

    // Validate sessions
    if (!sessions || sessions.length < 2) {
      this.logger.warn(
        `Cannot create exams: classroom ${classroomId} has ${sessions?.length || 0} sessions (need at least 2)`,
      );
      return;
    }

    // Tính toán index cho các session
    const midtermIndex = Math.floor(sessions.length * 0.6);
    const finalIndex = sessions.length - 1;

    // Validate indices
    if (midtermIndex < 0 || midtermIndex >= sessions.length) {
      this.logger.warn(
        `Invalid midterm index ${midtermIndex} for ${sessions.length} sessions`,
      );
      return;
    }

    if (finalIndex < 0 || finalIndex >= sessions.length) {
      this.logger.warn(
        `Invalid final index ${finalIndex} for ${sessions.length} sessions`,
      );
      return;
    }

    // Kiểm tra midterm và final không trùng nhau
    if (midtermIndex === finalIndex) {
      this.logger.warn(
        `Midterm and final exams would be on same session (index ${midtermIndex}). Adjusting midterm to ${midtermIndex - 1}`,
      );
      // Điều chỉnh midterm về trước 1 session nếu trùng
      if (midtermIndex > 0) {
        const adjustedMidtermIndex = midtermIndex - 1;
        const midtermSession = sessions[adjustedMidtermIndex];
        const finalSession = sessions[finalIndex];

        // Validate session times
        if (!this.validateSession(midtermSession)) {
          this.logger.warn(`Invalid midterm session at index ${adjustedMidtermIndex}`);
          return;
        }
        if (!this.validateSession(finalSession)) {
          this.logger.warn(`Invalid final session at index ${finalIndex}`);
          return;
        }

        await this.createMidtermExam({
          classroomId,
          courseId,
          teacherId,
          session: midtermSession,
          sessionIndex: adjustedMidtermIndex,
        });

        await this.createFinalExam({
          classroomId,
          courseId,
          teacherId,
          session: finalSession,
          sessionIndex: finalIndex,
        });
      } else {
        this.logger.warn(`Cannot adjust midterm index, skipping exam creation`);
        return;
      }
    } else {
      // Lấy target sessions
      const midtermSession = sessions[midtermIndex];
      const finalSession = sessions[finalIndex];

      // Validate session times
      if (!this.validateSession(midtermSession)) {
        this.logger.warn(`Invalid midterm session at index ${midtermIndex}`);
        return;
      }
      if (!this.validateSession(finalSession)) {
        this.logger.warn(`Invalid final session at index ${finalIndex}`);
        return;
      }

      // Tạo bài thi giữa kỳ
      await this.createMidtermExam({
        classroomId,
        courseId,
        teacherId,
        session: midtermSession,
        sessionIndex: midtermIndex,
      });

      // Tạo bài thi cuối kỳ
      await this.createFinalExam({
        classroomId,
        courseId,
        teacherId,
        session: finalSession,
        sessionIndex: finalIndex,
      });
    }

    this.logger.log(
      `Auto exams created successfully for classroom ${classroomId}`,
    );
  }

  /**
   * Validate session has valid times
   */
  private validateSession(session: any): boolean {
    if (!session) return false;
    if (!session.startTime || !session.endTime) return false;
    if (!(session.startTime instanceof Date) || !(session.endTime instanceof Date)) {
      return false;
    }
    if (session.endTime <= session.startTime) return false;
    if (!session.durationHours || session.durationHours <= 0) return false;
    return true;
  }


  private async createMidtermExam(params: {
    classroomId: string;
    courseId: string;
    teacherId: string;
    session: any;
    sessionIndex: number;
  }): Promise<void> {
    const {
      classroomId,
      courseId,
      teacherId,
      session,
      sessionIndex,
    } = params;

    // Use actual session times
    const startTime = new Date(session.startTime);
    const dueDate = new Date(session.endTime);
    const timeLimit = Math.round(session.durationHours * 60); // Convert hours to minutes
    const sessionNumber = sessionIndex + 1; // 1-indexed for display

    const midtermExam = await this.prisma.assignment.create({
      data: {
        title: 'Bài thi giữa kỳ',
        description:
          'Bài thi giữa kỳ đánh giá kiến thức từ đầu khóa học đến giữa khóa học.',
        instructions: `
# Hướng dẫn làm bài thi giữa kỳ

## Thời gian làm bài: ${timeLimit} phút
## Tổng điểm: 100 điểm

### Cấu trúc bài thi:
- **Phần 1: Ngữ pháp** (30 điểm) - 15 câu hỏi trắc nghiệm
- **Phần 2: Từ vựng** (25 điểm) - 10 câu điền từ vào chỗ trống
- **Phần 3: Đọc hiểu** (25 điểm) - 1 bài đọc với 5 câu hỏi
- **Phần 4: Nghe hiểu** (20 điểm) - 1 bài nghe với 5 câu hỏi

### Lưu ý:
- Làm bài nghiêm túc, không trao đổi với bạn bè
- Kiểm tra kỹ trước khi nộp bài
- Nếu gặp sự cố kỹ thuật, báo ngay với giáo viên
        `,
        type: AssignmentType.MIDTERM_EXAM,
        weight: 0.3, // 30% trọng số điểm
        totalPoints: 100,
        timeLimit: timeLimit, // Thời gian buổi học
        maxAttempts: 1, // Chỉ được làm 1 lần
        startTime: startTime, // Thời gian bắt đầu làm bài (từ session)
        dueDate: dueDate, // Thời gian kết thúc (từ session)
        isPublished: true,
        customContent: {
          sessionId: session.id,
          sessionIndex: sessionIndex,
          sessionTitle: session.title,
        },
        classroom: {
          connect: { id: classroomId },
        },
        teacher: {
          connect: { id: teacherId },
        },
        assignmentActivities: {
          create: [
            // Phần 1: Ngữ pháp (30 điểm)
            {
              type: 'quiz',
              title: 'Ngữ pháp - Câu hỏi 1-5',
              points: 10,
              content: {
                question:
                  'Chọn đáp án đúng để hoàn thành câu: "I _____ to school every day."',
                options: ['go', 'goes', 'going', 'went'],
                correctIndex: 0,
              },
            },
            {
              type: 'quiz',
              title: 'Ngữ pháp - Câu hỏi 6-10',
              points: 10,
              content: {
                question: 'Chọn đáp án đúng: "She _____ English for 5 years."',
                options: ['study', 'studies', 'has studied', 'is studying'],
                correctIndex: 2,
              },
            },
            {
              type: 'quiz',
              title: 'Ngữ pháp - Câu hỏi 11-15',
              points: 10,
              content: {
                question:
                  'Chọn đáp án đúng: "If I _____ you, I would study harder."',
                options: ['am', 'was', 'were', 'be'],
                correctIndex: 2,
              },
            },
            // Phần 2: Từ vựng (25 điểm)
            {
              type: 'fill_blank',
              title: 'Từ vựng - Điền từ vào chỗ trống',
              points: 25,
              content: {
                passage:
                  'Complete the following passage with appropriate words: "The _____ is shining brightly today. I can see many _____ flying in the sky. The weather is perfect for a _____ in the park."',
                blanks: ['sun', 'birds', 'walk'],
              },
            },
            // Phần 3: Đọc hiểu (25 điểm)
            {
              type: 'reading',
              title: 'Đọc hiểu - Bài đọc về môi trường',
              points: 25,
              content: {
                passage: `Climate change is one of the most pressing issues of our time. Rising global temperatures, melting ice caps, and extreme weather events are all signs that our planet is in trouble. Scientists agree that human activities, particularly the burning of fossil fuels, are the primary cause of climate change.

To address this crisis, we must take immediate action. This includes reducing our carbon footprint, investing in renewable energy sources, and protecting our forests and oceans. Every individual can make a difference by making small changes in their daily lives, such as using public transportation, reducing waste, and conserving energy.

The future of our planet depends on the choices we make today. If we act now, we can still prevent the worst effects of climate change and create a sustainable future for generations to come.`,
                questions: [
                  {
                    question:
                      'What is the main cause of climate change according to the passage?',
                    options: [
                      'Natural disasters',
                      'Human activities, especially burning fossil fuels',
                      'Solar radiation',
                      'Ocean currents',
                    ],
                    correctIndex: 1,
                  },
                  {
                    question:
                      'What can individuals do to help address climate change?',
                    options: [
                      "Nothing, it's too late",
                      'Use public transportation and reduce waste',
                      'Wait for government action',
                      'Move to another planet',
                    ],
                    correctIndex: 1,
                  },
                ],
              },
            },
            // Phần 4: Nghe hiểu (20 điểm)
            {
              type: 'listening',
              title: 'Nghe hiểu - Cuộc hội thoại về du lịch',
              points: 20,
              content: {
                audioUrl: '/audio/midterm-listening-sample.mp3', // Placeholder URL
                questions: [
                  {
                    question: 'Where does the conversation take place?',
                    options: [
                      'At a travel agency',
                      'At an airport',
                      'At a hotel',
                      'At a restaurant',
                    ],
                    correctIndex: 0,
                  },
                  {
                    question: 'What is the main topic of the conversation?',
                    options: [
                      'Booking a flight',
                      'Planning a vacation',
                      'Checking into a hotel',
                      'Ordering food',
                    ],
                    correctIndex: 1,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    this.logger.log(
      `Created midterm exam: ${midtermExam.id} for session ${sessionNumber} (index ${sessionIndex})`,
    );
  }

  private async createFinalExam(params: {
    classroomId: string;
    courseId: string;
    teacherId: string;
    session: any;
    sessionIndex: number;
  }): Promise<void> {
    const {
      classroomId,
      courseId,
      teacherId,
      session,
      sessionIndex,
    } = params;

    // Use actual session times
    const startTime = new Date(session.startTime);
    const dueDate = new Date(session.endTime);
    const timeLimit = Math.round(session.durationHours * 60); // Convert hours to minutes
    const sessionNumber = sessionIndex + 1; // 1-indexed for display

    const finalExam = await this.prisma.assignment.create({
      data: {
        title: 'Bài thi cuối kỳ',
        description:
          'Bài thi cuối kỳ đánh giá toàn bộ kiến thức đã học trong khóa học.',
        instructions: `
# Hướng dẫn làm bài thi cuối kỳ

## Thời gian làm bài: ${timeLimit} phút
## Tổng điểm: 100 điểm

### Cấu trúc bài thi:
- **Phần 1: Ngữ pháp** (25 điểm) - 20 câu hỏi trắc nghiệm
- **Phần 2: Từ vựng** (20 điểm) - 10 câu điền từ vào chỗ trống
- **Phần 3: Đọc hiểu** (25 điểm) - 2 bài đọc với 10 câu hỏi
- **Phần 4: Nghe hiểu** (15 điểm) - 1 bài nghe với 5 câu hỏi
- **Phần 5: Viết** (15 điểm) - Viết đoạn văn 150-200 từ

### Lưu ý:
- Làm bài nghiêm túc, không trao đổi với bạn bè
- Kiểm tra kỹ trước khi nộp bài
- Phần viết cần đảm bảo đủ số từ yêu cầu
- Nếu gặp sự cố kỹ thuật, báo ngay với giáo viên
        `,
        type: AssignmentType.FINAL_EXAM,
        weight: 0.4, // 40% trọng số điểm
        totalPoints: 100,
        timeLimit: timeLimit, // Thời gian buổi học
        maxAttempts: 1, // Chỉ được làm 1 lần
        startTime: startTime, // Thời gian bắt đầu làm bài (từ session)
        dueDate: dueDate, // Thời gian kết thúc (từ session)
        isPublished: true,
        customContent: {
          sessionId: session.id,
          sessionIndex: sessionIndex,
          sessionTitle: session.title,
        },
        classroom: {
          connect: { id: classroomId },
        },
        teacher: {
          connect: { id: teacherId },
        },
        assignmentActivities: {
          create: [
            // Phần 1: Ngữ pháp (25 điểm)
            {
              type: 'quiz',
              title: 'Ngữ pháp - Câu hỏi 1-10',
              points: 12.5,
              content: {
                question:
                  'Chọn đáp án đúng: "By the time we arrived, the movie _____ already started."',
                options: ['has', 'had', 'was', 'is'],
                correctIndex: 1,
              },
            },
            {
              type: 'quiz',
              title: 'Ngữ pháp - Câu hỏi 11-20',
              points: 12.5,
              content: {
                question:
                  'Chọn đáp án đúng: "I wish I _____ more time to study."',
                options: ['have', 'had', 'will have', 'would have'],
                correctIndex: 1,
              },
            },
            // Phần 2: Từ vựng (20 điểm)
            {
              type: 'fill_blank',
              title: 'Từ vựng - Điền từ vào chỗ trống',
              points: 20,
              content: {
                passage:
                  'Complete the following passage: "Technology has _____ our lives in many ways. It has made communication faster and more _____. However, it has also created new challenges such as _____ addiction and privacy concerns."',
                blanks: ['transformed', 'efficient', 'digital'],
              },
            },
            // Phần 3: Đọc hiểu (25 điểm)
            {
              type: 'reading',
              title: 'Đọc hiểu - Bài đọc về giáo dục',
              points: 12.5,
              content: {
                passage: `Online learning has become increasingly popular in recent years, especially after the global pandemic. Many educational institutions have adopted digital platforms to deliver courses and connect with students remotely.

While online learning offers flexibility and convenience, it also presents unique challenges. Students must be self-motivated and disciplined to succeed in an online environment. Technical issues can also disrupt the learning process, and the lack of face-to-face interaction may affect student engagement.

Despite these challenges, online learning has proven to be an effective alternative to traditional classroom education. It has made education more accessible to people around the world and has opened up new opportunities for lifelong learning.`,
                questions: [
                  {
                    question:
                      'What has made online learning more popular recently?',
                    options: [
                      'Lower costs',
                      'The global pandemic',
                      'Better technology',
                      'More qualified teachers',
                    ],
                    correctIndex: 1,
                  },
                ],
              },
            },
            {
              type: 'reading',
              title: 'Đọc hiểu - Bài đọc về công nghệ',
              points: 12.5,
              content: {
                passage: `Artificial Intelligence (AI) is revolutionizing various industries, from healthcare to finance. Machine learning algorithms can analyze vast amounts of data to identify patterns and make predictions that would be impossible for humans to process manually.

In healthcare, AI is being used to diagnose diseases, develop new treatments, and improve patient care. In finance, it helps detect fraud and make investment decisions. However, the rapid advancement of AI also raises concerns about job displacement and ethical implications.

As AI continues to evolve, it is crucial to ensure that its development is guided by ethical principles and that its benefits are distributed fairly across society.`,
                questions: [
                  {
                    question:
                      'What is one concern about AI mentioned in the passage?',
                    options: [
                      'High costs',
                      'Job displacement',
                      'Slow development',
                      'Limited applications',
                    ],
                    correctIndex: 1,
                  },
                ],
              },
            },
            // Phần 4: Nghe hiểu (15 điểm)
            {
              type: 'listening',
              title: 'Nghe hiểu - Bài thuyết trình về môi trường',
              points: 15,
              content: {
                audioUrl: '/audio/final-listening-sample.mp3', // Placeholder URL
                questions: [
                  {
                    question: 'What is the main topic of the presentation?',
                    options: [
                      'Climate change solutions',
                      'Economic development',
                      'Social media trends',
                      'Space exploration',
                    ],
                    correctIndex: 0,
                  },
                ],
              },
            },
            // Phần 5: Viết (15 điểm)
            {
              type: 'writing',
              title: 'Viết - Đoạn văn về tương lai',
              points: 15,
              content: {
                prompt:
                  'Write a paragraph (150-200 words) about your vision for the future. Discuss what you hope to achieve in the next 10 years and how you plan to reach your goals.',
                minWords: 150,
              },
            },
          ],
        },
      },
    });

    this.logger.log(
      `Created final exam: ${finalExam.id} for session ${sessionNumber} (index ${sessionIndex})`,
    );
  }
}
