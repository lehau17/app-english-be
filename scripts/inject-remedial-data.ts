
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_USER_ID = 'b8bdb3c8-3ffb-4d0a-bad7-b7a6f2f89734';

const MOCK_WORDS = [
    { word: 'schedule', phoneme: '/ˈʃɛdjuːl/', sentence: 'Can we check the schedule?' },
    { word: 'comfortable', phoneme: '/ˈkʌmf.tə.bəl/', sentence: 'This chair is very comfortable.' },
    { word: 'rural', phoneme: '/ˈrʊə.rəl/', sentence: 'They live in a rural area.' },
    { word: 'colonel', phoneme: '/ˈkɜː.nəl/', sentence: 'The colonel gave an order.' },
    { word: 'worcestershire', phoneme: '/ˈwʊs.tə.ʃər/', sentence: 'Pass the Worcestershire sauce.' },
    { word: 'choir', phoneme: '/ˈkwaɪ.ər/', sentence: 'She sings in the church choir.' },
    { word: 'squirrel', phoneme: '/ˈskwɪr.əl/', sentence: 'The squirrel climbed the tree.' },
    { word: 'phenomenon', phoneme: '/fəˈnɒm.ɪ.nən/', sentence: 'It is a natural phenomenon.' },
    { word: 'brewery', phoneme: '/ˈbruː.ə.ri/', sentence: 'We visited a local brewery.' },
    { word: 'penguin', phoneme: '/ˈpɛŋ.ɡwɪn/', sentence: 'The penguin waddled on the ice.' },
    { word: 'library', phoneme: '/ˈlaɪ.brər.i/', sentence: 'I am going to the library.' },
    { word: 'february', phoneme: '/ˈfɛb.ru.ər.i/', sentence: 'My birthday is in February.' },
    { word: 'definitely', phoneme: '/ˈdɛf.ɪ.nət.li/', sentence: 'I will definitely be there.' },
    { word: 'misc', phoneme: '/mɪsk/', sentence: 'Put it in the misc folder.' },
    { word: 'queue', phoneme: '/kjuː/', sentence: 'Stand in the queue.' },
];

async function main() {
    console.log(`Checking user ${TARGET_USER_ID}...`);
    const user = await prisma.user.findUnique({ where: { id: TARGET_USER_ID } });

    if (!user) {
        console.error(`User ${TARGET_USER_ID} not found!`);
        process.exit(1);
    }

    console.log('Injecting 15 mispronunciation records...');

    for (const item of MOCK_WORDS) {
        await prisma.mispronounceWord.upsert({
            where: {
                userId_word: {
                    userId: TARGET_USER_ID,
                    word: item.word
                }
            },
            update: {
                errorCount: { increment: 1 },
                lastErrorAt: new Date(),
                problematicPhoneme: item.phoneme,
                contextSentence: item.sentence,
                source: 'practice'
            },
            create: {
                userId: TARGET_USER_ID,
                word: item.word,
                errorCount: 1,
                problematicPhoneme: item.phoneme,
                contextSentence: item.sentence,
                source: 'practice',
                userPronunciation: 'wrong pronunciation mockup'
            }
        });
    }

    console.log('Updating user pronunciationErrorCounter...');

    // Force update to ensure it crosses a threshold (e.g. if current is 2, make it 15. If 15, make it 30)
    // But user asked to "inject 15 words" and make logic run. logic runs on mod 10.
    // We'll increment by 15.
    const updatedUser = await prisma.user.update({
        where: { id: TARGET_USER_ID },
        data: {
            pronunciationErrorCounter: { increment: 15 }
        }
    });

    console.log(`Success! User error counter is now: ${updatedUser.pronunciationErrorCounter}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
