// src/modules/courses/courses-import.service.ts
import { PrismaRepository } from '@app/database';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  ActivityType,
  DifficultyLevel,
  LanguageCode,
  UserRole,
} from '@prisma/client';
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
  language?: string; // en/vi...
  price?: number | string;
  isPublished?: boolean | string;
  tags?: string; // tag1,tag2
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
  constructor(
    private readonly prisma: PrismaRepository,
    private readonly googleTranslateFreeService: GoogleTranslateFreeService,
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

    const errors: string[] = [];
    const results: any[] = [];
    const actions: (() => Promise<void>)[] = [];

    for (let i = 0; i < metaRows.length; i++) {
      const m = this.normalizeMeta(metaRows[i]);
      if (!m.code) errors.push(`Courses row ${i + 2}: thiếu code`);
      if (!m.title) errors.push(`Courses row ${i + 2}: thiếu title`);
      const instructorId = m.instructorId || dto.defaultInstructorId;
      if (!instructorId)
        errors.push(
          `Courses row ${i + 2}: thiếu instructorId (hoặc defaultInstructorId)`,
        );

      // Chỉ check role TEACHER nếu instructorId đến từ Excel file (không phải default)
      const isFromExcel = !!m.instructorId;
      const instructor = instructorId
        ? await this.prisma.user.findUnique({ where: { id: instructorId } })
        : null;
      if (instructorId && !instructor) {
        errors.push(`Courses row ${i + 2}: instructorId không hợp lệ`);
      } else if (
        instructorId &&
        isFromExcel &&
        instructor.role !== UserRole.teacher
      ) {
        errors.push(`Courses row ${i + 2}: instructorId không phải TEACHER`);
      }
    }
    if (errors.length) throw new BadRequestException(errors.join('; '));

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

            await this.prisma.course.update({
              where: { id: existing.id },
              data: {
                title: m.title,
                description: m.description,
                orderNo: m.orderNo ?? existing.orderNo,
                difficulty: m.difficulty,
                imageUrl: m.imageUrl,
                tags: m.tags,
                instructor: {
                  connect: { id: m.instructorId || dto.defaultInstructorId! },
                },
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
                instructor: {
                  connect: { id: m.instructorId || dto.defaultInstructorId! },
                },
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
      instructorId: r.instructorId ? String(r.instructorId).trim() : undefined,
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

  // Normalize various human-friendly activity type strings from Excel into keys matching ActivityType
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
        instructorId: '',
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

    // Create worksheets
    const metaSheet = XLSX.utils.json_to_sheet(courseMeta);
    const contentSheet = XLSX.utils.json_to_sheet(courseContent);

    // Add worksheets to workbook
    XLSX.utils.book_append_sheet(workbook, metaSheet, 'Course Meta');
    XLSX.utils.book_append_sheet(workbook, contentSheet, 'Course Content');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      filename: 'animals-course-template.xlsx',
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
