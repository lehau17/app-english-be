import { PrismaRepository } from '@app/database';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger } from '@nestjs/common';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { DynamicStructuredTool } from 'langchain/tools';
import z from 'zod';
import { RagTool } from '../tools/rag.tool';
import { SqlTool } from '../tools/sql.tool';
import { RagService } from './rag.service';
import { SqlService } from './sql.service';

@Injectable()
export class LandingConsultantService {
    private readonly logger = new Logger(LandingConsultantService.name);
    private agent!: AgentExecutor;

    constructor(
        private ragService: RagService,
        private sqlService: SqlService,
        private prisma: PrismaRepository,
    ) {
        void this.initializeAgent();
    }

    private async initializeAgent() {
        try {
            this.logger.log('🎓 Khởi tạo Landing Page Consultant Agent...');

            const llm = new ChatGoogleGenerativeAI({
                model: 'gemini-2.5-flash',
                apiKey: process.env.GEMINI_API_KEY,
                temperature: 0.3, // Slightly higher for more friendly responses
                streaming: true,
            });

            const tools = [
                new RagTool(this.ragService),
                new SqlTool(this.sqlService),
                this.getCoursesTool(),
                this.getClassroomsTool(),
            ];

            const prompt = ChatPromptTemplate.fromMessages([
                [
                    'system',
                    `
Bạn là trợ lý AI tư vấn khóa học chuyên nghiệp của EngliMaster.

🎯 NHIỆM VỤ CHÍNH:
- Tư vấn khóa học phù hợp với nhu cầu học viên
- Giải thích chi tiết về các khóa học, lộ trình học tập
- Hướng dẫn đăng ký khóa học
- Trả lời câu hỏi về học phí, lịch học, giáo viên
- Gợi ý khóa học dựa trên trình độ và mục tiêu
- Tạo động lực và khuyến khích học viên đăng ký

🛠️ CÔNG CỤ CÓ SẴN:
1. **knowledge_search**: Tìm kiếm thông tin về khóa học, chương trình học, quy định
2. **database_query**: Truy vấn thông tin khóa học, lớp học từ database
3. **get_courses**: Lấy danh sách khóa học có sẵn (trả về ID khóa học)
4. **get_classrooms**: Lấy danh sách lớp học của một khóa học

📋 QUY TẮC TRÍCH DẪN LINK:
- **BẮT BUỘC**: Khi giới thiệu khóa học CỤ THỂ, PHẢI dùng format Markdown link
- Format chuẩn: [Đăng ký ngay](/enroll?courseId=COURSE_ID)
- Ví dụ thực tế:
  * Khóa học ID: 45d78980-a98f-469d-8826-e4ac10e96f7d
  * Link: [Đăng ký ngay](/enroll?courseId=45d78980-a98f-469d-8826-e4ac10e96f7d)
- **KHÔNG BAO GIỜ** viết: "tại đây: /enroll" hoặc "tại /enroll"
- **LUÔN LUÔN** viết: "[Đăng ký ngay](/enroll?courseId=xxx)"

💡 CÁCH TRẢ LỜI:
- Ngắn gọn, rõ ràng, dễ hiểu
- Sử dụng emoji phù hợp (🎓 📚 💡 ✨)
- Khi tool get_courses trả về danh sách khóa học, mỗi khóa có trường "id"
- Dùng ID này để tạo link: [Đăng ký ngay](/enroll?courseId=ID_TỪ_TOOL)
- Nếu không có ID cụ thể: [Xem tất cả khóa học](/enroll)

📝 VÍ DỤ RESPONSE ĐÚNG:
User: "Khóa học nào cho người mới?"
Agent gọi get_courses(level="beginner")
Tool trả về: {"courses": [{"id": "abc-123", "name": "Test", "price": 10000}]}
Agent trả lời:
"Chào bạn! 🎓 Mình tìm thấy khóa Test phù hợp với bạn:
- Giá: 10.000 VND
- Trình độ: Sơ cấp

[Đăng ký ngay](/enroll?courseId=abc-123) để bắt đầu học nhé! ✨"

⚠️ LƯU Ý QUAN TRỌNG:
- KHÔNG viết text đơn thuần như "/enroll" hay "tại /enroll"
- PHẢI wrap trong markdown link [text](url)
- PHẢI có courseId trong URL khi giới thiệu khóa học cụ thể
- Tool get_courses luôn trả về trường "id" - hãy sử dụng nó!
`,
                ],
                ['placeholder', '{chat_history}'],
                ['human', '{input}'],
                ['placeholder', '{agent_scratchpad}'],
            ]);

            const agentRunnable = await createToolCallingAgent({
                llm,
                tools,
                prompt,
            });

            this.agent = new AgentExecutor({
                agent: agentRunnable,
                tools,
                verbose: true,
                maxIterations: 5,
                returnIntermediateSteps: true,
            });
            this.logger.log('✅ Landing Consultant Agent initialized successfully');
        } catch (error) {
            this.logger.error('❌ Failed to initialize Landing Consultant Agent:', error);
            throw error;
        }
    }

    /**
     * Tool to get available courses
     */
    private getCoursesTool() {
        return new DynamicStructuredTool({
            name: 'get_courses',
            description: `Lấy danh sách khóa học có sẵn. Trả về: tên khóa học, mô tả, trình độ, giá, thời lượng.`,
            schema: z.object({
                level: z.string().optional().describe('Lọc theo trình độ (beginner, intermediate, advanced)'),
                search: z.string().optional().describe('Tìm kiếm theo tên khóa học'),
            }),
            func: async ({ level, search }) => {
                const where: any = { isPublished: true };

                if (level) {
                    where.difficulty = level.toUpperCase();
                }

                if (search) {
                    where.OR = [
                        { title: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } },
                    ];
                }

                const courses = await this.prisma.course.findMany({
                    where,
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        difficulty: true,
                        price: true,
                        currency: true,
                        plannedSessions: true,
                        estimatedHours: true,
                    },
                    orderBy: { orderNo: 'asc' },
                    take: 20,
                });

                return JSON.stringify({
                    success: true,
                    courses: courses.map((course) => ({
                        id: course.id,
                        name: course.title,
                        description: course.description || '',
                        level: course.difficulty || 'General',
                        price: course.price || 0,
                        currency: course.currency || 'VND',
                        duration: course.plannedSessions
                            ? `${course.plannedSessions} buổi`
                            : course.estimatedHours
                                ? `~${Math.round(course.estimatedHours)} giờ`
                                : 'Theo lộ trình',
                    })),
                    total: courses.length,
                });
            },
        });
    }

    /**
     * Tool to get classrooms for a course
     */
    private getClassroomsTool() {
        return new DynamicStructuredTool({
            name: 'get_classrooms',
            description: `Lấy danh sách lớp học của một khóa học. Trả về: tên lớp, lịch học, giáo viên, số chỗ, giá.`,
            schema: z.object({
                courseId: z.string().describe('ID của khóa học'),
            }),
            func: async ({ courseId }) => {
                const course = await this.prisma.course.findUnique({
                    where: { id: courseId },
                    select: { id: true, title: true, price: true },
                });

                if (!course) {
                    throw new Error('Không tìm thấy khóa học với ID: ' + courseId);
                }

                const classrooms = await this.prisma.classroom.findMany({
                    where: {
                        courseId,
                        isActive: true,
                        status: { in: ['upcoming', 'ongoing'] },
                    },
                    include: {
                        teacher: {
                            select: {
                                displayName: true,
                                firstName: true,
                                lastName: true,
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
                    orderBy: { periodStart: 'asc' },
                });

                const weekDayLabel: Record<string, string> = {
                    mon: 'Thứ 2',
                    tue: 'Thứ 3',
                    wed: 'Thứ 4',
                    thu: 'Thứ 5',
                    fri: 'Thứ 6',
                    sat: 'Thứ 7',
                    sun: 'Chủ nhật',
                };

                return JSON.stringify({
                    success: true,
                    courseName: course.title,
                    classrooms: classrooms.map((classroom) => {
                        const schedule = classroom.slots
                            .map((slot) => {
                                const day = weekDayLabel[slot.dayOfWeek] || slot.dayOfWeek;
                                const startHours = Math.floor(slot.startMinuteOfDay / 60);
                                const startMins = slot.startMinuteOfDay % 60;
                                const endHours = Math.floor(slot.endMinuteOfDay / 60);
                                const endMins = slot.endMinuteOfDay % 60;
                                return `${day} ${startHours.toString().padStart(2, '0')}:${startMins.toString().padStart(2, '0')}-${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
                            })
                            .join(', ');

                        const teacherName =
                            classroom.teacher?.displayName ||
                            `${classroom.teacher?.firstName || ''} ${classroom.teacher?.lastName || ''}`.trim() ||
                            'Chưa có giáo viên';

                        return {
                            id: classroom.id,
                            name: classroom.name,
                            schedule: schedule || 'Lịch học linh hoạt',
                            teacher: teacherName,
                            maxStudents: classroom.maxStudents || 0,
                            currentStudents: classroom.students.length,
                            availableSlots: (classroom.maxStudents || 0) - classroom.students.length,
                            price: course.price || 0,
                            startDate: classroom.periodStart,
                        };
                    }),
                    total: classrooms.length,
                });
            },
        });
    }

    async processQuery(question: string): Promise<{
        answer: string;
        toolsUsed: string[];
        processingTime: number;
        executionSteps?: any[];
    }> {
        try {
            const startTime = Date.now();

            const result = await this.agent.invoke({
                input: question,
            });

            const processingTime = Date.now() - startTime;

            const toolsUsed =
                result.intermediateSteps?.map((step: any) => step.action?.tool) || [];

            return {
                answer: result.output,
                toolsUsed,
                processingTime,
                executionSteps: result.intermediateSteps || [],
            };
        } catch (error) {
            this.logger.error('Error processing consultant query:', error);
            throw error;
        }
    }

    async *streamQuery(question: string): AsyncGenerator<any> {
        try {
            const stream = await this.agent.stream({
                input: question,
            });

            for await (const chunk of stream) {
                yield chunk;
            }
        } catch (error) {
            this.logger.error('Error streaming consultant query:', error);
            throw error;
        }
    }
}

