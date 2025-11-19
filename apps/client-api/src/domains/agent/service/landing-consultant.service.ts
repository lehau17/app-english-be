import { PrismaRepository } from '@app/database';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger } from '@nestjs/common';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { RagTool } from '../tools/rag.tool';
import { SqlTool } from '../tools/sql.tool';
import { RagService } from './rag.service';
import { SqlService } from './sql.service';
import { DynamicStructuredTool } from 'langchain/tools';
import z from 'zod';

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
3. **get_courses**: Lấy danh sách khóa học có sẵn
4. **get_classrooms**: Lấy danh sách lớp học của một khóa học

📋 QUY TẮC:
- Luôn thân thiện, nhiệt tình, chuyên nghiệp
- Trả lời bằng tiếng Việt (trừ khi học viên yêu cầu tiếng Anh)
- Đưa ra thông tin chính xác về khóa học từ database
- Khuyến khích học viên đăng ký nhưng không ép buộc
- Nếu không biết, hãy thừa nhận và đề xuất liên hệ tư vấn viên
- Luôn đề xuất link đăng ký: "/enroll" khi phù hợp

💡 CÁCH TRẢ LỜI:
- Ngắn gọn, rõ ràng, dễ hiểu
- Sử dụng emoji phù hợp (🎓 📚 💡 ✨)
- Cung cấp thông tin cụ thể: giá, lịch học, giáo viên
- Đề xuất các bước tiếp theo: "Bạn có thể đăng ký tại /enroll"
- Tạo cảm giác tin cậy và chuyên nghiệp

📌 VÍ DỤ CÂU HỎI THƯỜNG GẶP:
- "Khóa học nào phù hợp với người mới bắt đầu?"
- "Học phí của khóa học IELTS là bao nhiêu?"
- "Lịch học của lớp buổi tối như thế nào?"
- "Tôi muốn học giao tiếp, khóa nào phù hợp?"
- "Cách đăng ký khóa học như thế nào?"

⚠️ LƯU Ý:
- KHÔNG được tạo tài khoản hoặc xử lý thanh toán
- KHÔNG được thay đổi dữ liệu trong database
- CHỈ tư vấn và cung cấp thông tin
- Luôn hướng dẫn học viên đến trang /enroll để đăng ký
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
                try {
                    const where: any = { isPublished: true };

                    if (level) {
                        where.difficulty = level.toUpperCase();
                    }

                    if (search) {
                        where.OR = [
                            { title: { contains: search, mode: 'insensitive' } },
                            { name: { contains: search, mode: 'insensitive' } },
                        ];
                    }

                    const courses = await this.prisma.course.findMany({
                        where,
                        select: {
                            id: true,
                            title: true,
                            name: true,
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
                            name: course.title || course.name,
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
                } catch (error) {
                    this.logger.error('Error getting courses:', error);
                    return JSON.stringify({
                        success: false,
                        error: 'Không thể lấy danh sách khóa học. Vui lòng thử lại sau.',
                    });
                }
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
                try {
                    const course = await this.prisma.course.findUnique({
                        where: { id: courseId },
                        select: { id: true, title: true, price: true },
                    });

                    if (!course) {
                        return JSON.stringify({
                            success: false,
                            error: 'Không tìm thấy khóa học.',
                        });
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
                } catch (error) {
                    this.logger.error('Error getting classrooms:', error);
                    return JSON.stringify({
                        success: false,
                        error: 'Không thể lấy danh sách lớp học. Vui lòng thử lại sau.',
                    });
                }
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

