# 🎧 Text-to-Podcast với Auto-Generated Activities

Tính năng mới cho phép bạn **chuyển văn bản thành podcast** và **tự động tạo bài kiểm tra** dựa trên nội dung đó.

## 🌟 Tính năng chính

### 1. **Text-to-Speech (Văn bản → Âm thanh)**
- Nhập đoạn văn bản bất kỳ
- Chọn giọng nói (Nam/Nữ, US/UK/AU)
- Điều chỉnh tốc độ đọc (0.5x - 2.0x)
- Tự động tạo file âm thanh

### 2. **Auto-Generate Activities (Tự động tạo bài tập)**
- **Fill in the Blanks** (Điền vào chỗ trống) ⭐
- **Multiple Choice** (Trắc nghiệm)
- **True/False** (Đúng/Sai)
- **Comprehension** (Hiểu bài đọc)

### 3. **Các mức độ khó**
- **Easy**: 1 chỗ trống/câu, 5 điểm
- **Medium**: 2 chỗ trống/câu, 10 điểm
- **Hard**: 3 chỗ trống/câu, 15 điểm

## 📡 API Endpoints

### **POST** `/private/v1/podcasts/from-text`
Tạo podcast từ văn bản với auto-generate activities

**Request Body:**
```json
{
  "title": "Learning English Conversation",
  "description": "Daily conversation practice",
  "textContent": "Hello, how are you today? I am fine, thank you. What about you? I am doing great. Would you like to have coffee with me? That sounds wonderful. Let's meet at 3 PM at the coffee shop.",
  "voiceType": "female_en_us",
  "speechSpeed": 1.0,
  "category": "conversation",
  "difficulty": "beginner",
  "tags": ["conversation", "daily", "greeting"],
  "autoGenerateActivities": true,
  "activityTypes": ["fill_in_blanks", "multiple_choice"],
  "numberOfBlanks": 5,
  "questionDifficulty": "medium"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Podcast created from text successfully",
  "data": {
    "podcast": {
      "id": "uuid",
      "title": "Learning English Conversation",
      "audioUrl": "/uploads/podcasts/tts_xxx.mp3",
      "duration": 30,
      "transcript": "Hello, how are you today?...",
      "category": "conversation"
    },
    "activities": [
      {
        "id": "uuid",
        "title": "Fill in the Blanks - Medium",
        "type": "fill_in_blanks",
        "content": {
          "questions": [
            {
              "id": "blank_1",
              "sentence": "Hello, ___1___ are you today?",
              "correctAnswers": ["how"],
              "blanks": 1
            }
          ]
        }
      }
    ],
    "audioGeneration": {
      "success": true,
      "audioUrl": "/uploads/podcasts/tts_xxx.mp3",
      "duration": 30
    }
  }
}
```

### **POST** `/private/v1/podcasts/:id/generate-activities`
Tạo thêm activities cho podcast đã có

**Request Body:**
```json
{
  "activityTypes": ["fill_in_blanks", "true_false"],
  "numberOfQuestions": 8,
  "questionDifficulty": "hard"
}
```

## 🎯 Use Cases

### **Case 1: Tạo bài học từ đoạn hội thoại**
```json
{
  "title": "Restaurant Conversation",
  "textContent": "Waiter: Good evening. How many people? Customer: Table for two, please. Waiter: Right this way. Here's your menu. Customer: Thank you. What do you recommend? Waiter: Our steak is very popular.",
  "voiceType": "male_en_us",
  "activityTypes": ["fill_in_blanks"],
  "numberOfBlanks": 6,
  "questionDifficulty": "medium"
}
```

### **Case 2: Tạo bài test từ văn bản**
```json
{
  "title": "News Article Practice",
  "textContent": "Scientists have discovered a new species of butterfly in the Amazon rainforest. This butterfly has unique blue and gold patterns on its wings. It feeds on nectar from rare flowers that bloom only during the rainy season.",
  "activityTypes": ["fill_in_blanks", "multiple_choice", "comprehension"],
  "numberOfBlanks": 8,
  "questionDifficulty": "hard"
}
```

## 🔧 Tùy chỉnh giọng nói

| Voice Type | Mô tả |
|------------|-------|
| `female_en_us` | Nữ - Tiếng Anh Mỹ |
| `male_en_us` | Nam - Tiếng Anh Mỹ |
| `female_en_uk` | Nữ - Tiếng Anh Anh |
| `male_en_uk` | Nam - Tiếng Anh Anh |
| `female_en_au` | Nữ - Tiếng Anh Úc |
| `male_en_au` | Nam - Tiếng Anh Úc |

## 🎮 Luồng sử dụng

1. **Nhập văn bản** → Chọn giọng đọc → Chọn độ khó
2. **Hệ thống tạo âm thanh** từ văn bản
3. **Tự động phân tích** và tạo câu hỏi điền chỗ trống
4. **Học viên nghe** và làm bài tập
5. **Hệ thống chấm điểm** và cung cấp phản hồi

## ⚡ Advanced Features

### **Smart Blank Selection**
- Tránh blanking các từ đơn giản (the, a, an, and...)
- Ưu tiên blank các từ có ý nghĩa
- Phân bố blanks đều trong câu

### **Adaptive Difficulty**
- **Easy**: 1 blank/câu, từ dễ
- **Medium**: 2 blanks/câu, từ trung bình
- **Hard**: 3 blanks/câu, từ khó + cụm từ

### **Audio Quality**
- Tự động ước tính thời lượng dựa trên số từ
- Hỗ trợ điều chỉnh tốc độ đọc
- Tích hợp với TTS APIs chất lượng cao

## 🔮 Roadmap

- [ ] Tích hợp Google Text-to-Speech API
- [ ] Thêm AI-powered question generation
- [ ] Hỗ trợ nhiều ngôn ngữ
- [ ] Voice cloning cho giáo viên
- [ ] Real-time pronunciation scoring

---

**Ví dụ hoàn chỉnh**: Nhập đoạn văn về "Daily Routine" → Tạo podcast 2 phút → Auto-generate 10 câu hỏi điền chỗ trống → Học viên nghe và làm bài → Nhận điểm và feedback chi tiết! 🎉
