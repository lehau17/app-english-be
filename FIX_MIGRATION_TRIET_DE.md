# 🔧 Fix Migration Drift Triệt Để - Complete Guide

## ⚠️ Vấn Đề Hiện Tại

```
1. Migration 20250926090000_add_score_change_notifications - modified after applied
2. Migration 20251012110000_baseline_updatedAt - modified after applied
3. Orphaned migration 20251012100000_fix_updatedAt_drift - in DB but not in local
```

## ✅ Solution: Clean & Rebuild

---

## 🚀 Option 1: Automated Script (Khuyến Nghị)

```bash
cd /Users/hiteksofftware/Desktop/KLTN/english-learning
./fix-migration-triet-de.sh
```

Script sẽ:
1. Xóa orphaned migration từ database
2. Apply migrations mới
3. Verify status

---

## 🛠️ Option 2: Manual Steps

### **Step 1: Connect to Database**

```bash
cd /Users/hiteksofftware/Desktop/KLTN/english-learning

# Get database URL from .env
cat .env | grep DATABASE_URL
```

### **Step 2: Clean Orphaned Migration**

**Via Prisma CLI:**
```bash
npx prisma db execute --file clean-orphaned-migration.sql --schema libs/database/prisma/schema.prisma
```

**Or connect to PostgreSQL directly:**
```bash
psql "postgresql://user:pass@34.124.234.184:5432/english_learning"
```

Then run:
```sql
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20251012100000_fix_updatedAt_drift';

-- Verify
SELECT migration_name, finished_at
FROM "_prisma_migrations"
ORDER BY finished_at DESC
LIMIT 5;
```

### **Step 3: Apply Migrations**

```bash
npx prisma migrate dev --schema libs/database/prisma/schema.prisma
```

When prompted for migration name:
```
baseline_updatedAt
```

### **Step 4: Verify**

```bash
npx prisma migrate status --schema libs/database/prisma/schema.prisma
```

Expected output:
```
✓ Database schema is up to date!
```

---

## 🔥 Option 3: Nuclear Reset (If Nothing Works)

**⚠️ MATTERẤT CẢ DỮ LIỆU - CHỈ DÙNG TRÊN DEV!**

```bash
cd /Users/hiteksofftware/Desktop/KLTN/english-learning

# Backup first (optional)
npx prisma db pull --schema libs/database/prisma/schema.prisma

# Reset everything
npx prisma migrate reset --schema libs/database/prisma/schema.prisma --skip-seed

# Confirm: yes
```

---

## 📋 Quick Reference Commands

### Check Migration Status
```bash
npx prisma migrate status --schema libs/database/prisma/schema.prisma
```

### List Migrations in DB
```bash
npx prisma db execute --stdin --schema libs/database/prisma/schema.prisma <<EOF
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY finished_at DESC;
EOF
```

### Remove Specific Migration from DB
```bash
npx prisma db execute --stdin --schema libs/database/prisma/schema.prisma <<EOF
DELETE FROM "_prisma_migrations"
WHERE migration_name = 'MIGRATION_NAME_HERE';
EOF
```

### Apply Pending Migrations
```bash
npx prisma migrate deploy --schema libs/database/prisma/schema.prisma
```

### Force Resolve Migration
```bash
npx prisma migrate resolve --applied MIGRATION_NAME --schema libs/database/prisma/schema.prisma
```

---

## 🎯 Recommended Workflow

1. **Clean orphaned migration:**
   ```bash
   npx prisma db execute --file clean-orphaned-migration.sql --schema libs/database/prisma/schema.prisma
   ```

2. **Apply new migrations:**
   ```bash
   npx prisma migrate dev --schema libs/database/prisma/schema.prisma
   ```

3. **Generate Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

4. **Test application:**
   ```bash
   npm run start:client-api:dev
   ```

---

## 🐛 Troubleshooting

### Error: "Migration was modified after it was applied"

**Cause:** Migration file changed after being recorded in `_prisma_migrations`

**Fix:**
1. Restore original file from git: `git checkout -- path/to/migration.sql`
2. Or delete from DB: `DELETE FROM "_prisma_migrations" WHERE migration_name = 'XXX'`

### Error: "Migration failed to apply cleanly to shadow database"

**Cause:** Migration expects DB state that doesn't exist in shadow DB

**Fix:** Ensure migration uses conditional logic (`IF NOT EXISTS`, `DO $$ BEGIN ... EXCEPTION ... END $$`)

### Error: "Drift detected"

**Cause:** Database schema doesn't match migration history

**Fix:**
1. Update schema.prisma to match DB
2. Create baseline migration
3. Or reset: `npx prisma migrate reset`

---

## 📚 Files Created

- `clean-orphaned-migration.sql` - SQL to remove orphaned migration
- `fix-migration-triet-de.sh` - Automated fix script
- `FIX_MIGRATION_TRIET_DE.md` - This guide

---

## ✅ Success Criteria

After running fix:

```
✓ No orphaned migrations in _prisma_migrations table
✓ All local migrations applied to database
✓ No drift detected
✓ prisma migrate status shows "up to date"
```

---

## 🚀 Quick Copy-Paste

```bash
cd /Users/hiteksofftware/Desktop/KLTN/english-learning

# Clean
npx prisma db execute --file clean-orphaned-migration.sql --schema libs/database/prisma/schema.prisma

# Apply
npx prisma migrate dev --schema libs/database/prisma/schema.prisma

# Verify
npx prisma migrate status --schema libs/database/prisma/schema.prisma
```

---

**Chọn Option 1 (script) hoặc Option 2 (manual) và chạy ngay! 🚀**
