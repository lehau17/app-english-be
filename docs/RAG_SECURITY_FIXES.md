# RAG Service - Security Audit & Fixes

## Tổng quan
Đây là tài liệu chi tiết về các lỗ hỏng bảo mật được phát hiện trong RAG Service và các giải pháp đã áp dụng để khắc phục.

---

## 🔴 Lỗ hỏng nghiêm trọng đã phát hiện

### 1. **SQL Injection trong `rag.service.ts`** (CRITICAL)

#### Vị trí:
- File: `apps/client-api/src/domains/agent/service/rag.service.ts`
- Dòng: 47-51 và 119-125

#### Mô tả lỗ hỏng:
Code ban đầu sử dụng template literal với `$executeRaw` và nội suy chuỗi trực tiếp vào câu lệnh SQL:

```typescript
// ❌ MÃ CŨ - DỄ BỊ SQL INJECTION
const vectorText = `[${embedding.join(',')}]`;
await this.prisma.$executeRaw`
  UPDATE knowledge_documents
  SET embedding_vector = ${vectorText}::vector
  WHERE id = ${doc.id}
`;
```

**Tại sao nguy hiểm:**
- Mặc dù `embedding` là array số từ Gemini API, nhưng không có validation
- Nếu có lỗi logic hoặc data bị nhiễm, có thể inject SQL
- `doc.id` cũng không được kiểm tra trước khi đưa vào query

#### Giải pháp đã áp dụng:

```typescript
// ✅ MÃ MỚI - AN TOÀN
// 1. Validate input trước
if (!Array.isArray(embedding) || embedding.some(v => typeof v !== 'number')) {
  throw new Error('Invalid embedding format: must be array of numbers');
}

const vectorText = `[${embedding.join(',')}]`;
// 2. Sử dụng parameterized query
await this.prisma.$executeRawUnsafe(
  `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
  vectorText,
  doc.id
);
```

**Cải thiện:**
1. ✅ Validate embedding chỉ chứa số
2. ✅ Sử dụng positional parameters ($1, $2) thay vì string interpolation
3. ✅ Tách biệt data và query command

---

### 2. **SQL Injection trong `reindex-embeddings.ts`** (CRITICAL)

#### Vị trí:
- File: `scripts/reindex-embeddings.ts`
- Dòng: 70-72

#### Mô tả lỗ hỏng:
```typescript
// ❌ MÃ CŨ - TRỰC TIẾP NỐI CHUỖI VÀO SQL
await prisma.$executeRawUnsafe(
  `UPDATE knowledge_document SET embedding_vector = '${vectorText}'::vector WHERE id = '${d.id}'`,
);
```

**Tại sao nguy hiểm:**
- String interpolation trực tiếp vào SQL
- Nếu `d.id` bị manipulated, có thể thực thi arbitrary SQL
- `vectorText` cũng chưa được validate

#### Giải pháp đã áp dụng:

```typescript
// ✅ MÃ MỚI
// 1. Validate embedding
if (!Array.isArray(emb) || emb.length === 0) {
  console.warn(`Empty embedding for doc ${d.id}`);
  continue;
}
if (emb.some(v => typeof v !== 'number' || !isFinite(v))) {
  console.warn(`Invalid embedding values for doc ${d.id}`);
  continue;
}

// 2. Sử dụng parameterized query
const vectorText = `[${emb.join(',')}]`;
await prisma.$executeRawUnsafe(
  `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
  vectorText,
  d.id
);
```

---

### 3. **SQL Injection trong `backfill-embedding-vector.ts`** (CRITICAL)

#### Vị trí:
- File: `scripts/backfill-embedding-vector.ts`
- Dòng: 88-91

#### Mô tả lỗ hỏng:
Tương tự như `reindex-embeddings.ts` - sử dụng string interpolation.

#### Giải pháp:
Tương tự như trên, thêm validation và sử dụng parameterized query.

---

### 4. **API Endpoint không đúng trong Scripts** (HIGH)

#### Vị trí:
- File: `scripts/reindex-embeddings.ts`
- File: `scripts/backfill-embedding-vector.ts`

#### Mô tả lỗ hỏng:
Scripts sử dụng endpoint REST API thủ công với `node-fetch`:

```typescript
// ❌ MÃ CŨ - SAI ENDPOINT
const resp = await fetch('https://generativeai.googleapis.com/v1beta2/models/text-embedding-004:embed', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${GEMINI_KEY}`,
  },
  body: JSON.stringify({ text: text }),
});
```

**Vấn đề:**
- Endpoint có thể không chính xác hoặc deprecated
- Authentication method không đúng (Bearer vs API Key)
- Không tận dụng official SDK
- Khó maintain khi API thay đổi

#### Giải pháp đã áp dụng:

```typescript
// ✅ MÃ MỚI - SỬ DỤNG OFFICIAL SDK
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const embeddingModel = genAI.getGenerativeModel({
      model: 'text-embedding-004',
    });
    const result: any = await embeddingModel.embedContent(text);
    return result?.embedding?.values || [];
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
```

**Lợi ích:**
1. ✅ Sử dụng official SDK - đảm bảo tương thích
2. ✅ Authentication tự động
3. ✅ Error handling tốt hơn
4. ✅ Maintainable khi API update

---

### 5. **Application Crash Risk in Constructor** (MEDIUM)

#### Vị trí:
- File: `apps/client-api/src/domains/agent/service/rag.service.ts`
- Dòng: 22-28

#### Mô tả lỗ hỏng:

```typescript
// ❌ MÃ CŨ - CÓ THỂ CRASH APP
constructor(
  private prisma: PrismaRepository,
  private geminiService: GeminiService,
) {
  // Gọi async function trong constructor mà không handle error
  this.loadSampleDocuments();
}
```

**Vấn đề:**
- `loadSampleDocuments()` là async function
- Nếu có lỗi (DB down, API fail), exception không được catch
- NestJS constructor không support async/await tốt
- Có thể crash toàn bộ app khi khởi động

#### Giải pháp đã áp dụng:

```typescript
// ✅ MÃ MỚI - AN TOÀN
constructor(
  private prisma: PrismaRepository,
  private geminiService: GeminiService,
) {
  // Không block constructor
  // Sử dụng setTimeout để defer và catch errors
  setTimeout(() => {
    this.loadSampleDocuments().catch((e) => {
      this.logger.error('Failed to load sample documents:', e);
    });
  }, 0);
}
```

**Cải thiện:**
1. ✅ Constructor không bao giờ throw exception
2. ✅ App vẫn khởi động được ngay cả khi seed fail
3. ✅ Error được log đúng cách
4. ✅ Non-blocking - không làm chậm app startup

---

### 6. **Missing Input Validation** (MEDIUM)

#### Vị trí:
- File: `apps/client-api/src/domains/agent/service/rag.service.ts`
- Method: `findSimilarDocuments()`

#### Mô tả lỗ hỏng:
Không validate `queryEmbedding` trước khi sử dụng:

```typescript
// ❌ MÃ CŨ - KHÔNG VALIDATE INPUT
private async findSimilarDocuments(queryEmbedding: number[], topK = 3) {
  // Trực tiếp sử dụng queryEmbedding mà không kiểm tra
  const vectorText = `[${queryEmbedding.join(',')}]`;
  // ...
}
```

**Rủi ro:**
- Nếu `queryEmbedding` là `null`, `undefined`, hoặc array rỗng → crash
- Nếu chứa `NaN`, `Infinity` → kết quả sai
- Nếu chứa non-number → SQL error

#### Giải pháp đã áp dụng:

```typescript
// ✅ MÃ MỚI - VALIDATE INPUT
private async findSimilarDocuments(queryEmbedding: number[], topK = 3) {
  // 1. Kiểm tra array và không rỗng
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    this.logger.warn('Invalid query embedding provided');
    return [];
  }
  
  // 2. Kiểm tra tất cả elements là số hợp lệ
  if (queryEmbedding.some(v => typeof v !== 'number' || !isFinite(v))) {
    this.logger.warn('Query embedding contains invalid values');
    return [];
  }

  // Safe to use
  const vectorText = `[${queryEmbedding.join(',')}]`;
  // ...
}
```

---

## 📊 Tóm tắt các thay đổi

| Lỗ hỏng | Mức độ | File | Trạng thái |
|---------|--------|------|------------|
| SQL Injection trong rag.service.ts | CRITICAL | `rag.service.ts` | ✅ Fixed |
| SQL Injection trong reindex script | CRITICAL | `reindex-embeddings.ts` | ✅ Fixed |
| SQL Injection trong backfill script | CRITICAL | `backfill-embedding-vector.ts` | ✅ Fixed |
| Sai Gemini API endpoint | HIGH | Scripts | ✅ Fixed |
| Constructor có thể crash app | MEDIUM | `rag.service.ts` | ✅ Fixed |
| Thiếu input validation | MEDIUM | `rag.service.ts` | ✅ Fixed |

---

## 🛡️ Best Practices được áp dụng

### 1. **Parameterized Queries**
- Luôn sử dụng positional parameters ($1, $2) với `$executeRawUnsafe`
- Không bao giờ nối chuỗi trực tiếp vào SQL
- Validate dữ liệu trước khi đưa vào query

### 2. **Input Validation**
- Validate type (array, number, string)
- Validate range (length > 0, isFinite)
- Validate format trước khi xử lý

### 3. **Error Handling**
- Không throw exception trong constructor
- Catch và log errors thay vì crash
- Graceful degradation khi có lỗi

### 4. **Use Official SDKs**
- Ưu tiên official SDK thay vì REST API trực tiếp
- Đảm bảo compatibility và security updates
- Better error messages và debugging

---

## 🔍 Testing & Verification

### Manual Testing Checklist:

1. **Test SQL Injection Prevention:**
   ```bash
   # Thử với document có special characters
   POST /public/v1/ai/documents
   {
     "title": "Test'; DROP TABLE users; --",
     "content": "Content",
     "documentType": "test",
     "source": "test"
   }
   ```
   ✅ Kỳ vọng: Document được tạo an toàn, không thực thi SQL injection

2. **Test Invalid Embeddings:**
   - Test với embedding chứa `NaN`
   - Test với embedding rỗng
   - Test với embedding không phải array
   
   ✅ Kỳ vọng: Lỗi được handle gracefully, không crash

3. **Test Constructor Error:**
   - Khởi động app khi DB không available
   - Khởi động app khi GEMINI_API_KEY sai
   
   ✅ Kỳ vọng: App vẫn start được, log error

### Automated Tests:

```typescript
// Example test cases cần thêm
describe('RagService Security', () => {
  it('should prevent SQL injection in addDocument', async () => {
    const malicious = {
      title: "'; DROP TABLE knowledge_documents; --",
      content: "test",
      documentType: "test",
      source: "test"
    };
    
    await expect(service.addDocument(malicious)).resolves.not.toThrow();
  });

  it('should validate embedding arrays', async () => {
    const invalidEmbedding = [1, 2, NaN, 4];
    // Should not crash, should handle gracefully
  });
});
```

---

## 📝 Migration Guide

### Để deploy các fixes này:

1. **Update dependencies** (nếu chưa có):
   ```bash
   npm install @google/generative-ai
   ```

2. **Chạy lại build:**
   ```bash
   npm run build
   ```

3. **Test local trước:**
   ```bash
   npm run start:client-api:dev
   ```

4. **Test scripts:**
   ```bash
   GEMINI_API_KEY=your_key npm run ts-node scripts/reindex-embeddings.ts
   ```

5. **Deploy to production:**
   - Code đã backward compatible
   - Không cần migration DB
   - Restart services là đủ

---

## 🔮 Recommendations for Future

### Ngay lập tức:
- [ ] Thêm rate limiting cho endpoint `/public/v1/ai/documents`
- [ ] Thêm authentication/authorization cho AI endpoints
- [ ] Monitor API usage và set quotas

### Trung hạn:
- [ ] Implement caching layer cho embeddings
- [ ] Add pagination cho fallback search
- [ ] Write comprehensive unit tests
- [ ] Add integration tests

### Dài hạn:
- [ ] Consider using Redis/Memcached cho vector cache
- [ ] Implement proper vector database (Pinecone, Weaviate)
- [ ] Add monitoring và alerting
- [ ] Implement audit logging

---

## 🎯 Kết luận

Tất cả các lỗ hỏng nghiêm trọng đã được fix:

✅ **SQL Injection** - Fixed bằng parameterized queries và validation  
✅ **API Endpoint** - Fixed bằng official SDK  
✅ **Constructor Error** - Fixed bằng proper error handling  
✅ **Input Validation** - Fixed bằng strict validation  

Code hiện tại đã an toàn hơn nhiều và tuân thủ security best practices. Tuy nhiên, vẫn cần tiếp tục monitor và cải thiện theo recommendations ở trên.

---

**Date:** 2024-01-XX  
**Author:** GitHub Copilot Security Audit  
**Version:** 1.0  
**Status:** ✅ Completed
