import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

// Output path
const outDir = path.join(process.cwd(), 'temp-uploads');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'family_course_import.xlsx');

// Course meta sheet (must be named 'Courses')
const courses = [
  {
    code: 'FAMILY-001',
    title: 'Gia đình - Family Course',
    description: 'Khóa học tiếng Anh chủ đề Gia đình, mỗi lesson chứa đầy đủ 8 activity chuẩn để thử import.',
    orderNo: 200,
    difficulty: 'beginner',
    language: 'en',
    price: 0,
    isPublished: true,
    tags: 'family|basic|conversation',
    imageUrl: 'https://example.com/family.jpg',
    instructorId: ''
  }
];

// Activity template generator per lesson
function buildLessonRows(lessonNo: number, title: string, estimatedTime = 20) {
  const base: any[] = [];
  // Lesson header row
  base.push({ lessonNo, lessonTitle: title, lessonDescription: `${title} - practice all skills`, lessonEstimatedTime: estimatedTime, lessonObjectives: 'Vocabulary|Listening|Speaking|Reading|Writing|Grammar|Pronunciation|Quiz' });

  // 8 activities: vocab, quiz, listening, pronunciation, speaking, reading, writing, grammar
  base.push({ lessonNo, activityNo: 1, activityType: 'vocab', activityTitle: 'Vocab: family members', word: 'mother', definition: 'Your female parent', examples: 'My mother is kind|Her mother cooks well' });
  base.push({ lessonNo, activityNo: 2, activityType: 'quiz', activityTitle: 'Quiz: family vocab', question: 'Who is your father?', options: 'mother|father|sister', correctIndex: 1, explanation: 'father is male parent' });
  base.push({ lessonNo, activityNo: 3, activityType: 'listening', activityTitle: 'Listening: family dialogue', audioUrl: '', prompt: 'What relation do they have?', options: 'siblings|parents|friends', correctIndex: 1 });
  base.push({ lessonNo, activityNo: 4, activityType: 'pronunciation', activityTitle: 'Pronunciation: sibling', phrase: 'sibling', hints: 'stress on first syllable' });
  base.push({ lessonNo, activityNo: 5, activityType: 'speaking', activityTitle: 'Speaking: introduce your family', prompt: 'Talk about your family for 60 seconds', minSeconds: 45 });
  base.push({ lessonNo, activityNo: 6, activityType: 'reading', activityTitle: 'Reading: family story', passage: 'This is the Nguyen family. They live together and help each other.', question: 'Who lives together?', options: 'The family|The neighbors|The friends', correctIndex: 0 });
  base.push({ lessonNo, activityNo: 7, activityType: 'writing', activityTitle: 'Writing: letter to a family member', prompt: 'Write a short letter to a family member thanking them', minWords: 50 });
  base.push({ lessonNo, activityNo: 8, activityType: 'grammar', activityTitle: 'Grammar: possessive nouns', rule: 'Use apostrophe-s for possessive: Mother\'s book', question: 'Which shows possession?', options: "mothers book|mother's book|mother book", correctIndex: 1 });

  return base;
}

// Build multiple lessons (e.g., 5 lessons)
const rows: any[] = [];
const lessonTitles = [
  'Family Members & Roles',
  'Daily Routines at Home',
  'Celebrations & Traditions',
  'Home Description & Rooms',
  'Relationships & Feelings'
];

lessonTitles.forEach((t, idx) => {
  const lessonNo = idx + 1;
  const lessonRows = buildLessonRows(lessonNo, t, 15 + idx * 5);
  rows.push(...lessonRows);
});

// Build workbook and sheets
const wb = XLSX.utils.book_new();
const wsCourses = XLSX.utils.json_to_sheet(courses);
XLSX.utils.book_append_sheet(wb, wsCourses, 'Courses');

const wsContent = XLSX.utils.json_to_sheet(rows);
XLSX.utils.book_append_sheet(wb, wsContent, 'FAMILY-001');

// Write file
XLSX.writeFile(wb, outFile);
console.log('Family course Excel generated at:', outFile);
