import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedVocabulary() {
    console.log('🌱 Seeding vocabulary data...')

    // IELTS Vocabulary List
    const ieltsList = await prisma.vocabularyList.create({
        data: {
            title: 'IELTS Essential Vocabulary',
            description:
                'Essential vocabulary for IELTS test preparation. Covers common topics and academic language.',
            difficulty: 'intermediate',
            category: 'IELTS',
            level: 'Band 6.0-7.5',
            isPublic: true,
            isOfficial: true,
            language: 'en',
        },
    })

    // Unit 1: Environment
    const unit1 = await prisma.vocabularyUnit.create({
        data: {
            listId: ieltsList.id,
            title: 'Unit 1: Environment & Climate',
            description: 'Vocabulary related to environmental issues and climate change',
            orderIndex: 1,
        },
    })

    await prisma.vocabularyTerm.createMany({
        data: [
            {
                unitId: unit1.id,
                word: 'sustainable',
                definition: 'able to be maintained at a certain rate or level',
                pronunciation: 'səˈsteɪnəbl',
                partOfSpeech: 'adjective',
                ipaUs: 'səˈsteɪnəbl',
                ipaUk: 'səˈsteɪnəbəl',
                translationVi: 'bền vững',
                examples: [
                    {
                        sentence: 'We need to develop sustainable energy sources.',
                        translation: 'Chúng ta cần phát triển các nguồn năng lượng bền vững.',
                    },
                ],
                synonyms: ['viable', 'maintainable'],
                difficulty: 'intermediate',
                orderIndex: 1,
            },
            {
                unitId: unit1.id,
                word: 'biodiversity',
                definition:
                    'the variety of plant and animal life in the world or in a particular habitat',
                pronunciation: 'ˌbaɪoʊdaɪˈvɜːrsəti',
                partOfSpeech: 'noun',
                ipaUs: 'ˌbaɪoʊdaɪˈvɜːrsəti',
                ipaUk: 'ˌbaɪəʊdaɪˈvɜːsəti',
                translationVi: 'đa dạng sinh học',
                examples: [
                    {
                        sentence:
                            'The Amazon rainforest is known for its rich biodiversity.',
                        translation:
                            'Rừng mưa Amazon nổi tiếng với đa dạng sinh học phong phú.',
                    },
                ],
                difficulty: 'advanced',
                orderIndex: 2,
            },
            {
                unitId: unit1.id,
                word: 'pollution',
                definition:
                    'the presence in or introduction into the environment of harmful substances',
                pronunciation: 'pəˈluːʃn',
                partOfSpeech: 'noun',
                ipaUs: 'pəˈluːʃn',
                ipaUk: 'pəˈluːʃn',
                translationVi: 'ô nhiễm',
                examples: [
                    {
                        sentence: 'Air pollution is a serious problem in many cities.',
                        translation: 'Ô nhiễm không khí là vấn đề nghiêm trọng ở nhiều thành phố.',
                    },
                ],
                synonyms: ['contamination'],
                antonyms: ['cleanliness', 'purity'],
                difficulty: 'beginner',
                orderIndex: 3,
            },
            {
                unitId: unit1.id,
                word: 'renewable',
                definition:
                    'capable of being renewed; relating to energy from sources that are not depleted when used',
                pronunciation: 'rɪˈnuːəbl',
                partOfSpeech: 'adjective',
                ipaUs: 'rɪˈnuːəbl',
                ipaUk: 'rɪˈnjuːəbl',
                translationVi: 'có thể tái tạo',
                examples: [
                    {
                        sentence: 'Solar and wind are renewable energy sources.',
                        translation: 'Năng lượng mặt trời và gió là các nguồn năng lượng tái tạo.',
                    },
                ],
                antonyms: ['non-renewable'],
                difficulty: 'intermediate',
                orderIndex: 4,
            },
            {
                unitId: unit1.id,
                word: 'conservation',
                definition:
                    'the action of conserving something, especially the environment',
                pronunciation: 'ˌkɑːnsərˈveɪʃn',
                partOfSpeech: 'noun',
                ipaUs: 'ˌkɑːnsərˈveɪʃn',
                ipaUk: 'ˌkɒnsəˈveɪʃn',
                translationVi: 'bảo tồn',
                examples: [
                    {
                        sentence: 'Wildlife conservation is important for future generations.',
                        translation: 'Bảo tồn động vật hoang dã rất quan trọng cho các thế hệ tương lai.',
                    },
                ],
                synonyms: ['preservation', 'protection'],
                difficulty: 'intermediate',
                orderIndex: 5,
            },
        ],
    })

    // Unit 2: Education
    const unit2 = await prisma.vocabularyUnit.create({
        data: {
            listId: ieltsList.id,
            title: 'Unit 2: Education & Learning',
            description: 'Academic vocabulary and education-related terms',
            orderIndex: 2,
        },
    })

    await prisma.vocabularyTerm.createMany({
        data: [
            {
                unitId: unit2.id,
                word: 'curriculum',
                definition: 'the subjects comprising a course of study in a school',
                pronunciation: 'kəˈrɪkjələm',
                partOfSpeech: 'noun',
                ipaUs: 'kəˈrɪkjələm',
                ipaUk: 'kəˈrɪkjʊləm',
                translationVi: 'chương trình giảng dạy',
                examples: [
                    {
                        sentence: 'The school is updating its curriculum.',
                        translation: 'Trường đang cập nhật chương trình giảng dạy.',
                    },
                ],
                difficulty: 'intermediate',
                orderIndex: 1,
            },
            {
                unitId: unit2.id,
                word: 'literacy',
                definition: 'the ability to read and write',
                pronunciation: 'ˈlɪtərəsi',
                partOfSpeech: 'noun',
                ipaUs: 'ˈlɪtərəsi',
                ipaUk: 'ˈlɪtərəsi',
                translationVi: 'khả năng đọc viết',
                examples: [
                    {
                        sentence: 'Improving literacy rates is a national priority.',
                        translation: 'Cải thiện tỷ lệ biết chữ là ưu tiên quốc gia.',
                    },
                ],
                antonyms: ['illiteracy'],
                difficulty: 'intermediate',
                orderIndex: 2,
            },
            {
                unitId: unit2.id,
                word: 'pedagogy',
                definition: 'the method and practice of teaching',
                pronunciation: 'ˈpedəɡɑːdʒi',
                partOfSpeech: 'noun',
                ipaUs: 'ˈpedəɡɑːdʒi',
                ipaUk: 'ˈpedəɡɒdʒi',
                translationVi: 'phương pháp sư phạm',
                examples: [
                    {
                        sentence: 'Effective pedagogy is essential for student success.',
                        translation: 'Phương pháp sư phạm hiệu quả là cần thiết cho sự thành công của học sinh.',
                    },
                ],
                difficulty: 'advanced',
                orderIndex: 3,
            },
        ],
    })

    console.log(`✅ Created IELTS list with ${await prisma.vocabularyTerm.count({ where: { unit: { listId: ieltsList.id } } })} terms`)

    // TOEIC Business Vocabulary
    const toeicList = await prisma.vocabularyList.create({
        data: {
            title: 'TOEIC Business Vocabulary',
            description:
                'Essential business English vocabulary for TOEIC test preparation',
            difficulty: 'intermediate',
            category: 'TOEIC',
            level: '600-800',
            isPublic: true,
            isOfficial: true,
            language: 'en',
        },
    })

    const businessUnit = await prisma.vocabularyUnit.create({
        data: {
            listId: toeicList.id,
            title: 'Unit 1: Business Communication',
            description: 'Vocabulary for professional communication',
            orderIndex: 1,
        },
    })

    await prisma.vocabularyTerm.createMany({
        data: [
            {
                unitId: businessUnit.id,
                word: 'agenda',
                definition: 'a list of items to be discussed at a meeting',
                pronunciation: 'əˈdʒendə',
                partOfSpeech: 'noun',
                ipaUs: 'əˈdʒendə',
                ipaUk: 'əˈdʒendə',
                translationVi: 'chương trình nghị sự',
                examples: [
                    {
                        sentence: "Let's review the meeting agenda.",
                        translation: 'Hãy xem lại chương trình nghị sự của cuộc họp.',
                    },
                ],
                difficulty: 'intermediate',
                orderIndex: 1,
            },
            {
                unitId: businessUnit.id,
                word: 'negotiate',
                definition: 'to try to reach an agreement through discussion',
                pronunciation: 'nɪˈɡoʊʃieɪt',
                partOfSpeech: 'verb',
                ipaUs: 'nɪˈɡoʊʃieɪt',
                ipaUk: 'nɪˈɡəʊʃieɪt',
                translationVi: 'đàm phán',
                examples: [
                    {
                        sentence: 'We need to negotiate the terms of the contract.',
                        translation: 'Chúng ta cần đàm phán các điều khoản của hợp đồng.',
                    },
                ],
                synonyms: ['bargain', 'discuss'],
                difficulty: 'intermediate',
                orderIndex: 2,
            },
            {
                unitId: businessUnit.id,
                word: 'deadline',
                definition: 'the latest time or date by which something should be completed',
                pronunciation: 'ˈdedlaɪn',
                partOfSpeech: 'noun',
                ipaUs: 'ˈdedlaɪn',
                ipaUk: 'ˈdedlaɪn',
                translationVi: 'hạn chót',
                examples: [
                    {
                        sentence: 'The project deadline is next Friday.',
                        translation: 'Hạn chót của dự án là thứ Sáu tuần sau.',
                    },
                ],
                difficulty: 'beginner',
                orderIndex: 3,
            },
        ],
    })

    console.log(`✅ Created TOEIC list with ${await prisma.vocabularyTerm.count({ where: { unit: { listId: toeicList.id } } })} terms`)

    // Daily Conversation Vocabulary
    const dailyList = await prisma.vocabularyList.create({
        data: {
            title: 'Everyday English Conversation',
            description: 'Common words and phrases for daily communication',
            difficulty: 'beginner',
            category: 'Daily Life',
            level: 'A1-A2',
            isPublic: true,
            isOfficial: true,
            language: 'en',
        },
    })

    const greetingsUnit = await prisma.vocabularyUnit.create({
        data: {
            listId: dailyList.id,
            title: 'Unit 1: Greetings & Introductions',
            description: 'Basic greetings and self-introduction',
            orderIndex: 1,
        },
    })

    await prisma.vocabularyTerm.createMany({
        data: [
            {
                unitId: greetingsUnit.id,
                word: 'introduction',
                definition: 'the action of introducing someone or something',
                pronunciation: 'ˌɪntrəˈdʌkʃn',
                partOfSpeech: 'noun',
                ipaUs: 'ˌɪntrəˈdʌkʃn',
                ipaUk: 'ˌɪntrəˈdʌkʃn',
                translationVi: 'sự giới thiệu',
                examples: [
                    {
                        sentence: 'Let me make a quick introduction.',
                        translation: 'Hãy để tôi giới thiệu nhanh.',
                    },
                ],
                difficulty: 'beginner',
                orderIndex: 1,
            },
            {
                unitId: greetingsUnit.id,
                word: 'pleasure',
                definition: 'a feeling of happy satisfaction and enjoyment',
                pronunciation: 'ˈpleʒər',
                partOfSpeech: 'noun',
                ipaUs: 'ˈpleʒər',
                ipaUk: 'ˈpleʒə',
                translationVi: 'niềm vui, hân hạnh',
                examples: [
                    {
                        sentence: "It's a pleasure to meet you.",
                        translation: 'Rất hân hạnh được gặp bạn.',
                    },
                ],
                synonyms: ['delight', 'joy'],
                difficulty: 'beginner',
                orderIndex: 2,
            },
        ],
    })

    console.log(`✅ Created Daily Life list with ${await prisma.vocabularyTerm.count({ where: { unit: { listId: dailyList.id } } })} terms`)

    console.log('🎉 Vocabulary seeding completed!')
    console.log(`📚 Total lists: 3`)
    console.log(`📖 Total units: 4`)
    console.log(`📝 Total terms: ${await prisma.vocabularyTerm.count()}`)
}

seedVocabulary()
    .catch((e) => {
        console.error('❌ Error seeding vocabulary:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })


