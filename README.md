# WorkTrack Frontend

Giao diện React/Next.js kết nối API Django, dùng MySQL đã cấu hình trong backend. Không có đăng nhập. Nhận diện khuôn mặt trên màn quét là mô phỏng, không sử dụng camera.

## Giao diện dùng chung

Các component shadcn/ui được quản lý trong `components/ui` và cấu hình tại `components.json`. Dùng `AppButton` cho nút thao tác và `FormField` cho ô nhập, vùng nhập và danh sách chọn thông thường; chúng dùng các component Button, Input, Textarea và Native Select của shadcn/ui. Ô chọn nhân viên dùng chung Popover và Command của shadcn/ui, hỗ trợ tìm theo mã hoặc tên. Hộp thoại và một số điều khiển khác vẫn dùng MUI, với font và màu đồng bộ. Font Noto Sans hỗ trợ tiếng Việt được đóng gói cùng ứng dụng.

## Chạy demo

Mở hai terminal từ thư mục `WorkTrack`.

**Terminal 1 — backend:**

```bash
cd work-track_be
source .venv/bin/activate
python manage.py check_db
python manage.py runserver 127.0.0.1:8000
```

Backend đọc cấu hình MySQL trong `work-track_be/.env`. Xem [hướng dẫn backend](../work-track_be/README.md) nếu chưa kết nối được database.

**Terminal 2 — frontend:**

```bash
cd work-track_fe
npm install
npm run dev
```

Mở `http://localhost:3000`. Frontend gọi `/api/...`; Next.js chuyển tiếp đến Django tại `http://127.0.0.1:8000`. Nếu backend dùng địa chỉ khác, chỉnh `BACKEND_API_ORIGIN` trong `.env.local` (có thể sao chép từ `.env.example`) rồi khởi động lại frontend. Không đưa thông tin MySQL vào cấu hình frontend.

Khi mở ứng dụng, qua ngày mới hoặc xem lịch ngày hiện tại/tương lai, demo tự tạo ca 08:30–17:30 cho nhân viên đang hoạt động và đủ điều kiện, kể cả cuối tuần. Ca đã có hoặc đã hủy được giữ nguyên; ngày đã qua không tự tạo. Nếu chưa mở ứng dụng, lượt quét demo vẫn tự tạo ca cho riêng nhân viên đủ điều kiện của ngày đó.

## Có thể thử

- Chọn nhân viên và cơ sở từ database. Bấm **Quét chấm công**; backend tự quyết định IN/OUT. Không cần bấm xác nhận.
- Chọn **QR đi support**: cơ sở có QR động đổi theo giờ thực; bấm **Lấy mã đang hiển thị**, chọn vị trí mô phỏng rồi bấm **Chấm công bằng QR**. Có thể sửa/xóa mã để thử sai/thiếu mã; chọn vị trí ngoài khu vực hoặc không lấy được để tạo yêu cầu xác minh.
- Quét lại trong ngưỡng cooldown: nhận lý do bỏ qua; lượt này không đảo IN/OUT. Có thể chọn kết quả nhận diện lỗi để thử thông báo.
- Đặt mốc giờ demo và bấm **Áp dụng**; đồng hồ chạy tiếp theo thời gian thực đã trôi qua, hoặc bấm **Về giờ hiện tại**. Giờ demo được gửi tới API mô phỏng; khi dùng giờ hiện tại backend lấy giờ server.
- Tiếng Việt: có bật/tắt, âm lượng, nghe thử; IN chào tên, OUT tạm biệt tên, lỗi đọc lý do. Với 100 tên mẫu và các lỗi phổ biến, ưu tiên file giọng Piper tạo offline. Với tên khác, ưu tiên giọng tiếng Việt cục bộ của trình duyệt; nếu không có, đọc lời chào chung và thông báo thiếu bản thu tên.
- Tab **Chấm công hằng ngày** tính công ca demo 08:30–17:30 từ lượt hiệu lực, hiển thị phút muộn/sớm, các lý do cần xác minh và cho gửi giải trình bổ sung/sửa lượt. Nếu quên IN đầu ca khiến lượt ra bị suy là IN, gửi yêu cầu sửa lượt đó thành OUT và sau khi duyệt gửi thêm yêu cầu bổ sung IN. Mục **Thống kê tháng** đếm số ngày đi muộn/về sớm và ngày ca đã kết thúc nhưng chưa đủ dữ liệu. HR duyệt/từ chối yêu cầu ở mục Giải trình; chi tiết nhân viên hiển thị lượt quét gốc.
- Xem dữ liệu đã lưu ở Lịch sử chấm công, Nhân viên, Lịch & phân công, Cảnh báo HR, Giải trình. Trong danh sách Nhân viên, bấm **Xem chấm công** để xem ca và dòng thời gian lượt quét của từng người; mặc định theo ngày trên đồng hồ demo và có thể chọn ngày khác. Tại **Lịch & phân công → Phân công support**, HR tạo/sửa/hủy phân công; có thể tạo trực tiếp từ một cảnh báo HR. Nếu chưa có ca, bấm **Tạo ca demo** để chủ động tạo ca 08:30–17:30. Phân công bù không tự đóng cảnh báo. Có lọc và phân trang. HR mô phỏng có thể xác minh cảnh báo, duyệt/từ chối yêu cầu bằng ghi chú; dữ liệu gốc được giữ nguyên.
- Nếu kết nối gián đoạn sau khi gửi, giữ lại lượt đó và bấm **Thử lại cùng lượt quét**. Request ID và nội dung không đổi, kể cả reload cùng tab, để backend trả lại kết quả cũ nếu đã ghi; không tạo lượt trùng.

Quét trên FE **ghi thật vào MySQL đang cấu hình**. Các thao tác xác minh/duyệt cập nhật MySQL và ghi nhật ký HR mô phỏng. QR được backend phát/kiểm tra và tạo hình quét được; thao tác đọc QR và GPS trong demo là mô phỏng. Camera/GPS thật và bảng tính công chưa triển khai.

`public/audio/` chứa 218 câu nói demo tạo offline bằng [Piper vi_VN-vais1000-medium](https://huggingface.co/rhasspy/piper-voices/tree/217ddc7/vi/vi_VN/vais1000/medium) (nguồn VAIS-1000 được ghi trong model card). Không cần cài Piper hoặc tải mô hình khi chạy ứng dụng và không gửi tên nhân viên tới dịch vụ TTS ngoài. Để tạo lại, cài `piper-tts` trong một môi trường Python riêng, tải mô hình `.onnx` cùng file `.onnx.json`, rồi chạy `python scripts/generate-piper-audio.py --model /duong-dan/ten-model.onnx --output /thu-muc-tam`; nghe thử trước khi chép các file vào `public/audio/`. Generator eSpeak cũ được giữ tại `scripts/generate-demo-audio.py`.

## Kiểm tra

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Kiểm thử trình duyệt FE ↔ Django ↔ MySQL trên instance tạm, độc lập (Linux có `mysqld`, `mysql`, Chrome và backend `.venv`):

```bash
bash scripts/run-e2e.sh
```

Script tạo database tạm trong `/tmp`, dùng cổng 8011/3011, import schema/seed, chạy Playwright rồi dừng các server. Không kết nối hoặc ghi vào MySQL cổng 3307 của bạn. Để đổi Chrome, truyền `CHROME_PATH=/đường/dẫn/chrome`.

Các trường hợp kiểm tra: tải 100 người/5 cơ sở; IN, quét lặp, OUT; đồng hồ demo tiếp tục chạy; mất phản hồi sau khi ghi và retry không thêm lượt; âm thanh dự phòng khi không có giọng Việt; lọc nhân viên và màn hình điện thoại; QR hết hạn/thu hồi, chưa phân công và thiếu GPS.
