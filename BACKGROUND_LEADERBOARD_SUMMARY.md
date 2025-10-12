# Background Worker Leaderboard - Quick Summary

## Vấn đề
Background-worker import `LeaderboardService` từ client-api → circular dependency → build fail

## Giải pháp
Tạo service và repository riêng cho background-worker

## Files tạo mới

### 1. `leaderboard.repository.ts`
Copy từ client-api, xử lý:
- Aggregate scores từ nhiều nguồn (assignments, progress, attempts, podcast)
- Apply weights: assignments=1, progress=0.6, attempts=0.4, podcast=0.3
- Save snapshots vào database

### 2. `background-leaderboard.service.ts`
Service cho background worker với 3 methods:
- `rebuildClassroomLeaderboard(classroomId, year, month)`
- `rebuildMonthlyLeaderboard(year, month)`
- `rebuildYearlyLeaderboard(year)`

## Files sửa

### 3. `leaderboard-score-processor.service.ts`
```diff
- import { LeaderboardService } from 'apps/client-api/...'
+ import { BackgroundLeaderboardService } from './background-leaderboard.service'

- await this.leaderboardService.getClassroomLeaderboard(...)
+ await this.leaderboardService.rebuildClassroomLeaderboard(...)
```

### 4. `leaderboard.module.ts`
```diff
- import from '../../../client-api/...'
+ import from './'

providers: [
-   LeaderboardService,
+   BackgroundLeaderboardService,
]
```

## Khác biệt Client-API vs Background-Worker

| Feature | Client-API | Background-Worker |
|---------|------------|-------------------|
| Purpose | HTTP API | Cron jobs |
| Methods | `getXxxLeaderboard()` | `rebuildXxxLeaderboard()` |
| Return | DTO with data | `Promise<void>` |
| Validation | DTOs + validators | Simple interfaces |
| Error | HTTP exceptions | Logger only |

## Build Status
✅ `npm run build:background-worker` - Success  
✅ `npm run build:client-api` - Success  
✅ No circular dependencies  
✅ All types resolved  

## Cách hoạt động
```
Score Change → Database Trigger → Kafka Event
    ↓
ScoreChangeListener (collect events)
    ↓
Cron Job (every 5 min)
    ↓
BackgroundLeaderboardService.rebuild()
    ↓
Repository.aggregateScores() + replaceSnapshots()
    ↓
LeaderboardSnapshot table updated
```

## Next Steps
1. ✅ Build successful
2. Test rebuild với real data
3. Monitor cron logs
4. Verify snapshots update correctly

## Files Changed
- ✅ Created: `leaderboard.repository.ts`
- ✅ Created: `background-leaderboard.service.ts`  
- ✅ Modified: `leaderboard-score-processor.service.ts`
- ✅ Modified: `leaderboard.module.ts`
