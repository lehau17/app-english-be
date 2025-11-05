# Vocabulary V2 System - Complete Implementation ✅

## Tổng Quan

Hệ thống Vocabulary V2 hoàn toàn mới được thiết kế theo mô hình **Parroto.app**, bao gồm:
- **Hierarchical Structure**: Vocabulary List → Unit → Term
- **Spaced Repetition System (SRS)**: Thuật toán SM-2 để tối ưu hóa việc học từ vựng
- **User Progress Tracking**: Theo dõi tiến độ học tập của từng user
- **Flashcard Review**: Giao diện flashcard hiện đại và thân thiện

## Kiến Trúc Hệ Thống

### Database Schema

```
VocabularyList (Danh sách từ vựng)
  ├── VocabularyUnit (Các đơn vị/bài học)
  │     └── VocabularyTerm (Các từ vựng)
  └── UserVocabularyList (User đã thêm list vào collection)

UserVocabularyProgress (Tiến độ học của user cho từng term)
VocabularyReviewSession (Lịch sử các session review)
```

### Backend Structure

```
apps/client-api/src/domains/vocabulary-v2/
├── dto/
│   ├── vocabulary-list.dto.ts       # DTO cho Lists
│   ├── vocabulary-unit.dto.ts       # DTO cho Units
│   ├── vocabulary-term.dto.ts       # DTO cho Terms
│   └── review.dto.ts                 # DTO cho Review System
├── repository/
│   └── vocabulary.repository.ts      # Prisma operations
├── service/
│   ├── srs.service.ts                # SM-2 Algorithm
│   ├── vocabulary-list.service.ts    # Business logic cho Lists
│   ├── vocabulary-unit.service.ts    # Business logic cho Units
│   ├── vocabulary-term.service.ts    # Business logic cho Terms
│   └── review.service.ts             # Review session logic
├── controller/
│   ├── vocabulary-list.controller.ts       # Public endpoints
│   ├── vocabulary-unit.controller.ts       # Unit endpoints
│   ├── vocabulary-review.controller.ts     # Review endpoints
│   └── admin-vocabulary.controller.ts      # Admin CRUD
└── vocabulary-v2.module.ts
```

### Frontend Structure

```
englishWeb/src/
├── types/
│   └── vocabulary.type.ts            # TypeScript types
├── services/
│   └── vocabulary.api.ts             # API client
├── hooks/
│   └── vocabulary.hooks.ts           # React Query hooks
└── pages/
    ├── VocabularyListsPage.tsx       # Browse all lists
    ├── VocabularyListDetailPage.tsx  # View list details & units
    ├── VocabularyReviewPage.tsx      # Flashcard review
    └── MyVocabularyPage.tsx          # User's collection & stats
```

## API Endpoints

### Public User Endpoints

#### Lists
- `GET /private/v1/vocabulary/lists` - Browse vocabulary lists (with filters)
- `GET /private/v1/vocabulary/lists/my` - Get user's lists
- `GET /private/v1/vocabulary/lists/:listId` - Get list details
- `POST /private/v1/vocabulary/lists/:listId/add` - Add list to collection
- `DELETE /private/v1/vocabulary/lists/:listId/remove` - Remove from collection

#### Units & Terms
- `GET /private/v1/vocabulary/lists/:listId/units` - Get units in a list
- `GET /private/v1/vocabulary/lists/:listId/units/:unitId` - Get unit details with terms

#### Review System
- `GET /private/v1/vocabulary/review/session` - Start review session
  - Query params: `listId`, `unitId`, `mode`, `limit`, `includeNew`, `includeReview`
- `POST /private/v1/vocabulary/review/submit` - Submit review results
- `GET /private/v1/vocabulary/review/stats` - Get user stats
  - Query params: `listId` (optional)
- `GET /private/v1/vocabulary/review/due` - Get due cards for review
  - Query params: `listId`, `limit`

### Admin Endpoints

#### Lists Management
- `POST /private/v1/admin/vocabulary/lists` - Create list
- `PUT /private/v1/admin/vocabulary/lists/:id` - Update list
- `DELETE /private/v1/admin/vocabulary/lists/:id` - Delete list

#### Units Management
- `POST /private/v1/admin/vocabulary/lists/:listId/units` - Create unit
- `PUT /private/v1/admin/vocabulary/units/:id` - Update unit
- `DELETE /private/v1/admin/vocabulary/units/:id` - Delete unit
- `PATCH /private/v1/admin/vocabulary/units/:id/reorder` - Reorder unit

#### Terms Management
- `POST /private/v1/admin/vocabulary/units/:unitId/terms` - Create term
- `PUT /private/v1/admin/vocabulary/terms/:id` - Update term
- `DELETE /private/v1/admin/vocabulary/terms/:id` - Delete term
- `POST /private/v1/admin/vocabulary/units/:unitId/terms/import` - Bulk import
- `PATCH /private/v1/admin/vocabulary/terms/:id/reorder` - Reorder term

## Spaced Repetition System (SRS)

### SM-2 Algorithm

Hệ thống sử dụng thuật toán **SuperMemo SM-2** để tối ưu hóa việc ôn tập:

```typescript
// User rating: 0-5
// 0 = Forgot completely
// 1-2 = Hard (remembered with difficulty)
// 3-4 = Good (remembered correctly)
// 5 = Easy (remembered instantly)

// Formula:
EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))

// Interval calculation:
if q >= 3:
  if repetitions === 0: interval = 1 day
  if repetitions === 1: interval = 6 days
  if repetitions >= 2: interval = previous_interval * EF

if q < 3:
  repetitions = 0
  interval = 1 day
```

### Card States

- **new**: Chưa học lần nào
- **learning**: Đang học (0-2 lần đúng)
- **review**: Đang ôn tập (3+ lần đúng)
- **mastered**: Thành thạo (EF > 2.5, interval > 21 days)

## Sample Data

Hệ thống đã được seed với 3 vocabulary lists mẫu:

### 1. IELTS Essential Vocabulary
- **Level**: Band 6.0-7.5
- **Units**: Environment & Climate, Education & Learning
- **Terms**: 8 terms (sustainable, biodiversity, pollution, etc.)

### 2. TOEIC Business Vocabulary
- **Level**: 600-800
- **Units**: Business Communication
- **Terms**: 3 terms (agenda, negotiate, deadline)

### 3. Everyday English Conversation
- **Level**: A1-A2
- **Units**: Greetings & Introductions
- **Terms**: 2 terms (introduction, pleasure)

## Setup & Usage

### 1. Database

```bash
# Generate Prisma client
npx prisma generate

# Sync database
npx prisma db push

# Seed sample data
npx ts-node prisma/seeds/vocabulary-seed.ts
```

### 2. Backend

```bash
# Build
npm run build:client-api

# Run dev
npm run start:client-api:dev
```

### 3. Frontend

```bash
cd englishWeb

# Install dependencies (if needed)
npm install

# Build
npm run build

# Run dev
npm run dev
```

### 4. Access

- **Browse Lists**: http://localhost:5173/vocabulary
- **My Collection**: http://localhost:5173/vocabulary/my-lists
- **API Docs**: http://localhost:3334/api/docs

## Frontend Routes

```typescript
/vocabulary                      # Browse all vocabulary lists
/vocabulary/lists/:listId        # View list details
/vocabulary/review/:listId       # Review flashcards for a list
/vocabulary/review               # Review all due cards
/vocabulary/my-lists             # User's vocabulary collection
```

## Features Implemented

### ✅ Core Features
- [x] Hierarchical vocabulary structure (List → Unit → Term)
- [x] Full CRUD operations (Admin)
- [x] User collection management (Add/Remove lists)
- [x] Spaced Repetition System (SM-2)
- [x] Flashcard review interface
- [x] Progress tracking per term
- [x] Review statistics & streaks
- [x] Due cards calculation
- [x] Filters (category, difficulty, search)
- [x] Pagination support

### ✅ UI/UX
- [x] Modern, clean design
- [x] Grid & List view modes
- [x] Progress bars & indicators
- [x] Responsive layout
- [x] Loading states
- [x] Error handling
- [x] Toast notifications

### ✅ Data Model
- [x] VocabularyList with metadata (difficulty, category, level)
- [x] VocabularyUnit with ordering
- [x] VocabularyTerm with rich content (IPA, examples, synonyms, antonyms)
- [x] UserVocabularyProgress with SRS data
- [x] VocabularyReviewSession logging

## API Response Examples

### Get Vocabulary Lists

```json
GET /private/v1/vocabulary/lists?category=IELTS&difficulty=intermediate

{
  "statusCode": 200,
  "message": "OK",
  "data": {
    "data": [
      {
        "id": "...",
        "title": "IELTS Essential Vocabulary",
        "description": "Essential vocabulary for IELTS...",
        "difficulty": "intermediate",
        "category": "IELTS",
        "level": "Band 6.0-7.5",
        "totalTerms": 8,
        "totalUnits": 2,
        "userCount": 5,
        "isOfficial": true,
        "userProgress": {
          "completedTerms": 3,
          "totalTerms": 8,
          "lastStudiedAt": "2025-01-01T10:00:00Z",
          "addedAt": "2025-01-01T09:00:00Z"
        }
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### Start Review Session

```json
GET /private/v1/vocabulary/review/session?listId=xxx&mode=flashcard&limit=20

{
  "statusCode": 200,
  "message": "OK",
  "data": {
    "terms": [
      {
        "id": "...",
        "word": "sustainable",
        "definition": "able to be maintained at a certain rate or level",
        "pronunciation": "səˈsteɪnəbl",
        "partOfSpeech": "adjective",
        "translationVi": "bền vững",
        "examples": [
          {
            "sentence": "We need to develop sustainable energy sources.",
            "translation": "Chúng ta cần phát triển các nguồn năng lượng bền vững."
          }
        ],
        "synonyms": ["viable", "maintainable"],
        "userProgress": {
          "status": "learning",
          "nextReviewAt": "2025-01-02T10:00:00Z",
          "correctCount": 2,
          "wrongCount": 1,
          "repetitions": 2
        }
      }
    ],
    "totalDue": 5,
    "newCount": 3,
    "reviewCount": 2,
    "mode": "flashcard"
  }
}
```

### Get Review Stats

```json
GET /private/v1/vocabulary/review/stats

{
  "statusCode": 200,
  "message": "OK",
  "data": {
    "totalTerms": 13,
    "newCount": 5,
    "learningCount": 4,
    "reviewCount": 3,
    "masteredCount": 1,
    "dueToday": 7,
    "currentStreak": 5,
    "longestStreak": 12,
    "totalReviews": 45,
    "lastStudiedAt": "2025-01-01T15:30:00Z"
  }
}
```

## Tech Stack

### Backend
- **Framework**: NestJS
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger

### Frontend
- **Framework**: React + Vite
- **State Management**: TanStack Query (React Query)
- **Styling**: Tailwind CSS
- **Routing**: React Router
- **Icons**: Lucide React
- **Notifications**: react-hot-toast

## Best Practices

### Backend
- ✅ DTOs với validation decorators
- ✅ Repository pattern cho database operations
- ✅ Service layer cho business logic
- ✅ Controller chỉ handle HTTP
- ✅ Error handling với NestJS exception filters
- ✅ Swagger documentation

### Frontend
- ✅ React Query cho data fetching & caching
- ✅ Custom hooks cho reusable logic
- ✅ TypeScript types matching backend DTOs
- ✅ Component composition
- ✅ Loading & error states
- ✅ Responsive design

## Future Enhancements

### Potential Features
- [ ] Typing quiz mode (type the word)
- [ ] Multiple choice quiz
- [ ] Audio pronunciation (TTS integration)
- [ ] Image upload for terms
- [ ] Import/Export vocabulary lists
- [ ] Shared lists (social feature)
- [ ] Leaderboard
- [ ] Daily goals & reminders
- [ ] Mobile app (React Native)
- [ ] Offline mode (PWA)

## Troubleshooting

### Database Issues
```bash
# Reset database
npx prisma migrate reset

# Regenerate client
npx prisma generate

# Re-seed
npx ts-node prisma/seeds/vocabulary-seed.ts
```

### Build Issues
```bash
# Backend
cd english-learning
rm -rf dist node_modules
npm install
npm run build:client-api

# Frontend
cd englishWeb
rm -rf dist node_modules
npm install
npm run build
```

## API Testing với Swagger

Truy cập: `http://localhost:3334/api/docs`

Swagger UI cung cấp:
- Danh sách tất cả endpoints
- Request/Response schemas
- Try-it-out để test API
- Authentication (Bearer token)

## Kết Luận

Hệ thống Vocabulary V2 đã được triển khai đầy đủ với:
- ✅ Database schema phân cấp
- ✅ Backend APIs hoàn chỉnh (CRUD + Review)
- ✅ Frontend pages đẹp và thân thiện
- ✅ Spaced Repetition System (SM-2)
- ✅ Sample data để test
- ✅ Build thành công cả BE & FE

User có thể:
1. Browse danh sách từ vựng
2. Thêm list vào collection
3. Review flashcards với SRS
4. Theo dõi tiến độ học tập
5. Xem thống kê và streak

Hệ thống sẵn sàng để sử dụng! 🎉

