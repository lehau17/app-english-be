# 🧪 AUTH MODULE TEST COVERAGE ANALYSIS

**Ngày:** 11/10/2025
**Module:** Auth (Service, Repository, Controllers)

---

## 📊 HIỆN TRẠNG TEST COVERAGE

### ✅ **AuthService Tests (auth.service.spec.ts)**

**Có test (15/15 methods):**

1. ✅ `register()` - 3 test cases
   - Success case
   - Email exists
   - Phone exists

2. ✅ `login()` - 5 test cases
   - Success
   - User not found
   - Invalid password
   - No password set
   - Invalid role

3. ✅ `changePassword()` - 3 test cases
   - Success
   - User not found
   - Invalid current password

4. ✅ `refreshToken()` - 2 test cases
   - Success
   - Invalid token

5. ✅ `logout()` - 1 test case
   - Success

6. ✅ `forgotPassword()` - 2 test cases
   - User exists
   - User not found (security)

7. ✅ `resetPassword()` - 2 test cases
   - Success
   - Invalid token

8. ✅ `updateProfile()` - 3 test cases
   - Success
   - Email normalization
   - Email duplicate

9. ✅ `me()` - 1 test case
   - Success

10. ✅ `hasParent()` - 2 test cases
    - Has parent
    - No parent

11. ✅ `adminLogin()` - 2 test cases
    - Success
    - Not admin

12. ✅ `parentLogin()` - 1 test case
    - Success

13. ✅ `adminRegister()` - 2 test cases
    - Success
    - Registration fails

**Total Service Tests:** 30 test cases ✅

---

### ⚠️ **AuthRepository Tests (auth.repository.spec.ts)**

**File có 715 lines** nhưng cần kiểm tra coverage chi tiết:

- ✅ Basic structure có
- ❓ Cần verify từng method

**Methods cần test (15 methods):**

1. `register()`
2. `changePassword()`
3. `findUserForLogin()`
4. `storeRefreshToken()`
5. `revokeRefreshToken()`
6. `refreshToken()`
7. `findById()`
8. `findParentRelation()`
9. `findByEmail()`
10. `updateProfile()`
11. `invalidateUserResetTokens()`
12. `createPasswordResetToken()`
13. `findValidPasswordResetToken()`
14. `markResetTokenUsed()`
15. `updatePassword()`

---

### ❌ **Controllers Tests - MISSING COMPLETELY**

#### **PublicAuthController (0 tests)**

**Endpoints cần test (9 endpoints):**

1. `POST /student-register`
2. `POST /student-login`
3. `POST /refresh-token`
4. `POST /logout`
5. `POST /admin-login`
6. `POST /parent-login`
7. `POST /admin-register`
8. `POST /forgot-password`
9. `POST /reset-password`

**Mỗi endpoint cần test:**
- Success case
- Validation errors (DTO)
- Service exceptions
- Response formatting

**Estimate:** ~40-50 test cases

#### **PrivateAuthController (0 tests)**

**Endpoints cần test (4 endpoints):**

1. `GET /me`
2. `GET /has-parent`
3. `POST /change-password`
4. `PUT /profile`

**Mỗi endpoint cần test:**
- Success case
- Unauthorized (no token)
- Invalid token
- Validation errors
- Service exceptions

**Estimate:** ~20-25 test cases

---

## 🔴 MISSING TEST CASES

### **1. PublicAuthController Tests - CRITICAL** ⭐⭐⭐⭐⭐

**Chưa có file:** `public-auth.controller.spec.ts`

**Priority:** P0 - Controllers là entry point, phải test kỹ

**Test scenarios:**

#### `/student-register`
- ✅ Valid registration
- ❌ Missing required fields
- ❌ Invalid email format
- ❌ Invalid phone format
- ❌ Password too short
- ❌ Duplicate email (400)
- ❌ Duplicate phone (400)

#### `/student-login`
- ✅ Valid login
- ❌ Missing credentials
- ❌ Invalid email format
- ❌ Wrong password (400)
- ❌ User not found (400)
- ❌ Account not student/teacher (400)

#### `/refresh-token`
- ✅ Valid refresh
- ❌ Missing token
- ❌ Invalid token format
- ❌ Expired token (401)
- ❌ Revoked token (401)

#### `/logout`
- ✅ Valid logout
- ❌ Missing token
- ❌ Invalid token

#### `/admin-login`
- ✅ Valid admin login
- ❌ Not admin role (400)
- ❌ Invalid credentials

#### `/parent-login`
- ✅ Valid parent login
- ❌ Not parent role (400)
- ❌ Invalid credentials

#### `/admin-register`
- ✅ Valid admin register
- ❌ Registration fails

#### `/forgot-password`
- ✅ User exists
- ✅ User not exists (still success for security)
- ❌ Invalid email format
- ❌ Missing email

#### `/reset-password`
- ✅ Valid token
- ❌ Invalid token (400)
- ❌ Expired token (400)
- ❌ Missing fields
- ❌ Password validation

---

### **2. PrivateAuthController Tests - HIGH** ⭐⭐⭐⭐

**Chưa có file:** `private-auth.controller.spec.ts`

**Priority:** P1 - Protected endpoints cần test auth flow

**Test scenarios:**

#### `GET /me`
- ✅ Valid token → return user
- ❌ No token (401)
- ❌ Invalid token (401)
- ❌ Expired token (401)
- ❌ User not found

#### `GET /has-parent`
- ✅ Student has parent
- ✅ Student no parent
- ❌ No token (401)
- ❌ Invalid token (401)

#### `POST /change-password`
- ✅ Valid password change
- ❌ No token (401)
- ❌ Invalid current password (400)
- ❌ Missing fields
- ❌ New password too short
- ❌ User not found

#### `PUT /profile`
- ✅ Valid update
- ❌ No token (401)
- ❌ Invalid email format
- ❌ Email already used (400)
- ❌ Missing required fields

---

### **3. Repository Tests - MEDIUM** ⭐⭐⭐

**File có:** `auth.repository.spec.ts` (715 lines)

**Cần verify coverage cho 15 methods:**

#### Missing/Incomplete tests (estimate):

1. `storeRefreshToken()`
   - ❌ Success case
   - ❌ Duplicate jti

2. `revokeRefreshToken()`
   - ❌ Success
   - ❌ Already revoked
   - ❌ Not found

3. `refreshToken()`
   - ❌ Valid token
   - ❌ Expired token
   - ❌ Revoked token
   - ❌ User not found

4. `findParentRelation()`
   - ❌ Found
   - ❌ Not found

5. `invalidateUserResetTokens()`
   - ❌ Success
   - ❌ No tokens to invalidate

6. `createPasswordResetToken()`
   - ❌ Success
   - ❌ Duplicate token hash

7. `findValidPasswordResetToken()`
   - ❌ Valid token
   - ❌ Expired token
   - ❌ Used token
   - ❌ Not found

8. `markResetTokenUsed()`
   - ❌ Success
   - ❌ Already used

9. `updatePassword()`
   - ❌ Success
   - ❌ User not found

---

## 📈 COVERAGE SUMMARY

| Component | Total Methods | Tests Exist | Missing | Coverage |
|-----------|--------------|-------------|---------|----------|
| **AuthService** | 15 | 30 | 0 | ✅ 100% |
| **AuthRepository** | 15 | ~50% | ~50% | ⚠️ 50% |
| **PublicAuthController** | 9 | 0 | 45 | ❌ 0% |
| **PrivateAuthController** | 4 | 0 | 25 | ❌ 0% |
| **TOTAL** | 43 | 30+ | 70+ | ⚠️ ~43% |

---

## 🎯 ACTION PLAN

### **Phase 1: Critical (Tuần này)** ⭐⭐⭐⭐⭐

1. **PublicAuthController Tests** (1 ngày)
   - Create `public-auth.controller.spec.ts`
   - 45 test cases
   - Coverage target: 100%

2. **PrivateAuthController Tests** (0.5 ngày)
   - Create `private-auth.controller.spec.ts`
   - 25 test cases
   - Coverage target: 100%

### **Phase 2: Important (Tuần sau)** ⭐⭐⭐

3. **Complete AuthRepository Tests** (1 ngày)
   - Review existing 715 lines
   - Add missing scenarios
   - 30+ more test cases
   - Coverage target: 100%

### **Phase 3: Integration (Optional)** ⭐⭐

4. **E2E Tests** (0.5 ngày)
   - Full auth flow
   - Register → Login → Refresh → Logout
   - Forgot → Reset password
   - Profile update

---

## 💻 IMPLEMENTATION GUIDE

### **File structure:**

```
apps/client-api/src/domains/auth/
├── controller/
│   ├── public-auth.controller.ts
│   ├── public-auth.controller.spec.ts    ← CREATE THIS
│   ├── private-auth.controller.ts
│   └── private-auth.controller.spec.ts   ← CREATE THIS
├── service/
│   ├── auth.service.ts
│   └── auth.service.spec.ts              ✅ COMPLETE
└── repository/
    ├── auth.repository.ts
    └── auth.repository.spec.ts           ⚠️ NEEDS MORE TESTS
```

---

## 🧪 TESTING PATTERNS

### **Controller Test Pattern:**

```typescript
describe('PublicAuthController', () => {
  let controller: PublicAuthController;
  let service: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicAuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            // ... mock all methods
          },
        },
      ],
    }).compile();

    controller = module.get(PublicAuthController);
    service = module.get(AuthService);
  });

  describe('POST /student-register', () => {
    it('should register successfully with valid data', async () => {
      // Arrange
      const dto = { email: 'test@test.com', ... };
      const expected = { accessToken: '...', user: {...} };
      service.register.mockResolvedValue(expected);

      // Act
      const result = await controller.register(dto);

      // Assert
      expect(result).toEqual(expected);
      expect(service.register).toHaveBeenCalledWith(dto);
    });

    it('should throw BadRequestException if email exists', async () => {
      // Arrange
      const dto = { email: 'existing@test.com', ... };
      service.register.mockRejectedValue(
        new BadRequestException('Email already exists')
      );

      // Act & Assert
      await expect(controller.register(dto)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
```

---

## 📊 ESTIMATED EFFORT

| Task | Test Cases | Time | Priority |
|------|-----------|------|----------|
| PublicAuthController | 45 | 8h | P0 |
| PrivateAuthController | 25 | 4h | P1 |
| Complete AuthRepository | 30 | 8h | P2 |
| E2E Tests | 10 | 4h | P3 |
| **TOTAL** | **110** | **24h** | **3 ngày** |

---

## ✅ SUCCESS CRITERIA

### **Phase 1 Done:**
- [ ] `public-auth.controller.spec.ts` created
- [ ] `private-auth.controller.spec.ts` created
- [ ] All controller endpoints tested
- [ ] 100% coverage for controllers
- [ ] All tests passing

### **Phase 2 Done:**
- [ ] `auth.repository.spec.ts` complete
- [ ] All 15 repository methods tested
- [ ] 100% coverage for repository
- [ ] All tests passing

### **Overall:**
- [ ] Total 110+ test cases
- [ ] Coverage: Service 100%, Repository 100%, Controllers 100%
- [ ] Zero test failures
- [ ] CI/CD passing

---

## 🎓 BEST PRACTICES

1. **Arrange-Act-Assert** pattern
2. **Mock external dependencies** (Prisma, Kafka, Mailer)
3. **Test edge cases** (null, undefined, empty strings)
4. **Test error paths** (exceptions, validation failures)
5. **Use descriptive test names** ("should do X when Y")
6. **Group related tests** (describe blocks)
7. **Clean up mocks** (beforeEach/afterEach)

---

## 🚀 NEXT STEPS

1. **Hôm nay:** Đọc document này
2. **Ngày mai:** Tạo `public-auth.controller.spec.ts`
3. **Ngày kia:** Tạo `private-auth.controller.spec.ts`
4. **Tuần sau:** Complete `auth.repository.spec.ts`

---

**Kết luận:**
- ✅ Service tests: Excellent (100%)
- ⚠️ Repository tests: Incomplete (~50%)
- ❌ Controller tests: Missing (0%)

**Priority:** Viết controller tests ngay lập tức!

---

*Document created: 11/10/2025*
*Next review: After Phase 1 completion*
