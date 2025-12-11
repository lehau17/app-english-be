import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { AssignmentWithDetails } from '../repository';

@Injectable()
export class AssignmentPdfService {
  /**
   * Generate PDF buffer from assignment data
   */
  async generateAssignmentPdf(
    assignment: AssignmentWithDetails,
  ): Promise<Buffer> {
    // Use Chrome for Testing (ARM64 version for Mac Silicon)
    const executablePath = '/usr/bin/google-chrome';

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
      ],
    });

    try {
      const page = await browser.newPage();

      // Generate HTML content for the assignment
      const htmlContent = this.generateAssignmentHtml(assignment);

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate HTML content for assignment PDF
   */
  private generateAssignmentHtml(assignment: AssignmentWithDetails): string {
    const currentDate = new Date().toLocaleDateString('vi-VN');

    return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Assignment: ${assignment.title}</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }

          .header {
            text-align: center;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }

          .header h1 {
            color: #2563eb;
            margin: 0;
            font-size: 28px;
          }

          .assignment-info {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            border-left: 4px solid #2563eb;
          }

          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
          }

          .info-label {
            font-weight: bold;
            color: #475569;
          }

          .info-value {
            color: #1e293b;
          }

          .description {
            background: #fff;
            padding: 20px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 30px;
          }

          .activities-section {
            margin-top: 30px;
          }

          .activity {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            page-break-inside: avoid;
          }

          .activity-header {
            background: #2563eb;
            color: white;
            padding: 10px 15px;
            margin: -20px -20px 15px -20px;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
          }

          .activity-type {
            background: #3b82f6;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            text-transform: uppercase;
            margin-left: 10px;
          }

          .activity-content {
            margin-top: 15px;
          }

          .question {
            margin-bottom: 15px;
          }

          .question-text {
            font-weight: 500;
            margin-bottom: 10px;
            color: #1e293b;
          }

          .options {
            margin-left: 20px;
          }

          .option {
            margin-bottom: 8px;
            display: flex;
            align-items: flex-start;
          }

          .option-label {
            font-weight: bold;
            margin-right: 8px;
            min-width: 20px;
          }

          .correct-answer {
            color: #059669;
            font-weight: bold;
          }

          .activity-points {
            text-align: right;
            font-weight: bold;
            color: #2563eb;
            margin-top: 10px;
          }

          .footer {
            margin-top: 40px;
            text-align: center;
            color: #64748b;
            font-size: 12px;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
          }

          .page-break {
            page-break-before: always;
          }

          @media print {
            body { print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${assignment.title}</h1>
          <p>Bài tập được tạo ngày: ${currentDate}</p>
        </div>

        <div class="assignment-info">
          <div class="info-row">
            <span class="info-label">Giáo viên:</span>
            <span class="info-value">${assignment.teacher?.displayName || assignment.teacher?.firstName + ' ' + assignment.teacher?.lastName || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Lớp học:</span>
            <span class="info-value">${assignment.classroom?.name || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Hạn nộp:</span>
            <span class="info-value">${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString('vi-VN') : 'Không giới hạn'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Tổng điểm:</span>
            <span class="info-value">${assignment.totalPoints || 'N/A'} điểm</span>
          </div>
          <div class="info-row">
            <span class="info-label">Thời gian làm bài:</span>
            <span class="info-value">${assignment.timeLimit ? assignment.timeLimit + ' phút' : 'Không giới hạn'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Số lần làm tối đa:</span>
            <span class="info-value">${assignment.maxAttempts || 'Không giới hạn'}</span>
          </div>
        </div>

        ${
          assignment.description
            ? `
        <div class="description">
          <h3>Mô tả bài tập:</h3>
          <p>${assignment.description}</p>
        </div>
        `
            : ''
        }

        ${
          assignment.instructions
            ? `
        <div class="description">
          <h3>Hướng dẫn làm bài:</h3>
          <p>${assignment.instructions}</p>
        </div>
        `
            : ''
        }

        <div class="activities-section">
          <h2>Các câu hỏi trong bài tập:</h2>
          ${this.generateActivitiesHtml(assignment.assignmentActivities || [])}
        </div>

        <div class="footer">
          <p>Được tạo bởi hệ thống English Learning Platform</p>
          <p>Ngày tạo PDF: ${currentDate}</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML for assignment activities
   */
  private generateActivitiesHtml(activities: any[]): string {
    return activities
      .map((activity, index) => {
        const activityNumber = index + 1;
        return `
        <div class="activity">
          <div class="activity-header">
            Câu hỏi ${activityNumber}: ${activity.title || `Activity ${activityNumber}`}
            <span class="activity-type">${this.getActivityTypeLabel(activity.type)}</span>
          </div>

          ${activity.instructions ? `<p><strong>Hướng dẫn:</strong> ${activity.instructions}</p>` : ''}

          <div class="activity-content">
            ${this.generateActivityContentHtml(activity)}
          </div>

          <div class="activity-points">
            Điểm: ${activity.points || 10} điểm
            ${activity.timeLimit ? ` | Thời gian: ${activity.timeLimit} phút` : ''}
            ${activity.difficulty ? ` | Độ khó: ${this.getDifficultyLabel(activity.difficulty)}` : ''}
          </div>
        </div>
      `;
      })
      .join('');
  }

  /**
   * Generate HTML content based on activity type
   */
  private generateActivityContentHtml(activity: any): string {
    const content = activity.content || {};

    // Debug logging
    console.log('🔍 Activity debug:', {
      type: activity.type,
      title: activity.title,
      content: JSON.stringify(content, null, 2),
    });

    switch (activity.type) {
      case 'quiz':
        return this.generateQuizHtml(content);
      case 'multiple_choice':
        return this.generateMultipleChoiceHtml(content);
      case 'single_choice':
        return this.generateSingleChoiceHtml(content);
      case 'true_false':
        return this.generateTrueFalseHtml(content);
      case 'fill_blank':
        return this.generateFillBlankHtml(content);
      case 'essay':
        return this.generateEssayHtml(content);
      case 'listening':
        return this.generateListeningHtml(content);
      case 'reading':
        return this.generateReadingHtml(content);
      case 'grammar':
        return this.generateGrammarHtml(content);
      default:
        return this.generateGenericHtml(content);
    }
  }

  private generateMultipleChoiceHtml(content: any): string {
    const question = content.question || '';
    const options = content.options || [];
    const correctAnswers = content.correctAnswers || [];

    // Debug logging
    console.log('🔍 Multiple Choice debug:', {
      question,
      optionsCount: options.length,
      correctAnswers,
      contentKeys: Object.keys(content),
    });

    return `
      <div class="question">
        <div class="question-text">${question}</div>
        <div class="options">
          ${options
            .map((option: any, idx: number) => {
              const letter = String.fromCharCode(65 + idx); // A, B, C, D...
              const isCorrect = correctAnswers.includes(idx);
              return `
              <div class="option ${isCorrect ? 'correct-answer' : ''}">
                <span class="option-label">${letter}.</span>
                <span>${option}</span>
                ${isCorrect ? ' ✓' : ''}
              </div>
            `;
            })
            .join('')}
        </div>
        <p><strong>Đáp án đúng:</strong> <span class="correct-answer">${correctAnswers.map((idx: number) => String.fromCharCode(65 + idx)).join(', ')}</span></p>
      </div>
    `;
  }

  private generateSingleChoiceHtml(content: any): string {
    const question = content.question || '';
    const options = content.options || [];
    const correctAnswer = content.correctAnswer;

    return `
      <div class="question">
        <div class="question-text">${question}</div>
        <div class="options">
          ${options
            .map((option: any, idx: number) => {
              const letter = String.fromCharCode(65 + idx); // A, B, C, D...
              const isCorrect = correctAnswer === idx;
              return `
              <div class="option ${isCorrect ? 'correct-answer' : ''}">
                <span class="option-label">${letter}.</span>
                <span>${option}</span>
                ${isCorrect ? ' ✓' : ''}
              </div>
            `;
            })
            .join('')}
        </div>
        <p><strong>Đáp án đúng:</strong> <span class="correct-answer">${String.fromCharCode(65 + correctAnswer)}</span></p>
      </div>
    `;
  }

  private generateTrueFalseHtml(content: any): string {
    const question = content.question || '';
    const correctAnswer = content.correctAnswer;

    return `
      <div class="question">
        <div class="question-text">${question}</div>
        <div class="options">
          <div class="option ${correctAnswer === true ? 'correct-answer' : ''}">
            <span class="option-label">A.</span>
            <span>Đúng</span>
            ${correctAnswer === true ? ' ✓' : ''}
          </div>
          <div class="option ${correctAnswer === false ? 'correct-answer' : ''}">
            <span class="option-label">B.</span>
            <span>Sai</span>
            ${correctAnswer === false ? ' ✓' : ''}
          </div>
        </div>
        <p><strong>Đáp án đúng:</strong> <span class="correct-answer">${correctAnswer ? 'Đúng' : 'Sai'}</span></p>
      </div>
    `;
  }

  private generateFillBlankHtml(content: any): string {
    const question = content.question || '';
    const blanks = content.blanks || [];

    return `
      <div class="question">
        <div class="question-text">${question}</div>
        ${
          blanks.length > 0
            ? `
          <div class="options">
            <p><strong>Đáp án:</strong></p>
            ${blanks
              .map(
                (blank: any, idx: number) => `
              <div class="option">
                <span class="option-label">${idx + 1}.</span>
                <span class="correct-answer">${blank.correctAnswer || blank}</span>
              </div>
            `,
              )
              .join('')}
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  private generateEssayHtml(content: any): string {
    const question = content.question || '';
    const sampleAnswer = content.sampleAnswer || '';
    const criteria = content.criteria || [];

    return `
      <div class="question">
        <div class="question-text">${question}</div>
        ${
          sampleAnswer
            ? `
          <div class="options">
            <p><strong>Câu trả lời mẫu:</strong></p>
            <p class="correct-answer">${sampleAnswer}</p>
          </div>
        `
            : ''
        }
        ${
          criteria.length > 0
            ? `
          <div class="options">
            <p><strong>Tiêu chí chấm điểm:</strong></p>
            ${criteria
              .map(
                (criterion: string, idx: number) => `
              <div class="option">
                <span class="option-label">${idx + 1}.</span>
                <span>${criterion}</span>
              </div>
            `,
              )
              .join('')}
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  private generateListeningHtml(content: any): string {
    const question = content.question || '';
    const audioUrl = content.audioUrl || '';
    const transcript = content.transcript || '';
    const questions = content.questions || [];

    return `
      <div class="question">
        <div class="question-text">${question}</div>
        ${audioUrl ? `<p><strong>File âm thanh:</strong> ${audioUrl}</p>` : ''}
        ${
          transcript
            ? `
          <div class="options">
            <p><strong>Transcript:</strong></p>
            <p class="correct-answer">${transcript}</p>
          </div>
        `
            : ''
        }
        ${
          questions.length > 0
            ? `
          <div class="options">
            <p><strong>Câu hỏi con:</strong></p>
            ${questions
              .map(
                (q: any, idx: number) => `
              <div class="option">
                <span class="option-label">${idx + 1}.</span>
                <span>${q.question}</span>
                ${q.correctAnswer ? `<br><span class="correct-answer">Đáp án: ${q.correctAnswer}</span>` : ''}
              </div>
            `,
              )
              .join('')}
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  private generateReadingHtml(content: any): string {
    const passage = content.passage || '';
    const questions = content.questions || [];

    return `
      <div class="question">
        ${
          passage
            ? `
          <div class="options">
            <p><strong>Đoạn văn:</strong></p>
            <p>${passage}</p>
          </div>
        `
            : ''
        }
        ${
          questions.length > 0
            ? `
          <div class="options">
            <p><strong>Câu hỏi:</strong></p>
            ${questions
              .map(
                (q: any, idx: number) => `
              <div class="option">
                <span class="option-label">${idx + 1}.</span>
                <span>${q.question}</span>
                ${q.correctAnswer ? `<br><span class="correct-answer">Đáp án: ${q.correctAnswer}</span>` : ''}
              </div>
            `,
              )
              .join('')}
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  private generateQuizHtml(content: any): string {
    const question = content.question || '';
    const options = content.options || [];
    const correctIndex = content.correctIndex;

    // Debug logging
    console.log('🔍 Quiz debug:', {
      question,
      optionsCount: options.length,
      correctIndex,
      contentKeys: Object.keys(content),
    });

    return `
      <div class="question">
        <div class="question-text">${question}</div>
        <div class="options">
          ${options
            .map((option: any, idx: number) => {
              const letter = String.fromCharCode(65 + idx); // A, B, C, D...
              const isCorrect = correctIndex === idx;
              return `
              <div class="option ${isCorrect ? 'correct-answer' : ''}">
                <span class="option-label">${letter}.</span>
                <span>${option}</span>
                ${isCorrect ? ' ✓' : ''}
              </div>
            `;
            })
            .join('')}
        </div>
        ${
          typeof correctIndex === 'number'
            ? `
        <p><strong>Đáp án đúng:</strong> <span class="correct-answer">${String.fromCharCode(65 + correctIndex)}</span></p>
        `
            : ''
        }
      </div>
    `;
  }

  private generateGrammarHtml(content: any): string {
    const question = content.question || '';
    const options = content.options || [];
    const correctIndex = content.correctIndex;

    // Debug logging
    console.log('🔍 Grammar debug:', {
      question,
      optionsCount: options.length,
      correctIndex,
      contentKeys: Object.keys(content),
    });

    return `
      <div class="question">
        <div class="question-text">${question}</div>
        <div class="options">
          ${options
            .map((option: any, idx: number) => {
              const letter = String.fromCharCode(65 + idx); // A, B, C, D...
              const isCorrect = correctIndex === idx;
              return `
              <div class="option ${isCorrect ? 'correct-answer' : ''}">
                <span class="option-label">${letter}.</span>
                <span>${option}</span>
                ${isCorrect ? ' ✓' : ''}
              </div>
            `;
            })
            .join('')}
        </div>
        ${
          typeof correctIndex === 'number'
            ? `
        <p><strong>Đáp án đúng:</strong> <span class="correct-answer">${String.fromCharCode(65 + correctIndex)}</span></p>
        `
            : ''
        }
      </div>
    `;
  }

  private generateGenericHtml(content: any): string {
    return `
      <div class="question">
        <div class="question-text">${content.question || JSON.stringify(content, null, 2)}</div>
      </div>
    `;
  }

  /**
   * Get localized activity type label
   */
  private getActivityTypeLabel(type: string): string {
    const typeLabels: Record<string, string> = {
      multiple_choice: 'Trắc nghiệm nhiều đáp án',
      single_choice: 'Trắc nghiệm một đáp án',
      true_false: 'Đúng/Sai',
      fill_blank: 'Điền từ vào chỗ trống',
      essay: 'Tự luận',
      listening: 'Nghe hiểu',
      reading: 'Đọc hiểu',
      speaking: 'Nói',
      writing: 'Viết',
    };

    return typeLabels[type] || type;
  }

  /**
   * Get localized difficulty label
   */
  private getDifficultyLabel(difficulty: string): string {
    const difficultyLabels: Record<string, string> = {
      easy: 'Dễ',
      medium: 'Trung bình',
      hard: 'Khó',
    };

    return difficultyLabels[difficulty] || difficulty;
  }
}
