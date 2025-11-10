# Fix Author Display - Always Shows "AI Generated"

## ❌ Problem:

Frontend luôn hiển thị "AI Generated" thay vì tên tác giả thật

**Cause:** API không trả về thông tin `author`, chỉ có `authorId`

---

## ✅ Fix Applied:

### Updated `podcast.repository.ts`:

**Method `findById()`** - Added author populate:

```typescript
async findById(id: string) {
  return this.prisma.podcast.findUnique({
    where: { id },
    include: {
      gaps: true,
      author: {              // ← ADDED
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
  });
}
```

**Method `findAll()`** - Already has author (no change needed)

---

## 🔧 Deploy:

```bash
# SSH to server
cd ~/KLTN/app-english-be

# Pull code
git pull

# Rebuild
npm run build

# Restart
pm2 restart main

# Test API
curl https://api.haudev.io.vn/api/private/v1/podcasts/{podcast-id} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected response:**
```json
{
  "data": {
    "id": "...",
    "title": "test",
    "author": {                    // ← NOW INCLUDED!
      "id": "c66579da-...",
      "displayName": "Hau Dev",
      "firstName": "Hau",
      "lastName": "Dev",
      "avatarUrl": "https://..."
    },
    "authorId": "c66579da-...",
    ...
  }
}
```

---

## 📱 Frontend Display Logic:

In `PodcastDetailPage.tsx` line 464-467:

```typescript
{podcastData.author
  ? `${podcastData.author.firstName || ''} ${podcastData.author.lastName || ''}`.trim() ||
    'Unknown Author'
  : 'AI Generated'}  // ← Fallback if no author
```

**Now with author populated:**
- ✅ Will show: "Hau Dev" (firstName + lastName)
- ✅ Or: "John Smith" (based on user profile)
- ❌ Only shows "AI Generated" if author is null

---

## ✅ After Deploy:

**Test:**
1. Rebuild backend: `npm run build && pm2 restart main`
2. Refresh frontend
3. Open podcast detail page
4. Check author display

**Expected:**
- Shows actual author name (from user profile)
- "AI Generated" only if podcast has no author (orphaned records)

---

## 🔍 Verify API Response:

```bash
# Test API directly
curl -X GET "https://api.haudev.io.vn/api/private/v1/podcasts/a1ffe661-d577-45bc-a495-7b414b62e5ce" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.data.author'

# Expected:
{
  "id": "c66579da-be89-47b6-a3c8-7ff121d68ca6",
  "displayName": "Hau",
  "firstName": "Hau",
  "lastName": "Dev",
  "avatarUrl": null
}
```

---

## 📋 Checklist:

- [x] Code updated - added author populate
- [ ] Backend rebuilt: `npm run build`
- [ ] Backend restarted: `pm2 restart main`
- [ ] Test API response has `author` field
- [ ] Frontend shows correct author name

---

**Status:** Code ready, need to rebuild backend
**Time:** 2 minutes to deploy
**Impact:** Author name will display correctly instead of "AI Generated"







