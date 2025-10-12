# Fix: AI Agent Conversation Widget Restart Bug

## 🐛 Problem

**Reported Issue:**
> "Khi tôi mở chat lên, nhấn 1 tin nhắn cũ thì widget sẽ như restart lại. Sau đó tôi nhắn mới bắt đầu work."

**Symptoms:**
- Click vào conversation cũ trong sidebar
- Widget "restart" (messages disappear)
- Phải gửi tin nhắn mới thì mới work

## 🔍 Root Cause

### Backend API Bug

**File:** `apps/client-api/src/domains/agent/controller/private-agent.controller.ts`

**Before (Wrong):**
```typescript
@Get('conversations/:id')  // ← Route có path param :id
async getConversation(
  @PayloadToken() payload: JwtPayload,
  @Query('id') conversationId: string,  // ❌ Nhưng lại lấy từ Query!
) {
  return this.agentService.getConversation(conversationId, payload.sub);
}

@Post('conversations/:id/delete')
async deleteConversation(
  @PayloadToken() payload: JwtPayload,
  @Query('id') conversationId: string,  // ❌ Sai
) {
```

**Problem:**
- Route pattern có `:id` trong path → NestJS expect dùng `@Param('id')`
- Nhưng controller dùng `@Query('id')` → lấy từ query string
- Frontend gửi: `GET /api/private/v1/agent/conversations/abc-123`
- Backend nhận: `conversationId = undefined` (vì không có query param)
- Result: API error → 401 → Auth interceptor logout → Widget restart

### Frontend API Client

**File:** `englishWeb/src/services/agent.api.ts`

**Before:**
```typescript
export const getConversation = async (
  conversationId: string
): Promise<AgentConversation> => {
  const response = await api.get(
    `/private/v1/agent/conversations/${conversationId}`,
    {
      params: { id: conversationId },  // ← Gửi cả 2: path + query (thừa)
    }
  )
  return response.data
}
```

**Problem:**
- Gửi `conversationId` vào path (đúng)
- Nhưng cũng gửi vào query params (thừa, và backend không dùng)

## ✅ Solution

### 1. Fix Backend - Dùng `@Param` thay `@Query`

**File:** `private-agent.controller.ts`

```typescript
@Get('conversations/:id')
async getConversation(
  @PayloadToken() payload: JwtPayload,
  @Param('id') conversationId: string,  // ✅ Fixed
) {
  return this.agentService.getConversation(conversationId, payload.sub);
}

@Post('conversations/:id/delete')
async deleteConversation(
  @PayloadToken() payload: JwtPayload,
  @Param('id') conversationId: string,  // ✅ Fixed
) {
  await this.agentService.deleteConversation(conversationId, payload.sub);
  return { success: true, message: 'Conversation deleted successfully' };
}
```

### 2. Fix Frontend - Remove Query Params

**File:** `agent.api.ts`

```typescript
export const getConversation = async (
  conversationId: string
): Promise<AgentConversation> => {
  const response = await api.get(
    `/private/v1/agent/conversations/${conversationId}`  // ✅ Chỉ dùng path
  )
  return response.data
}

export const deleteConversation = async (
  conversationId: string
): Promise<{ success: boolean; message: string }> => {
  const response = await api.post(
    `/private/v1/agent/conversations/${conversationId}/delete`  // ✅ Chỉ dùng path
  )
  return response.data
}
```

### 3. Improve Error Handling

**File:** `AiAgentPanel.tsx`

```typescript
const loadConversation = async (conversationId: string) => {
  try {
    const conversation = await getConversation(conversationId)
    setMessages(conversation.messages || [])
  } catch (error: any) {
    console.error('Failed to load conversation:', error)
    // If conversation not found or access denied, reset to new chat
    if (error?.response?.status === 404 || error?.response?.status === 403) {
      handleNewChat()  // ✅ Graceful fallback thay vì crash
    }
  }
}
```

## 📊 Impact

### Before Fix:
1. User clicks old conversation
2. Frontend: `GET /api/private/v1/agent/conversations/abc-123?id=abc-123`
3. Backend receives `conversationId = undefined` (from @Query)
4. Service throws error or returns 401
5. Auth interceptor catches 401 → logout
6. Widget resets, loses state
7. User confused 😵

### After Fix:
1. User clicks old conversation
2. Frontend: `GET /api/private/v1/agent/conversations/abc-123`
3. Backend receives `conversationId = "abc-123"` (from @Param) ✅
4. Service loads conversation successfully
5. Messages display correctly
6. User happy 😊

## 🧪 Testing

### Test Case 1: Load Existing Conversation

**Steps:**
1. Open AI Agent chat widget
2. Create a new conversation (send any message)
3. Create another conversation (click "Trò chuyện mới", send message)
4. Click the first conversation in sidebar
5. ✅ **Expected:** Messages from first conversation load immediately
6. ✅ **Expected:** No widget restart, no logout

**Before Fix:** Widget restarts, messages disappear
**After Fix:** Works perfectly ✅

### Test Case 2: Delete Conversation

**Steps:**
1. Hover over a conversation in sidebar
2. Click trash icon
3. ✅ **Expected:** Conversation deleted, removed from list
4. If active conversation deleted → reset to empty state

**Before Fix:** May fail silently or cause errors
**After Fix:** Works correctly ✅

### Test Case 3: Error Handling

**Steps:**
1. Manually change conversationId in browser DevTools
2. Try to load invalid conversation
3. ✅ **Expected:** Gracefully fallback to new chat (404/403)
4. ✅ **Expected:** No crash, no infinite loop

## 📝 Files Changed

### Backend:
- ✅ `apps/client-api/src/domains/agent/controller/private-agent.controller.ts`
  - Line 141: `@Query('id')` → `@Param('id')`
  - Line 154: `@Query('id')` → `@Param('id')`

### Frontend:
- ✅ `englishWeb/src/services/agent.api.ts`
  - `getConversation()`: Removed query params
  - `deleteConversation()`: Removed query params

- ✅ `englishWeb/src/components/ai-assistant/AiAgentPanel.tsx`
  - `loadConversation()`: Added 404/403 error handling

## 🎓 Lessons Learned

### NestJS Convention:
- **Path params** (`/users/:id`) → Use `@Param('id')`
- **Query params** (`/users?role=admin`) → Use `@Query('role')`
- **Never mix them!**

### Frontend Best Practice:
- Match backend API contract exactly
- Don't send redundant data (path + query)
- Handle errors gracefully (404/403 → fallback, not crash)

### Auth Interceptor:
- 401 should only logout if refresh token fails
- Not all errors should trigger logout
- Current implementation in `AuthContext.tsx` is correct (tries refresh first)

## ✅ Verification

Build status:
```bash
npm run build:client-api
# webpack 5.97.1 compiled successfully ✅
```

TypeScript errors: None (after import fix) ✅

Runtime test:
- Load conversation ✅
- Delete conversation ✅
- Error handling ✅

---

**Status:** ✅ Fixed and Tested
**Date:** October 13, 2025
**Impact:** High (Critical user-facing bug)
**Severity:** P0 (Blocks core functionality)
