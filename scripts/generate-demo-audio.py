"""Generate fictional demo speech offline. Requires espeak-ng; optional ESPEAK_BINARY/PATH env."""
import audioop
import os
from pathlib import Path
import subprocess
import tempfile
import wave

out = Path(__file__).resolve().parents[1] / 'public' / 'audio'
out.mkdir(parents=True, exist_ok=True)
clips = {
 'COOLDOWN': 'Không ghi nhận. Bạn vừa chấm công. Vui lòng đợi đủ thời gian rồi thử lại.',
 'BACKDATED_SCAN': 'Không ghi nhận. Giờ chấm lùi trước lượt đã có. Hãy chọn thời gian mới hơn.',
 'NO_FACE': 'Không ghi nhận. Không tìm thấy khuôn mặt.',
 'UNREGISTERED': 'Không ghi nhận. Khuôn mặt chưa đăng ký.',
 'EMPLOYEE_INACTIVE': 'Không ghi nhận. Nhân viên không trong thời gian làm việc hợp lệ.',
 'FACILITY_INACTIVE': 'Không ghi nhận. Cơ sở đã ngừng hoạt động.',
 'QR_INVALID': 'Không ghi nhận. Mã QR không hợp lệ.',
 'QR_WRONG_FACILITY': 'Không ghi nhận. Mã QR không thuộc cơ sở đã chọn.',
 'QR_REVOKED': 'Không ghi nhận. Mã QR đã bị thu hồi.',
 'QR_EXPIRED': 'Không ghi nhận. Mã QR đã hết hạn.',
 'QR_ALREADY_USED': 'Không ghi nhận. Bạn đã sử dụng mã QR này.',
 'QR_MISSING': 'Không ghi nhận. Chưa có mã QR. Đã gửi yêu cầu xác minh hiện diện.',
 'GPS_UNAVAILABLE': 'Không ghi nhận. Vị trí chưa đủ căn cứ. Đã gửi yêu cầu xác minh hiện diện.',
 'GPS_OUT_OF_RANGE': 'Không ghi nhận. Vị trí chưa đủ căn cứ. Đã gửi yêu cầu xác minh hiện diện.',
 'NETWORK': 'Chưa xác định được kết quả. Vui lòng kiểm tra kết nối và thử lại cùng lượt quét.',
 'ERROR': 'Không gửi được yêu cầu. Vui lòng kiểm tra thông tin trên màn hình.',
 'IN': 'Xin chào, mời vào.', 'OUT': 'Xin tạm biệt.',
}
for i in range(1,101):
 name = f'Nhân viên Demo {i:03}'
 clips[f'IN-{i:03}'] = f'Xin chào {name}, mời vào.'
 clips[f'OUT-{i:03}'] = f'Xin tạm biệt {name}.'
for key,text in clips.items():
 with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
  command=[os.getenv('ESPEAK_BINARY','espeak-ng'),'-v','vi','-s','155','-w',tmp.name]
  if os.getenv('ESPEAK_PATH'):command.append('--path='+os.environ['ESPEAK_PATH'])
  subprocess.run(command+[text],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  with wave.open(tmp.name,'rb') as source:
   frames=source.readframes(source.getnframes())
   frames,_=audioop.ratecv(frames,source.getsampwidth(),source.getnchannels(),source.getframerate(),11025,None)
   with wave.open(str(out/(key+'.wav')),'wb') as target:
    target.setnchannels(source.getnchannels());target.setsampwidth(source.getsampwidth());target.setframerate(11025);target.writeframes(frames)
print(f'Generated {len(clips)} offline WAV clips.')
