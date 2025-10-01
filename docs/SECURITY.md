# Security Guidelines - RAG Service

## Overview
This document outlines security best practices for the RAG (Retrieval-Augmented Generation) service in the English Learning platform.

## Critical Security Measures Implemented

### 1. SQL Injection Prevention

**Rule**: Never use string interpolation in SQL queries.

❌ **Bad Practice:**
```typescript
// VULNERABLE to SQL injection
const query = `UPDATE table SET field = '${userInput}'`;
await prisma.$executeRawUnsafe(query);
```

✅ **Good Practice:**
```typescript
// SAFE: Use parameterized queries
await prisma.$executeRawUnsafe(
  `UPDATE table SET field = $1 WHERE id = $2`,
  userInput,
  id
);
```

### 2. Input Validation

**Rule**: Always validate user input before processing.

✅ **Implemented in DTOs:**
```typescript
@MaxLength(1000)
@IsNotEmpty()
@IsString()
question!: string;
```

✅ **Implemented in Service Layer:**
```typescript
// Validate embedding arrays
if (!Array.isArray(embedding) || embedding.some(v => typeof v !== 'number')) {
  throw new Error('Invalid embedding format');
}
```

### 3. Error Handling

**Rule**: Never expose internal errors to clients.

✅ **Implemented:**
```typescript
try {
  // risky operation
} catch (e) {
  this.logger.error('Internal error:', e);
  throw new BadRequestException('Operation failed');
}
```

### 4. Resource Limits

**Rule**: Prevent DoS attacks with rate limiting and size limits.

✅ **Implemented:**
- Content: max 50,000 characters
- Title: max 500 characters
- Query: max 1,000 characters

## Security Checklist for New Features

When adding new features to the RAG service, verify:

- [ ] All SQL queries use parameterized queries
- [ ] All user inputs are validated (type, length, format)
- [ ] Error messages don't expose internal details
- [ ] Rate limiting is in place for public endpoints
- [ ] Large inputs are handled gracefully
- [ ] Async operations have timeouts
- [ ] Logging doesn't include sensitive data

## Common Vulnerabilities to Avoid

### 1. SQL Injection
- ❌ String concatenation in SQL
- ❌ Unvalidated user input in queries
- ✅ Use Prisma parameterized queries

### 2. NoSQL Injection
- ❌ Direct object assignment from user input
- ✅ Validate and sanitize all inputs

### 3. XSS (Cross-Site Scripting)
- ❌ Rendering raw HTML from user input
- ✅ Escape all user-generated content

### 4. Denial of Service (DoS)
- ❌ No limits on request size
- ❌ No rate limiting
- ✅ Implement request size limits
- ✅ Add rate limiting middleware

### 5. Information Disclosure
- ❌ Detailed error messages to clients
- ❌ Stack traces in production
- ✅ Generic error messages
- ✅ Detailed logging (server-side only)

## Security Testing

### Manual Testing
```bash
# Test SQL injection prevention
curl -X POST http://localhost:3000/public/v1/ai/documents \
  -H "Content-Type: application/json" \
  -d '{"title":"Test'\'' DROP TABLE--","content":"test","documentType":"test","source":"test"}'

# Expected: Document created safely, no SQL injection
```

### Automated Testing
```typescript
describe('Security Tests', () => {
  it('should prevent SQL injection in document title', async () => {
    const malicious = {
      title: "'; DROP TABLE knowledge_documents; --",
      content: 'test',
      documentType: 'test',
      source: 'test'
    };
    await expect(service.addDocument(malicious)).resolves.not.toThrow();
  });
});
```

## Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. Contact the security team via email: [security@example.com]
3. Provide detailed information about the vulnerability
4. Wait for confirmation before disclosing

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Prisma Security Best Practices](https://www.prisma.io/docs/guides/security)
- [NestJS Security](https://docs.nestjs.com/security/helmet)

## Updates

- **2024-01-XX**: Initial security audit and fixes
- Fixed SQL injection vulnerabilities in RAG service
- Added input validation to DTOs
- Implemented proper error handling
- Updated Gemini API usage to official SDK

---

Last updated: 2024-01-XX  
Maintained by: Development Team
