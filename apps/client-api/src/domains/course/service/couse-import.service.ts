// src/modules/courses/courses-import.service.ts
import { PrismaRepository } from '@app/database';
import {
  KafkaService,
  Neo4jEntityType,
  Neo4jSyncMessage,
  Neo4jSyncOperation,
} from '@app/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  ActivityType,
  DifficultyLevel,
  LanguageCode,
  UserRole,
} from '@prisma/client';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { CertificateTemplateService } from '../../certificate/services';
import { GoogleTranslateFreeService } from '../../google-translate/google-translate.service';
import { ImportCoursesDto } from '../dto';

type CourseMetaRow = {
  code: string;
  title: string;
  description?: string;
  orderNo?: number | string;
  difficulty?: string; // beginner...
  language?: string; // en/vi...
  price?: number | string;
  isPublished?: boolean | string;
  tags?: string; // tag1,tag2
  imageUrl?: string;
  plannedSessions?: number | string;
};

type CourseContentRow = {
  lessonNo: number | string;
  lessonTitle?: string;
  lessonDescription?: string;
  lessonDifficulty?: string;
  lessonEstimatedTime?: number | string;
  lessonIsLocked?: boolean | string;
  lessonObjectives?: string; // "obj1|obj2"

  activityNo?: number | string;
  activityType?: string;
  activityTitle?: string;
  timeLimit?: number | string;
  maxAttempts?: number | string;
  passingScore?: number | string;
  activityDifficulty?: string;
  points?: number | string;
  instructions?: string;
  hints?: string; // "h1|h2"
  mediaUrls?: string; // "u1,u2"
  contentJson?: string; // JSON ưu tiên

  // gợi ý theo type:
  question?: string;
  options?: string; // "A|B|C"
  correctIndex?: number | string;
  explanation?: string;

  word?: string;
  definition?: string;
  examples?: string; // "ex1|ex2"
  audioUrl?: string;
  imageUrl?: string;

  passage?: string;
  prompt?: string;
  minWords?: number | string;
  minSeconds?: number | string;

  rule?: string;
  phrase?: string;
  scenario?: string;

  // Listening activity specific fields
  listeningAudioUrl?: string;
  listeningInstructions?: string;
  listeningQuestions?: string; // Format: "Question1|options:opt1,opt2,opt3|correctIndex:0|explanation:explain||Question2|options:..."
};

@Injectable()
export class CoursesImportService {
  private readonly logger = new Logger(CoursesImportService.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly googleTranslateFreeService: GoogleTranslateFreeService,
    private readonly kafkaService: KafkaService,
    private readonly certificateTemplateService: CertificateTemplateService,
  ) {}

  async importFromExcel(dto: ImportCoursesDto, currentUserId: string) {
    dto.defaultInstructorId = currentUserId;
    void currentUserId; // reserved for auditing hooks
    let res: ArrayBuffer;

    if (dto.url) {
      // Import từ URL
      res = (
        await axios.get<ArrayBuffer>(dto.url, { responseType: 'arraybuffer' })
      ).data;
    } else if ((dto as any).buffer) {
      // Import từ buffer (cho multiple files)
      res = (dto as any).buffer;
    } else {
      throw new BadRequestException('Cần cung cấp url hoặc buffer');
    }

    const wb = XLSX.read(Buffer.from(res), { type: 'buffer' });
    if (wb.SheetNames.length === 0) throw new BadRequestException('Excel rỗng');

    const coursesSheet = wb.SheetNames.find(
      (n) => n.toLowerCase() === 'course meta',
    );
    if (!coursesSheet)
      throw new BadRequestException('Thiếu sheet "Course Meta"');

    const metaRows = XLSX.utils.sheet_to_json<CourseMetaRow>(
      wb.Sheets[coursesSheet],
      { defval: '' },
    );
    if (!metaRows.length)
      throw new BadRequestException('Sheet Course Meta không có dữ liệu');

    // Find optional Session Schedules sheet
    const schedulesSheetName = wb.SheetNames.find(
      (n) => n.toLowerCase() === 'session schedules',
    );
    // Parse session schedules if sheet exists
    const schedulesRows = schedulesSheetName
      ? XLSX.utils.sheet_to_json(wb.Sheets[schedulesSheetName], { defval: '' })
      : [];

    const errors: string[] = [];
    const results: any[] = [];
    const actions: (() => Promise<void>)[] = [];

    for (let i = 0; i < metaRows.length; i++) {
      const m = this.normalizeMeta(metaRows[i]);
      if (!m.code) errors.push(`Courses row ${i + 2}: thiếu code`);
      if (!m.title) errors.push(`Courses row ${i + 2}: thiếu title`);

      // Validate current user is teacher or admin
      const instructor = await this.prisma.user.findUnique({
        where: { id: dto.defaultInstructorId },
      });
      if (!instructor) {
        errors.push(`Instructor không tồn tại`);
      } else if (
        instructor.role !== UserRole.teacher &&
        instructor.role !== UserRole.admin
      ) {
        errors.push(`Instructor phải có vai trò TEACHER hoặc ADMIN`);
      }
    }
    if (errors.length) throw new BadRequestException(errors.join('; '));

    // A map to store lesson activities for session schedules
    // Structure: Map<courseCode, Map<lessonNo, Map<activityNo, activityId>>>
    const courseActivitiesMap = new Map<
      string,
      Map<string, Map<number, any>>
    >();

    // build per course
    for (const mRaw of metaRows) {
      const m = this.normalizeMeta(mRaw);
      const contentSheetName = wb.SheetNames.find(
        (n) => n.toLowerCase() === 'course content',
      );
      const rows: CourseContentRow[] = contentSheetName
        ? XLSX.utils.sheet_to_json<CourseContentRow>(
            wb.Sheets[contentSheetName],
            {
              defval: '',
            },
          )
        : [];

      const lessons = await this.rowsToLessons(rows);
      const totals = this.computeTotals(lessons);

      // Initialize activities map for this course
      if (!courseActivitiesMap.has(m.code)) {
        courseActivitiesMap.set(m.code, new Map<string, Map<number, any>>());
      }

      const preview = {
        code: m.code,
        title: m.title,
        lessons: lessons.length,
        activities: totals.activities,
        rows: rows.length,
        plannedSessions: m.plannedSessions,
      };

      if (dto.dryRun) {
        results.push(preview);
      } else {
        actions.push(async () => {
          // business rule: orderNo unique (nếu có)
          if (m.orderNo != null) {
            const same = await this.prisma.course.findFirst({
              where: { orderNo: m.orderNo },
            });
            if (same && !(dto.upsert && dto.matchBy === 'orderNo')) {
              throw new ConflictException(
                `orderNo ${m.orderNo} đã dùng cho khóa khác`,
              );
            }
          }

          // upsert theo matchBy
          let existing = null as any;
          if (dto.upsert) {
            if (dto.matchBy === 'orderNo' && m.orderNo != null) {
              existing = await this.prisma.course.findFirst({
                where: { orderNo: m.orderNo },
              });
            } else {
              existing = await this.prisma.course.findFirst({
                where: { title: m.title },
              });
            }
          }

          if (existing) {
            // xoá lessons/activities cũ rồi tạo lại cho đơn giản (hoặc patch nếu muốn)
            await this.prisma.lesson.deleteMany({
              where: { courseId: existing.id },
            });

            // Store the lesson activity IDs for session schedules
            const lessonActivityMap = new Map<string, Map<number, any>>();
            courseActivitiesMap.set(m.code, lessonActivityMap);

            // Update course with basic info
            const updatedCourse = await this.prisma.course.update({
              where: { id: existing.id },
              data: {
                title: m.title,
                description: m.description,
                orderNo: m.orderNo ?? existing.orderNo,
                difficulty: m.difficulty,
                imageUrl: m.imageUrl,
                tags: m.tags,
                instructor: {
                  connect: { id: dto.defaultInstructorId! },
                },
                price: m.price ?? 0,
                language: m.language,
                isPublished: dto.publish ?? m.isPublished ?? false,
                plannedSessions: m.plannedSessions,
                lessons: {
                  create: lessons.map((l) => ({
                    title: l.title,
                    description: l.description ?? null,
                    orderNo: l.orderNo,
                    difficulty: l.difficulty ?? undefined,
                    estimatedTime: l.estimatedTime ?? null,
                    isLocked: l.isLocked ?? true,
                    objectives: l.objectives ?? [],
                    activities: {
                      create: l.activities.map((a) => ({
                        type: a.type,
                        orderNo: a.orderNo,
                        title: a.title,
                        content: a.content, // JSONB
                        timeLimit: a.timeLimit ?? null,
                        maxAttempts: a.maxAttempts ?? null,
                        passingScore: a.passingScore ?? null,
                        difficulty: a.difficulty ?? undefined,
                        points: a.points ?? 10,
                        instructions: a.instructions ?? null,
                        hints: a.hints?.length ? a.hints : [],
                        mediaUrls: a.mediaUrls?.length ? a.mediaUrls : [],
                      })),
                    },
                  })),
                },
                totalLessons: lessons.length,
                totalDuration: totals.estimatedTime,
              },
              include: {
                lessons: {
                  include: {
                    activities: true,
                  },
                },
              },
            });

            // Store activities for session schedule processing
            for (const lesson of updatedCourse.lessons) {
              const lessonNo = String(lesson.orderNo);
              if (!lessonActivityMap.has(lessonNo)) {
                lessonActivityMap.set(lessonNo, new Map<number, any>());
              }

              const activityMap = lessonActivityMap.get(lessonNo)!;
              for (const activity of lesson.activities) {
                activityMap.set(activity.orderNo, activity);
              }
            }

            results.push({ ...preview, updated: 'yes' });
          } else {
            // Store the lesson activity IDs for session schedules
            const lessonActivityMap = new Map<string, Map<number, any>>();
            courseActivitiesMap.set(m.code, lessonActivityMap);

            // Default assignment weights for gradebook calculation
            const defaultWeights = {
              midterm: 0.3,
              final: 0.4,
              tests: 0.2,
              activities: 0.1,
            };

            const created = await this.prisma.course.create({
              data: {
                title: m.title,
                description: m.description,
                orderNo: m.orderNo ?? undefined,
                difficulty: m.difficulty,
                imageUrl: m.imageUrl,
                tags: m.tags,
                instructor: {
                  connect: { id: dto.defaultInstructorId! },
                },
                price: m.price ?? 0,
                language: m.language,
                plannedSessions: m.plannedSessions,
                isPublished: dto.publish ?? m.isPublished ?? false,
                defaultAssignmentWeights: defaultWeights, // Set default weights for auto-assignment creation
              },
            });

            // Create default certificate template for the course
            try {
              await this.certificateTemplateService.createDefaultTemplate(
                created.id,
              );
              this.logger.log(
                `Created certificate template for imported course ${created.id}`,
              );
            } catch (error) {
              // Log error but don't fail the import
              this.logger.warn(
                `Failed to create certificate template for course ${created.id}: ${error.message}`,
              );
            }

            // create lessons & activities
            for (const l of lessons) {
              const lesson = await this.prisma.lesson.create({
                data: {
                  courseId: created.id,
                  title: l.title,
                  description: l.description ?? null,
                  orderNo: l.orderNo,
                  difficulty: l.difficulty ?? DifficultyLevel.beginner,
                  estimatedTime: l.estimatedTime ?? null,
                  isLocked: l.isLocked ?? true,
                  objectives: l.objectives ?? [],
                },
              });

              // Initialize lesson in the activities map
              const lessonNo = String(l.orderNo);
              if (!lessonActivityMap.has(lessonNo)) {
                lessonActivityMap.set(lessonNo, new Map<number, any>());
              }
              const activityMap = lessonActivityMap.get(lessonNo)!;

              for (const a of l.activities) {
                const activity = await this.prisma.activity.create({
                  data: {
                    lessonId: lesson.id,
                    type: a.type,
                    orderNo: a.orderNo,
                    title: a.title,
                    content: a.content,
                    // timeLimit: a.timeLimit ?? null,
                    // maxAttempts: a.maxAttempts ?? null,
                    passingScore: a.passingScore ?? null,
                    difficulty: a.difficulty ?? DifficultyLevel.beginner,
                    points: a.points ?? 10,
                    instructions: a.instructions ?? null,
                    hints: a.hints?.length ? a.hints : [],
                    mediaUrls: a.mediaUrls?.length ? a.mediaUrls : [],
                  },
                });

                // Store activity info for session schedule processing
                activityMap.set(a.orderNo, activity);
              }
            }

            // update totals
            await this.prisma.course.update({
              where: { id: created.id },
              data: {
                totalLessons: lessons.length,
                totalDuration: totals.estimatedTime,
              },
            });

            results.push({ ...preview, created: 'yes' });
          }
        });
      }
    }

    if (!dto.dryRun) {
      // Execute all course creation/update actions
      for (const act of actions) await act();

      // Process session schedules if available
      if (schedulesRows.length > 0) {
        // Process session schedules from the sheet
        const sessionSchedulesByCourse = this.processSessionSchedules(
          schedulesRows,
          courseActivitiesMap,
        );

        // Apply session schedules to courses
        for (const [
          courseCode,
          sessionSchedules,
        ] of sessionSchedulesByCourse.entries()) {
          if (sessionSchedules.length === 0) continue;

          // Find the course by code
          const course = await this.prisma.course.findFirst({
            where: {
              // Use code from Excel as it's a stable identifier across imports
              OR: metaRows
                .filter((row) => String(row.code).trim() === courseCode)
                .map((row) => {
                  const normalizedMeta = this.normalizeMeta(row);
                  return dto.matchBy === 'orderNo' &&
                    normalizedMeta.orderNo != null
                    ? { orderNo: normalizedMeta.orderNo }
                    : { title: normalizedMeta.title };
                }),
            },
          });

          if (course) {
            // Delete existing session schedules first
            await this.prisma.sessionSchedule.deleteMany({
              where: { courseId: course.id },
            });

            // Create new session schedules with nested activities
            for (const schedule of sessionSchedules) {
              await this.prisma.sessionSchedule.create({
                data: {
                  courseId: course.id,
                  sessionNumber: schedule.sessionNumber,
                  title: schedule.title,
                  description: schedule.description,
                  activities: {
                    create: schedule.activities.map((activity: any) => ({
                      activityId: activity.activityId,
                      orderNo: activity.orderNo,
                    })),
                  },
                },
              });
            }
          }
        }
      }

      // Emit Neo4j sync events for all imported/updated courses
      if (!dto.dryRun) {
        for (const result of results) {
          if (result.created === 'yes' || result.updated === 'yes') {
            // Find the course by code or title to get its ID
            const course = await this.prisma.course.findFirst({
              where: {
                OR: [
                  { title: result.title },
                  ...(result.code
                    ? [{ title: { contains: result.code } }]
                    : []),
                ],
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            });

            if (course) {
              const operation =
                result.created === 'yes'
                  ? Neo4jSyncOperation.CREATE
                  : Neo4jSyncOperation.UPDATE;

              this.emitNeo4jSyncEvent(
                operation,
                Neo4jEntityType.COURSE,
                course.id,
              );
            }
          }
        }
      }
    }

    return {
      dryRun: !!dto.dryRun,
      upsert: !!dto.upsert,
      publish: !!dto.publish,
      matchBy: dto.matchBy ?? 'title',
      totalCourses: metaRows.length,
      totalSessionSchedules: schedulesRows.length,
      results,
    };
  }

  // ==== helpers ====

  private normalizeMeta(r: CourseMetaRow) {
    const diffKey = String(r.difficulty || 'beginner')
      .trim()
      .toLowerCase() as keyof typeof DifficultyLevel;
    const langKey = String(r.language || 'en')
      .trim()
      .toLowerCase() as keyof typeof LanguageCode;
    // Generate unique orderNo: timestamp + random number to avoid conflicts
    const orderNo =
      Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);
    return {
      code: String(r.code || '').trim(),
      title: String(r.title || '').trim(),
      description: String(r.description || '').trim() || undefined,
      orderNo: orderNo,
      difficulty: DifficultyLevel[diffKey] ?? DifficultyLevel.beginner,
      language: LanguageCode[langKey] ?? LanguageCode.en,
      price: this.numOrUndef(r.price),
      isPublished: this.boolOrUndef(r.isPublished),
      tags: String(r.tags || '')
        .split(/[|,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      imageUrl: String(r.imageUrl || '').trim() || undefined,
      plannedSessions: this.numOrUndef(r.plannedSessions),
    };
  }

  private async rowsToLessons(rows: CourseContentRow[]) {
    const cleaned = rows
      .map((r) => ({
        lessonNo: this.numOrZero(r.lessonNo),
        lessonTitle: (r.lessonTitle ?? '').toString().trim(),
        lessonDescription:
          (r.lessonDescription ?? '').toString().trim() || undefined,
        lessonDifficulty:
          (r.lessonDifficulty ?? '').toString().toLowerCase() || 'beginner',
        lessonEstimatedTime: this.numOrUndef(r.lessonEstimatedTime),
        lessonIsLocked: this.boolOrUndef(r.lessonIsLocked) ?? true,
        lessonObjectives: this.splitList(r.lessonObjectives),

        activityNo: this.numOrZero(r.activityNo),
        activityType: (r.activityType ?? '').toString().trim().toLowerCase(),
        activityTitle: (r.activityTitle ?? '').toString().trim(),

        timeLimit: this.numOrUndef(r.timeLimit),
        maxAttempts: this.numOrUndef(r.maxAttempts),
        passingScore: this.numOrUndef(r.passingScore),
        activityDifficulty:
          (r.activityDifficulty ?? '').toString().toLowerCase() || undefined,
        points: this.numOrUndef(r.points),
        instructions: (r.instructions ?? '').toString().trim() || undefined,
        hints: this.splitList(r.hints),
        mediaUrls: this.splitList(r.mediaUrls, /[|,]/),

        itemsRaw: (r as any).items != null ? String((r as any).items) : '',
        itemsDefinitionsRaw:
          (r as any).items_definitions != null
            ? String((r as any).items_definitions)
            : '',
        itemsExamplesRaw:
          (r as any).items_examples != null
            ? String((r as any).items_examples)
            : '',
        itemsImageUrlsRaw:
          (r as any).items_imageUrls != null
            ? String((r as any).items_imageUrls)
            : '',
        itemsAudioUrlsRaw:
          (r as any).items_audioUrls != null
            ? String((r as any).items_audioUrls)
            : '',

        contentJson: (r.contentJson ?? '').toString().trim(),

        // per-type helpers
        question: (r.question ?? '').toString().trim(),
        options: (r.options ?? '').toString().trim(), // Keep as string to be processed in buildContent
        correctIndex: this.numOrUndef(r.correctIndex),
        explanation: (r.explanation ?? '').toString().trim() || undefined,

        // fill_blank support: capture blanks column (pipe or comma separated)
        blanks: (r as any).blanks ? String((r as any).blanks) : '',

        word: (r.word ?? '').toString().trim(),
        definition: (r.definition ?? '').toString().trim(),
        examples: this.splitList(r.examples),

        audioUrl: (r.audioUrl ?? '').toString().trim() || undefined,
        imageUrl: (r.imageUrl ?? '').toString().trim() || undefined,

        passage: (r.passage ?? '').toString(),
        prompt: (r.prompt ?? '').toString(),
        minWords: this.numOrUndef(r.minWords),
        minSeconds: this.numOrUndef(r.minSeconds),

        rule: (r.rule ?? '').toString().trim() || undefined,
        phrase: (r.phrase ?? '').toString().trim() || undefined,
        scenario: (r.scenario ?? '').toString().trim() || undefined,

        // Listening activity specific fields
        listeningAudioUrl:
          (r.listeningAudioUrl ?? '').toString().trim() || undefined,
        listeningInstructions:
          (r.listeningInstructions ?? '').toString().trim() || undefined,
        listeningQuestions:
          (r.listeningQuestions ?? '').toString().trim() || undefined,
      }))
      .sort((a, b) => a.lessonNo - b.lessonNo || a.activityNo - b.activityNo);

    // group -> lessons
    const lessons: Array<{
      title: string;
      description?: string;
      orderNo: number;
      difficulty?: DifficultyLevel;
      estimatedTime?: number;
      isLocked?: boolean;
      objectives?: string[];
      activities: Array<{
        type: ActivityType;
        orderNo: number;
        title: string;
        content: any;
        timeLimit?: number;
        maxAttempts?: number;
        passingScore?: number;
        difficulty?: DifficultyLevel;
        points?: number;
        instructions?: string;
        hints?: string[];
        mediaUrls?: string[];
      }>;
    }> = [];

    for (const row of cleaned) {
      if (!row.lessonNo) continue;
      let lesson = lessons.find((l) => l.orderNo === row.lessonNo);
      if (!lesson) {
        lesson = {
          title: row.lessonTitle || `Lesson ${row.lessonNo}`,
          description: row.lessonDescription,
          orderNo: row.lessonNo,
          difficulty:
            DifficultyLevel[
              row.lessonDifficulty as keyof typeof DifficultyLevel
            ] ?? DifficultyLevel.beginner,
          estimatedTime: row.lessonEstimatedTime,
          isLocked: row.lessonIsLocked,
          objectives: row.lessonObjectives,
          activities: [],
        };
        lessons.push(lesson);
      }

      if (row.activityNo) {
        // normalize incoming activity type strings (allow aliases from Excel)
        const rawType = String(row.activityType || '').trim();
        const typeKey = this.normalizeActivityKey(rawType);
        const type = (ActivityType as any)[typeKey] ?? ActivityType.quiz;
        const content = await this.buildContent(type, row);
        lesson.activities.push({
          type,
          orderNo: row.activityNo,
          title: row.activityTitle || `${type} #${row.activityNo}`,
          content,
          timeLimit: row.timeLimit,
          maxAttempts: row.maxAttempts,
          passingScore: row.passingScore,
          difficulty: row.activityDifficulty
            ? (DifficultyLevel[
                row.activityDifficulty as keyof typeof DifficultyLevel
              ] ?? DifficultyLevel.beginner)
            : undefined,
          points: row.points,
          instructions: row.instructions,
          hints: row.hints,
          mediaUrls: row.mediaUrls,
        });
      }
    }

    return lessons;
  }

  private async buildContent(type: ActivityType, r: any) {
    // Nếu có contentJson hợp lệ → ưu tiên
    try {
      if (r.contentJson) {
        const parsed = JSON.parse(r.contentJson);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}

    const typeKey = String(type);
    switch (typeKey) {
      case ActivityType.quiz:
        // Support new multiple questions format
        if (r.quizQuestions) {
          const questions = this.parseQuizQuestions(r.quizQuestions);
          return {
            questions: questions,
          };
        }
        // Fallback to old format for backward compatibility
        return {
          question: r.question || '',
          options: this.splitList(r.options, /[|,]/),
          correctIndex: r.correctIndex ?? 0,
          explanation: r.explanation || '',
        };
      case ActivityType.vocab:
        // Desired shape: { items: [ { word, definition, examples, imageUrl, audioUrl } ] }
        // Priority: contentJson (if contains items) -> items + aligned items_* columns (pipe-separated) -> legacy word column
        try {
          if (r.contentJson) {
            const parsed = JSON.parse(r.contentJson);
            if (
              parsed &&
              typeof parsed === 'object' &&
              Array.isArray(parsed.items)
            ) {
              for (const it of parsed.items) {
                it.examples = Array.isArray(it.examples)
                  ? it.examples
                  : it.examples
                    ? String(it.examples)
                        .split(/[|,]/)
                        .map((s) => s.trim())
                        .filter(Boolean)
                    : [];
              }
              for (const it of parsed.items) {
                if (!it.audioUrl && it.word) {
                  try {
                    const { url } =
                      await this.googleTranslateFreeService.createAudioWithUrl(
                        it.word,
                        'en',
                      );
                    it.audioUrl = url;
                  } catch (e) {
                    console.error(
                      `Failed to generate audio for vocab "${it.word}":`,
                      e,
                    );
                  }
                }
              }
              return parsed;
            }
          }
        } catch {}

        const items: Array<any> = [];

        // If there is an `items` column (pipe-separated words), parse aligned columns
        if (r.itemsRaw) {
          const words = this.splitBySinglePipe(r.itemsRaw);
          const defs = this.splitBySinglePipe(r.itemsDefinitionsRaw);
          const examplesGroups = this.splitBySinglePipe(r.itemsExamplesRaw);
          const images = this.splitBySinglePipe(r.itemsImageUrlsRaw);
          const audios = this.splitBySinglePipe(r.itemsAudioUrlsRaw);

          for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const def = defs[i] || '';
            const examplesRaw = examplesGroups[i] || '';
            const examples = examplesRaw
              ? String(examplesRaw)
                  .split('||')
                  .map((x: string) => x.trim())
                  .filter(Boolean)
              : [];
            const imageUrl = images[i] || null;
            const audioUrl = audios[i] || null;
            items.push({ word, definition: def, examples, imageUrl, audioUrl });
          }
        }

        // legacy single-word column (supports pipe-separated multiple words)
        if (!items.length && r.word) {
          if (typeof r.word === 'string' && r.word.includes('|')) {
            const parts = String(r.word)
              .split(/\|/)
              .map((p) => p.trim())
              .filter(Boolean);
            for (const w of parts) {
              items.push({
                word: w,
                definition: r.definition || '',
                examples: r.examples?.length ? r.examples : [],
                imageUrl: r.imageUrl || null,
                audioUrl: null,
              });
            }
          } else {
            items.push({
              word: r.word || '',
              definition: r.definition || '',
              examples: r.examples?.length ? r.examples : [],
              imageUrl: r.imageUrl || null,
              audioUrl: r.audioUrl || null,
            });
          }
        }

        if (!items.length) {
          throw new BadRequestException(
            `Vocab activity thiếu dữ liệu mục từ (lesson ${r.lessonNo || '?'}, activity ${r.activityNo || '?'})`,
          );
        }

        // Generate audio per item if missing
        for (const it of items) {
          if (!it.audioUrl && it.word) {
            try {
              const { url } =
                await this.googleTranslateFreeService.createAudioWithUrl(
                  it.word,
                  'en',
                );
              it.audioUrl = url;
            } catch (e) {
              console.error(
                `Failed to generate audio for vocab "${it.word}":`,
                e,
              );
            }
          }
        }

        return {
          items,
        };
      case ActivityType.listening:
        // Support new multiple questions format
        if (r.listeningQuestions && r.listeningAudioUrl) {
          const questions = this.parseListeningQuestions(r.listeningQuestions);
          return {
            audioUrl: r.listeningAudioUrl,
            instructions: r.listeningInstructions || undefined,
            questions: questions,
          };
        }
        // Fallback to old format for backward compatibility
        return {
          audioUrl: r.audioUrl || '',
          instructions: r.prompt || '',
          questions: [
            {
              question: r.prompt || '',
              options: r.options?.length ? r.options : ['', ''],
              correctIndex: r.correctIndex ?? 0,
              explanation: r.explanation || undefined,
            },
          ],
        };
      case 'fill_blank':
        // Expect either contentJson with { passage, blanks } or columns: passage, blanks (pipe-separated)
        try {
          if (r.contentJson) {
            const parsed = JSON.parse(r.contentJson);
            if (parsed && typeof parsed === 'object') return parsed;
          }
        } catch {}
        return {
          passage: r.passage || r.question || r.prompt || '',
          // blanks: array of answers for the blanks in order. Accept pipe-separated 'blanks' column
          blanks: this.splitList(r.blanks, /[|,]/),
        };
      case 'dictation':
        // Simple dictation activity shape
        try {
          if (r.contentJson) {
            const parsed = JSON.parse(r.contentJson);
            if (parsed && typeof parsed === 'object') return parsed;
          }
        } catch {}
        return {
          audioUrl: r.audioUrl || '',
          transcript: r.passage || r.prompt || r.question || '',
          minWords: r.minWords ?? 0,
        };
      case 'matching':
        // Expect either contentJson with { pairs: [{left,right}, ...] } or leftItems/rightItems pipe-separated columns
        try {
          if (r.contentJson) {
            const parsed = JSON.parse(r.contentJson);
            if (parsed && typeof parsed === 'object') return parsed;
          }
        } catch {}
        // try leftItems / rightItems
        if (r.leftItems || r.rightItems) {
          const left = String(r.leftItems || '')
            .split(/[|,]/)
            .map((s) => s.trim())
            .filter(Boolean);
          const right = String(r.rightItems || '')
            .split(/[|,]/)
            .map((s) => s.trim())
            .filter(Boolean);
          const pairs: Array<{ left?: string; right?: string }> = [];
          const max = Math.max(left.length, right.length);
          for (let i = 0; i < max; i++)
            pairs.push({ left: left[i] || '', right: right[i] || '' });
          return { pairs };
        }
        // fallback: parse options as pairs separated by :: (e.g. "apple::táo|banana::chuối")
        if (r.options) {
          const parts = this.splitList(r.options, /[|]/);
          const pairs = parts.map((p) => {
            const [l, rgt] = p
              .split(/::|:\s|--|->/)
              .map((x: any) => String(x || '').trim());
            return { left: l || '', right: rgt || '' };
          });
          return { pairs };
        }
        return { pairs: [] };
      case ActivityType.pronunciation:
        return {
          phrase: r.phrase || '',
          tips: r.hints || [],
          sampleUrl: r.audioUrl || '',
        };
      case ActivityType.speaking:
        return {
          prompt: r.prompt || '',
          minSeconds: r.minSeconds ?? 15,
          tips: r.hints || [],
        };
      case ActivityType.mini_game:
        return {
          target: r.prompt || '',
          pool: this.splitList(r.options, /[|,]/),
          rounds: r.points ?? 3,
        };
      case ActivityType.reading:
        // Support new multiple questions format
        if (r.readingQuestions) {
          const questions = this.parseReadingQuestions(r.readingQuestions);
          return {
            passage: r.passage || '',
            questions: questions,
          };
        }
        // Fallback to old format for backward compatibility
        return {
          passage: r.passage || '',
          question: r.question || '',
          options: this.splitList(r.options, /[|,]/),
          correctIndex: r.correctIndex ?? 0,
        };
      case ActivityType.writing:
        return {
          prompt: r.prompt || '',
          minWords: r.minWords ?? 40,
          rubric: r.hints || [],
        };
      case ActivityType.grammar:
        // Support new multiple exercises format
        if (r.grammarExercises) {
          const exercises = this.parseGrammarExercises(r.grammarExercises);
          return {
            rule: r.rule || '',
            exercises: exercises,
          };
        }
        // Fallback to old format for backward compatibility
        return {
          rule: r.rule || '',
          question: r.question || '',
          options: this.splitList(r.options, /[|,]/),
          correctIndex: r.correctIndex ?? 0,
        };
      case ActivityType.flashcard:
        return {
          cards: [
            {
              front: r.word || '',
              back: r.definition || '',
              imageUrl: r.imageUrl || '',
            },
          ],
        };
      case ActivityType.conversation:
        return {
          scenario: r.scenario || '',
          initialDialog: [{ role: 'assistant', text: r.prompt || '' }],
          suggestions: r.hints || [],
        };
      default:
        return {};
    }
  }

  private computeTotals(
    lessons: Array<{
      title: string;
      description?: string;
      orderNo: number;
      difficulty?: DifficultyLevel;
      estimatedTime?: number;
      isLocked?: boolean;
      objectives?: string[];
      activities: Array<{
        type: ActivityType;
        orderNo: number;
        title: string;
        content: any;
        timeLimit?: number;
        maxAttempts?: number;
        passingScore?: number;
        difficulty?: DifficultyLevel;
        points?: number;
        instructions?: string;
        hints?: string[];
        mediaUrls?: string[];
      }>;
    }>,
  ) {
    const estimatedTime = lessons.reduce(
      (s, l) => s + (l.estimatedTime ?? 0),
      0,
    );
    const activities = lessons.reduce((s, l) => s + l.activities.length, 0);
    return { estimatedTime, activities };
  }

  private numOrUndef(v: any) {
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? n : undefined;
  }
  private numOrZero(v: any) {
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? n : 0;
  }
  private boolOrUndef(v: any) {
    if (v === true || v === false) return v;
    const s = String(v).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(s)) return true;
    if (['false', '0', 'no', 'n'].includes(s)) return false;
    return undefined;
  }
  private splitList(v: any, sep = /[|,]/) {
    return String(v || '')
      .split(sep)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private splitBySinglePipe(value: string) {
    return String(value || '')
      .split(/(?<!\|)\|(?!\|)/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /**
   * Parse listening questions from string format:
   * "Question1|options:opt1,opt2,opt3|correctIndex:0|explanation:explain||Question2|options:..."
   * Double pipes (||) separate questions, single pipes (|) separate question properties
   */
  private parseListeningQuestions(questionsStr: string): Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }> {
    if (!questionsStr) return [];

    const questionBlocks = questionsStr
      .split('||')
      .map((block) => block.trim())
      .filter(Boolean);
    const questions = [];

    for (const block of questionBlocks) {
      const parts = block.split('|').map((part) => part.trim());

      let question = '';
      let options: string[] = [];
      let correctIndex = 0;
      let explanation: string | undefined;

      for (const part of parts) {
        if (part.startsWith('options:')) {
          const optionsStr = part.substring(8); // Remove 'options:'
          options = optionsStr
            .split(',')
            .map((opt) => opt.trim())
            .filter(Boolean);
        } else if (part.startsWith('correctIndex:')) {
          const indexStr = part.substring(13); // Remove 'correctIndex:'
          correctIndex = parseInt(indexStr) || 0;
        } else if (part.startsWith('explanation:')) {
          explanation = part.substring(12).trim() || undefined; // Remove 'explanation:'
        } else if (!question && part) {
          // First non-prefixed part is the question
          question = part;
        }
      }

      if (question) {
        questions.push({
          question,
          options: options.length > 0 ? options : ['', ''],
          correctIndex,
          explanation,
        });
      }
    }

    return questions.length > 0
      ? questions
      : [
          {
            question: '',
            options: ['', ''],
            correctIndex: 0,
          },
        ];
  }

  private parseQuizQuestions(questionsStr: string): Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }> {
    if (!questionsStr) return [];

    const questionBlocks = questionsStr
      .split('||')
      .map((block) => block.trim())
      .filter(Boolean);
    const questions = [];

    for (const block of questionBlocks) {
      const parts = block.split('|').map((part) => part.trim());

      let question = '';
      let options: string[] = [];
      let correctIndex = 0;
      let explanation: string | undefined;

      for (const part of parts) {
        if (part.startsWith('options:')) {
          const optionsStr = part.substring(8); // Remove 'options:'
          options = optionsStr
            .split(',')
            .map((opt) => opt.trim())
            .filter(Boolean);
        } else if (part.startsWith('correctIndex:')) {
          const indexStr = part.substring(13); // Remove 'correctIndex:'
          correctIndex = parseInt(indexStr) || 0;
        } else if (part.startsWith('explanation:')) {
          explanation = part.substring(12).trim() || undefined; // Remove 'explanation:'
        } else if (!question && part) {
          // First non-prefixed part is the question
          question = part;
        }
      }

      if (question) {
        questions.push({
          question,
          options: options.length > 0 ? options : ['', ''],
          correctIndex,
          explanation,
        });
      }
    }

    return questions.length > 0
      ? questions
      : [
          {
            question: '',
            options: ['', ''],
            correctIndex: 0,
            explanation: '',
          },
        ];
  }

  private parseReadingQuestions(questionsStr: string): Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }> {
    if (!questionsStr) return [];

    const questionBlocks = questionsStr
      .split('||')
      .map((block) => block.trim())
      .filter(Boolean);
    const questions = [];

    for (const block of questionBlocks) {
      const parts = block.split('|').map((part) => part.trim());

      let question = '';
      let options: string[] = [];
      let correctIndex = 0;
      let explanation: string | undefined;

      for (const part of parts) {
        if (part.startsWith('options:')) {
          const optionsStr = part.substring(8); // Remove 'options:'
          options = optionsStr
            .split(',')
            .map((opt) => opt.trim())
            .filter(Boolean);
        } else if (part.startsWith('correctIndex:')) {
          const indexStr = part.substring(13); // Remove 'correctIndex:'
          correctIndex = parseInt(indexStr) || 0;
        } else if (part.startsWith('explanation:')) {
          explanation = part.substring(12).trim() || undefined; // Remove 'explanation:'
        } else if (!question && part) {
          // First non-prefixed part is the question
          question = part;
        }
      }

      if (question) {
        questions.push({
          question,
          options: options.length > 0 ? options : ['', ''],
          correctIndex,
          explanation,
        });
      }
    }

    return questions.length > 0
      ? questions
      : [
          {
            question: '',
            options: ['', ''],
            correctIndex: 0,
          },
        ];
  }

  private parseGrammarExercises(exercisesStr: string): Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }> {
    if (!exercisesStr) return [];

    const exerciseBlocks = exercisesStr
      .split('||')
      .map((block) => block.trim())
      .filter(Boolean);
    const exercises = [];

    for (const block of exerciseBlocks) {
      const parts = block.split('|').map((part) => part.trim());

      let question = '';
      let options: string[] = [];
      let correctIndex = 0;
      let explanation: string | undefined;

      for (const part of parts) {
        if (part.startsWith('options:')) {
          const optionsStr = part.substring(8); // Remove 'options:'
          options = optionsStr
            .split(',')
            .map((opt) => opt.trim())
            .filter(Boolean);
        } else if (part.startsWith('correctIndex:')) {
          const indexStr = part.substring(13); // Remove 'correctIndex:'
          correctIndex = parseInt(indexStr) || 0;
        } else if (part.startsWith('explanation:')) {
          explanation = part.substring(12).trim() || undefined; // Remove 'explanation:'
        } else if (!question && part) {
          // First non-prefixed part is the question
          question = part;
        }
      }

      if (question) {
        exercises.push({
          question,
          options: options.length > 0 ? options : ['', ''],
          correctIndex,
          explanation,
        });
      }
    }

    return exercises.length > 0
      ? exercises
      : [
          {
            question: '',
            options: ['', ''],
            correctIndex: 0,
          },
        ];
  }

  // Normalize various human-friendly activity type strings from Excel into keys matching ActivityType
  /**
   * Process session schedules from Excel sheet
   * @param schedulesSheet The sheet containing session schedules
   * @param courseActivitiesMap Map of activities by course, lesson and activity number
   * @returns Array of session schedule DTOs grouped by courseCode
   */
  private processSessionSchedules(
    schedulesSheet: any[] | undefined,
    courseActivitiesMap: Map<string, Map<string, Map<number, any>>>,
  ) {
    if (!schedulesSheet || !schedulesSheet.length)
      return new Map<string, any[]>();

    const sessionSchedulesByCourse = new Map<string, any[]>();

    for (const row of schedulesSheet) {
      // Skip empty rows or rows without courseCode or sessionNumber
      if (!row.courseCode || row.sessionNumber == null) continue;

      const courseCode = String(row.courseCode).trim();
      const sessionNumber = this.numOrZero(row.sessionNumber);
      if (!courseCode || !sessionNumber) continue;

      const title = row.title ? String(row.title).trim() : undefined;
      const description = row.description
        ? String(row.description).trim()
        : undefined;

      // Process activity references in format "L1A2,L1A3,L2A1"
      // Where L1A2 means "Lesson 1, Activity 2"
      const activityRefs = String(row.activityRefs || '').trim();
      const activities: Array<{ activityId: string; orderNo: number }> = [];

      if (activityRefs) {
        const refs = activityRefs
          .split(',')
          .map((ref) => ref.trim())
          .filter(Boolean);
        let orderNo = 1;

        // Get the activities map for this course
        const courseActivities = courseActivitiesMap.get(courseCode);
        if (!courseActivities) continue;

        for (const ref of refs) {
          // Parse reference like "L1A2" into lesson=1, activity=2
          const match = ref.match(/L(\d+)A(\d+)/i);
          if (!match) continue;

          const lessonNo = String(match[1]);
          const activityNo = parseInt(match[2], 10);

          // Get the actual activity ID from the map
          const lessonMap = courseActivities.get(lessonNo);
          if (!lessonMap) continue;

          const activity = lessonMap.get(activityNo);
          if (!activity) continue;

          activities.push({
            activityId: activity.id,
            orderNo: orderNo++,
          });
        }
      }

      // Add the session schedule to the map for this course
      if (!sessionSchedulesByCourse.has(courseCode)) {
        sessionSchedulesByCourse.set(courseCode, []);
      }

      sessionSchedulesByCourse.get(courseCode)!.push({
        sessionNumber,
        title,
        description,
        activities,
      });
    }

    return sessionSchedulesByCourse;
  }

  private normalizeActivityKey(raw: string) {
    const s = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, '_');
    // common aliases mapping
    const map: Record<string, string> = {
      fill_blank: 'fill_blank',
      fillinblank: 'fill_blank',
      fill_in_blank: 'fill_blank',
      'fill in the blank': 'fill_blank',
      'fill in blanks': 'fill_blank',
      fill_in_blanks: 'fill_blank',
      dictation: 'dictation',
      dictate: 'dictation',
      matching: 'matching',
      match: 'matching',
      matchings: 'matching',
      // keep known types as-is
      quiz: 'quiz',
      vocab: 'vocab',
      listening: 'listening',
      pronunciation: 'pronunciation',
      speaking: 'speaking',
      mini_game: 'mini_game',
      reading: 'reading',
      writing: 'writing',
      grammar: 'grammar',
      flashcard: 'flashcard',
      conversation: 'conversation',
    };
    // try direct match
    if (map[s]) return map[s];
    // try removing punctuation
    const normalized = s.replace(/[^a-z0-9_]/g, '_');
    if (map[normalized]) return map[normalized];
    // fallback: return raw lowercased token
    return s;
  }

  /**
   * Import nhiều file Excel cùng lúc
   */
  async importMultipleExcels(
    files: Express.Multer.File[],
    dto: Partial<ImportCoursesDto>,
    currentUserId: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Không có file nào được upload');
    }

    if (files.length > 10) {
      throw new BadRequestException('Tối đa 10 file cùng lúc');
    }

    // Process files sequentially and throw BadRequestException immediately on first error
    const results: any[] = [];
    for (const file of files) {
      // Validate file type
      if (
        !file.originalname.endsWith('.xlsx') &&
        !file.originalname.endsWith('.xls')
      ) {
        throw new BadRequestException(
          `File ${file.originalname}: Chỉ hỗ trợ file .xlsx hoặc .xls`,
        );
      }

      try {
        // Import trực tiếp từ buffer
        const singleDto = { ...dto, buffer: file.buffer } as any;
        const result = await this.importFromExcel(singleDto, currentUserId);

        results.push({
          fileName: file.originalname,
          success: true,
          data: result,
        });
      } catch (error) {
        // Immediately throw BadRequestException with the underlying error message
        throw new BadRequestException(
          `File ${file.originalname}: ${error.message || 'Lỗi không xác định'}`,
        );
      }
    }

    return {
      totalFiles: files.length,
      successfulImports: results.length,
      failedImports: 0,
      results,
    };
  }

  /**
   * Download template Excel for course import
   */
  async downloadTemplate() {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Course meta data - Animals theme
    const courseMeta = [
      {
        code: 'ANIMALS_COURSE_001',
        title: 'Learning English Through Animals',
        description:
          'A comprehensive English course using animals as the main theme',
        orderNo: 1,
        difficulty: 'beginner',
        language: 'en',
        price: 0,
        isPublished: false,
        tags: 'english,animals,beginner,vocabulary',
        imageUrl: 'https://example.com/animals-course.jpg',
        plannedSessions: 5, // New field for number of planned sessions
      },
    ];

    // Animals course content - 10 lessons with all activity types
    const courseContent = [];

    const lessons = [
      {
        no: 1,
        title: 'Farm Animals',
        description: 'Learn about common farm animals',
        animals: ['cow', 'pig', 'sheep', 'chicken', 'horse', 'duck'],
        theme: 'farm',
      },
      {
        no: 2,
        title: 'Wild Animals',
        description: 'Discover wild animals in nature',
        animals: ['lion', 'tiger', 'elephant', 'giraffe', 'zebra', 'monkey'],
        theme: 'wild',
      },
      {
        no: 3,
        title: 'Sea Animals',
        description: 'Explore creatures of the ocean',
        animals: ['fish', 'shark', 'whale', 'dolphin', 'octopus', 'turtle'],
        theme: 'sea',
      },
      {
        no: 4,
        title: 'Birds',
        description: 'Learn about different types of birds',
        animals: ['eagle', 'parrot', 'owl', 'penguin', 'swan', 'peacock'],
        theme: 'birds',
      },
      {
        no: 5,
        title: 'Pets',
        description: 'Common household pets',
        animals: ['dog', 'cat', 'rabbit', 'hamster', 'goldfish', 'bird'],
        theme: 'pets',
      },
      {
        no: 6,
        title: 'Insects',
        description: 'Small creatures - insects and bugs',
        animals: ['butterfly', 'bee', 'ant', 'spider', 'ladybug', 'dragonfly'],
        theme: 'insects',
      },
      {
        no: 7,
        title: 'Jungle Animals',
        description: 'Animals living in the jungle',
        animals: ['jaguar', 'toucan', 'sloth', 'anaconda', 'macaw', 'tapir'],
        theme: 'jungle',
      },
      {
        no: 8,
        title: 'Arctic Animals',
        description: 'Animals adapted to cold climates',
        animals: [
          'polar bear',
          'penguin',
          'seal',
          'walrus',
          'arctic fox',
          'reindeer',
        ],
        theme: 'arctic',
      },
      {
        no: 9,
        title: 'Desert Animals',
        description: 'Animals living in desert environments',
        animals: [
          'camel',
          'lizard',
          'scorpion',
          'snake',
          'cactus wren',
          'fennec fox',
        ],
        theme: 'desert',
      },
      {
        no: 10,
        title: 'Extinct Animals',
        description: 'Learning about animals that no longer exist',
        animals: [
          'dinosaur',
          'mammoth',
          'dodo',
          'saber-tooth tiger',
          'pterodactyl',
          'triceratops',
        ],
        theme: 'extinct',
      },
    ];

    // Generate content for each lesson
    lessons.forEach((lesson) => {
      const baseRow = {
        lessonNo: lesson.no,
        lessonTitle: lesson.title,
        lessonDescription: lesson.description,
        lessonDifficulty: 'beginner' as DifficultyLevel,
        lessonEstimatedTime: 45,
        lessonIsLocked: false,
        lessonObjectives: `Learn ${lesson.theme} animal names|Practice pronunciation|Understand animal characteristics`,
      };

      // Activity 1: Vocabulary
      courseContent.push({
        ...baseRow,
        activityNo: 1,
        activityType: 'vocab',
        activityTitle: `${lesson.title} Vocabulary`,
        timeLimit: 15,
        maxAttempts: 3,
        passingScore: 70,
        activityDifficulty: 'beginner',
        points: 15,
        instructions: `Learn the names of ${lesson.theme} animals`,
        hints:
          'Look at the pictures|Listen to pronunciation|Practice saying the words',
        items: lesson.animals.join('|'),
        items_definitions: lesson.animals
          .map((animal) => `A ${animal} is a ${lesson.theme} animal`)
          .join('|'),
        items_examples: lesson.animals
          .map(
            (animal) =>
              `I saw a ${animal} at the ${lesson.theme === 'pets' ? 'pet store' : lesson.theme === 'farm' ? 'farm' : 'zoo'}.||The ${animal} is very ${animal === 'elephant' ? 'big' : animal === 'ant' ? 'small' : 'beautiful'}.`,
          )
          .join('|'),
      });

      // Activity 2: Listening (multiple questions)
      courseContent.push({
        ...baseRow,
        activityNo: 2,
        activityType: 'listening',
        activityTitle: `${lesson.title} Listening`,
        timeLimit: 20,
        maxAttempts: 2,
        passingScore: 80,
        activityDifficulty: 'beginner',
        points: 20,
        instructions:
          'Listen to the audio about animals and answer the questions',
        hints:
          'Listen carefully|Focus on animal names|You can replay the audio',
        listeningAudioUrl: `https://example.com/audio/${lesson.theme}_animals.mp3`,
        listeningInstructions: `Listen to the description of ${lesson.theme} animals and answer the questions`,
        listeningQuestions: `Which animal is mentioned first?|options:${lesson.animals.slice(0, 4).join(',')}|correctIndex:0|explanation:The first animal mentioned is ${lesson.animals[0]}||What sound does a ${lesson.animals[1]} make?|options:Moo,Oink,Woof,Roar|correctIndex:${lesson.animals[1] === 'cow' ? 0 : lesson.animals[1] === 'pig' ? 1 : lesson.animals[1] === 'dog' ? 2 : 3}|explanation:A ${lesson.animals[1]} makes this sound`,
      });

      // Activity 3: Quiz
      courseContent.push({
        ...baseRow,
        activityNo: 3,
        activityType: 'quiz',
        activityTitle: `${lesson.title} Quiz`,
        timeLimit: 10,
        maxAttempts: 2,
        passingScore: 75,
        activityDifficulty: 'beginner',
        points: 15,
        instructions: 'Answer questions about the animals you learned',
        hints: 'Think carefully|Remember the characteristics',
        question: `Which of these is a ${lesson.theme} animal?`,
        options: `${lesson.animals[0]},dog,car,book`,
        correctIndex: 0,
        explanation: `${lesson.animals[0]} is indeed a ${lesson.theme} animal`,
      });

      // Activity 4: Reading
      courseContent.push({
        ...baseRow,
        activityNo: 4,
        activityType: 'reading',
        activityTitle: `${lesson.title} Reading`,
        timeLimit: 15,
        maxAttempts: 2,
        passingScore: 70,
        activityDifficulty: 'beginner',
        points: 20,
        instructions: 'Read the passage and answer the question',
        hints: 'Read carefully|Look for key information',
        passage: `${lesson.animals[0].charAt(0).toUpperCase() + lesson.animals[0].slice(1)}s are amazing ${lesson.theme} animals. They live in ${lesson.theme === 'farm' ? 'farms with farmers' : lesson.theme === 'wild' ? 'the wild nature' : lesson.theme === 'sea' ? 'the ocean' : `${lesson.theme} environments`}. These animals are very ${lesson.animals[0] === 'elephant' ? 'large and intelligent' : lesson.animals[0] === 'ant' ? 'small but strong' : 'interesting'}. Many people enjoy learning about ${lesson.animals[0]}s because they are ${lesson.theme === 'pets' ? 'friendly companions' : lesson.theme === 'wild' ? 'powerful and majestic' : 'fascinating creatures'}.`,
        question: `According to the passage, where do ${lesson.animals[0]}s live?`,
        options: `In the ${lesson.theme === 'farm' ? 'farm' : lesson.theme === 'wild' ? 'wild' : lesson.theme === 'sea' ? 'ocean' : lesson.theme},In space,In the clouds,Underground`,
        correctIndex: 0,
      });

      // Activity 5: Writing
      courseContent.push({
        ...baseRow,
        activityNo: 5,
        activityType: 'writing',
        activityTitle: `${lesson.title} Writing`,
        timeLimit: 20,
        maxAttempts: 1,
        passingScore: 60,
        activityDifficulty: 'beginner',
        points: 25,
        instructions: `Write about your favorite ${lesson.theme} animal`,
        hints:
          'Use complete sentences|Describe the animal|Explain why you like it',
        prompt: `Write a short paragraph (at least 50 words) about your favorite ${lesson.theme} animal. Describe what it looks like, where it lives, and why you like it.`,
        minWords: 50,
      });

      // Activity 6: Grammar
      courseContent.push({
        ...baseRow,
        activityNo: 6,
        activityType: 'grammar',
        activityTitle: `${lesson.title} Grammar`,
        timeLimit: 10,
        maxAttempts: 3,
        passingScore: 75,
        activityDifficulty: 'beginner',
        points: 15,
        instructions: 'Practice grammar with animal sentences',
        hints: 'Think about singular and plural|Use correct articles',
        rule: 'Use "a" or "an" before singular animal names. Use "an" before vowel sounds (a, e, i, o, u).',
        question: `Complete the sentence: "I saw ___ ${lesson.animals[2]} at the zoo."`,
        options: 'a,an,the,some',
        correctIndex: lesson.animals[2].match(/^[aeiou]/) ? 1 : 0,
      });

      // Activity 7: Pronunciation
      courseContent.push({
        ...baseRow,
        activityNo: 7,
        activityType: 'pronunciation',
        activityTitle: `${lesson.title} Pronunciation`,
        timeLimit: 15,
        maxAttempts: 5,
        passingScore: 70,
        activityDifficulty: 'beginner',
        points: 15,
        instructions: 'Practice pronouncing animal names correctly',
        hints: 'Listen to the sample|Speak clearly|Practice multiple times',
        phrase: lesson.animals[0],
        sampleUrl: `https://example.com/pronunciation/${lesson.animals[0]}.mp3`,
      });

      // Activity 8: Fill in the Blank
      courseContent.push({
        ...baseRow,
        activityNo: 8,
        activityType: 'fill_blank',
        activityTitle: `${lesson.title} Fill in the Blanks`,
        timeLimit: 10,
        maxAttempts: 2,
        passingScore: 80,
        activityDifficulty: 'beginner',
        points: 15,
        instructions: 'Complete the sentences with the correct animal names',
        hints: 'Think about the context|Use the animals from this lesson',
        passage: `A ___ is a large ${lesson.theme} animal. The ___ makes a loud sound. Many children love to see a ___ at the zoo.`,
        blanks: `${lesson.animals[0]}|${lesson.animals[1]}|${lesson.animals[2]}`,
      });

      // Activity 9: Matching
      courseContent.push({
        ...baseRow,
        activityNo: 9,
        activityType: 'matching',
        activityTitle: `${lesson.title} Matching`,
        timeLimit: 12,
        maxAttempts: 2,
        passingScore: 75,
        activityDifficulty: 'beginner',
        points: 15,
        instructions: 'Match the animals with their sounds or characteristics',
        hints: 'Think about what you know|Connect related items',
        options: `${lesson.animals[0]}::${lesson.animals[0] === 'cow' ? 'Moo' : lesson.animals[0] === 'dog' ? 'Woof' : lesson.animals[0] === 'cat' ? 'Meow' : 'Roar'}|${lesson.animals[1]}::${lesson.animals[1] === 'pig' ? 'Oink' : lesson.animals[1] === 'horse' ? 'Neigh' : lesson.animals[1] === 'sheep' ? 'Baa' : 'Chirp'}|${lesson.animals[2]}::${lesson.theme === 'farm' ? 'Farm animal' : lesson.theme === 'wild' ? 'Wild animal' : lesson.theme === 'sea' ? 'Sea creature' : lesson.theme.charAt(0).toUpperCase() + lesson.theme.slice(1) + ' animal'}`,
      });

      // Activity 10: Speaking
      courseContent.push({
        ...baseRow,
        activityNo: 10,
        activityType: 'speaking',
        activityTitle: `${lesson.title} Speaking`,
        timeLimit: 30,
        maxAttempts: 3,
        passingScore: 60,
        activityDifficulty: 'beginner',
        points: 20,
        instructions: `Talk about ${lesson.theme} animals for at least 30 seconds`,
        hints:
          'Speak clearly|Use the vocabulary you learned|Describe the animals',
        prompt: `Describe three ${lesson.theme} animals. Talk about what they look like, where they live, and what makes them special. Speak for at least 30 seconds.`,
        minSeconds: 30,
      });
    });

    // Create session schedules example data
    const sessionSchedules = [];

    // Identify the course code
    const courseCode = courseMeta[0].code;

    // Calculate how many activities are in each lesson on average (e.g., 10)
    // For this template, distribute them across 5 sessions (as defined in plannedSessions)

    // Session 1: Farm Animals and Wild Animals (Lessons 1-2)
    sessionSchedules.push({
      courseCode: courseCode,
      sessionNumber: 1,
      title: 'Introduction to Farm and Wild Animals',
      description: 'Learn about animals found on farms and in the wild',
      activityRefs: 'L1A1,L1A2,L1A3,L1A4,L2A1,L2A2',
    });

    // Session 2: Continuing Wild Animals and Sea Animals (Lessons 2-3)
    sessionSchedules.push({
      courseCode: courseCode,
      sessionNumber: 2,
      title: 'Wild and Sea Animals',
      description:
        'Continue learning about wild animals and discover sea creatures',
      activityRefs: 'L2A3,L2A4,L2A5,L3A1,L3A2,L3A3',
    });

    // Session 3: Sea Animals and Birds (Lessons 3-4)
    sessionSchedules.push({
      courseCode: courseCode,
      sessionNumber: 3,
      title: 'Sea Life and Birds',
      description: 'Finish sea creatures and start learning about birds',
      activityRefs: 'L3A4,L3A5,L3A6,L4A1,L4A2,L4A3',
    });

    // Session 4: Birds and Pets (Lessons 4-5)
    sessionSchedules.push({
      courseCode: courseCode,
      sessionNumber: 4,
      title: 'Birds and Household Pets',
      description: 'Continue with birds and learn about common household pets',
      activityRefs: 'L4A4,L4A5,L4A6,L5A1,L5A2,L5A3',
    });

    // Session 5: Pets and Review (Lesson 5)
    sessionSchedules.push({
      courseCode: courseCode,
      sessionNumber: 5,
      title: 'Pet Care and Course Review',
      description: 'Complete pet studies and review everything we learned',
      activityRefs: 'L5A4,L5A5,L5A6,L5A7,L5A8',
    });

    // Create worksheets
    const metaSheet = XLSX.utils.json_to_sheet(courseMeta);
    const contentSheet = XLSX.utils.json_to_sheet(courseContent);
    const schedulesSheet = XLSX.utils.json_to_sheet(sessionSchedules);

    // Add helper notes to the schedules sheet
    XLSX.utils.sheet_add_aoa(
      schedulesSheet,
      [
        [
          'NOTE: activityRefs format is "L<lessonNo>A<activityNo>" to reference activities in Course Content sheet.',
        ],
        [
          'Example: "L1A2,L1A3,L2A1" means Lesson 1 Activity 2, Lesson 1 Activity 3, and Lesson 2 Activity 1.',
        ],
        ['Multiple activities are separated by commas without spaces.'],
      ],
      { origin: { r: sessionSchedules.length + 2, c: 0 } },
    );

    // Add worksheets to workbook
    XLSX.utils.book_append_sheet(workbook, metaSheet, 'Course Meta');
    XLSX.utils.book_append_sheet(workbook, contentSheet, 'Course Content');
    XLSX.utils.book_append_sheet(workbook, schedulesSheet, 'Session Schedules');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      filename: 'animals-course-template.xlsx',
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /**
   * Download TOEIC Basic course template Excel
   */
  async generateToeicBasicTemplate() {
    const workbook = XLSX.utils.book_new();

    const courseMeta = [
      {
        code: 'TOEIC_BASIC_001',
        title: 'TOEIC Cơ Bản - Basic TOEIC Preparation',
        description:
          'Khóa học TOEIC cơ bản giúp học viên làm quen với format bài thi TOEIC, từ vựng và ngữ pháp cơ bản trong môi trường công sở',
        orderNo: 1,
        difficulty: 'beginner',
        language: 'en',
        price: 0,
        isPublished: false,
        tags: 'toeic,english,business,beginner,test-preparation',
        imageUrl: 'https://example.com/toeic-course.jpg',
        plannedSessions: 10,
      },
    ];

    const courseContent: CourseContentRow[] = [];

    const toeicLessons = [
      {
        no: 1,
        title: 'Introduction to TOEIC',
        description:
          'Learn about TOEIC test format, scoring system, and test-taking strategies',
        objectives:
          'Understand TOEIC format|Learn test strategies|Familiarize with question types',
        vocab: [
          'test',
          'score',
          'section',
          'question',
          'answer',
          'time',
          'format',
          'strategy',
        ],
      },
      {
        no: 2,
        title: 'Listening Part 1: Photographs',
        description:
          'Practice describing photographs and identifying key details',
        objectives:
          'Identify people in photos|Describe actions|Recognize objects and locations',
        vocab: [
          'photograph',
          'person',
          'action',
          'object',
          'location',
          'describe',
          'identify',
          'detail',
        ],
      },
      {
        no: 3,
        title: 'Listening Part 2: Question-Response',
        description: 'Master short question-response conversations',
        objectives:
          'Understand questions|Choose appropriate responses|Recognize question types',
        vocab: [
          'question',
          'response',
          'conversation',
          'wh-question',
          'yes-no',
          'suggestion',
          'request',
          'offer',
        ],
      },
      {
        no: 4,
        title: 'Listening Part 3: Conversations',
        description: 'Comprehend longer dialogues between two or more people',
        objectives: 'Follow conversations|Identify speakers|Understand context',
        vocab: [
          'conversation',
          'dialogue',
          'speaker',
          'context',
          'topic',
          'agreement',
          'disagreement',
          'opinion',
        ],
      },
      {
        no: 5,
        title: 'Listening Part 4: Talks',
        description: 'Understand monologues, announcements, and presentations',
        objectives:
          'Listen to announcements|Understand instructions|Follow presentations',
        vocab: [
          'announcement',
          'monologue',
          'presentation',
          'instruction',
          'broadcast',
          'message',
          'notice',
          'information',
        ],
      },
      {
        no: 6,
        title: 'Reading Part 5: Incomplete Sentences',
        description: 'Master grammar and vocabulary in sentence completion',
        objectives:
          'Apply grammar rules|Choose correct vocabulary|Complete sentences accurately',
        vocab: [
          'sentence',
          'grammar',
          'vocabulary',
          'complete',
          'tense',
          'preposition',
          'conjunction',
          'article',
        ],
      },
      {
        no: 7,
        title: 'Reading Part 6: Text Completion',
        description: 'Fill in blanks in business texts and emails',
        objectives:
          'Understand text context|Choose appropriate words|Maintain text coherence',
        vocab: [
          'text',
          'email',
          'memo',
          'letter',
          'blank',
          'coherence',
          'context',
          'appropriate',
        ],
      },
      {
        no: 8,
        title: 'Reading Part 7: Reading Comprehension',
        description:
          'Read and understand business articles, advertisements, and documents',
        objectives:
          'Read for main ideas|Find specific information|Understand inference',
        vocab: [
          'article',
          'advertisement',
          'document',
          'comprehension',
          'main idea',
          'detail',
          'inference',
          'purpose',
        ],
      },
      {
        no: 9,
        title: 'Speaking Practice',
        description: 'Practice TOEIC Speaking test format and tasks',
        objectives:
          'Describe pictures|Express opinions|Respond to questions|Propose solutions',
        vocab: [
          'speaking',
          'pronunciation',
          'fluency',
          'opinion',
          'describe',
          'propose',
          'solution',
          'suggestion',
        ],
      },
      {
        no: 10,
        title: 'Writing Practice',
        description: 'Practice TOEIC Writing test format and tasks',
        objectives:
          'Write sentences|Compose emails|Express ideas clearly|Use correct grammar',
        vocab: [
          'writing',
          'sentence',
          'email',
          'composition',
          'grammar',
          'structure',
          'coherence',
          'clarity',
        ],
      },
    ];

    toeicLessons.forEach((lesson) => {
      const baseRow: Partial<CourseContentRow> = {
        lessonNo: lesson.no,
        lessonTitle: lesson.title,
        lessonDescription: lesson.description,
        lessonDifficulty: 'beginner',
        lessonEstimatedTime: 60,
        lessonIsLocked: false,
        lessonObjectives: lesson.objectives,
      };

      let activityNo = 1;

      // Activity 1-3: Vocabulary (3 activities)
      for (let i = 0; i < 3; i++) {
        const vocabWords = lesson.vocab.slice(i * 2, (i + 1) * 2 + 1);
        courseContent.push({
          ...baseRow,
          activityNo: activityNo++,
          activityType: 'vocab',
          activityTitle: `${lesson.title} Vocabulary ${i + 1}`,
          timeLimit: 15,
          maxAttempts: 3,
          passingScore: 70,
          activityDifficulty: 'beginner',
          points: 15,
          instructions: `Learn business and workplace vocabulary related to ${lesson.title.toLowerCase()}`,
          hints:
            'Read definitions carefully|Listen to pronunciation|Use words in sentences',
          items: vocabWords.join('|'),
          items_definitions: vocabWords
            .map((word) => {
              const defs: Record<string, string> = {
                test: 'An examination to assess knowledge or ability',
                score: 'A number representing performance on a test',
                photograph: 'A picture taken with a camera',
                question: 'A sentence that asks for information',
                conversation: 'A talk between two or more people',
                announcement: 'A public statement about something',
                sentence: 'A group of words expressing a complete thought',
                email: 'Electronic mail sent over the internet',
                article: 'A piece of writing in a newspaper or magazine',
                speaking: 'The action of expressing thoughts verbally',
              };
              return (
                defs[word] || `A word related to ${lesson.title.toLowerCase()}`
              );
            })
            .join('|'),
          items_examples: vocabWords
            .map((word) => {
              const examples: Record<string, string> = {
                test: 'I need to study for the TOEIC test||The test will be next week',
                score:
                  'My TOEIC score was 850||She got a high score on the exam',
                photograph:
                  'Look at this photograph||The photograph shows a meeting',
                question:
                  'Can you answer this question?||What is your question?',
                conversation:
                  'We had a long conversation||The conversation was interesting',
                announcement:
                  'Listen to the announcement||The announcement was clear',
                sentence: 'Complete this sentence||The sentence is correct',
                email: 'I sent an email yesterday||Check your email',
                article: 'Read this article||The article is informative',
                speaking:
                  'Practice your speaking||Speaking English is important',
              };
              return (
                examples[word] ||
                `Use ${word} in a sentence||${word} is important`
              );
            })
            .join('|'),
        });
      }

      // Activity 4-8: Listening (5 activities)
      for (let i = 0; i < 5; i++) {
        const scenarios = [
          'office meeting',
          'phone call',
          'announcement',
          'presentation',
          'conversation',
        ];
        courseContent.push({
          ...baseRow,
          activityNo: activityNo++,
          activityType: 'listening',
          activityTitle: `${lesson.title} Listening ${i + 1}`,
          timeLimit: 20,
          maxAttempts: 2,
          passingScore: 75,
          activityDifficulty: 'beginner',
          points: 20,
          instructions: `Listen to the ${scenarios[i]} and answer the questions`,
          hints: 'Listen carefully|Focus on key words|You can replay the audio',
          listeningAudioUrl: `https://example.com/audio/toeic_${lesson.no}_${i + 1}.mp3`,
          listeningInstructions: `Listen to the ${scenarios[i]} about ${lesson.title.toLowerCase()} and answer the questions`,
          listeningQuestions: `What is the main topic?|options:${lesson.title},Business,Meeting,Travel|correctIndex:0|explanation:The main topic is ${lesson.title}||Who is speaking?|options:Manager,Teacher,Student,Doctor|correctIndex:0|explanation:The speaker is a manager`,
        });
      }

      // Activity 9-12: Reading (4 activities)
      for (let i = 0; i < 4; i++) {
        const passages = [
          `Welcome to ${lesson.title}. This section will help you understand the key concepts and prepare for the TOEIC test. You will learn important vocabulary and practice various question types.`,
          `In ${lesson.title}, students practice different skills. The exercises are designed to improve your comprehension and test-taking abilities. Regular practice is essential for success.`,
          `The ${lesson.title} section covers important topics that frequently appear on the TOEIC exam. Understanding these topics will help you achieve a better score.`,
          `Practice makes perfect in ${lesson.title}. Complete all exercises and review your answers carefully. This will help you identify areas that need more practice.`,
        ];
        courseContent.push({
          ...baseRow,
          activityNo: activityNo++,
          activityType: 'reading',
          activityTitle: `${lesson.title} Reading ${i + 1}`,
          timeLimit: 15,
          maxAttempts: 2,
          passingScore: 70,
          activityDifficulty: 'beginner',
          points: 20,
          instructions: 'Read the passage and answer the questions',
          hints: 'Read carefully|Look for key information|Check all options',
          passage: passages[i],
          question: `What is the main purpose of ${lesson.title}?`,
          options:
            'To prepare for TOEIC|To learn grammar|To practice writing|To improve speaking',
          correctIndex: 0,
        });
      }

      // Activity 13-15: Grammar (3 activities)
      for (let i = 0; i < 3; i++) {
        const grammarRules = [
          'Use present simple for routines and facts. Use present continuous for actions happening now.',
          'Use past simple for completed actions. Use past continuous for actions in progress in the past.',
          'Use present perfect for actions that started in the past and continue to the present.',
        ];
        courseContent.push({
          ...baseRow,
          activityNo: activityNo++,
          activityType: 'grammar',
          activityTitle: `${lesson.title} Grammar ${i + 1}`,
          timeLimit: 10,
          maxAttempts: 3,
          passingScore: 75,
          activityDifficulty: 'beginner',
          points: 15,
          instructions: 'Complete the sentences with correct grammar',
          hints:
            'Think about tenses|Check subject-verb agreement|Use correct forms',
          rule: grammarRules[i],
          question: `Complete: "I ___ ${lesson.vocab[0]} every day."`,
          options: 'practice,practices,practiced,practicing',
          correctIndex: 0,
        });
      }

      // Activity 16-17: Quiz (2 activities)
      for (let i = 0; i < 2; i++) {
        courseContent.push({
          ...baseRow,
          activityNo: activityNo++,
          activityType: 'quiz',
          activityTitle: `${lesson.title} Quiz ${i + 1}`,
          timeLimit: 10,
          maxAttempts: 2,
          passingScore: 75,
          activityDifficulty: 'beginner',
          points: 15,
          instructions: 'Answer the question about TOEIC',
          hints: 'Think carefully|Review the lesson|Choose the best answer',
          question: `Which is most important for ${lesson.title}?`,
          options:
            'Practice regularly,Memorize words,Read quickly,Speak loudly',
          correctIndex: 0,
          explanation: 'Regular practice is essential for TOEIC success',
        });
      }

      // Activity 18: Fill Blank
      courseContent.push({
        ...baseRow,
        activityNo: activityNo++,
        activityType: 'fill_blank',
        activityTitle: `${lesson.title} Fill in the Blanks`,
        timeLimit: 12,
        maxAttempts: 2,
        passingScore: 80,
        activityDifficulty: 'beginner',
        points: 15,
        instructions: 'Complete the sentences with correct words',
        hints: 'Think about context|Use vocabulary from this lesson',
        passage: `In ${lesson.title}, you will learn about ${lesson.vocab[0]} and ${lesson.vocab[1]}. These are important for the TOEIC ___ . Practice ___ will help you improve.`,
        blanks: `test|regularly`,
      });

      // Activity 19: Speaking
      courseContent.push({
        ...baseRow,
        activityNo: activityNo++,
        activityType: 'speaking',
        activityTitle: `${lesson.title} Speaking Practice`,
        timeLimit: 30,
        maxAttempts: 3,
        passingScore: 60,
        activityDifficulty: 'beginner',
        points: 20,
        instructions: `Speak about ${lesson.title.toLowerCase()} for at least 30 seconds`,
        hints:
          'Speak clearly|Use vocabulary from the lesson|Organize your thoughts',
        prompt: `Describe what you learned about ${lesson.title.toLowerCase()}. Talk about the key concepts and how they relate to the TOEIC test. Speak for at least 30 seconds.`,
        minSeconds: 30,
      });

      // Activity 20: Writing
      courseContent.push({
        ...baseRow,
        activityNo: activityNo++,
        activityType: 'writing',
        activityTitle: `${lesson.title} Writing Practice`,
        timeLimit: 20,
        maxAttempts: 1,
        passingScore: 60,
        activityDifficulty: 'beginner',
        points: 25,
        instructions: `Write about ${lesson.title.toLowerCase()}`,
        hints: 'Use complete sentences|Check grammar|Organize your ideas',
        prompt: `Write a short paragraph (at least 50 words) about ${lesson.title.toLowerCase()}. Explain what you learned and how it helps with TOEIC preparation.`,
        minWords: 50,
      });
    });

    const sessionSchedules = [];
    const courseCode = courseMeta[0].code;

    for (let session = 1; session <= 10; session++) {
      const activities: string[] = [];
      for (let activity = 1; activity <= 20; activity++) {
        activities.push(`L${session}A${activity}`);
      }
      sessionSchedules.push({
        courseCode: courseCode,
        sessionNumber: session,
        title: `Session ${session}: ${toeicLessons[session - 1].title}`,
        description: `Complete all activities for ${toeicLessons[session - 1].title}`,
        activityRefs: activities.join(','),
      });
    }

    const metaSheet = XLSX.utils.json_to_sheet(courseMeta);
    const contentSheet = XLSX.utils.json_to_sheet(courseContent);
    const schedulesSheet = XLSX.utils.json_to_sheet(sessionSchedules);

    XLSX.utils.sheet_add_aoa(
      schedulesSheet,
      [
        [
          'NOTE: activityRefs format is "L<lessonNo>A<activityNo>" to reference activities in Course Content sheet.',
        ],
        [
          'Example: "L1A2,L1A3,L2A1" means Lesson 1 Activity 2, Lesson 1 Activity 3, and Lesson 2 Activity 1.',
        ],
        ['Multiple activities are separated by commas without spaces.'],
      ],
      { origin: { r: sessionSchedules.length + 2, c: 0 } },
    );

    XLSX.utils.book_append_sheet(workbook, metaSheet, 'Course Meta');
    XLSX.utils.book_append_sheet(workbook, contentSheet, 'Course Content');
    XLSX.utils.book_append_sheet(workbook, schedulesSheet, 'Session Schedules');

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    return {
      buffer,
      filename: 'toeic-basic-course-template.xlsx',
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /**
   * Download TOEIC Intermediate course template Excel
   */
  async generateToeicIntermediateTemplate() {
    const workbook = XLSX.utils.book_new();

    const courseMeta = [
      {
        code: 'TOEIC_INTERMEDIATE_001',
        title: 'TOEIC Trung Cấp - Intermediate TOEIC Preparation',
        description:
          'Khóa học TOEIC trung cấp giúp học viên nâng cao kỹ năng làm bài thi TOEIC với từ vựng và ngữ pháp ở mức trung cấp trong môi trường công sở chuyên nghiệp',
        orderNo: 1,
        difficulty: 'intermediate',
        language: 'en',
        price: 0,
        isPublished: false,
        tags: 'toeic,english,business,intermediate,test-preparation',
        imageUrl: 'https://example.com/toeic-intermediate-course.jpg',
        plannedSessions: 10,
      },
    ];

    const courseContent: CourseContentRow[] = [];

    const toeicLessons = [
      {
        no: 1,
        title: 'Advanced TOEIC Strategies',
        description:
          'Master advanced test-taking strategies and time management for TOEIC',
        objectives:
          'Apply advanced strategies|Manage time effectively|Analyze question patterns',
        vocab: [
          'strategy',
          'technique',
          'approach',
          'methodology',
          'analysis',
          'efficiency',
          'optimization',
          'proficiency',
        ],
      },
      {
        no: 2,
        title: 'Listening Part 1: Complex Photographs',
        description:
          'Analyze complex photographs with multiple elements and subtle details',
        objectives:
          'Identify complex scenes|Analyze relationships|Recognize subtle details',
        vocab: [
          'complexity',
          'analysis',
          'relationship',
          'interaction',
          'environment',
          'perspective',
          'composition',
          'context',
        ],
      },
      {
        no: 3,
        title: 'Listening Part 2: Advanced Question-Response',
        description:
          'Master sophisticated question-response patterns and indirect answers',
        objectives:
          'Understand indirect responses|Recognize implications|Identify tone and intent',
        vocab: [
          'implication',
          'indirect',
          'nuance',
          'subtext',
          'inference',
          'interpretation',
          'contextual',
          'sophisticated',
        ],
      },
      {
        no: 4,
        title: 'Listening Part 3: Complex Conversations',
        description:
          'Comprehend multi-speaker conversations with overlapping topics and opinions',
        objectives:
          'Follow multi-threaded discussions|Distinguish viewpoints|Track topic shifts',
        vocab: [
          'discussion',
          'viewpoint',
          'perspective',
          'argument',
          'debate',
          'consensus',
          'disagreement',
          'negotiation',
        ],
      },
      {
        no: 5,
        title: 'Listening Part 4: Professional Talks',
        description:
          'Understand professional presentations, reports, and detailed announcements',
        objectives:
          'Comprehend technical content|Extract key information|Follow structured presentations',
        vocab: [
          'presentation',
          'report',
          'analysis',
          'evaluation',
          'recommendation',
          'proposal',
          'executive',
          'professional',
        ],
      },
      {
        no: 6,
        title: 'Reading Part 5: Advanced Grammar',
        description:
          'Master complex grammatical structures and advanced vocabulary in context',
        objectives:
          'Apply complex grammar|Use advanced vocabulary|Understand subtle distinctions',
        vocab: [
          'grammar',
          'structure',
          'syntax',
          'morphology',
          'semantics',
          'distinction',
          'precision',
          'sophistication',
        ],
      },
      {
        no: 7,
        title: 'Reading Part 6: Professional Text Completion',
        description:
          'Complete complex business documents with advanced vocabulary and structures',
        objectives:
          'Maintain coherence|Use appropriate register|Apply advanced vocabulary',
        vocab: [
          'coherence',
          'register',
          'formality',
          'professionalism',
          'documentation',
          'correspondence',
          'communication',
          'articulation',
        ],
      },
      {
        no: 8,
        title: 'Reading Part 7: Complex Comprehension',
        description:
          'Analyze complex business texts, reports, and multi-part documents',
        objectives:
          'Analyze complex texts|Synthesize information|Make inferences|Evaluate arguments',
        vocab: [
          'analysis',
          'synthesis',
          'evaluation',
          'inference',
          'argument',
          'evidence',
          'conclusion',
          'interpretation',
        ],
      },
      {
        no: 9,
        title: 'Advanced Speaking Practice',
        description:
          'Practice sophisticated speaking tasks with complex scenarios and opinions',
        objectives:
          'Express complex ideas|Articulate opinions|Present arguments|Propose solutions',
        vocab: [
          'articulation',
          'expression',
          'presentation',
          'persuasion',
          'argumentation',
          'eloquence',
          'fluency',
          'sophistication',
        ],
      },
      {
        no: 10,
        title: 'Advanced Writing Practice',
        description:
          'Compose professional emails, reports, and business documents',
        objectives:
          'Write professionally|Structure complex texts|Use advanced vocabulary|Maintain coherence',
        vocab: [
          'composition',
          'structure',
          'organization',
          'coherence',
          'sophistication',
          'professionalism',
          'articulation',
          'precision',
        ],
      },
    ];

    toeicLessons.forEach((lesson) => {
      const baseRow: Partial<CourseContentRow> = {
        lessonNo: lesson.no,
        lessonTitle: lesson.title,
        lessonDescription: lesson.description,
        lessonDifficulty: 'intermediate',
        lessonEstimatedTime: 75,
        lessonIsLocked: false,
        lessonObjectives: lesson.objectives,
      };

      let activityNo = 1;

      // Activity 1-3: Vocabulary (3 activities)
      for (let i = 0; i < 3; i++) {
        const vocabWords = lesson.vocab.slice(i * 2, (i + 1) * 2 + 1);
        courseContent.push({
          ...baseRow,
          activityNo: activityNo++,
          activityType: 'vocab',
          activityTitle: `${lesson.title} Vocabulary ${i + 1}`,
          timeLimit: 18,
          maxAttempts: 3,
          passingScore: 80,
          activityDifficulty: 'intermediate',
          points: 18,
          instructions: `Learn intermediate business and professional vocabulary related to ${lesson.title.toLowerCase()}`,
          hints:
            'Study definitions carefully|Understand context|Use words in professional settings',
          items: vocabWords.join('|'),
          items_definitions: vocabWords
            .map((word) => {
              const defs: Record<string, string> = {
                strategy:
                  'A plan of action designed to achieve a long-term goal',
                technique: 'A way of carrying out a particular task',
                complexity: 'The state of being intricate or complicated',
                implication: 'A conclusion that can be drawn from something',
                discussion: 'The action or process of talking about something',
                presentation:
                  'A speech or talk in which a new product or idea is described',
                grammar: 'The whole system and structure of a language',
                coherence: 'The quality of being logical and consistent',
                analysis:
                  'Detailed examination of the elements or structure of something',
                articulation:
                  'The formation of clear and distinct sounds in speech',
              };
              return (
                defs[word] ||
                `An intermediate-level term related to ${lesson.title.toLowerCase()}`
              );
            })
            .join('|'),
          items_examples: vocabWords
            .map((word) => {
              const examples: Record<string, string> = {
                strategy:
                  'Our company developed a new marketing strategy||The strategy proved successful',
                technique:
                  'She mastered the technique of negotiation||This technique is widely used',
                complexity:
                  'The complexity of the issue requires careful analysis||We understand the complexity',
                implication:
                  'The implications are significant||Consider the implications carefully',
                discussion:
                  'We had a productive discussion||The discussion lasted two hours',
                presentation:
                  'The presentation was well-received||Prepare your presentation',
                grammar: 'Advanced grammar is essential||Study grammar rules',
                coherence:
                  'Maintain coherence in your writing||The text lacks coherence',
                analysis:
                  'Conduct a thorough analysis||The analysis revealed important findings',
                articulation:
                  'Work on your articulation||Clear articulation is important',
              };
              return (
                examples[word] ||
                `Use ${word} in a professional context||${word} is crucial for success`
              );
            })
            .join('|'),
        });
      }

      // Activity 4-8: Listening (5 activities)
      for (let i = 0; i < 5; i++) {
        const scenarios = [
          'executive meeting',
          'client consultation',
          'board presentation',
          'strategic planning session',
          'professional conference',
        ];
        courseContent.push({
          ...baseRow,
          activityNo: activityNo++,
          activityType: 'listening',
          activityTitle: `${lesson.title} Listening ${i + 1}`,
          timeLimit: 25,
          maxAttempts: 2,
          passingScore: 80,
          activityDifficulty: 'intermediate',
          points: 22,
          instructions: `Listen to the ${scenarios[i]} and answer the questions`,
          hints:
            'Listen for key details|Focus on context|Identify main points and implications',
          listeningAudioUrl: `https://example.com/audio/toeic_intermediate_${lesson.no}_${i + 1}.mp3`,
          listeningInstructions: `Listen to the ${scenarios[i]} about ${lesson.title.toLowerCase()} and answer the questions`,
          listeningQuestions: `What is the primary concern?|options:Strategy,Budget,Timeline,Quality|correctIndex:0|explanation:The primary concern relates to strategic planning||What action will be taken?|options:Review,Implement,Postpone,Delegate|correctIndex:1|explanation:The action involves implementation`,
        });
      }

      // Activity 9-12: Reading (4 activities)
      for (let i = 0; i < 4; i++) {
        const passages = [
          `Welcome to ${lesson.title}. This advanced section focuses on developing sophisticated skills necessary for achieving high TOEIC scores. You will engage with complex business scenarios and professional communication patterns that reflect real-world workplace situations.`,
          `In ${lesson.title}, students work with intermediate-level content that challenges their comprehension and analytical abilities. The exercises are designed to build confidence in handling professional English across various business contexts.`,
          `The ${lesson.title} module addresses critical competencies required for professional success. Through systematic practice, you will enhance your ability to understand nuanced communication and sophisticated business terminology.`,
          `Mastery of ${lesson.title} requires consistent practice and attention to detail. The activities in this section will help you develop the precision and sophistication needed to excel in professional English communication.`,
        ];
        courseContent.push({
          ...baseRow,
          activityNo: activityNo++,
          activityType: 'reading',
          activityTitle: `${lesson.title} Reading ${i + 1}`,
          timeLimit: 20,
          maxAttempts: 2,
          passingScore: 80,
          activityDifficulty: 'intermediate',
          points: 22,
          instructions: 'Read the passage carefully and answer the questions',
          hints:
            'Read for main ideas and details|Analyze the context|Consider implications',
          passage: passages[i],
          question: `What is the main focus of ${lesson.title}?`,
          options:
            'Professional communication skills|Basic vocabulary|Simple grammar|Casual conversation',
          correctIndex: 0,
        });
      }

      // Activity 13-15: Grammar (3 activities)
      for (let i = 0; i < 3; i++) {
        const grammarRules = [
          'Use complex conditional structures (third conditional, mixed conditionals) for hypothetical situations and past consequences.',
          'Master passive voice in various tenses and modal verbs for professional communication and formal writing.',
          'Apply advanced relative clauses, reduced relative clauses, and complex sentence structures for sophisticated expression.',
        ];
        courseContent.push({
          ...baseRow,
          activityNo: activityNo++,
          activityType: 'grammar',
          activityTitle: `${lesson.title} Grammar ${i + 1}`,
          timeLimit: 12,
          maxAttempts: 3,
          passingScore: 80,
          activityDifficulty: 'intermediate',
          points: 18,
          instructions: 'Complete the sentences with correct advanced grammar',
          hints:
            'Consider complex structures|Check verb forms|Apply advanced rules',
          rule: grammarRules[i],
          question: `Complete: "If we ___ ${lesson.vocab[0]} earlier, we would have achieved better results."`,
          options: 'had implemented,implemented,would implement,implement',
          correctIndex: 0,
        });
      }

      // Activity 16-17: Quiz (2 activities)
      for (let i = 0; i < 2; i++) {
        courseContent.push({
          ...baseRow,
          activityNo: activityNo++,
          activityType: 'quiz',
          activityTitle: `${lesson.title} Quiz ${i + 1}`,
          timeLimit: 12,
          maxAttempts: 2,
          passingScore: 80,
          activityDifficulty: 'intermediate',
          points: 18,
          instructions: 'Answer the question about TOEIC intermediate level',
          hints:
            'Think critically|Apply advanced knowledge|Choose the best answer',
          question: `Which is most critical for ${lesson.title}?`,
          options:
            'Advanced comprehension and analysis,Basic memorization,Simple repetition,Surface understanding',
          correctIndex: 0,
          explanation:
            'Advanced comprehension and analysis are essential for intermediate TOEIC success',
        });
      }

      // Activity 18: Fill Blank
      courseContent.push({
        ...baseRow,
        activityNo: activityNo++,
        activityType: 'fill_blank',
        activityTitle: `${lesson.title} Fill in the Blanks`,
        timeLimit: 15,
        maxAttempts: 2,
        passingScore: 85,
        activityDifficulty: 'intermediate',
        points: 18,
        instructions:
          'Complete the sentences with appropriate intermediate-level words',
        hints: 'Consider context and register|Use professional vocabulary',
        passage: `In ${lesson.title}, you will develop ${lesson.vocab[0]} and ${lesson.vocab[1]} skills. These competencies are essential for professional ___ and effective ___ in business environments.`,
        blanks: `communication|interaction`,
      });

      // Activity 19: Speaking
      courseContent.push({
        ...baseRow,
        activityNo: activityNo++,
        activityType: 'speaking',
        activityTitle: `${lesson.title} Speaking Practice`,
        timeLimit: 45,
        maxAttempts: 3,
        passingScore: 70,
        activityDifficulty: 'intermediate',
        points: 25,
        instructions: `Speak about ${lesson.title.toLowerCase()} for at least 45 seconds`,
        hints:
          'Speak clearly and professionally|Use advanced vocabulary|Structure your response',
        prompt: `Discuss what you learned about ${lesson.title.toLowerCase()}. Explain the key concepts, their applications in professional settings, and how they contribute to TOEIC success. Speak for at least 45 seconds.`,
        minSeconds: 45,
      });

      // Activity 20: Writing
      courseContent.push({
        ...baseRow,
        activityNo: activityNo++,
        activityType: 'writing',
        activityTitle: `${lesson.title} Writing Practice`,
        timeLimit: 25,
        maxAttempts: 1,
        passingScore: 70,
        activityDifficulty: 'intermediate',
        points: 30,
        instructions: `Write professionally about ${lesson.title.toLowerCase()}`,
        hints:
          'Use advanced vocabulary|Maintain professional tone|Structure your writing clearly',
        prompt: `Write a professional paragraph (at least 100 words) about ${lesson.title.toLowerCase()}. Discuss the importance of these skills in business communication and how they enhance TOEIC performance.`,
        minWords: 100,
      });
    });

    const sessionSchedules = [];
    const courseCode = courseMeta[0].code;

    for (let session = 1; session <= 10; session++) {
      const activities: string[] = [];
      for (let activity = 1; activity <= 20; activity++) {
        activities.push(`L${session}A${activity}`);
      }
      sessionSchedules.push({
        courseCode: courseCode,
        sessionNumber: session,
        title: `Session ${session}: ${toeicLessons[session - 1].title}`,
        description: `Complete all activities for ${toeicLessons[session - 1].title}`,
        activityRefs: activities.join(','),
      });
    }

    const metaSheet = XLSX.utils.json_to_sheet(courseMeta);
    const contentSheet = XLSX.utils.json_to_sheet(courseContent);
    const schedulesSheet = XLSX.utils.json_to_sheet(sessionSchedules);

    XLSX.utils.sheet_add_aoa(
      schedulesSheet,
      [
        [
          'NOTE: activityRefs format is "L<lessonNo>A<activityNo>" to reference activities in Course Content sheet.',
        ],
        [
          'Example: "L1A2,L1A3,L2A1" means Lesson 1 Activity 2, Lesson 1 Activity 3, and Lesson 2 Activity 1.',
        ],
        ['Multiple activities are separated by commas without spaces.'],
      ],
      { origin: { r: sessionSchedules.length + 2, c: 0 } },
    );

    XLSX.utils.book_append_sheet(workbook, metaSheet, 'Course Meta');
    XLSX.utils.book_append_sheet(workbook, contentSheet, 'Course Content');
    XLSX.utils.book_append_sheet(workbook, schedulesSheet, 'Session Schedules');

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    return {
      buffer,
      filename: 'toeic-intermediate-course-template.xlsx',
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /**
   * Download TOEIC Advanced course template Excel
   */
  async generateToeicAdvancedTemplate() {
    const workbook = XLSX.utils.book_new();

    const courseMeta = [
      {
        code: 'TOEIC_ADVANCED_001',
        title: 'TOEIC Nâng Cao - Advanced TOEIC Preparation',
        description:
          'Khóa học TOEIC nâng cao giúp học viên đạt điểm số cao trong bài thi TOEIC với từ vựng chuyên sâu, ngữ pháp phức tạp và kỹ năng giao tiếp chuyên nghiệp ở mức độ cao cấp',
        orderNo: 1,
        difficulty: 'advanced',
        language: 'en',
        price: 0,
        isPublished: false,
        tags: 'toeic,english,business,advanced,test-preparation',
        imageUrl: 'https://example.com/toeic-advanced-course.jpg',
        plannedSessions: 10,
      },
    ];

    const courseContent: CourseContentRow[] = [];

    const toeicLessons = [
      {
        no: 1,
        title: 'Expert TOEIC Mastery',
        description:
          'Achieve expert-level proficiency with advanced strategies and sophisticated techniques',
        objectives:
          'Master expert strategies|Achieve precision|Excel in all sections|Optimize performance',
        vocab: [
          'mastery',
          'proficiency',
          'expertise',
          'excellence',
          'optimization',
          'precision',
          'sophistication',
          'refinement',
        ],
      },
      {
        no: 2,
        title: 'Listening Part 1: Expert Analysis',
        description:
          'Analyze intricate photographs with expert-level attention to detail and context',
        objectives:
          'Analyze intricate details|Interpret complex scenes|Understand subtle nuances|Make expert inferences',
        vocab: [
          'intricate',
          'nuance',
          'subtlety',
          'interpretation',
          'expertise',
          'discernment',
          'sophistication',
          'refinement',
        ],
      },
      {
        no: 3,
        title: 'Listening Part 2: Sophisticated Responses',
        description:
          'Master highly sophisticated question-response patterns with idiomatic expressions',
        objectives:
          'Understand idiomatic expressions|Recognize sophisticated patterns|Interpret complex responses|Identify advanced implications',
        vocab: [
          'idiomatic',
          'sophistication',
          'implication',
          'interpretation',
          'nuance',
          'subtlety',
          'expertise',
          'refinement',
        ],
      },
      {
        no: 4,
        title: 'Listening Part 3: Complex Multi-Speaker Dialogues',
        description:
          'Comprehend highly complex multi-speaker conversations with overlapping topics and sophisticated arguments',
        objectives:
          'Follow complex arguments|Distinguish subtle viewpoints|Track sophisticated topic shifts|Analyze expert-level discussions',
        vocab: [
          'argument',
          'viewpoint',
          'sophistication',
          'analysis',
          'expertise',
          'discernment',
          'interpretation',
          'refinement',
        ],
      },
      {
        no: 5,
        title: 'Listening Part 4: Executive-Level Talks',
        description:
          'Understand executive presentations, strategic reports, and high-level professional communications',
        objectives:
          'Comprehend executive content|Extract strategic information|Follow sophisticated presentations|Analyze expert communications',
        vocab: [
          'executive',
          'strategic',
          'sophistication',
          'expertise',
          'analysis',
          'refinement',
          'mastery',
          'excellence',
        ],
      },
      {
        no: 6,
        title: 'Reading Part 5: Expert Grammar',
        description:
          'Master highly sophisticated grammatical structures and advanced idiomatic vocabulary',
        objectives:
          'Apply expert grammar|Use idiomatic expressions|Understand subtle distinctions|Achieve precision',
        vocab: [
          'grammar',
          'idiomatic',
          'sophistication',
          'precision',
          'expertise',
          'refinement',
          'mastery',
          'excellence',
        ],
      },
      {
        no: 7,
        title: 'Reading Part 6: Executive Text Completion',
        description:
          'Complete highly sophisticated business documents with expert-level vocabulary and complex structures',
        objectives:
          'Maintain sophisticated coherence|Use executive register|Apply expert vocabulary|Achieve professional excellence',
        vocab: [
          'coherence',
          'register',
          'sophistication',
          'expertise',
          'refinement',
          'mastery',
          'excellence',
          'precision',
        ],
      },
      {
        no: 8,
        title: 'Reading Part 7: Expert-Level Comprehension',
        description:
          'Analyze highly complex business texts, strategic reports, and sophisticated multi-part documents',
        objectives:
          'Analyze expert-level texts|Synthesize complex information|Make sophisticated inferences|Evaluate expert arguments',
        vocab: [
          'analysis',
          'synthesis',
          'evaluation',
          'inference',
          'sophistication',
          'expertise',
          'refinement',
          'mastery',
        ],
      },
      {
        no: 9,
        title: 'Expert Speaking Practice',
        description:
          'Practice expert-level speaking with highly sophisticated scenarios and complex professional opinions',
        objectives:
          'Express expert-level ideas|Articulate sophisticated opinions|Present complex arguments|Propose innovative solutions',
        vocab: [
          'articulation',
          'sophistication',
          'expertise',
          'innovation',
          'refinement',
          'mastery',
          'excellence',
          'precision',
        ],
      },
      {
        no: 10,
        title: 'Expert Writing Practice',
        description:
          'Compose executive-level emails, strategic reports, and sophisticated business documents',
        objectives:
          'Write at expert level|Structure sophisticated texts|Use executive vocabulary|Achieve professional excellence',
        vocab: [
          'composition',
          'sophistication',
          'expertise',
          'refinement',
          'mastery',
          'excellence',
          'precision',
          'articulation',
        ],
      },
    ];

    toeicLessons.forEach((lesson) => {
      const baseRow: Partial<CourseContentRow> = {
        lessonNo: lesson.no,
        lessonTitle: lesson.title,
        lessonDescription: lesson.description,
        lessonDifficulty: 'advanced',
        lessonEstimatedTime: 90,
        lessonIsLocked: false,
        lessonObjectives: lesson.objectives,
      };

      let activityNo = 1;

      // Activity 1-3: Vocabulary (3 activities)
      for (let i = 0; i < 3; i++) {
        const vocabWords = lesson.vocab.slice(i * 2, (i + 1) * 2 + 1);
        courseContent.push({
          ...baseRow,
          activityNo: activityNo++,
          activityType: 'vocab',
          activityTitle: `${lesson.title} Vocabulary ${i + 1}`,
          timeLimit: 20,
          maxAttempts: 3,
          passingScore: 85,
          activityDifficulty: 'advanced',
          points: 20,
          instructions: `Master advanced and idiomatic business vocabulary related to ${lesson.title.toLowerCase()}`,
          hints:
            'Study sophisticated definitions|Understand nuanced contexts|Use words in executive settings',
          items: vocabWords.join('|'),
          items_definitions: vocabWords
            .map((word) => {
              const defs: Record<string, string> = {
                mastery:
                  'Comprehensive knowledge or skill in a subject or accomplishment',
                proficiency: 'A high degree of competence or skill; expertise',
                intricate: 'Very complicated or detailed',
                nuance:
                  'A subtle difference in or shade of meaning, expression, or sound',
                idiomatic:
                  'Using, containing, or denoting expressions that are natural to a native speaker',
                sophistication:
                  'The quality of being sophisticated; refinement',
                expertise: 'Expert skill or knowledge in a particular field',
                refinement:
                  'The process of removing impurities or unwanted elements',
              };
              return (
                defs[word] ||
                `An advanced-level term related to ${lesson.title.toLowerCase()}`
              );
            })
            .join('|'),
          items_examples: vocabWords
            .map((word) => {
              const examples: Record<string, string> = {
                mastery:
                  'She demonstrated complete mastery of the subject||Mastery requires dedication',
                proficiency:
                  'His proficiency in English is exceptional||Achieve high proficiency',
                intricate:
                  'The intricate details require careful analysis||An intricate problem',
                nuance:
                  'Understand the nuance of the expression||Subtle nuances matter',
                idiomatic:
                  'Use idiomatic expressions naturally||Idiomatic language is complex',
                sophistication:
                  'The sophistication of the approach||Demonstrate sophistication',
                expertise: 'Leverage your expertise||Share your expertise',
                refinement:
                  'The refinement of the process||Continuous refinement',
              };
              return (
                examples[word] ||
                `Use ${word} in an executive context||${word} demonstrates excellence`
              );
            })
            .join('|'),
        });
      }

      // Activity 4-8: Listening (5 activities)
      for (let i = 0; i < 5; i++) {
        const scenarios = [
          'board of directors meeting',
          'strategic planning session',
          'executive briefing',
          'high-level negotiation',
          'international conference',
        ];
        courseContent.push({
          ...baseRow,
          activityNo: activityNo++,
          activityType: 'listening',
          activityTitle: `${lesson.title} Listening ${i + 1}`,
          timeLimit: 30,
          maxAttempts: 2,
          passingScore: 85,
          activityDifficulty: 'advanced',
          points: 25,
          instructions: `Listen to the ${scenarios[i]} and answer sophisticated questions`,
          hints:
            'Listen for subtle details|Analyze complex context|Identify sophisticated implications',
          listeningAudioUrl: `https://example.com/audio/toeic_advanced_${lesson.no}_${i + 1}.mp3`,
          listeningInstructions: `Listen to the ${scenarios[i]} about ${lesson.title.toLowerCase()} and answer the questions`,
          listeningQuestions: `What is the underlying strategic concern?|options:Strategic alignment,Operational efficiency,Market positioning,Resource allocation|correctIndex:0|explanation:The concern relates to strategic alignment||What sophisticated approach will be adopted?|options:Comprehensive analysis,Incremental change,Rapid implementation,Delegated responsibility|correctIndex:0|explanation:The approach involves comprehensive analysis`,
        });
      }

      // Activity 9-12: Reading (4 activities)
      for (let i = 0; i < 4; i++) {
        const passages = [
          `Welcome to ${lesson.title}. This expert-level section is designed for professionals seeking to achieve the highest TOEIC scores. You will engage with highly sophisticated business scenarios, executive-level communication patterns, and complex professional contexts that reflect the most demanding workplace situations. Mastery of these advanced skills requires exceptional dedication and precision.`,
          `In ${lesson.title}, students work with advanced-level content that challenges even experienced professionals. The exercises are meticulously designed to build expertise in handling the most sophisticated professional English across diverse executive and strategic business contexts.`,
          `The ${lesson.title} module addresses the most critical competencies required for executive-level professional success. Through rigorous practice with complex materials, you will enhance your ability to understand highly nuanced communication, sophisticated business terminology, and subtle professional implications.`,
          `Achieving mastery in ${lesson.title} requires exceptional commitment, sophisticated analytical skills, and attention to the most subtle details. The activities in this section will help you develop the precision, sophistication, and expertise needed to excel at the highest levels of professional English communication.`,
        ];
        courseContent.push({
          ...baseRow,
          activityNo: activityNo++,
          activityType: 'reading',
          activityTitle: `${lesson.title} Reading ${i + 1}`,
          timeLimit: 25,
          maxAttempts: 2,
          passingScore: 85,
          activityDifficulty: 'advanced',
          points: 25,
          instructions:
            'Read the sophisticated passage carefully and answer expert-level questions',
          hints:
            'Analyze complex ideas|Synthesize information|Evaluate sophisticated arguments|Make expert inferences',
          passage: passages[i],
          question: `What is the primary objective of ${lesson.title}?`,
          options:
            'Achieve expert-level professional communication|Basic vocabulary acquisition|Simple grammar practice|Casual conversation skills',
          correctIndex: 0,
        });
      }

      // Activity 13-15: Grammar (3 activities)
      for (let i = 0; i < 3; i++) {
        const grammarRules = [
          'Master highly sophisticated conditional structures including inverted conditionals, mixed conditionals with complex time relationships, and conditional perfect forms for expert-level expression.',
          'Excel in passive voice transformations across all tenses, advanced modal verb combinations, and sophisticated passive constructions for executive-level professional communication.',
          'Apply expert-level relative clauses, advanced reduced relative clauses, complex appositives, and sophisticated sentence structures including cleft sentences and advanced subordination.',
        ];
        courseContent.push({
          ...baseRow,
          activityNo: activityNo++,
          activityType: 'grammar',
          activityTitle: `${lesson.title} Grammar ${i + 1}`,
          timeLimit: 15,
          maxAttempts: 3,
          passingScore: 85,
          activityDifficulty: 'advanced',
          points: 20,
          instructions: 'Complete sentences with expert-level grammar',
          hints:
            'Apply sophisticated structures|Check complex verb forms|Use expert-level rules',
          rule: grammarRules[i],
          question: `Complete: "Had we ___ ${lesson.vocab[0]} more strategically, we would have achieved exceptional results."`,
          options: 'approached,approach,approaching,would approach',
          correctIndex: 0,
        });
      }

      // Activity 16-17: Quiz (2 activities)
      for (let i = 0; i < 2; i++) {
        courseContent.push({
          ...baseRow,
          activityNo: activityNo++,
          activityType: 'quiz',
          activityTitle: `${lesson.title} Quiz ${i + 1}`,
          timeLimit: 15,
          maxAttempts: 2,
          passingScore: 85,
          activityDifficulty: 'advanced',
          points: 20,
          instructions: 'Answer expert-level questions about TOEIC',
          hints:
            'Apply expert knowledge|Think critically and analytically|Choose the most sophisticated answer',
          question: `Which is most essential for ${lesson.title}?`,
          options:
            'Expert-level comprehension and sophisticated analysis,Basic memorization techniques,Simple repetition methods,Surface-level understanding',
          correctIndex: 0,
          explanation:
            'Expert-level comprehension and sophisticated analysis are fundamental for advanced TOEIC excellence',
        });
      }

      // Activity 18: Fill Blank
      courseContent.push({
        ...baseRow,
        activityNo: activityNo++,
        activityType: 'fill_blank',
        activityTitle: `${lesson.title} Fill in the Blanks`,
        timeLimit: 18,
        maxAttempts: 2,
        passingScore: 90,
        activityDifficulty: 'advanced',
        points: 20,
        instructions:
          'Complete sentences with expert-level vocabulary and sophisticated expressions',
        hints:
          'Consider sophisticated context|Use executive register|Apply expert vocabulary',
        passage: `In ${lesson.title}, you will develop ${lesson.vocab[0]} and ${lesson.vocab[1]} to an expert level. These sophisticated competencies are essential for executive ___ and highly effective ___ in complex business environments.`,
        blanks: `communication|interaction`,
      });

      // Activity 19: Speaking
      courseContent.push({
        ...baseRow,
        activityNo: activityNo++,
        activityType: 'speaking',
        activityTitle: `${lesson.title} Speaking Practice`,
        timeLimit: 60,
        maxAttempts: 3,
        passingScore: 75,
        activityDifficulty: 'advanced',
        points: 30,
        instructions: `Speak about ${lesson.title.toLowerCase()} for at least 60 seconds`,
        hints:
          'Speak with sophistication|Use expert vocabulary|Structure your response professionally',
        prompt: `Provide an expert-level discussion about ${lesson.title.toLowerCase()}. Explain the sophisticated concepts, their strategic applications in executive settings, and how they contribute to achieving exceptional TOEIC performance. Speak for at least 60 seconds.`,
        minSeconds: 60,
      });

      // Activity 20: Writing
      courseContent.push({
        ...baseRow,
        activityNo: activityNo++,
        activityType: 'writing',
        activityTitle: `${lesson.title} Writing Practice`,
        timeLimit: 30,
        maxAttempts: 1,
        passingScore: 75,
        activityDifficulty: 'advanced',
        points: 35,
        instructions: `Write at expert level about ${lesson.title.toLowerCase()}`,
        hints:
          'Use executive vocabulary|Maintain sophisticated tone|Structure with precision',
        prompt: `Write an expert-level professional paragraph (at least 150 words) about ${lesson.title.toLowerCase()}. Discuss the strategic importance of these sophisticated skills in executive communication and how they enable exceptional TOEIC performance.`,
        minWords: 150,
      });
    });

    const sessionSchedules = [];
    const courseCode = courseMeta[0].code;

    for (let session = 1; session <= 10; session++) {
      const activities: string[] = [];
      for (let activity = 1; activity <= 20; activity++) {
        activities.push(`L${session}A${activity}`);
      }
      sessionSchedules.push({
        courseCode: courseCode,
        sessionNumber: session,
        title: `Session ${session}: ${toeicLessons[session - 1].title}`,
        description: `Complete all activities for ${toeicLessons[session - 1].title}`,
        activityRefs: activities.join(','),
      });
    }

    const metaSheet = XLSX.utils.json_to_sheet(courseMeta);
    const contentSheet = XLSX.utils.json_to_sheet(courseContent);
    const schedulesSheet = XLSX.utils.json_to_sheet(sessionSchedules);

    XLSX.utils.sheet_add_aoa(
      schedulesSheet,
      [
        [
          'NOTE: activityRefs format is "L<lessonNo>A<activityNo>" to reference activities in Course Content sheet.',
        ],
        [
          'Example: "L1A2,L1A3,L2A1" means Lesson 1 Activity 2, Lesson 1 Activity 3, and Lesson 2 Activity 1.',
        ],
        ['Multiple activities are separated by commas without spaces.'],
      ],
      { origin: { r: sessionSchedules.length + 2, c: 0 } },
    );

    XLSX.utils.book_append_sheet(workbook, metaSheet, 'Course Meta');
    XLSX.utils.book_append_sheet(workbook, contentSheet, 'Course Content');
    XLSX.utils.book_append_sheet(workbook, schedulesSheet, 'Session Schedules');

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    return {
      buffer,
      filename: 'toeic-advanced-course-template.xlsx',
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /**
   * Emit Neo4j sync event to Kafka
   */
  private emitNeo4jSyncEvent(
    operation: Neo4jSyncOperation,
    entityType: Neo4jEntityType,
    entityId: string,
    metadata?: Record<string, any>,
  ): void {
    try {
      const message: Neo4jSyncMessage = {
        operation,
        entityType,
        entityId,
        taskId: `${entityType}-${operation}-${entityId}-${Date.now()}`,
        timestamp: Date.now(),
        metadata,
      };

      this.kafkaService.send('neo4j-sync', message);

      this.logger.log(
        `Emitted Neo4j sync event: ${operation} ${entityType} ${entityId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit Neo4j sync event: ${error.message}`,
        error.stack,
      );
      // Don't throw error - sync failure shouldn't block the main operation
    }
  }
}
