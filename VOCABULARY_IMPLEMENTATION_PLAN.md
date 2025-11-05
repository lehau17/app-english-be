# Vocabulary System - Implementation Plan

## 🎯 Overview

Implement hệ thống vocabulary giống Parroto.app với cấu trúc:
- **VocabularyList** (Danh sách): IELTS, TOEIC, Business English...
- **VocabularyUnit** (Unit): Unit 1, Unit 2... trong mỗi danh sách
- **VocabularyTerm** (Từ vựng): Các từ trong unit
- **SRS Algorithm**: Spaced Repetition cho việc ôn tập hiệu quả

---

## 📋 PHASE 1: Database Schema & Migration

### 1.1. Update Prisma Schema

**File:** `libs/database/prisma/schema.prisma`

```prisma
// Add new models (see VOCABULARY_SCHEMA_DESIGN.md)
model VocabularyList { ... }
model VocabularyUnit { ... }
model VocabularyTerm { ... }
model UserVocabularyList { ... }
model UserVocabularyProgress { ... }
model VocabularyReviewSession { ... }
```

**Update User model:**
```prisma
model User {
  // ... existing fields

  createdVocabLists    VocabularyList[]         @relation("VocabularyListCreator")
  addedVocabLists      UserVocabularyList[]
  vocabularyProgress   UserVocabularyProgress[]
  vocabReviewSessions  VocabularyReviewSession[]
}
```

### 1.2. Create Migration

```bash
cd english-learning
npx prisma migrate dev --name add_vocabulary_system
npx prisma generate
```

### 1.3. Seed Data (Optional)

Create sample vocabulary lists:
- IELTS Vocabulary (Band 6.0-7.0)
- TOEIC Essential Words
- Business English
- Travel & Tourism

**File:** `libs/database/prisma/seed-vocabulary.ts`

---

## 📋 PHASE 2: Backend - DTOs & Types

### 2.1. Create DTOs

**File:** `apps/client-api/src/domains/vocabulary/dto/vocabulary-list.dto.ts`

```typescript
// List DTOs
export class CreateVocabularyListDto {
  title: string
  description?: string
  difficulty: DifficultyLevel
  category?: string
  level?: string
  thumbnailUrl?: string
  isPublic?: boolean
}

export class UpdateVocabularyListDto {
  title?: string
  description?: string
  difficulty?: DifficultyLevel
  thumbnailUrl?: string
}

export class VocabularyListResponseDto {
  id: string
  title: string
  description?: string
  difficulty: string
  category?: string
  thumbnailUrl?: string
  totalTerms: number
  totalUnits: number
  userCount: number
  isPublic: boolean
  isOfficial: boolean
  createdAt: Date
}
```

**File:** `apps/client-api/src/domains/vocabulary/dto/vocabulary-unit.dto.ts`

```typescript
export class CreateVocabularyUnitDto {
  title: string
  description?: string
  orderIndex?: number
}

export class VocabularyUnitResponseDto {
  id: string
  title: string
  description?: string
  orderIndex: number
  termCount: number
  terms?: VocabularyTermResponseDto[]
}
```

**File:** `apps/client-api/src/domains/vocabulary/dto/vocabulary-term.dto.ts`

```typescript
export class CreateVocabularyTermDto {
  word: string
  definition: string
  pronunciation?: string
  partOfSpeech?: string
  audioUrl?: string
  imageUrl?: string
  examples?: Array<{ sentence: string; translation?: string }>
  synonyms?: string[]
  antonyms?: string[]
  translationVi?: string
  orderIndex?: number
}

export class VocabularyTermResponseDto {
  id: string
  word: string
  definition: string
  pronunciation?: string
  partOfSpeech?: string
  audioUrl?: string
  imageUrl?: string
  examples?: any
  synonyms?: string[]
  antonyms?: string[]
  translationVi?: string
  orderIndex: number
  // User progress (if authenticated)
  userProgress?: UserProgressDto
}
```

**File:** `apps/client-api/src/domains/vocabulary/dto/review.dto.ts`

```typescript
export class ReviewCardDto {
  termId: string
  quality: number // 0-5 (SM-2 algorithm)
}

export class StartReviewSessionDto {
  listId?: string
  unitId?: string
  limit?: number
  mode: 'flashcard' | 'quiz' | 'typing'
}

export class ReviewSessionResponseDto {
  terms: VocabularyTermResponseDto[]
  totalDue: number
  newCount: number
  reviewCount: number
}

export class SubmitReviewDto {
  sessionId?: string
  reviews: ReviewCardDto[]
}
```

---

## 📋 PHASE 3: Backend - Services & Logic

### 3.1. Vocabulary List Service

**File:** `apps/client-api/src/domains/vocabulary/service/vocabulary-list.service.ts`

```typescript
@Injectable()
export class VocabularyListService {
  // Public lists
  async getPublicLists(filters: {
    category?: string
    difficulty?: string
    search?: string
    page?: number
    limit?: number
  }): Promise<PaginatedResponse<VocabularyListResponseDto>>

  // Get single list
  async getList(listId: string, userId?: string): Promise<VocabularyListResponseDto>

  // User's lists
  async getUserLists(userId: string): Promise<VocabularyListResponseDto[]>

  // Add list to user's collection
  async addListToUser(userId: string, listId: string): Promise<void>

  // Remove list from user
  async removeListFromUser(userId: string, listId: string): Promise<void>

  // Admin: Create/Update/Delete list
  async createList(dto: CreateVocabularyListDto, creatorId: string): Promise<VocabularyListResponseDto>
  async updateList(listId: string, dto: UpdateVocabularyListDto): Promise<VocabularyListResponseDto>
  async deleteList(listId: string): Promise<void>
}
```

### 3.2. Vocabulary Unit Service

**File:** `apps/client-api/src/domains/vocabulary/service/vocabulary-unit.service.ts`

```typescript
@Injectable()
export class VocabularyUnitService {
  // Get units in a list
  async getUnits(listId: string): Promise<VocabularyUnitResponseDto[]>

  // Get single unit with terms
  async getUnit(unitId: string, userId?: string): Promise<VocabularyUnitResponseDto>

  // Admin: CRUD units
  async createUnit(listId: string, dto: CreateVocabularyUnitDto): Promise<VocabularyUnitResponseDto>
  async updateUnit(unitId: string, dto: UpdateVocabularyUnitDto): Promise<VocabularyUnitResponseDto>
  async deleteUnit(unitId: string): Promise<void>
  async reorderUnits(listId: string, unitIds: string[]): Promise<void>
}
```

### 3.3. Vocabulary Term Service

**File:** `apps/client-api/src/domains/vocabulary/service/vocabulary-term.service.ts`

```typescript
@Injectable()
export class VocabularyTermService {
  // Get terms in a unit
  async getTerms(unitId: string, userId?: string): Promise<VocabularyTermResponseDto[]>

  // Get single term
  async getTerm(termId: string, userId?: string): Promise<VocabularyTermResponseDto>

  // Admin: CRUD terms
  async createTerm(unitId: string, dto: CreateVocabularyTermDto): Promise<VocabularyTermResponseDto>
  async updateTerm(termId: string, dto: UpdateVocabularyTermDto): Promise<VocabularyTermResponseDto>
  async deleteTerm(termId: string): Promise<void>
  async reorderTerms(unitId: string, termIds: string[]): Promise<void>

  // Batch import terms from JSON/CSV
  async importTerms(unitId: string, terms: CreateVocabularyTermDto[]): Promise<void>
}
```

### 3.4. SRS Service (Core Algorithm)

**File:** `apps/client-api/src/domains/vocabulary/service/srs.service.ts`

```typescript
@Injectable()
export class SRSService {
  /**
   * SM-2 Algorithm Implementation
   * @param progress Current user progress
   * @param quality Rating 0-5
   * @returns Updated progress
   */
  calculateNextReview(
    progress: UserVocabularyProgress,
    quality: number
  ): {
    easeFactor: number
    interval: number
    repetitions: number
    nextReviewAt: Date
    status: string
  } {
    let { easeFactor, interval, repetitions } = progress

    if (quality >= 3) {
      // Correct answer
      if (repetitions === 0) {
        interval = 1
      } else if (repetitions === 1) {
        interval = 6
      } else {
        interval = Math.round(interval * easeFactor)
      }
      repetitions += 1

      // Update ease factor
      easeFactor = Math.max(
        1.3,
        easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
      )

      // Status progression
      let status = 'learning'
      if (repetitions >= 3 && interval >= 21) {
        status = 'mastered'
      } else if (repetitions >= 1) {
        status = 'review'
      }

      return {
        easeFactor,
        interval,
        repetitions,
        nextReviewAt: addDays(new Date(), interval),
        status
      }
    } else {
      // Wrong answer - reset
      return {
        easeFactor: Math.max(1.3, easeFactor - 0.2),
        interval: 1,
        repetitions: 0,
        nextReviewAt: addDays(new Date(), 1),
        status: 'learning'
      }
    }
  }

  /**
   * Get due cards for review
   */
  async getDueCards(userId: string, limit: number = 20): Promise<VocabularyTermResponseDto[]>

  /**
   * Get new cards to learn
   */
  async getNewCards(userId: string, listId?: string, limit: number = 10): Promise<VocabularyTermResponseDto[]>
}
```

### 3.5. Review Service

**File:** `apps/client-api/src/domains/vocabulary/service/review.service.ts`

```typescript
@Injectable()
export class ReviewService {
  constructor(
    private readonly srsService: SRSService,
    private readonly repository: VocabularyRepository
  ) {}

  // Start review session
  async startSession(userId: string, dto: StartReviewSessionDto): Promise<ReviewSessionResponseDto>

  // Submit review results
  async submitReview(userId: string, dto: SubmitReviewDto): Promise<{
    correct: number
    wrong: number
    nextReviewDate: Date
  }>

  // Get review statistics
  async getStats(userId: string, listId?: string): Promise<{
    totalTerms: number
    newCount: number
    learningCount: number
    reviewCount: number
    masteredCount: number
    dueToday: number
  }>
}
```

---

## 📋 PHASE 4: Backend - Controllers & APIs

### 4.1. Vocabulary List Controller

**File:** `apps/client-api/src/domains/vocabulary/controller/vocabulary-list.controller.ts`

```typescript
@Controller('/private/v1/vocabulary/lists')
@ApiTags('Vocabulary Lists')
@ApiBearerAuth('Authorization')
export class VocabularyListController {
  // GET /private/v1/vocabulary/lists - Browse public lists
  @Get()
  async getLists(@Query() filters: GetListsDto)

  // GET /private/v1/vocabulary/lists/:id - Get list detail
  @Get(':id')
  async getList(@Param('id') id: string, @PayloadToken() user: JwtPayload)

  // GET /private/v1/vocabulary/lists/my/lists - User's lists
  @Get('my/lists')
  async getMyLists(@PayloadToken() user: JwtPayload)

  // POST /private/v1/vocabulary/lists/:id/add - Add list to my collection
  @Post(':id/add')
  async addToMyLists(@Param('id') id: string, @PayloadToken() user: JwtPayload)

  // DELETE /private/v1/vocabulary/lists/:id/remove
  @Delete(':id/remove')
  async removeFromMyLists(@Param('id') id: string, @PayloadToken() user: JwtPayload)
}
```

### 4.2. Vocabulary Unit Controller

**File:** `apps/client-api/src/domains/vocabulary/controller/vocabulary-unit.controller.ts`

```typescript
@Controller('/private/v1/vocabulary/lists/:listId/units')
@ApiTags('Vocabulary Units')
@ApiBearerAuth('Authorization')
export class VocabularyUnitController {
  // GET /private/v1/vocabulary/lists/:listId/units
  @Get()
  async getUnits(@Param('listId') listId: string)

  // GET /private/v1/vocabulary/lists/:listId/units/:id
  @Get(':id')
  async getUnit(@Param('id') id: string, @PayloadToken() user: JwtPayload)
}
```

### 4.3. Vocabulary Review Controller

**File:** `apps/client-api/src/domains/vocabulary/controller/vocabulary-review.controller.ts`

```typescript
@Controller('/private/v1/vocabulary/review')
@ApiTags('Vocabulary Review')
@ApiBearerAuth('Authorization')
export class VocabularyReviewController {
  // GET /private/v1/vocabulary/review/session - Start review session
  @Get('session')
  async startSession(@PayloadToken() user: JwtPayload, @Query() dto: StartReviewSessionDto)

  // POST /private/v1/vocabulary/review/submit - Submit review results
  @Post('submit')
  async submitReview(@PayloadToken() user: JwtPayload, @Body() dto: SubmitReviewDto)

  // GET /private/v1/vocabulary/review/stats - Get statistics
  @Get('stats')
  async getStats(@PayloadToken() user: JwtPayload, @Query('listId') listId?: string)

  // GET /private/v1/vocabulary/review/due - Get due cards
  @Get('due')
  async getDueCards(@PayloadToken() user: JwtPayload, @Query('limit') limit?: number)
}
```

### 4.4. Admin Controller (CRUD)

**File:** `apps/client-api/src/domains/vocabulary/controller/admin-vocabulary.controller.ts`

```typescript
@Controller('/private/v1/admin/vocabulary')
@ApiTags('Admin - Vocabulary')
@ApiBearerAuth('Authorization')
@Roles('admin', 'teacher')
export class AdminVocabularyController {
  // Lists management
  @Post('lists')
  async createList(@Body() dto: CreateVocabularyListDto, @PayloadToken() user: JwtPayload)

  @Put('lists/:id')
  async updateList(@Param('id') id: string, @Body() dto: UpdateVocabularyListDto)

  @Delete('lists/:id')
  async deleteList(@Param('id') id: string)

  // Units management
  @Post('lists/:listId/units')
  async createUnit(@Param('listId') listId: string, @Body() dto: CreateVocabularyUnitDto)

  @Put('units/:id')
  async updateUnit(@Param('id') id: string, @Body() dto: UpdateVocabularyUnitDto)

  @Delete('units/:id')
  async deleteUnit(@Param('id') id: string)

  // Terms management
  @Post('units/:unitId/terms')
  async createTerm(@Param('unitId') unitId: string, @Body() dto: CreateVocabularyTermDto)

  @Post('units/:unitId/terms/import')
  async importTerms(@Param('unitId') unitId: string, @Body() terms: CreateVocabularyTermDto[])

  @Put('terms/:id')
  async updateTerm(@Param('id') id: string, @Body() dto: UpdateVocabularyTermDto)

  @Delete('terms/:id')
  async deleteTerm(@Param('id') id: string)
}
```

---

## 📋 PHASE 5: Frontend - Types & APIs

### 5.1. Types

**File:** `englishWeb/src/types/vocabulary.type.ts`

```typescript
export interface VocabularyList {
  id: string
  title: string
  description?: string
  difficulty: string
  category?: string
  thumbnailUrl?: string
  totalTerms: number
  totalUnits: number
  userCount: number
  isPublic: boolean
  isOfficial: boolean
  createdAt: string
}

export interface VocabularyUnit {
  id: string
  title: string
  description?: string
  orderIndex: number
  termCount: number
  terms?: VocabularyTerm[]
}

export interface VocabularyTerm {
  id: string
  word: string
  definition: string
  pronunciation?: string
  partOfSpeech?: string
  audioUrl?: string
  imageUrl?: string
  examples?: Array<{ sentence: string; translation?: string }>
  synonyms?: string[]
  antonyms?: string[]
  translationVi?: string
  userProgress?: UserProgress
}

export interface UserProgress {
  status: 'new' | 'learning' | 'review' | 'mastered'
  nextReviewAt: string
  correctCount: number
  wrongCount: number
  repetitions: number
}

export interface ReviewSession {
  terms: VocabularyTerm[]
  totalDue: number
  newCount: number
  reviewCount: number
}

export interface ReviewStats {
  totalTerms: number
  newCount: number
  learningCount: number
  reviewCount: number
  masteredCount: number
  dueToday: number
}
```

### 5.2. API Services

**File:** `englishWeb/src/services/vocabulary.api.ts`

```typescript
import api from '../lib/api'
import type { VocabularyList, VocabularyUnit, VocabularyTerm, ReviewSession, ReviewStats } from '../types/vocabulary.type'

// Lists
export const getVocabularyLists = async (filters?: {
  category?: string
  difficulty?: string
  search?: string
  page?: number
  limit?: number
}) => {
  const response = await api.get('/private/v1/vocabulary/lists', { params: filters })
  return response.data.data
}

export const getVocabularyList = async (id: string): Promise<VocabularyList> => {
  const response = await api.get(`/private/v1/vocabulary/lists/${id}`)
  return response.data.data
}

export const getMyVocabularyLists = async (): Promise<VocabularyList[]> => {
  const response = await api.get('/private/v1/vocabulary/lists/my/lists')
  return response.data.data
}

export const addListToMyCollection = async (listId: string) => {
  const response = await api.post(`/private/v1/vocabulary/lists/${listId}/add`)
  return response.data
}

// Units
export const getUnits = async (listId: string): Promise<VocabularyUnit[]> => {
  const response = await api.get(`/private/v1/vocabulary/lists/${listId}/units`)
  return response.data.data
}

export const getUnit = async (listId: string, unitId: string): Promise<VocabularyUnit> => {
  const response = await api.get(`/private/v1/vocabulary/lists/${listId}/units/${unitId}`)
  return response.data.data
}

// Review
export const startReviewSession = async (params: {
  listId?: string
  unitId?: string
  limit?: number
  mode: 'flashcard' | 'quiz' | 'typing'
}): Promise<ReviewSession> => {
  const response = await api.get('/private/v1/vocabulary/review/session', { params })
  return response.data.data
}

export const submitReview = async (reviews: Array<{ termId: string; quality: number }>) => {
  const response = await api.post('/private/v1/vocabulary/review/submit', { reviews })
  return response.data.data
}

export const getReviewStats = async (listId?: string): Promise<ReviewStats> => {
  const response = await api.get('/private/v1/vocabulary/review/stats', {
    params: { listId }
  })
  return response.data.data
}
```

---

## 📋 PHASE 6: Frontend - UI Components

### 6.1. Vocabulary Lists Page

**File:** `englishWeb/src/pages/VocabularyListsPage.tsx`

Features:
- Browse vocabulary lists (grid/list view)
- Filter by category, difficulty
- Search
- "Add to My Lists" button
- Show progress for added lists

### 6.2. Vocabulary List Detail Page

**File:** `englishWeb/src/pages/VocabularyListDetailPage.tsx`

Features:
- List info (title, description, stats)
- Units list (collapsible)
- Show terms in each unit
- "Start Review" button
- Progress overview

### 6.3. Flashcard Review Page

**File:** `englishWeb/src/pages/VocabularyFlashcardPage.tsx`

Features:
- Card flip animation (word ↔ definition)
- Quality rating (0-5 buttons)
- Progress bar
- Audio playback
- "Show Answer" button
- Skip/Next buttons

### 6.4. My Vocabulary Page

**File:** `englishWeb/src/pages/MyVocabularyPage.tsx`

Features:
- User's added lists
- Overall statistics
- Due cards count
- Calendar heatmap (study streak)
- Quick review button

### 6.5. Reusable Components

**Components to create:**
- `<VocabularyListCard />` - List thumbnail card
- `<VocabularyUnitCard />` - Unit card with progress
- `<VocabularyTermCard />` - Term card with definition
- `<Flashcard />` - Flip card component
- `<ProgressRing />` - Circular progress indicator
- `<StudyStreak />` - Calendar heatmap
- `<ReviewStats />` - Stats dashboard

---

## 📋 PHASE 7: Mobile App (englishMobile)

### Similar structure to Web:
- Lists screen
- Unit detail screen
- Flashcard screen
- Review screen
- My vocabulary screen

**Use same API services**

---

## 📋 PHASE 8: CMS (cms-english)

### Admin features:
- Create/Edit/Delete Lists
- Create/Edit/Delete Units
- Create/Edit/Delete Terms
- Import terms from CSV/JSON
- Reorder units and terms
- View usage statistics
- Manage user progress (reset, etc.)

---

## 🚀 Implementation Timeline

### Week 1: Database & Backend Foundation
- ✅ Update Prisma schema
- ✅ Create migrations
- ✅ Create DTOs
- ✅ Implement repositories

### Week 2: Backend Services
- ✅ VocabularyListService
- ✅ VocabularyUnitService
- ✅ VocabularyTermService
- ✅ SRSService (core algorithm)

### Week 3: Backend APIs & Testing
- ✅ All controllers
- ✅ API testing
- ✅ Seed sample data

### Week 4: Frontend Web (englishWeb)
- ✅ Types & API services
- ✅ Lists page
- ✅ Detail page
- ✅ Flashcard page

### Week 5: Frontend Mobile & CMS
- ✅ Mobile screens
- ✅ CMS admin pages
- ✅ Import/Export tools

### Week 6: Polish & Launch
- ✅ Bug fixes
- ✅ Performance optimization
- ✅ Documentation
- ✅ User testing

---

## 📚 Reference Materials

### SM-2 Algorithm:
- https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
- https://github.com/thyagoluciano/sm2

### Parroto-like UI/UX:
- Clean, minimal design
- Card-based layout
- Progress indicators everywhere
- Gamification (streaks, achievements)
- Easy navigation

### Sample Data Sources:
- Oxford 3000 word list
- IELTS vocabulary lists
- TOEIC essential words
- Business English vocabulary

---

## ✅ Success Criteria

- [ ] User can browse and add vocabulary lists
- [ ] User can review vocabulary with flashcards
- [ ] SRS algorithm works correctly (cards appear at right time)
- [ ] Progress tracking is accurate
- [ ] Admin can create and manage vocabulary content
- [ ] Mobile app has feature parity with web
- [ ] Performance is good (< 2s page load)
- [ ] UI is intuitive and beautiful

---

## 🎯 Next Steps

1. Review and approve this plan
2. Start with Phase 1 (Database Schema)
3. Implement phase by phase
4. Test each phase before moving to next
5. Deploy to staging for user testing
6. Launch to production

**Ready to start implementation?** 🚀


