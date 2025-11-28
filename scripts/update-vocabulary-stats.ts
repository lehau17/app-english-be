import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Update cached stats for all vocabulary lists
 */
async function updateVocabularyStats() {
    console.log('Updating vocabulary statistics...\n');

    const lists = await prisma.vocabularyList.findMany();

    for (const list of lists) {
        console.log(`Processing: ${list.title}`);

        // Count total units
        const totalUnits = await prisma.vocabularyUnit.count({
            where: { listId: list.id },
        });

        // Count total terms
        const totalTerms = await prisma.vocabularyTerm.count({
            where: {
                unit: {
                    listId: list.id,
                },
            },
        });

        // Update list
        await prisma.vocabularyList.update({
            where: { id: list.id },
            data: {
                totalUnits,
                totalTerms,
            },
        });

        console.log(`  Updated: ${totalUnits} units, ${totalTerms} terms\n`);
    }

    console.log('All stats updated!');

    // Show final totals
    const allLists = await prisma.vocabularyList.findMany({
        select: {
            title: true,
            totalUnits: true,
            totalTerms: true,
            userCount: true,
        },
    });

    console.log('\nFinal Statistics:\n');
    allLists.forEach((list) => {
        console.log(`${list.title}:`);
        console.log(`  - Units: ${list.totalUnits}`);
        console.log(`  - Terms: ${list.totalTerms}`);
        console.log(`  - Users: ${list.userCount}\n`);
    });
}

updateVocabularyStats()
    .catch((e) => {
        console.error('Error updating stats:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });



