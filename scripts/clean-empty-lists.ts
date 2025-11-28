import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanEmptyLists() {
    console.log('🧹 Cleaning empty vocabulary lists...\n');

    const emptyLists = await prisma.vocabularyList.findMany({
        where: {
            totalTerms: 0,
        },
    });

    console.log(`Found ${emptyLists.length} empty lists to delete:\n`);

    for (const list of emptyLists) {
        console.log(`  Deleting: ${list.title} (${list.totalTerms} terms)`);
        await prisma.vocabularyList.delete({
            where: { id: list.id },
        });
    }

    console.log(`\nCleaned ${emptyLists.length} empty lists!`);

    const remaining = await prisma.vocabularyList.count();
    console.log(`Remaining lists: ${remaining}`);
}

cleanEmptyLists()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
