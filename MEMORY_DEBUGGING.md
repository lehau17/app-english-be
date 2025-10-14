# Hướng dẫn Gỡ lỗi Bộ nhớ cho Ứng dụng NestJS

Tài liệu này cung cấp một hướng dẫn cơ bản về cách chẩn đoán và xác định các vấn đề rò rỉ bộ nhớ (memory leak) trong ứng dụng Node.js, đặc biệt là các ứng dụng NestJS.

## 1. Các Dấu hiệu của Rò rỉ Bộ nhớ

- **Mức sử dụng RAM tăng dần theo thời gian**: Mức sử dụng bộ nhớ của ứng dụng liên tục tăng dưới tải trọng thông thường và không bao giờ giảm xuống mức cơ bản, ngay cả trong thời gian không hoạt động.
- **Giảm hiệu năng**: Ứng dụng trở nên chậm chạp hơn theo thời gian do Garbage Collector (GC) phải làm việc nhiều hơn.
- **Sập ứng dụng (Crash)**: Ứng dụng bị sập với lỗi `FATAL ERROR: Ineffective mark-compacts near heap limit` hoặc các lỗi tương tự liên quan đến hết bộ nhớ.

## 2. Công cụ Chẩn đoán

### a. Clinic.js

`clinic.js` là một bộ công cụ mạnh mẽ để chẩn đoán các vấn đề về hiệu năng của Node.js.

- **Cài đặt**:
  ```bash
  npm install -g clinic
  ```

- **Sử dụng `clinic doctor`**:
  `clinic doctor` giúp xác định nguyên nhân gốc rễ của các vấn_đề hiệu năng, bao gồm cả rò rỉ bộ nhớ.

  **Cách chạy**:
  ```bash
  clinic doctor -- node dist/apps/client-api/main.js
  ```
  Lệnh này sẽ khởi động ứng dụng của bạn và bắt đầu thu thập dữ liệu. Sau khi bạn tạo ra một số tải (ví dụ: sử dụng `autocannon` hoặc thực hiện các yêu cầu API thủ công), hãy dừng ứng dụng (Ctrl+C). Clinic.js sẽ tạo một báo cáo HTML.

  **Phân tích báo cáo**:
  Mở tệp HTML được tạo. Tìm biểu đồ "Memory Usage". Nếu bạn thấy mức sử dụng bộ nhớ có xu hướng tăng đều mà không giảm, đó là một dấu hiệu mạnh mẽ của rò rỉ bộ nhớ.

### b. Heap Snapshots (Ảnh chụp Heap)

Heap snapshots cho phép bạn kiểm tra chi tiết các đối tượng trong bộ nhớ tại một thời điểm cụ thể. Bằng cách so sánh các snapshot được chụp ở các thời điểm khác nhau, bạn có thể xác định các đối tượng nào đang được tạo ra nhưng không được giải phóng.

**Cách lấy Heap Snapshots**:

1.  **Chạy ứng dụng ở chế độ gỡ lỗi (debug mode)**:
    ```bash
    node --inspect dist/apps/client-api/main.js
    ```

2.  **Sử dụng Chrome DevTools**:
    - Mở trình duyệt Chrome và truy cập `chrome://inspect`.
    - Bạn sẽ thấy tiến trình Node.js của mình trong mục "Remote Target". Nhấp vào "inspect".
    - Trong cửa sổ DevTools vừa mở, chuyển đến tab **Memory**.
    - Chọn "Heap snapshot" và nhấp vào nút **Take snapshot**.

**Quy trình so sánh**:

1.  **Snapshot 1 (Cơ sở)**: Lấy một snapshot ngay sau khi ứng dụng khởi động và ổn định.
2.  **Tạo tải**: Thực hiện các hành động mà bạn nghi ngờ gây ra rò rỉ (ví dụ: thực hiện nhiều cuộc gọi AI Speaking, kết nối và ngắt kết nối nhiều client).
3.  **Snapshot 2**: Lấy một snapshot thứ hai.
4.  **So sánh**: Trong DevTools, chọn snapshot thứ hai, sau đó trong menu thả xuống "Summary", chọn **Comparison**. Chế độ xem này sẽ hiển thị các đối tượng mới được cấp phát giữa hai lần chụp. Hãy chú ý đến các đối tượng có `Delta` lớn. Phân tích các đối tượng này để tìm ra nơi chúng được tạo và tại sao chúng không được thu gom.

## 3. Các Mẫu Code Phổ biến Gây Rò rỉ Bộ nhớ

- **Event Listeners không được dọn dẹp**: Luôn đảm bảo rằng mỗi lệnh gọi `.on()` hoặc `.addListener()` đều có một lệnh gọi `.off()` hoặc `.removeListener()` tương ứng khi không còn cần thiết. Đặc biệt chú ý đến các đối tượng có vòng đời ngắn (như sockets hoặc request) đăng ký các sự kiện trên các đối tượng có vòng đời dài (như các service singleton).
- **Tiến trình con (Child Processes)**: Giống như Event Listeners, các trình xử lý sự kiện trên các tiến trình con (`.on('data')`, `.on('close')`) phải được dọn dẹp để tránh rò rỉ. Sử dụng `.removeAllListeners()` khi tiến trình con kết thúc.
- **Subscriptions (ví dụ: RxJS)**: Mọi `.subscribe()` phải được kết hợp với một lệnh gọi `.unsubscribe()` trong một hook vòng đời phù hợp (ví dụ: `OnDestroy` trong NestJS).
- **Cache không có TTL**: Dữ liệu được lưu vào cache mà không có Thời gian sống (Time-To-Live) có thể tích tụ vô hạn.
- **Biến toàn cục/Static**: Tránh lưu trữ dữ liệu dành riêng cho request hoặc session trong các biến toàn cục hoặc static.
- **Closures**: Các hàm closure có thể vô tình giữ lại các tham chiếu đến các đối tượng lớn hơn cần thiết, ngăn chúng bị thu gom. Hãy cẩn thận với các closure được tạo ra trong các vòng lặp hoặc các hàm chạy thường xuyên.