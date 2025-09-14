import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDailyQuests() {
  console.log('🌱 Seeding daily quests...');

  const quests = [
    {
      text: 'Hoàn thành 5 bài tập từ vựng',
      description: 'Luyện tập từ vựng để cải thiện vốn từ',
      points: 10,
      category: 'vocabulary',
      difficulty: 'beginner',
      targetValue: 5,
      targetType: 'activities'
    },
    {
      text: 'Luyện nghe trong 15 phút',
      description: 'Nghe và làm bài tập nghe để cải thiện kỹ năng',
      points: 15,
      category: 'listening',
      difficulty: 'beginner',
      targetValue: 15,
      targetType: 'time'
    },
    {
      text: 'Hoàn thành 3 bài phát âm',
      description: 'Luyện phát âm để nói tiếng Anh chuẩn hơn',
      points: 12,
      category: 'pronunciation',
      difficulty: 'intermediate',
      targetValue: 3,
      targetType: 'activities'
    },
    {
      text: 'Đọc và trả lời câu hỏi trong 10 phút',
      description: 'Cải thiện kỹ năng đọc hiểu',
      points: 10,
      category: 'reading',
      difficulty: 'beginner',
      targetValue: 10,
      targetType: 'time'
    },
    {
      text: 'Hoàn thành bài tập ngữ pháp',
      description: 'Ôn luyện ngữ pháp cơ bản',
      points: 8,
      category: 'grammar',
      difficulty: 'beginner',
      targetValue: 1,
      targetType: 'activities'
    }
  ];

  for (const quest of quests) {
    await prisma.dailyQuest.upsert({
      where: { id: `quest-${quest.category}` },
      update: quest,
      create: {
        id: `quest-${quest.category}`,
        ...quest
      }
    });
  }

  console.log('✅ Daily quests seeded successfully!');
}

seedDailyQuests()
  .catch((e) => {
    console.error('❌ Error seeding daily quests:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
