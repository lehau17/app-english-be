import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding vocabulary data...')

  // Create IELTS Vocabulary List
  const ielts = await prisma.vocabularyList.create({
    data: {
      title: 'IELTS Essential Vocabulary',
      description:
        'Master 500+ essential words for IELTS exam preparation. Covers all major topics and academic vocabulary.',
      difficulty: 'intermediate',
      category: 'IELTS',
      level: 'B2-C1',
      isPublic: true,
      isOfficial: true,
      language: 'en',
      bannerUrl:
        'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800',
      thumbnailUrl:
        'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400',
    },
  })

  // Unit 1: Environment & Nature
  const envUnit = await prisma.vocabularyUnit.create({
    data: {
      listId: ielts.id,
      title: 'Unit 1: Environment & Nature',
      description: 'Vocabulary related to environmental issues and nature',
      orderIndex: 1,
    },
  })

  const envTerms = [
    {
      word: 'Biodiversity',
      definition:
        'The variety of plant and animal life in a particular habitat',
      pronunciation: 'baɪəʊdaɪˈvɜːsəti',
      partOfSpeech: 'noun',
      ipaUs: '/ˌbaɪoʊdaɪˈvɜːrsəti/',
      ipaUk: '/ˌbaɪəʊdaɪˈvɜːsəti/',
      translationVi: 'Đa dạng sinh học',
      examples: [
        {
          sentence: 'The Amazon rainforest has incredible biodiversity.',
          translation: 'Rừng mưa Amazon có sự đa dạng sinh học đáng kinh ngạc.',
        },
        {
          sentence:
            'Protecting biodiversity is crucial for ecosystem health.',
          translation:
            'Bảo vệ đa dạng sinh học là rất quan trọng cho sức khỏe hệ sinh thái.',
        },
      ],
      synonyms: ['biological diversity', 'variety of life'],
      difficulty: 'intermediate',
      orderIndex: 1,
    },
    {
      word: 'Deforestation',
      definition: 'The action of clearing a wide area of trees',
      pronunciation: 'diːˌfɒrɪˈsteɪʃən',
      partOfSpeech: 'noun',
      ipaUs: '/diːˌfɔːrɪˈsteɪʃən/',
      ipaUk: '/diːˌfɒrɪˈsteɪʃən/',
      translationVi: 'Phá rừng',
      examples: [
        {
          sentence:
            'Deforestation contributes significantly to climate change.',
          translation:
            'Phá rừng góp phần đáng kể vào biến đổi khí hậu.',
        },
        {
          sentence:
            'The government is working to reduce deforestation rates.',
          translation:
            'Chính phủ đang nỗ lực giảm tỷ lệ phá rừng.',
        },
      ],
      synonyms: ['forest clearance', 'logging'],
      antonyms: ['reforestation', 'afforestation'],
      difficulty: 'intermediate',
      orderIndex: 2,
    },
    {
      word: 'Sustainable',
      definition:
        'Able to be maintained at a certain rate or level without depleting resources',
      pronunciation: 'səˈsteɪnəbl',
      partOfSpeech: 'adjective',
      ipaUs: '/səˈsteɪnəbl/',
      ipaUk: '/səˈsteɪnəbl/',
      translationVi: 'Bền vững',
      examples: [
        {
          sentence:
            'We need to develop sustainable energy sources.',
          translation:
            'Chúng ta cần phát triển các nguồn năng lượng bền vững.',
        },
        {
          sentence:
            'Sustainable agriculture protects the environment.',
          translation:
            'Nông nghiệp bền vững bảo vệ môi trường.',
        },
      ],
      synonyms: ['viable', 'maintainable', 'renewable'],
      antonyms: ['unsustainable', 'wasteful'],
      difficulty: 'intermediate',
      orderIndex: 3,
    },
    {
      word: 'Ecosystem',
      definition:
        'A biological community of interacting organisms and their environment',
      pronunciation: 'ˈiːkəʊsɪstəm',
      partOfSpeech: 'noun',
      ipaUs: '/ˈiːkoʊsɪstəm/',
      ipaUk: '/ˈiːkəʊsɪstəm/',
      translationVi: 'Hệ sinh thái',
      examples: [
        {
          sentence: 'Coral reefs are complex marine ecosystems.',
          translation:
            'Rạn san hô là các hệ sinh thái biển phức tạp.',
        },
        {
          sentence:
            'Human activity is disrupting natural ecosystems.',
          translation:
            'Hoạt động của con người đang phá vỡ các hệ sinh thái tự nhiên.',
        },
      ],
      synonyms: ['habitat', 'biome', 'environment'],
      difficulty: 'intermediate',
      orderIndex: 4,
    },
    {
      word: 'Pollution',
      definition:
        'The presence of harmful substances in the environment',
      pronunciation: 'pəˈluːʃən',
      partOfSpeech: 'noun',
      ipaUs: '/pəˈluːʃən/',
      ipaUk: '/pəˈluːʃən/',
      translationVi: 'Ô nhiễm',
      examples: [
        {
          sentence: 'Air pollution is a major health concern in cities.',
          translation:
            'Ô nhiễm không khí là mối quan tâm lớn về sức khỏe ở các thành phố.',
        },
        {
          sentence: 'Plastic pollution threatens marine life.',
          translation: 'Ô nhiễm nhựa đe dọa sinh vật biển.',
        },
      ],
      synonyms: ['contamination', 'impurity'],
      antonyms: ['cleanliness', 'purity'],
      difficulty: 'beginner',
      orderIndex: 5,
    },
  ]

  for (const term of envTerms) {
    await prisma.vocabularyTerm.create({
      data: {
        ...term,
        unitId: envUnit.id,
      },
    })
  }

  // Unit 2: Technology & Innovation
  const techUnit = await prisma.vocabularyUnit.create({
    data: {
      listId: ielts.id,
      title: 'Unit 2: Technology & Innovation',
      description: 'Modern technology and innovation vocabulary',
      orderIndex: 2,
    },
  })

  const techTerms = [
    {
      word: 'Artificial Intelligence',
      definition:
        'The simulation of human intelligence processes by machines',
      pronunciation: 'ˌɑːtɪˈfɪʃəl ɪnˈtelɪdʒəns',
      partOfSpeech: 'noun',
      ipaUs: '/ˌɑːrtɪˈfɪʃəl ɪnˈtelɪdʒəns/',
      ipaUk: '/ˌɑːtɪˈfɪʃəl ɪnˈtelɪdʒəns/',
      translationVi: 'Trí tuệ nhân tạo',
      examples: [
        {
          sentence:
            'Artificial intelligence is transforming many industries.',
          translation:
            'Trí tuệ nhân tạo đang chuyển đổi nhiều ngành công nghiệp.',
        },
      ],
      synonyms: ['AI', 'machine intelligence'],
      difficulty: 'advanced',
      orderIndex: 1,
    },
    {
      word: 'Innovation',
      definition: 'The introduction of new ideas, methods, or products',
      pronunciation: 'ˌɪnəˈveɪʃən',
      partOfSpeech: 'noun',
      ipaUs: '/ˌɪnəˈveɪʃən/',
      ipaUk: '/ˌɪnəˈveɪʃən/',
      translationVi: 'Sự đổi mới',
      examples: [
        {
          sentence: 'Innovation drives economic growth.',
          translation: 'Sự đổi mới thúc đẩy tăng trưởng kinh tế.',
        },
      ],
      synonyms: ['invention', 'breakthrough', 'novelty'],
      difficulty: 'intermediate',
      orderIndex: 2,
    },
  ]

  for (const term of techTerms) {
    await prisma.vocabularyTerm.create({
      data: {
        ...term,
        unitId: techUnit.id,
      },
    })
  }

  // Create TOEIC Vocabulary List
  const toeic = await prisma.vocabularyList.create({
    data: {
      title: 'TOEIC Business Vocabulary',
      description:
        'Essential business English vocabulary for TOEIC test preparation and professional communication.',
      difficulty: 'intermediate',
      category: 'TOEIC',
      level: 'B1-B2',
      isPublic: true,
      isOfficial: true,
      language: 'en',
      bannerUrl:
        'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800',
      thumbnailUrl:
        'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400',
    },
  })

  const businessUnit = await prisma.vocabularyUnit.create({
    data: {
      listId: toeic.id,
      title: 'Unit 1: Office & Workplace',
      description: 'Common workplace and office vocabulary',
      orderIndex: 1,
    },
  })

  const businessTerms = [
    {
      word: 'Colleague',
      definition: 'A person with whom one works in a profession or business',
      pronunciation: 'ˈkɒliːɡ',
      partOfSpeech: 'noun',
      ipaUs: '/ˈkɑːliːɡ/',
      ipaUk: '/ˈkɒliːɡ/',
      translationVi: 'Đồng nghiệp',
      examples: [
        {
          sentence: 'I have a meeting with my colleagues this afternoon.',
          translation: 'Tôi có cuộc họp với đồng nghiệp chiều nay.',
        },
      ],
      synonyms: ['coworker', 'associate', 'partner'],
      difficulty: 'beginner',
      orderIndex: 1,
    },
    {
      word: 'Deadline',
      definition: 'The latest time by which something must be completed',
      pronunciation: 'ˈdedlaɪn',
      partOfSpeech: 'noun',
      ipaUs: '/ˈdedlaɪn/',
      ipaUk: '/ˈdedlaɪn/',
      translationVi: 'Hạn chót',
      examples: [
        {
          sentence: 'The deadline for this project is next Friday.',
          translation: 'Hạn chót cho dự án này là thứ Sáu tuần sau.',
        },
      ],
      synonyms: ['due date', 'time limit'],
      difficulty: 'beginner',
      orderIndex: 2,
    },
    {
      word: 'Efficiency',
      definition:
        'The state of achieving maximum productivity with minimum wasted effort',
      pronunciation: 'ɪˈfɪʃənsi',
      partOfSpeech: 'noun',
      ipaUs: '/ɪˈfɪʃənsi/',
      ipaUk: '/ɪˈfɪʃənsi/',
      translationVi: 'Hiệu quả',
      examples: [
        {
          sentence: 'We need to improve our team\'s efficiency.',
          translation: 'Chúng ta cần cải thiện hiệu quả của đội.',
        },
      ],
      synonyms: ['productivity', 'effectiveness'],
      antonyms: ['inefficiency', 'wastefulness'],
      difficulty: 'intermediate',
      orderIndex: 3,
    },
  ]

  for (const term of businessTerms) {
    await prisma.vocabularyTerm.create({
      data: {
        ...term,
        unitId: businessUnit.id,
      },
    })
  }

  // Create Daily Life Vocabulary List
  const daily = await prisma.vocabularyList.create({
    data: {
      title: 'Daily English Conversations',
      description:
        'Common vocabulary for everyday conversations and situations.',
      difficulty: 'beginner',
      category: 'Daily Life',
      level: 'A2-B1',
      isPublic: true,
      isOfficial: true,
      language: 'en',
      bannerUrl:
        'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800',
      thumbnailUrl:
        'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400',
    },
  })

  const greetingsUnit = await prisma.vocabularyUnit.create({
    data: {
      listId: daily.id,
      title: 'Unit 1: Greetings & Introductions',
      description: 'Essential phrases for meeting people',
      orderIndex: 1,
    },
  })

  const greetingsTerms = [
    {
      word: 'Introduce',
      definition: 'To make someone known by name to another person',
      pronunciation: 'ˌɪntrəˈdjuːs',
      partOfSpeech: 'verb',
      ipaUs: '/ˌɪntrəˈduːs/',
      ipaUk: '/ˌɪntrəˈdjuːs/',
      translationVi: 'Giới thiệu',
      examples: [
        {
          sentence: 'Let me introduce myself. My name is Sarah.',
          translation: 'Hãy để tôi tự giới thiệu. Tên tôi là Sarah.',
        },
      ],
      synonyms: ['present', 'acquaint'],
      difficulty: 'beginner',
      orderIndex: 1,
    },
    {
      word: 'Pleased',
      definition: 'Feeling happy and satisfied',
      pronunciation: 'pliːzd',
      partOfSpeech: 'adjective',
      ipaUs: '/pliːzd/',
      ipaUk: '/pliːzd/',
      translationVi: 'Hài lòng, vui mừng',
      examples: [
        {
          sentence: 'Pleased to meet you!',
          translation: 'Rất vui được gặp bạn!',
        },
      ],
      synonyms: ['happy', 'delighted', 'glad'],
      difficulty: 'beginner',
      orderIndex: 2,
    },
  ]

  for (const term of greetingsTerms) {
    await prisma.vocabularyTerm.create({
      data: {
        ...term,
        unitId: greetingsUnit.id,
      },
    })
  }

  console.log('Vocabulary data seeded successfully!')
  console.log(`Created lists:`)
  console.log(`  - ${ielts.title} (${envTerms.length + techTerms.length} terms)`)
  console.log(`  - ${toeic.title} (${businessTerms.length} terms)`)
  console.log(`  - ${daily.title} (${greetingsTerms.length} terms)`)
}

main()
  .catch((e) => {
    console.error('Error seeding vocabulary:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

