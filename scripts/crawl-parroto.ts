import { DifficultyLevel, PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// Parroto API Configuration
const BASE_URL = 'https://api.parroto.app/api';
const DELAY_MS = 500; // 500ms between requests to be respectful

// Get Bearer token from environment variable or argument
const BEARER_TOKEN = process.env.PARROTO_TOKEN || process.argv[2];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ParrotoDeck {
    _id: string;
    name: string;
    description?: string;
    difficulty: string; // A1, A2, B1, B2, etc.
    total_cards: number;
    total_groups: number;
    meta?: any;
}

interface ParrotoGroup {
    _id: string;
    name: string;
    deck_id: string;
    order: number;
    total_cards: number;
    meta?: any;
}

interface ParrotoCard {
    card_id: string;
    word: string;
    explanation: {
        en: string;
        vi?: string;
    };
    translation: {
        vi?: string;
    };
    type: string; // noun, verb, adjective, etc.
    phonetics: Array<{
        text: string;
        audio: string;
        locale: string;
    }>;
    example: {
        en: string;
        vi?: string;
    };
    image_url?: string;
    group_id: string;
    deck_id: string;
}

/**
 * Fetch all vocabulary decks from Parroto
 */
async function fetchDecks(page = 1, limit = 20): Promise<ParrotoDeck[]> {
    try {
        console.log(`📚 Fetching decks (page ${page})...`);
        const response = await axios.get(`${BASE_URL}/vocabulary/public`, {
            params: { page, limit, search: '' },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            }
        });

        if (response.data.status === 'success') {
            const decks = response.data.data.decks || [];
            console.log(`✅ Found ${decks.length} decks`);
            return decks;
        }
        return [];
    } catch (error: any) {
        console.error('❌ Error fetching decks:', error.message);
        return [];
    }
}

/**
 * Fetch groups (units) for a deck
 */
async function fetchGroups(deckId: string): Promise<ParrotoGroup[]> {
    try {
        await sleep(DELAY_MS);
        console.log(`  📂 Fetching groups for deck ${deckId}...`);

        const response = await axios.get(`${BASE_URL}/vocabulary/public/${deckId}/groups`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            }
        });

        if (response.data.status === 'success') {
            const groups = response.data.data || [];
            console.log(`  ✅ Found ${groups.length} groups`);
            return groups;
        }
        return [];
    } catch (error: any) {
        console.error(`  ❌ Error fetching groups for ${deckId}:`, error.message);
        return [];
    }
}

/**
 * Fetch cards (terms) for a group
 */
async function fetchCards(deckId: string, groupId: string, limit = 1000): Promise<ParrotoCard[]> {
    try {
        await sleep(DELAY_MS);
        console.log(`    📝 Fetching cards for group ${groupId}...`);

        const headers: any = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        };

        if (BEARER_TOKEN) {
            headers['Authorization'] = `Bearer ${BEARER_TOKEN}`;
        }

        const response = await axios.get(`${BASE_URL}/learning-vocabulary/new`, {
            params: { deckId, groupId, limit },
            headers
        });

        if (response.data.status === 'success') {
            const cards = response.data.data.cards || [];
            console.log(`    ✅ Found ${cards.length} cards`);
            return cards;
        }
        return [];
    } catch (error: any) {
        console.error(`    ❌ Error fetching cards for ${groupId}:`, error.message);
        return [];
    }
}

/**
 * Map Parroto difficulty to our schema
 */
function mapDifficulty(parrotoLevel: string): DifficultyLevel {
    const level = parrotoLevel.toUpperCase();
    if (level === 'A1' || level === 'A2') return DifficultyLevel.beginner;
    if (level === 'B1' || level === 'B2') return DifficultyLevel.intermediate;
    if (level === 'C1' || level === 'C2') return DifficultyLevel.advanced;
    return DifficultyLevel.intermediate; // default
}

/**
 * Import a deck with all its groups and cards
 */
async function importDeck(deck: ParrotoDeck, groups: ParrotoGroup[], allCards: Map<string, ParrotoCard[]>) {
    console.log(`\n🎯 Importing deck: ${deck.name}`);

    // Create vocabulary list
    const vocabularyList = await prisma.vocabularyList.create({
        data: {
            title: deck.name,
            description: deck.description || `Imported from Parroto - ${deck.total_cards} words`,
            difficulty: mapDifficulty(deck.difficulty),
            category: 'Imported',
            level: deck.difficulty,
            isPublic: true,
            isOfficial: false, // Mark as imported, not official
            language: 'en',
        }
    });

    console.log(`✅ Created list: ${vocabularyList.id}`);

    // Import each group
    for (const group of groups) {
        const cards = allCards.get(group._id) || [];

        if (cards.length === 0) {
            console.log(`  ⏭️  Skipping empty group: ${group.name}`);
            continue;
        }

        console.log(`  📂 Importing group: ${group.name} (${cards.length} cards)`);

        // Create vocabulary unit
        const vocabularyUnit = await prisma.vocabularyUnit.create({
            data: {
                listId: vocabularyList.id,
                title: group.name,
                description: group.meta?.translations?.vi?.name || group.name,
                orderIndex: group.order,
            }
        });

        // Prepare terms data
        const termsData = cards.map((card, index) => {
            // Extract phonetics
            const usPhonetic = card.phonetics.find(p => p.locale === 'en-US');
            const ukPhonetic = card.phonetics.find(p => p.locale === 'en-UK');

            return {
                unitId: vocabularyUnit.id,
                word: card.word,
                definition: card.explanation.en,
                pronunciation: usPhonetic?.text || ukPhonetic?.text,
                partOfSpeech: card.type,
                audioUrl: usPhonetic?.audio || ukPhonetic?.audio,
                imageUrl: card.image_url,
                examples: card.example?.en ? [{
                    sentence: card.example.en,
                    translation: card.example.vi || undefined,
                }] : [],
                ipaUs: usPhonetic?.text,
                ipaUk: ukPhonetic?.text,
                translationVi: card.translation.vi,
                orderIndex: index + 1,
                difficulty: DifficultyLevel.intermediate, // Default
            };
        });

        // Bulk insert terms
        await prisma.vocabularyTerm.createMany({
            data: termsData,
        });

        console.log(`  ✅ Imported ${termsData.length} terms for ${group.name}`);
    }

    return vocabularyList;
}

/**
 * Main crawler function
 */
async function main() {
    console.log('🚀 Starting Parroto vocabulary crawler...\n');

    // Check if token is provided
    if (!BEARER_TOKEN) {
        console.error('❌ Bearer token required!');
        console.log('\nUsage:');
        console.log('  npx ts-node scripts/crawl-parroto.ts YOUR_BEARER_TOKEN');
        console.log('  OR');
        console.log('  PARROTO_TOKEN=YOUR_TOKEN npx ts-node scripts/crawl-parroto.ts');
        process.exit(1);
    }

    console.log('✅ Bearer token found\n');

    try {
        // Step 1: Fetch all decks (increase limit if needed)
        const decks = await fetchDecks(1, 50);

        if (decks.length === 0) {
            console.log('❌ No decks found. Exiting...');
            return;
        }

        console.log(`\n📊 Total decks to process: ${decks.length}\n`);

        let totalImported = 0;

        // Step 2: Process each deck
        for (let i = 0; i < decks.length; i++) {
            const deck = decks[i];
            console.log(`\n[${i + 1}/${decks.length}] Processing: ${deck.name}`);
            console.log(`  📊 ${deck.total_cards} cards across ${deck.total_groups} groups`);

            // Fetch groups for this deck
            const groups = await fetchGroups(deck._id);

            if (groups.length === 0) {
                console.log(`  ⏭️  No groups found, skipping...`);
                continue;
            }

            // Fetch cards for each group
            const allCards = new Map<string, ParrotoCard[]>();

            for (const group of groups) {
                const cards = await fetchCards(deck._id, group._id);
                allCards.set(group._id, cards);
            }

            // Import to database
            try {
                await importDeck(deck, groups, allCards);
                totalImported++;
                console.log(`✅ Successfully imported: ${deck.name}`);
            } catch (error: any) {
                console.error(`❌ Failed to import ${deck.name}:`, error.message);
            }

            // Delay between decks
            await sleep(DELAY_MS * 2);
        }

        console.log('\n\n🎉 Crawling complete!');
        console.log(`📊 Statistics:`);
        console.log(`  - Total decks processed: ${decks.length}`);
        console.log(`  - Successfully imported: ${totalImported}`);

        // Get final counts
        const listCount = await prisma.vocabularyList.count();
        const unitCount = await prisma.vocabularyUnit.count();
        const termCount = await prisma.vocabularyTerm.count();

        console.log(`\n📚 Database totals:`);
        console.log(`  - Lists: ${listCount}`);
        console.log(`  - Units: ${unitCount}`);
        console.log(`  - Terms: ${termCount}`);

    } catch (error: any) {
        console.error('❌ Fatal error:', error.message);
        throw error;
    }
}

// Run the crawler
main()
    .catch((e) => {
        console.error('💥 Crawler failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

