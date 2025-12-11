import { ExcelExportService } from '@app/shared';
import { Injectable } from '@nestjs/common';
import { GradebookService } from './gradebook.service';

@Injectable()
export class GradebookExportService {
  constructor(
    private readonly excelExportService: ExcelExportService,
    private readonly gradebookService: GradebookService,
  ) {}

  /**
   * Export classroom gradebook to Excel
   */
  async exportClassroomGradebook(
    classroomId: string,
  ): Promise<Buffer> {
    const gradebook = await this.gradebookService.calculateClassroomGrades(
      classroomId,
    );

    const columns = [
      { header: 'Họ và tên', key: 'studentName', width: 25 },
      { header: 'Giữa kỳ', key: 'midterm', width: 12 },
      { header: 'Cuối kỳ', key: 'final', width: 12 },
      { header: 'Bài kiểm tra', key: 'tests', width: 15 },
      { header: 'Hoạt động', key: 'activities', width: 12 },
      { header: 'Điểm tổng kết', key: 'finalGrade', width: 15 },
    ];

    const data = gradebook.students.map((student) => ({
      studentName: student.studentName,
      midterm: student.midterm ?? '-',
      final: student.final ?? '-',
      tests: student.tests ?? '-',
      activities: student.activities ?? '-',
      finalGrade: student.finalGrade.toFixed(1),
    }));

    return this.excelExportService.generateExcel(
      data,
      columns,
      `Bảng điểm lớp ${gradebook.classroomName}`,
    );
  }

  /**
   * Export student transcript to Excel
   */
  async exportStudentTranscript(studentId: string): Promise<Buffer> {
    const transcript = await this.gradebookService.getStudentTranscript(
      studentId,
    );

    const columns = [
      { header: 'Lớp học', key: 'classroomName', width: 25 },
      { header: 'Khóa học', key: 'courseName', width: 25 },
      { header: 'Giữa kỳ', key: 'midterm', width: 12 },
      { header: 'Cuối kỳ', key: 'final', width: 12 },
      { header: 'Bài kiểm tra', key: 'tests', width: 15 },
      { header: 'Hoạt động', key: 'activities', width: 12 },
      { header: 'Điểm tổng kết', key: 'finalGrade', width: 15 },
    ];

    const data = transcript.classrooms.map((classroom) => ({
      classroomName: classroom.classroomName,
      courseName: classroom.courseName,
      midterm: classroom.midterm ?? '-',
      final: classroom.final ?? '-',
      tests: classroom.tests ?? '-',
      activities: classroom.activities ?? '-',
      finalGrade: classroom.finalGrade.toFixed(1),
    }));

    return this.excelExportService.generateExcel(
      data,
      columns,
      `Bảng điểm của ${transcript.studentName}`,
    );
  }

  /**
   * Export parent children grades to Excel
   */
  async exportParentChildrenGrades(parentId: string): Promise<Buffer> {
    const grades = await this.gradebookService.getParentChildrenGrades(
      parentId,
    );

    const columns = [
      { header: 'Tên con', key: 'childName', width: 20 },
      { header: 'Lớp học', key: 'classroomName', width: 25 },
      { header: 'Khóa học', key: 'courseName', width: 25 },
      { header: 'Giữa kỳ', key: 'midterm', width: 12 },
      { header: 'Cuối kỳ', key: 'final', width: 12 },
      { header: 'Bài kiểm tra', key: 'tests', width: 15 },
      { header: 'Hoạt động', key: 'activities', width: 12 },
      { header: 'Điểm tổng kết', key: 'finalGrade', width: 15 },
    ];

    const data: any[] = [];
    grades.children.forEach((child) => {
      child.classrooms.forEach((classroom) => {
        data.push({
          childName: child.childName,
          classroomName: classroom.classroomName,
          courseName: classroom.courseName,
          midterm: classroom.midterm ?? '-',
          final: classroom.final ?? '-',
          tests: classroom.tests ?? '-',
          activities: classroom.activities ?? '-',
          finalGrade: classroom.finalGrade.toFixed(1),
        });
      });
    });

    return this.excelExportService.generateExcel(
      data,
      columns,
      'Bảng điểm các con',
    );
  }
}












