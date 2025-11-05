# Parroto API Analysis & Crawling Guide

## 🔍 Bước 1: Phân Tích API

### Cách Check API:

1. **Mở Parroto Vocabulary Page**: https://parroto.app/vocabulary
2. **Mở Browser DevTools**: F12 hoặc Right Click → Inspect
3. **Vào Tab Network**
4. **Filter**: XHR hoặc Fetch
5. **Reload page hoặc click vào các vocabulary lists**
6. **Quan sát các API requests**

### Các API Endpoints Có Thể Có:

```
# Lists
GET /api/vocabulary/lists
GET /api/vocabulary/lists/:id

# Units
GET /api/vocabulary/lists/:listId/units
GET /api/vocabulary/units/:unitId

# Terms/Words
GET /api/vocabulary/units/:unitId/terms
GET /api/vocabulary/terms
```

### Response Structure (Dự đoán):

```json
// GET /api/vocabulary/lists
{
  "data": [
    {
      "id": "uuid",
      "title": "IELTS Vocabulary",
      "description": "...",
      "level": "intermediate",
      "totalWords": 500,
      "units": [...]
    }
  ]
}

// GET /api/vocabulary/units/:unitId/terms
{
  "data": [
    {
      "id": "uuid",
      "word": "sustainable",
      "definition": "...",
      "pronunciation": "/səˈsteɪnəbl/",
      "examples": ["..."],
      "translation": "bền vững"
    }
  ]
}
```

---

## 📝 Bước 2: Ghi Lại API Details

### Cần Lưu Lại:

1. **Base URL**: `https://parroto.app/api/...` (hoặc subdomain khác)
2. **Headers cần thiết**:
   ```
   Authorization: Bearer xxx (nếu cần)
   Content-Type: application/json
   User-Agent: ...
   ```
3. **Rate Limiting**: Có giới hạn request/phút không?
4. **Pagination**: Có phân trang không? (page, limit, cursor?)
5. **Authentication**: Cần đăng nhập không?

---

## 🔨 Bước 3: Tạo Crawler Script

### Option 1: Simple Node.js Script

```typescript
// scripts/crawl-parroto.ts

import axios from 'axios';
import { promises as fs } from 'fs';

const BASE_URL = 'https://parroto.app/api'; // Update with actual URL
const DELAY_MS = 1000; // 1 second between requests

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface VocabularyList {
  id: string;
  title: string;
  description?: string;
  level?: string;
}

interface VocabularyTerm {
  id?: string;
  word: string;
  definition: string;
  pronunciation?: string;
  examples?: string[];
  translation?: string;
}

async function crawlVocabularyLists(): Promise<VocabularyList[]> {
  try {
    const response = await axios.get(`${BASE_URL}/vocabulary/lists`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        // Add other headers if needed
      }
    });

    return response.data.data || response.data;
  } catch (error) {
    console.error('Error fetching lists:', error);
    return [];
  }
}

async function crawlVocabularyTerms(listId: string, unitId: string): Promise<VocabularyTerm[]> {
  try {
    await sleep(DELAY_MS); // Rate limiting

    const response = await axios.get(`${BASE_URL}/vocabulary/units/${unitId}/terms`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      }
    });

    return response.data.data || response.data;
  } catch (error) {
    console.error(`Error fetching terms for unit ${unitId}:`, error);
    return [];
  }
}

async function main() {
  console.log('🚀 Starting Parroto vocabulary crawler...');

  // Step 1: Get all vocabulary lists
  const lists = await crawlVocabularyLists();
  console.log(`✅ Found ${lists.length} vocabulary lists`);

  const allData: any = {
    lists: [],
    timestamp: new Date().toISOString(),
  };

  // Step 2: For each list, get all units and terms
  for (const list of lists) {
    console.log(`📚 Processing: ${list.title}`);

    const listData = {
      ...list,
      units: []
    };

    // TODO: Get units for this list
    // const units = await crawlVocabularyUnits(list.id);

    // TODO: For each unit, get terms
    // for (const unit of units) {
    //   const terms = await crawlVocabularyTerms(list.id, unit.id);
    //   listData.units.push({ ...unit, terms });
    // }

    allData.lists.push(listData);
  }

  // Step 3: Save to JSON file
  const outputPath = './parroto-vocabulary-data.json';
  await fs.writeFile(outputPath, JSON.stringify(allData, null, 2));

  console.log(`✅ Data saved to ${outputPath}`);
  console.log(`📊 Total lists: ${allData.lists.length}`);
}

main();
```

### Option 2: Python Script (with Beautiful Soup)

```python
# scripts/crawl_parroto.py

import requests
import json
import time
from typing import List, Dict

BASE_URL = "https://parroto.app/api"
DELAY = 1  # seconds

def fetch_vocabulary_lists() -> List[Dict]:
    """Fetch all vocabulary lists"""
    try:
        response = requests.get(
            f"{BASE_URL}/vocabulary/lists",
            headers={
                'User-Agent': 'Mozilla/5.0',
            }
        )
        response.raise_for_status()
        data = response.json()
        return data.get('data', data)
    except Exception as e:
        print(f"Error fetching lists: {e}")
        return []

def fetch_vocabulary_terms(unit_id: str) -> List[Dict]:
    """Fetch terms for a specific unit"""
    try:
        time.sleep(DELAY)  # Rate limiting
        response = requests.get(
            f"{BASE_URL}/vocabulary/units/{unit_id}/terms",
            headers={
                'User-Agent': 'Mozilla/5.0',
            }
        )
        response.raise_for_status()
        data = response.json()
        return data.get('data', data)
    except Exception as e:
        print(f"Error fetching terms for unit {unit_id}: {e}")
        return []

def main():
    print("🚀 Starting Parroto vocabulary crawler...")

    lists = fetch_vocabulary_lists()
    print(f"✅ Found {len(lists)} vocabulary lists")

    all_data = {
        'lists': [],
        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
    }

    # Process each list
    for list_item in lists:
        print(f"📚 Processing: {list_item.get('title')}")
        # TODO: Implement unit and term fetching
        all_data['lists'].append(list_item)

    # Save to JSON
    with open('parroto-vocabulary-data.json', 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print(f"✅ Data saved!")
    print(f"📊 Total lists: {len(all_data['lists'])}")

if __name__ == '__main__':
    main()
```

---

## ⚠️ Important Notes

### 1. Legal & Ethical Considerations

- ✅ **Check Terms of Service**: Đọc ToS của Parroto
- ✅ **Rate Limiting**: Không spam requests
- ✅ **Attribution**: Ghi nguồn nếu sử dụng data
- ⚠️ **Copyright**: Data có thể có copyright

### 2. Technical Considerations

- **Rate Limiting**: 1-2 seconds between requests
- **Error Handling**: Retry on failure
- **Data Validation**: Validate response structure
- **Logging**: Log progress để debug

### 3. Alternative Approaches

#### A. Manual Export (If Available)
- Check if Parroto has export feature
- Download CSV/JSON directly

#### B. Browser Automation (Selenium/Puppeteer)
```typescript
import puppeteer from 'puppeteer';

async function crawlWithBrowser() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Navigate to vocabulary page
  await page.goto('https://parroto.app/vocabulary');

  // Extract data from DOM
  const data = await page.evaluate(() => {
    // Your extraction logic here
    return document.querySelectorAll('.vocabulary-item');
  });

  await browser.close();
  return data;
}
```

#### C. API Reverse Engineering
- Intercept React/Vue app API calls
- Use browser DevTools to capture requests
- Replicate in script

---

## 📊 Data Transformation

### Convert Parroto Format → Your Schema

```typescript
// scripts/transform-parroto-data.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ParrotoTerm {
  word: string;
  definition: string;
  pronunciation?: string;
  examples?: string[];
  translation?: string;
}

async function transformAndImport(data: any) {
  for (const list of data.lists) {
    // Create vocabulary list
    const vocabularyList = await prisma.vocabularyList.create({
      data: {
        title: list.title,
        description: list.description,
        difficulty: list.level || 'intermediate',
        isPublic: true,
        isOfficial: false, // Mark as imported
        language: 'en',
      }
    });

    for (const unit of list.units || []) {
      // Create unit
      const vocabularyUnit = await prisma.vocabularyUnit.create({
        data: {
          listId: vocabularyList.id,
          title: unit.title,
          description: unit.description,
          orderIndex: unit.order || 0,
        }
      });

      // Create terms
      const terms = (unit.terms || []).map((term: ParrotoTerm, index: number) => ({
        unitId: vocabularyUnit.id,
        word: term.word,
        definition: term.definition,
        pronunciation: term.pronunciation,
        translationVi: term.translation,
        examples: term.examples || [],
        orderIndex: index,
        difficulty: 'intermediate',
      }));

      await prisma.vocabularyTerm.createMany({
        data: terms,
      });
    }
  }
}
```

---

## 🚀 Usage

### Step 1: Analyze API
```bash
# Open browser, go to https://parroto.app/vocabulary
# Open DevTools → Network tab
# Note down API endpoints and structure
```

### Step 2: Update Script
```bash
# Update BASE_URL in script
# Update request headers if needed
# Test with 1-2 requests first
```

### Step 3: Run Crawler
```bash
# TypeScript
npx ts-node scripts/crawl-parroto.ts

# Python
python scripts/crawl_parroto.py
```

### Step 4: Import to Database
```bash
npx ts-node scripts/transform-parroto-data.ts
```

---

## 🎯 Next Steps

1. **Analyze Parroto API** (manual step)
2. **Update crawler script** with actual endpoints
3. **Test with small dataset** first
4. **Run full crawl** (be respectful!)
5. **Transform and import** to your database
6. **Add attribution** in app (e.g., "Data sourced from Parroto")

---

## 📝 Checklist

- [ ] Check Parroto Terms of Service
- [ ] Analyze API endpoints via DevTools
- [ ] Update BASE_URL in script
- [ ] Add necessary headers (auth, user-agent)
- [ ] Test with 1 list first
- [ ] Implement rate limiting
- [ ] Add error handling
- [ ] Run full crawl
- [ ] Save to JSON
- [ ] Transform to your schema
- [ ] Import to database
- [ ] Add attribution
- [ ] Test vocabulary feature

