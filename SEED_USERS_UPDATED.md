# Seed File Updated - 3 Predefined Users

## Summary

Updated `prisma/seed.ts` to create 3 specific users with bcrypt-hashed password.

## Created Users
The seed file will now create:

1. **Admin User**
   - Email: `admin@gmail.com`
   - Role: `admin`
   - Password: `123456aA@`

2. **Student User**
   - Email: `student@gmail.com`
   - Role: `student`
   - Password: `123456aA@`

3. **Parent User**
   - Email: `parent@gmail.com`
   - Role: `parent`
   - Password: `123456aA@`

## Changes Made
1. ✅ Uncommented the seed file
2. ✅ Replaced example users with the 3 required users
3. ✅ Updated password hash from "P@ssw0rd!" to "123456aA@"
4. ✅ Removed `username` field (not in User schema)
5. ✅ Added `displayName` field for better UX
6. ✅ Set proper roles: admin, student, parent
7. ✅ Removed course/lesson seeding (had schema errors)
8. ✅ Verified no TypeScript errors

## How to Run
From the `english-learning/` directory:

```bash
# Make sure database is running
docker compose up -d postgres

# Run the seed command
npm run prisma:seed
# or
npx prisma db seed --schema libs/database/prisma/schema.prisma
```

## Expected Output
```
🌱 Seeding database...
✅ Created users:
   - admin@gmail.com (Admin)
   - student@gmail.com (Student)
   - parent@gmail.com (Parent)
   - Password for all: 123456aA@
✅ Seed completed successfully!
```

## Testing Login
After seeding, you can test login with:
- **Email**: admin@gmail.com / student@gmail.com / parent@gmail.com
- **Password**: 123456aA@

## Notes
- Uses `upsert` so running seed multiple times is safe (won't create duplicates)
- Password is hashed with bcrypt (salt rounds = 10)
- All users have:
  - `emailVerified: true`
  - `status: active`
  - `language: en`
  - `timezone: Asia_Ho_Chi_Minh`
  - `provider: local`
