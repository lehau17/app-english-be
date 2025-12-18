/**
 * Tính toán tự động thời gian bắt đầu và kết thúc của lớp học dựa trên:
 * 1. Số buổi học theo kế hoạch của khóa học
 * 2. Lịch học hàng tuần (slots)
 * 3. Thời điểm bắt đầu (nếu có)
 *
 * Quy tắc:
 * - Nếu có startDate, sẽ tính endDate dựa vào số buổi theo kế hoạch và slots
 * - Nếu có endDate, sẽ tính startDate dựa vào số buổi theo kế hoạch và slots
 * - Nếu không có cả hai, sẽ bắt đầu từ ngày hiện tại và tính endDate
 */
export function autoCalculateClassroomPeriod(
  plannedSessions: number,
  slots: { dayOfWeek: string }[],
  startDate?: Date,
  endDate?: Date,
  holidayDates: string[] = [],
): { periodStart: Date; periodEnd: Date } {
  // Nếu không có slots hoặc plannedSessions, không thể tính toán
  if (!slots.length || !plannedSessions) {
    throw new Error(
      'Không thể tính toán thời gian lớp học khi không có lịch học hoặc số buổi',
    );
  }

  // Chuyển đổi dayOfWeek thành số (0-6, 0 là Chủ Nhật)
  const daysOfWeek = slots
    .map((slot) => {
      switch (slot.dayOfWeek) {
        case 'mon':
          return 1;
        case 'tue':
          return 2;
        case 'wed':
          return 3;
        case 'thu':
          return 4;
        case 'fri':
          return 5;
        case 'sat':
          return 6;
        case 'sun':
          return 0;
        default:
          return -1;
      }
    })
    .filter((day) => day >= 0);

  // Nếu daysOfWeek rỗng sau khi lọc, không thể tính toán
  if (!daysOfWeek.length) {
    throw new Error('Không có ngày học hợp lệ');
  }

  // Sắp xếp các ngày trong tuần
  daysOfWeek.sort((a, b) => a - b);

  // Số ngày học mỗi tuần
  const daysPerWeek = daysOfWeek.length;

  // Số tuần cần để hoàn thành plannedSessions
  const totalWeeks = Math.ceil(plannedSessions / daysPerWeek);

  const result = { periodStart: new Date(), periodEnd: new Date() };

  // Nếu có startDate, tính endDate
  if (startDate) {
    result.periodStart = new Date(startDate);

    // Tìm buổi học cuối cùng
    const lastSessionDate = findLastSessionDate(
      result.periodStart,
      daysOfWeek,
      plannedSessions,
      holidayDates,
    );

    // Thêm 1 ngày để đảm bảo kết thúc vào cuối ngày
    const endDate = new Date(lastSessionDate);
    endDate.setDate(endDate.getDate() + 1);
    result.periodEnd = endDate;
  }
  // Nếu có endDate, tính startDate (NOT SUPPORTING HOLIDAYS YET FOR BACKWARD CALCULATION AS IT IS RARELY USED)
  else if (endDate) {
    result.periodEnd = new Date(endDate);

    // Tính toán ngày bắt đầu từ ngày kết thúc
    const startDate = new Date(result.periodEnd);

    // Lùi về số tuần cần thiết
    startDate.setDate(startDate.getDate() - totalWeeks * 7);

    // Điều chỉnh ngày bắt đầu để phù hợp với lịch học
    while (
      plannedSessionsBetween(startDate, result.periodEnd, daysOfWeek) >
      plannedSessions
    ) {
      startDate.setDate(startDate.getDate() + 1);
    }

    result.periodStart = startDate;
  }
  // Nếu không có cả hai, bắt đầu từ ngày hiện tại
  else {
    result.periodStart = new Date();

    // Tìm buổi học cuối cùng
    const lastSessionDate = findLastSessionDate(
      result.periodStart,
      daysOfWeek,
      plannedSessions,
      holidayDates,
    );

    // Thêm 1 ngày để đảm bảo kết thúc vào cuối ngày
    const endDate = new Date(lastSessionDate);
    endDate.setDate(endDate.getDate() + 1);
    result.periodEnd = endDate;
  }

  return result;
}

/**
 * Tìm ngày của buổi học cuối cùng
 */
function findLastSessionDate(
  startDate: Date,
  daysOfWeek: number[],
  plannedSessions: number,
  holidayDates: string[] = [],
): Date {
  const currentDate = new Date(startDate);
  let sessionCount = 0;

  // Safety break to prevent infinite loops
  let safetyCounter = 0;
  const MAX_ITERATIONS = plannedSessions * 7 + 365;

  while (sessionCount < plannedSessions) {
    safetyCounter++;
    if (safetyCounter > MAX_ITERATIONS) break;

    const dayOfWeek = currentDate.getDay();
    const dateString = currentDate.toISOString().split('T')[0];

    // Check if valid day AND not a holiday
    if (daysOfWeek.includes(dayOfWeek)) {
      if (!holidayDates.includes(dateString)) {
        sessionCount++;

        // Nếu đây là buổi cuối cùng, trả về ngày này
        if (sessionCount === plannedSessions) {
          return new Date(currentDate);
        }
      }
    }

    // Chuyển sang ngày tiếp theo
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Không tìm thấy buổi cuối cùng (không nên xảy ra)
  return currentDate;
}

/**
 * Tính số buổi học giữa hai ngày
 */
function plannedSessionsBetween(
  startDate: Date,
  endDate: Date,
  daysOfWeek: number[],
): number {
  const currentDate = new Date(startDate);
  let sessionCount = 0;

  while (currentDate < endDate) {
    const dayOfWeek = currentDate.getDay();

    if (daysOfWeek.includes(dayOfWeek)) {
      sessionCount++;
    }

    // Chuyển sang ngày tiếp theo
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return sessionCount;
}
