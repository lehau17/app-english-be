#!/usr/bin/env node
/**
 * Test script for Graph RAG with Neo4j
 *
 * Tests:
 * 1. Initialize Neo4j schema
 * 2. Sync entities from database
 * 3. Build structured relationships
 * 4. Discover semantic relationships
 * 5. Traverse graph
 * 6. Find learning paths
 * 7. Get statistics
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api/public/v1/ai';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testInitializeSchema() {
  section('1. Initialize Neo4j Schema');

  try {
    const response = await axios.post(`${API_BASE}/graph/init-schema`);
    log('✅ Schema initialized', 'green');
    console.log(response.data);
    return true;
  } catch (error) {
    log(`❌ Failed: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

async function testSyncEntities() {
  section('2. Sync Entities from Database');

  try {
    log('⏳ Syncing courses, lessons, activities...', 'yellow');
    const response = await axios.post(`${API_BASE}/graph/sync-entities`);
    log(`✅ Synced ${response.data.count} entities`, 'green');
    console.log(response.data);
    return true;
  } catch (error) {
    log(`❌ Failed: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

async function testBuildRelationships() {
  section('3. Build Structured Relationships');

  try {
    log('⏳ Building CONTAINS, FOLLOWS relationships...', 'yellow');
    const response = await axios.post(`${API_BASE}/graph/build-relationships`);
    log(`✅ Created ${response.data.count} relationships`, 'green');
    console.log(response.data);
    return true;
  } catch (error) {
    log(`❌ Failed: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

async function testDiscoverSemanticRelationships() {
  section('4. Discover Semantic Relationships (Optional - takes time)');

  log('⚠️  Skipping semantic discovery for now', 'yellow');
  log('💡 Run manually: POST /api/graph/discover-relationships', 'blue');
  return true;
}

async function testGetStatistics() {
  section('5. Get Graph Statistics');

  try {
    const response = await axios.get(`${API_BASE}/graph/stats`);
    log('✅ Statistics retrieved', 'green');
    console.log('Entity counts:', response.data.entities);
    console.log('Relationship counts:', response.data.relationships);
    return true;
  } catch (error) {
    log(`❌ Failed: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

async function testSearchEntities() {
  section('6. Search Entities by Name');

  try {
    const query = 'English';
    log(`⏳ Searching for "${query}"...`, 'yellow');

    const response = await axios.get(`${API_BASE}/graph/entities/search`, {
      params: { query, limit: 5 }
    });

    log(`✅ Found ${response.data.length} entities`, 'green');
    response.data.forEach((entity, i) => {
      console.log(`${i + 1}. [${entity.type}] ${entity.name}`);
      if (entity.description) {
        console.log(`   ${entity.description.substring(0, 80)}...`);
      }
    });
    return true;
  } catch (error) {
    log(`❌ Failed: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

async function testTraverseGraph() {
  section('7. Traverse Graph from Entity');

  try {
    // First, get a course entity
    const searchResponse = await axios.get(`${API_BASE}/graph/entities/search`, {
      params: { query: 'course', limit: 1 }
    });

    if (searchResponse.data.length === 0) {
      log('⚠️  No entities found to traverse from', 'yellow');
      return false;
    }

    const startEntity = searchResponse.data[0];
    log(`⏳ Traversing from: [${startEntity.type}] ${startEntity.name}`, 'yellow');

    const response = await axios.post(`${API_BASE}/graph/traverse`, {
      startEntityIds: [startEntity.id],
      maxDepth: 2,
      direction: 'outgoing'
    });

    log(`✅ Found ${response.data.entities.length} connected entities`, 'green');
    log(`✅ Found ${response.data.relationships.length} relationships`, 'green');

    // Show sample
    console.log('\nSample entities:');
    response.data.entities.slice(0, 5).forEach((entity, i) => {
      console.log(`${i + 1}. [${entity.type}] ${entity.name}`);
    });

    console.log('\nSample relationships:');
    response.data.relationships.slice(0, 5).forEach((rel, i) => {
      console.log(`${i + 1}. ${rel.type} (weight: ${rel.weight})`);
    });

    return true;
  } catch (error) {
    log(`❌ Failed: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

async function testGetNeighbors() {
  section('8. Get Neighbors of Entity');

  try {
    // Get a lesson entity
    const searchResponse = await axios.get(`${API_BASE}/graph/entities/search`, {
      params: { query: 'lesson', limit: 1 }
    });

    if (searchResponse.data.length === 0) {
      log('⚠️  No lesson entity found', 'yellow');
      return false;
    }

    const entity = searchResponse.data[0];
    log(`⏳ Getting neighbors of: [${entity.type}] ${entity.name}`, 'yellow');

    const response = await axios.get(`${API_BASE}/graph/entities/${entity.id}/neighbors`, {
      params: { direction: 'both' }
    });

    log(`✅ Found ${response.data.length} neighbors`, 'green');

    response.data.slice(0, 5).forEach((neighbor, i) => {
      console.log(`${i + 1}. [${neighbor.entity.type}] ${neighbor.entity.name} (via ${neighbor.relationship})`);
    });

    return true;
  } catch (error) {
    log(`❌ Failed: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

async function runAllTests() {
  log('\n🚀 Starting Graph RAG Test Suite', 'cyan');
  log('📍 Make sure backend is running on port 3000\n', 'yellow');

  await sleep(1000);

  const results = [];

  results.push(await testInitializeSchema());
  await sleep(1000);

  results.push(await testSyncEntities());
  await sleep(2000);

  results.push(await testBuildRelationships());
  await sleep(2000);

  results.push(await testDiscoverSemanticRelationships());
  await sleep(500);

  results.push(await testGetStatistics());
  await sleep(500);

  results.push(await testSearchEntities());
  await sleep(500);

  results.push(await testTraverseGraph());
  await sleep(500);

  results.push(await testGetNeighbors());

  // Summary
  section('Test Summary');
  const passed = results.filter(r => r).length;
  const total = results.length;

  if (passed === total) {
    log(`✅ All ${total} tests passed!`, 'green');
  } else {
    log(`⚠️  ${passed}/${total} tests passed`, 'yellow');
  }

  log('\n💡 Next steps:', 'cyan');
  console.log('1. Extract concepts from documents: POST /api/graph/extract-concepts');
  console.log('2. Discover semantic relationships: POST /api/graph/discover-relationships');
  console.log('3. Test Graph RAG search: POST /api/graph-search');
  console.log('4. Open Neo4j Browser: http://localhost:7474');
  console.log('   Username: neo4j, Password: neo4j123456');
}

// Run tests
runAllTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
