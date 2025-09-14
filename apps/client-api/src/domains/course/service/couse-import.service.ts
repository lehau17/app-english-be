// src/modules/courses/courses-import.service.ts
import { PrismaRepository } from '@app/database';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ActivityType, DifficultyLevel, LanguageCode, UserRole } from '@prisma/client';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { GoogleTranslateFreeService } from '../../google-translate/google-translate.service';
import { ImportCoursesDto } from '../dto';

type CourseMetaRow = {
  code: string;
  title: string;
  description?: string;
  orderNo?: number | string;
  difficulty?: string; // beginner...
  language?: string;   // en/vi...
  price?: number | string;
  isPublished?: boolean | string;
  tags?: string;       // tag1,tag2
  imageUrl?: string;
  instructorId?: string;
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
  hints?: string;       // "h1|h2"
  mediaUrls?: string;   // "u1,u2"
  contentJson?: string; // JSON ưu tiên

  // gợi ý theo type:
  question?: string;
  options?: string;       // "A|B|C"
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
};

@Injectable()
export class CoursesImportService {
  constructor(
    private readonly prisma: PrismaRepository,
    private readonly googleTranslateFreeService: GoogleTranslateFreeService
  ) {}

  async importFromExcel(dto: ImportCoursesDto) {
    let res: ArrayBuffer;

    if (dto.url) {
      // Import từ URL
      res = (await axios.get<ArrayBuffer>(dto.url, { responseType: 'arraybuffer' })).data;
    } else if ((dto as any).buffer) {
      // Import từ buffer (cho multiple files)
      res = (dto as any).buffer;
    } else {
      throw new BadRequestException('Cần cung cấp url hoặc buffer');
    }

    const wb = XLSX.read(Buffer.from(res), { type: 'buffer' });
    if (wb.SheetNames.length === 0) throw new BadRequestException('Excel rỗng');

    const coursesSheet = wb.SheetNames.find((n) => n.toLowerCase() === 'courses');
    if (!coursesSheet) throw new BadRequestException('Thiếu sheet "Courses"');

    const metaRows = XLSX.utils.sheet_to_json<CourseMetaRow>(wb.Sheets[coursesSheet], { defval: '' });
    if (!metaRows.length) throw new BadRequestException('Sheet Courses không có dữ liệu');

    const errors: string[] = [];
    const results: any[] = [];
    const actions: (() => Promise<void>)[] = [];

    for (let i = 0; i < metaRows.length; i++) {
      const m = this.normalizeMeta(metaRows[i]);
      if (!m.code) errors.push(`Courses row ${i + 2}: thiếu code`);
      if (!m.title) errors.push(`Courses row ${i + 2}: thiếu title`);
      const instructorId = m.instructorId || dto.defaultInstructorId;
      if (!instructorId) errors.push(`Courses row ${i + 2}: thiếu instructorId (hoặc defaultInstructorId)`);

      // Chỉ check role TEACHER nếu instructorId đến từ Excel file (không phải default)
      const isFromExcel = !!m.instructorId;
      const instructor = instructorId
        ? await this.prisma.user.findUnique({ where: { id: instructorId } })
        : null;
      if (instructorId && !instructor) {
        errors.push(`Courses row ${i + 2}: instructorId không hợp lệ`);
      } else if (instructorId && isFromExcel && instructor.role !== UserRole.teacher) {
        errors.push(`Courses row ${i + 2}: instructorId không phải TEACHER`);
      }
    }
    if (errors.length) throw new BadRequestException(errors.join('; '));

    // build per course
    for (const mRaw of metaRows) {
      const m = this.normalizeMeta(mRaw);
      const sheetName =
        wb.SheetNames.find((n) => n.trim() === m.code) ||
        wb.SheetNames.find((n) => n.trim().toLowerCase() === `${m.code}`.toLowerCase());
      const rows: CourseContentRow[] = sheetName
        ? XLSX.utils.sheet_to_json<CourseContentRow>(wb.Sheets[sheetName], { defval: '' })
        : [];

      const lessons = await this.rowsToLessons(rows);
      const totals = this.computeTotals(lessons);

      const preview = {
        code: m.code,
        title: m.title,
        lessons: lessons.length,
        activities: totals.activities,
        rows: rows.length,
      };

      if (dto.dryRun) {
        results.push(preview);
      } else {
        actions.push(async () => {
          // business rule: orderNo unique (nếu có)
          if (m.orderNo != null) {
            const same = await this.prisma.course.findFirst({ where: { orderNo: m.orderNo } });
            if (same && !(dto.upsert && dto.matchBy === 'orderNo')) {
              throw new ConflictException(`orderNo ${m.orderNo} đã dùng cho khóa khác`);
            }
          }

          // upsert theo matchBy
          let existing = null as any;
          if (dto.upsert) {
            if (dto.matchBy === 'orderNo' && m.orderNo != null) {
              existing = await this.prisma.course.findFirst({ where: { orderNo: m.orderNo } });
            } else {
              existing = await this.prisma.course.findFirst({ where: { title: m.title } });
            }
          }

          if (existing) {
            // xoá lessons/activities cũ rồi tạo lại cho đơn giản (hoặc patch nếu muốn)
            await this.prisma.lesson.deleteMany({ where: { courseId: existing.id } });

            await this.prisma.course.update({
              where: { id: existing.id },
              data: {
                title: m.title,
                description: m.description,
                orderNo: m.orderNo ?? existing.orderNo,
                difficulty: m.difficulty,
                imageUrl: m.imageUrl,
                tags: m.tags,
                instructor: { connect: { id: m.instructorId || dto.defaultInstructorId! } },
                price: m.price ?? 0,
                language: m.language,
                isPublished: dto.publish ?? m.isPublished ?? false,
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
            });

            results.push({ ...preview, updated: 'yes' });
          } else {
            const created = await this.prisma.course.create({
              data: {
                title: m.title,
                description: m.description,
                orderNo: m.orderNo ?? undefined,
                difficulty: m.difficulty,
                imageUrl: m.imageUrl,
                tags: m.tags,
                instructor: { connect: { id: m.instructorId || dto.defaultInstructorId! } },
                price: m.price ?? 0,
                language: m.language,
                isPublished: dto.publish ?? m.isPublished ?? false,
              },
            });

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

              for (const a of l.activities) {
                await this.prisma.activity.create({
                  data: {
                    lessonId: lesson.id,
                    type: a.type,
                    orderNo: a.orderNo,
                    title: a.title,
                    content: a.content,
                    timeLimit: a.timeLimit ?? null,
                    maxAttempts: a.maxAttempts ?? null,
                    passingScore: a.passingScore ?? null,
                    difficulty: a.difficulty ?? DifficultyLevel.beginner,
                    points: a.points ?? 10,
                    instructions: a.instructions ?? null,
                    hints: a.hints?.length ? a.hints : [],
                    mediaUrls: a.mediaUrls?.length ? a.mediaUrls : [],
                  },
                });
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
      for (const act of actions) await act();
    }

    return {
      dryRun: !!dto.dryRun,
      upsert: !!dto.upsert,
      publish: !!dto.publish,
      matchBy: dto.matchBy ?? 'title',
      totalCourses: metaRows.length,
      results,
    };
  }

  // ==== helpers ====

  private normalizeMeta(r: CourseMetaRow) {
    const diffKey = (String(r.difficulty || 'beginner').trim().toLowerCase() as keyof typeof DifficultyLevel);
    const langKey = (String(r.language || 'en').trim().toLowerCase() as keyof typeof LanguageCode);
    return {
      code: String(r.code || '').trim(),
      title: String(r.title || '').trim(),
      description: String(r.description || '').trim() || undefined,
      orderNo: this.numOrUndef(r.orderNo),
      difficulty: DifficultyLevel[diffKey] ?? DifficultyLevel.beginner,
      language: LanguageCode[langKey] ?? LanguageCode.en,
      price: this.numOrUndef(r.price),
      isPublished: this.boolOrUndef(r.isPublished),
      tags: String(r.tags || '')
        .split(/[|,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      imageUrl: String(r.imageUrl || '').trim() || undefined,
      instructorId: r.instructorId ? String(r.instructorId).trim() : undefined,
    };
  }

  private async rowsToLessons(rows: CourseContentRow[]) {
    const cleaned = rows
      .map((r) => ({
        lessonNo: this.numOrZero(r.lessonNo),
        lessonTitle: (r.lessonTitle ?? '').toString().trim(),
        lessonDescription: (r.lessonDescription ?? '').toString().trim() || undefined,
        lessonDifficulty: (r.lessonDifficulty ?? '').toString().toLowerCase() || 'beginner',
        lessonEstimatedTime: this.numOrUndef(r.lessonEstimatedTime),
        lessonIsLocked: this.boolOrUndef(r.lessonIsLocked) ?? true,
        lessonObjectives: this.splitList(r.lessonObjectives),

        activityNo: this.numOrZero(r.activityNo),
        activityType: (r.activityType ?? '').toString().trim().toLowerCase(),
        activityTitle: (r.activityTitle ?? '').toString().trim(),

        timeLimit: this.numOrUndef(r.timeLimit),
        maxAttempts: this.numOrUndef(r.maxAttempts),
        passingScore: this.numOrUndef(r.passingScore),
        activityDifficulty: (r.activityDifficulty ?? '').toString().toLowerCase() || undefined,
        points: this.numOrUndef(r.points),
        instructions: (r.instructions ?? '').toString().trim() || undefined,
        hints: this.splitList(r.hints),
        mediaUrls: this.splitList(r.mediaUrls, /[|,]/),

        contentJson: (r.contentJson ?? '').toString().trim(),

        // per-type helpers
        question: (r.question ?? '').toString().trim(),
        options: this.splitList(r.options),
        correctIndex: this.numOrUndef(r.correctIndex),
        explanation: (r.explanation ?? '').toString().trim() || undefined,

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
      }))
      .sort((a, b) => (a.lessonNo - b.lessonNo) || (a.activityNo - b.activityNo));

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
          difficulty: DifficultyLevel[(row.lessonDifficulty as keyof typeof DifficultyLevel)] ?? DifficultyLevel.beginner,
          estimatedTime: row.lessonEstimatedTime,
          isLocked: row.lessonIsLocked,
          objectives: row.lessonObjectives,
          activities: [],
        };
        lessons.push(lesson);
      }

      if (row.activityNo) {
        const typeKey = (row.activityType as keyof typeof ActivityType) || 'quiz';
        const type = ActivityType[typeKey] ?? ActivityType.quiz;
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
            ? (DifficultyLevel[row.activityDifficulty as keyof typeof DifficultyLevel] ?? DifficultyLevel.beginner)
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

    switch (type) {
      case ActivityType.quiz:
        return {
          question: r.question || '',
          options: r.options?.length ? r.options : ['', ''],
          correctIndex: r.correctIndex ?? 0,
          explanation: r.explanation || '',
        };
      case ActivityType.vocab:
        const vocabContent = {
          word: r.word || '',
          definition: r.definition || '',
          examples: r.examples?.length ? r.examples : [],
          imageUrl: r.imageUrl || null,
          audioUrl: r.audioUrl || null,
        };

        // Tự động tạo audio nếu không có audioUrl và có word
        if (!vocabContent.audioUrl && vocabContent.word) {
          try {
            console.log(`Generating audio for vocab: ${vocabContent.word}`);
            const { url } = await this.googleTranslateFreeService.createAudioWithUrl(vocabContent.word, 'en');
            vocabContent.audioUrl = url;
            console.log(`Audio generated successfully: ${url}`);
          } catch (error) {
            console.error(`Failed to generate audio for vocab "${vocabContent.word}":`, error);
            // Không throw error, tiếp tục với audioUrl = null
          }
        }

        return vocabContent;
      case ActivityType.listening:
        return {
          audioUrl: r.audioUrl || '',
          prompt: r.prompt || '',
          options: r.options?.length ? r.options : ['', ''],
          correctIndex: r.correctIndex ?? 0,
        };
      case ActivityType.pronunciation:
        return { phrase: r.phrase || '', tips: r.hints || [], sampleUrl: r.audioUrl || '' };
      case ActivityType.speaking:
        return { prompt: r.prompt || '', minSeconds: r.minSeconds ?? 15, tips: r.hints || [] };
      case ActivityType.mini_game:
        return { target: r.prompt || '', pool: r.options || [], rounds: r.points ?? 3 };
      case ActivityType.reading:
        return { passage: r.passage || '', question: r.question || '', options: r.options || ['', ''], correctIndex: r.correctIndex ?? 0 };
      case ActivityType.writing:
        return { prompt: r.prompt || '', minWords: r.minWords ?? 40, rubric: r.hints || [] };
      case ActivityType.grammar:
        return { rule: r.rule || '', question: r.question || '', options: r.options || ['', ''], correctIndex: r.correctIndex ?? 0 };
      case ActivityType.flashcard:
        return { cards: [{ front: r.word || '', back: r.definition || '', imageUrl: r.imageUrl || '' }] };
      case ActivityType.conversation:
        return { scenario: r.scenario || '', initialDialog: [{ role: 'assistant', text: r.prompt || '' }], suggestions: r.hints || [] };
      default:
        return {};
    }
  }

  private computeTotals(lessons: Array<{
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
  }>) {
    const estimatedTime = lessons.reduce((s, l) => s + (l.estimatedTime ?? 0), 0);
    const activities = lessons.reduce((s, l) => s + l.activities.length, 0);
    return { estimatedTime, activities };
  }

  private numOrUndef(v: any) { const n = Number(String(v).trim()); return Number.isFinite(n) ? n : undefined; }
  private numOrZero(v: any) { const n = Number(String(v).trim()); return Number.isFinite(n) ? n : 0; }
  private boolOrUndef(v: any) {
    if (v === true || v === false) return v;
    const s = String(v).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(s)) return true;
    if (['false', '0', 'no', 'n'].includes(s)) return false;
    return undefined;
  }
  private splitList(v: any, sep = /[|]/) {
    return String(v || '')
      .split(sep)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /**
   * Import nhiều file Excel cùng lúc
   */
  async importMultipleExcels(files: Express.Multer.File[], dto: Partial<ImportCoursesDto>) {
    const results = [];

    for (const file of files) {
      try {
        // Validate file type
        if (!file.originalname.endsWith('.xlsx') && !file.originalname.endsWith('.xls')) {
          results.push({
            fileName: file.originalname,
            success: false,
            error: 'Chỉ hỗ trợ file .xlsx hoặc .xls'
          });
          continue;
        }

        // Import trực tiếp từ buffer
        const singleDto = { ...dto, buffer: file.buffer } as any;
        const result = await this.importFromExcel(singleDto);

        results.push({
          fileName: file.originalname,
          success: true,
          data: result
        });

      } catch (error) {
        results.push({
          fileName: file.originalname,
          success: false,
          error: error.message || 'Lỗi không xác định'
        });
      }
    }

    return {
      totalFiles: files.length,
      successfulImports: results.filter(r => r.success).length,
      failedImports: results.filter(r => !r.success).length,
      results
    };
  }
}
