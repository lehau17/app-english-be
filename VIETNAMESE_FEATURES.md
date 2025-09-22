# Vietnamese Language Features for Google Translate Service

## Tổng quan / Overview

Dịch vụ Google Translate đã được mở rộng với các tính năng chuyên biệt cho tiếng Việt, hỗ trợ việc học và giảng dạy tiếng Việt hiệu quả hơn.

The Google Translate service has been extended with Vietnamese-specific features to support more effective Vietnamese language learning and teaching.

## Các tính năng mới / New Features

### 1. Phân tích phát âm tiếng Việt / Vietnamese Pronunciation Analysis
- **Endpoint**: `POST /public/v1/google-translate/vietnamese/pronunciation-analysis`
- **Tính năng**: 
  - Hướng dẫn phát âm từng từ với IPA cơ bản
  - Phân tích thanh điệu (6 thanh: ngang, huyền, sắc, hỏi, ngã, nặng)
  - Đánh giá độ khó của văn bản
  - Đề xuất cách luyện phát âm
  - Tạo audio hướng dẫn

### 2. Audio theo phương ngữ miền / Regional Audio Generation
- **Endpoint**: `POST /public/v1/google-translate/vietnamese/regional-audio`
- **Tính năng**:
  - Tạo audio với đặc điểm phương ngữ miền Bắc, Trung, Nam
  - Tự động điều chỉnh từ ngữ theo đặc điểm địa phương
  - Hỗ trợ học viên làm quen với các giọng địa phương

### 3. Tạo bài tập điền từ tự động / Auto Fill-in-the-Blank Generator
- **Endpoint**: `POST /public/v1/google-translate/vietnamese/fill-blank-exercise`
- **Tính năng**:
  - Tự động chọn từ khóa quan trọng để tạo chỗ trống
  - Tạo các lựa chọn nhiễu thông minh (từ đồng âm, đồng nghĩa, tương tự)
  - Kèm audio đọc toàn bộ đoạn văn
  - Phân loại độ khó bài tập

### 4. Quiz ngữ pháp tiếng Việt / Vietnamese Grammar Quiz
- **Endpoint**: `POST /public/v1/google-translate/vietnamese/grammar-quiz`
- **Tính năng**:
  - Phát hiện mức độ trang trọng (formal/informal/neutral)
  - Tạo câu hỏi về từ loại và nghĩa từ
  - Giải thích chi tiết đáp án
  - Đánh giá mức độ ngữ pháp

### 5. Audio học từ vựng chuyên biệt / Specialized Vocabulary Audio
- **Endpoint**: `POST /public/v1/google-translate/vietnamese/vocabulary-audio`
- **Tính năng**:
  - Đọc từng từ với tốc độ có thể điều chỉnh (slow/normal/fast)
  - Tùy chọn kèm nghĩa của từ
  - Lặp lại từ nhiều lần để ghi nhớ
  - Tạo khoảng dừng phù hợp cho việc luyện tập

### 6. Bài tập nghe-hiểu tiếng Việt / Vietnamese Listening Comprehension
- **Endpoint**: `POST /public/v1/google-translate/vietnamese/listening-exercise`
- **Tính năng**:
  - Tạo audio đọc đoạn văn
  - Tự động sinh câu hỏi trắc nghiệm và điền từ
  - Đánh giá khả năng nghe hiểu
  - Phân loại độ khó theo trình độ

## Công cụ hỗ trợ / Supporting Utilities

### VietnameseUtil Class
Lớp tiện ích chuyên biệt xử lý văn bản tiếng Việt:

- **Loại bỏ dấu thanh điệu**: Chuyển đổi văn bản có dấu thành không dấu
- **Tách từ cải tiến**: Xử lý đặc thù của từ ghép tiếng Việt
- **Phát hiện ranh giới câu**: Nhận biết câu tiếng Việt chính xác
- **Phân tích mức độ trang trọng**: Phân biệt văn phong formal/informal
- **Trích xuất từ vựng**: Tìm từ khóa quan trọng với tần suất xuất hiện
- **Đánh giá độ khó đọc**: Tính toán dựa trên độ dài từ, câu và từ vựng phức tạp

## Ứng dụng trong giảng dạy / Teaching Applications

### 1. Cho giáo viên / For Teachers
- Tạo nhanh bài tập từ văn bản bất kỳ
- Đánh giá mức độ phù hợp của tài liệu với trình độ học viên
- Tạo audio hướng dẫn phát âm chuẩn
- Sinh câu hỏi kiểm tra tự động

### 2. Cho học viên / For Students  
- Luyện phát âm với hướng dẫn chi tiết
- Học từ vựng với audio tốc độ chậm
- Làm quen với các phương ngữ khác nhau
- Tự đánh giá khả năng nghe hiểu

### 3. Cho nhà phát triển ứng dụng / For App Developers
- API đầy đủ cho việc tích hợp vào ứng dụng học tiếng Việt
- Swagger documentation chi tiết
- Xử lý lỗi và validation đầy đủ
- Response format nhất quán

## Ví dụ sử dụng / Usage Examples

### Phân tích phát âm
```bash
curl -X POST "http://localhost:3334/api/public/v1/google-translate/vietnamese/pronunciation-analysis" \
  -H "Content-Type: application/json" \
  -d '{"text": "Xin chào, tôi học tiếng Việt"}'
```

### Tạo bài tập điền từ
```bash
curl -X POST "http://localhost:3334/api/public/v1/google-translate/vietnamese/fill-blank-exercise" \
  -H "Content-Type: application/json" \
  -d '{"text": "Việt Nam là một quốc gia có nền văn hóa lâu đời và truyền thống tốt đẹp"}'
```

### Audio từ vựng với tốc độ chậm
```bash
curl -X POST "http://localhost:3334/api/public/v1/google-translate/vietnamese/vocabulary-audio" \
  -H "Content-Type: application/json" \
  -d '{"words": ["học", "tập", "nói", "nghe"], "speed": "slow", "includeDefinitions": true}'
```

## Kế hoạch phát triển / Future Development

### Phase 1 - Hoàn thiện (Completed)
- [x] Vietnamese utility functions
- [x] Pronunciation analysis
- [x] Regional audio generation
- [x] Exercise generators
- [x] API endpoints with Swagger docs

### Phase 2 - Mở rộng (Future)
- [ ] Tích hợp từ điển tiếng Việt chuyên sâu
- [ ] Phân tích ngữ pháp nâng cao
- [ ] Hỗ trợ văn bản cổ điển
- [ ] Tích hợp AI để cải thiện chất lượng phân tích
- [ ] Hỗ trợ nhiều giọng đọc khác nhau
- [ ] Export bài tập ra các format khác (PDF, Word)

### Phase 3 - Tối ưu (Future)
- [ ] Cache kết quả để tăng tốc độ
- [ ] Batch processing cho nhiều văn bản
- [ ] Real-time pronunciation feedback
- [ ] Integration với speech-to-text
- [ ] Mobile-optimized endpoints
- [ ] Analytics và reporting

## Lưu ý kỹ thuật / Technical Notes

- Tất cả các endpoint Vietnamese sử dụng Google Translate TTS miễn phí
- Audio được lưu trên MinIO/S3 và trả về URL công khai  
- Hỗ trợ văn bản lên đến 200 ký tự mỗi chunk để tránh giới hạn API
- Tự động xử lý lỗi và fallback cho các trường hợp edge case
- Response format nhất quán với các endpoint hiện có
- Đầy đủ TypeScript types và validation

## Đóng góp / Contributing

Để đóng góp cho việc phát triển các tính năng tiếng Việt:

1. Báo cáo bug hoặc đề xuất tính năng qua Issues
2. Cải thiện thuật toán xử lý văn bản tiếng Việt
3. Thêm test cases cho các tính năng mới
4. Cập nhật documentation
5. Tối ưu performance cho các operations phức tạp

## Liên hệ / Contact

Để được hỗ trợ hoặc thảo luận về các tính năng tiếng Việt, vui lòng liên hệ team phát triển.