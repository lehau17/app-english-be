
import { PdfExportTool } from '../apps/client-api/src/domains/agent/tools/pdf-export.tool';
import { WordExportTool } from '../apps/client-api/src/domains/agent/tools/word-export.tool';
import { ExcelExportTool } from '../apps/client-api/src/domains/agent/tools/excel-export.tool';
import { Logger } from '@nestjs/common';

// Mock Logger
const mockLogger = {
    log: (msg: string) => console.log(`[LOG] ${msg}`),
    error: (msg: string, trace?: any) => console.error(`[ERROR] ${msg}`, trace),
    warn: (msg: string) => console.warn(`[WARN] ${msg}`),
} as unknown as Logger;

// Instantiate tools once
const excelTool = new ExcelExportTool();
// @ts-ignore
excelTool.logger = mockLogger;

const wordTool = new WordExportTool();
// @ts-ignore
wordTool.logger = mockLogger;

const pdfTool = new PdfExportTool();
// @ts-ignore
pdfTool.logger = mockLogger;

/**
 * Helper to generate random student data
 */
function generateData(count: number) {
    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `Student ${i + 1}`,
        score: Math.floor(Math.random() * 100),
        attendance: `${Math.floor(Math.random() * 100)}%`,
        status: Math.random() > 0.2 ? 'Active' : 'Inactive',
        lastActive: new Date().toISOString().split('T')[0],
    }));
}

/**
 * Scenario 1: Basic Individual Exports
 */
async function testBasicExport() {
    console.log('\n--- Scenario 1: Basic Individual Exports ---');
    const data = generateData(5);
    const input = {
        filename: 'scenario1_basic',
        title: 'Basic Export Report',
        data,
        includeStatistics: true,
    };

    await Promise.all([
        excelTool.generateExcel({ ...input, filename: 'scenario1_basic_excel' }),
        wordTool.generateWord({ ...input, filename: 'scenario1_basic_word' }),
        pdfTool.generatePdf({ ...input, filename: 'scenario1_basic_pdf' }),
    ]);
    console.log('✅ Scenario 1 Completed');
}

/**
 * Scenario 2: Concurrent/Parallel Exports (Simulating multiple users or batch job)
 */
async function testConcurrentExport() {
    console.log('\n--- Scenario 2: Concurrent Exports (Stress Test) ---');
    const data = generateData(20);

    const tasks = [];
    for (let i = 0; i < 5; i++) {
        const input = {
            filename: `scenario2_concurrent_${i}`,
            title: `Concurrent Report ${i}`,
            data,
        };
        tasks.push(pdfTool.generatePdf(input));
        tasks.push(excelTool.generateExcel(input));
    }

    // Run 10 exports in parallel
    await Promise.all(tasks);
    console.log('✅ Scenario 2 Completed (10 files generated in parallel)');
}

/**
 * Scenario 3: Complex Data with Charts and Formatting
 */
async function testComplexExport() {
    console.log('\n--- Scenario 3: Complex Data with Charts ---');
    const data = generateData(10);

    const chartData = [
        { name: 'Group A', value: 400 },
        { name: 'Group B', value: 300 },
        { name: 'Group C', value: 300 },
        { name: 'Group D', value: 200 },
    ];

    const input = {
        filename: 'scenario3_complex',
        title: 'Detailed KPI Report 2024',
        description: 'This report contains detailed analysis of student performance including distribution charts and engagement metrics. (Tiếng Việt: Báo cáo chi tiết)',
        data,
        includeStatistics: true,
        pageOrientation: 'landscape' as const,
        charts: [
            {
                type: 'chart' as const,
                chartType: 'pie' as const,
                title: 'Student Distribution',
                data: chartData,
            },
            {
                type: 'chart' as const,
                chartType: 'bar' as const,
                title: 'Score Analysis',
                data: data.slice(0, 5).map(d => ({ name: d.name, value: d.score })),
            }
        ],
    };

    try {
        const [resPdf, resWord] = await Promise.all([
            pdfTool.generatePdf(input),
            wordTool.generateWord(input)
        ]);
        console.log('PDF Complex:', JSON.parse(resPdf).filename);
        console.log('Word Complex:', JSON.parse(resWord).filename);
        console.log('✅ Scenario 3 Completed');
    } catch (e) {
        console.error('❌ Scenario 3 Failed:', e);
    }
}

/**
 * Scenario 4: Specific User Request - Student List Statistics to PDF
 */
async function testStudentListStatisticsPdf() {
    console.log('\n--- Scenario 4: Student List Statistics to PDF ---');

    // Specific Data Generation for this scenario
    const students = [
        { stt: 1, ho_ten: 'Nguyễn Văn A', lop: '12A1', diem_trung_binh: 8.5, xep_loai: 'Giỏi' },
        { stt: 2, ho_ten: 'Trần Thị B', lop: '12A1', diem_trung_binh: 7.2, xep_loai: 'Khá' },
        { stt: 3, ho_ten: 'Lê Văn C', lop: '12A2', diem_trung_binh: 6.5, xep_loai: 'Trung bình' },
        { stt: 4, ho_ten: 'Phạm Thị D', lop: '12A1', diem_trung_binh: 9.0, xep_loai: 'Xuất sắc' },
        { stt: 5, ho_ten: 'Hoàng Văn E', lop: '12A3', diem_trung_binh: 5.5, xep_loai: 'Trung bình' },
        { stt: 6, ho_ten: 'Vũ Thị F', lop: '12A2', diem_trung_binh: 7.8, xep_loai: 'Khá' },
        { stt: 7, ho_ten: 'Đặng Văn G', lop: '12A3', diem_trung_binh: 4.5, xep_loai: 'Yếu' },
        { stt: 8, ho_ten: 'Bùi Thị H', lop: '12A1', diem_trung_binh: 8.2, xep_loai: 'Giỏi' },
    ];

    // Calculate stats for chart
    const xepLoaiCount = students.reduce((acc, curr) => {
        acc[curr.xep_loai] = (acc[curr.xep_loai] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const chartData = Object.entries(xepLoaiCount).map(([name, value]) => ({ name, value }));

    const input = {
        filename: 'thong_ke_hoc_vien_thang_12_2025',
        title: 'BÁO CÁO THỐNG KÊ KẾT QUẢ HỌC TẬP',
        description: 'Báo cáo tổng hợp tình hình học tập của học viên khối 12 trong tháng 12/2025.',
        data: students,
        includeStatistics: true,
        charts: [
            {
                type: 'chart' as const,
                chartType: 'pie' as const,
                title: 'Biểu đồ phân bố xếp loại',
                data: chartData,
            },
            {
                type: 'chart' as const,
                chartType: 'bar' as const,
                title: 'Số lượng học viên theo xếp loại',
                data: chartData,
            }
        ]
    };

    try {
        const result = await pdfTool.generatePdf(input);
        const parsed = JSON.parse(result);
        console.log('📄 PDF Generated:', parsed.filename);
        console.log('🔗 URL:', parsed.fullDownloadUrl);
        console.log('✅ Scenario 4 Completed');
    } catch (error) {
        console.error('❌ Scenario 4 Failed:', error);
    }
}

/**
 * Main Runner
 */
async function runTests() {
    try {
        // await testBasicExport();
        // await testConcurrentExport();
        // await testComplexExport();

        // Running only the requested test case for clarity, or enable all if regression testing needed
        await testStudentListStatisticsPdf();

        console.log('\n🎉 TEST COMPLETED');
    } catch (error) {
        console.error('\n💥 TEST SUITE FAILED:', error);
    }
}

runTests();
