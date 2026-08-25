import cv2
from Utils.config import ENTRY_RTSP_URL

cap = cv2.VideoCapture(ENTRY_RTSP_URL, cv2.CAP_FFMPEG)

print("Opened:", cap.isOpened())

ret, frame = cap.read()

print("Frame received:", ret)

if ret:
    cv2.imshow("Test", frame)
    cv2.waitKey(0)

cap.release()
cv2.destroyAllWindows()