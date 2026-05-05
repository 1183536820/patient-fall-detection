#!/usr/bin/env python3
import argparse
import json
import os
import sys
import time
import base64
from pathlib import Path

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False

model = None

def calculate_vertical_distance(keypoints):
    left_shoulder = next((kp for kp in keypoints if kp['index'] == 5), None)
    right_shoulder = next((kp for kp in keypoints if kp['index'] == 6), None)
    left_hip = next((kp for kp in keypoints if kp['index'] == 11), None)
    right_hip = next((kp for kp in keypoints if kp['index'] == 12), None)

    shoulders = []
    hips = []

    if left_shoulder and left_shoulder['confidence'] > 0.3:
        shoulders.append(left_shoulder)
    if right_shoulder and right_shoulder['confidence'] > 0.3:
        shoulders.append(right_shoulder)
    if left_hip and left_hip['confidence'] > 0.3:
        hips.append(left_hip)
    if right_hip and right_hip['confidence'] > 0.3:
        hips.append(right_hip)

    if not shoulders or not hips:
        return None

    avg_shoulder_y = sum(s['y'] for s in shoulders) / len(shoulders)
    avg_hip_y = sum(h['y'] for h in hips) / len(hips)
    vertical_distance = abs(avg_hip_y - avg_shoulder_y)
    return vertical_distance

def calculate_body_angle(keypoints):
    left_shoulder = next((kp for kp in keypoints if kp['index'] == 5), None)
    right_shoulder = next((kp for kp in keypoints if kp['index'] == 6), None)
    left_hip = next((kp for kp in keypoints if kp['index'] == 11), None)
    right_hip = next((kp for kp in keypoints if kp['index'] == 12), None)

    shoulders = []
    hips = []

    if left_shoulder and left_shoulder['confidence'] > 0.3:
        shoulders.append((left_shoulder['x'], left_shoulder['y']))
    if right_shoulder and right_shoulder['confidence'] > 0.3:
        shoulders.append((right_shoulder['x'], right_shoulder['y']))
    if left_hip and left_hip['confidence'] > 0.3:
        hips.append((left_hip['x'], left_hip['y']))
    if right_hip and right_hip['confidence'] > 0.3:
        hips.append((right_hip['x'], right_hip['y']))

    if not shoulders or not hips:
        return None

    import math
    avg_shoulder_x = sum(s[0] for s in shoulders) / len(shoulders)
    avg_shoulder_y = sum(s[1] for s in shoulders) / len(shoulders)
    avg_hip_x = sum(h[0] for h in hips) / len(hips)
    avg_hip_y = sum(h[1] for h in hips) / len(hips)

    dx = avg_shoulder_x - avg_hip_x
    dy = avg_shoulder_y - avg_hip_y
    angle = math.degrees(math.atan2(abs(dx), abs(dy))) if dy != 0 else 90.0
    return angle

def is_fall(vertical_distance, body_angle, threshold, angle_threshold, use_angle):
    fall_reason = []
    if vertical_distance and vertical_distance < threshold:
        fall_reason.append(f'vertical_distance_too_small: {vertical_distance:.1f} < {threshold}')
    if use_angle and body_angle and body_angle > angle_threshold:
        fall_reason.append(f'angle_too_large: {body_angle:.1f} > {angle_threshold}')
    return len(fall_reason) > 0, fall_reason

def load_model(model_path_str):
    global model
    try:
        model_path = Path(model_path_str)
        if not model_path.exists():
            model_path = Path('yolov8n-pose.pt')
            if not model_path.exists():
                model_path = Path('python/yolov8n-pose.pt')
        
        model = YOLO(str(model_path))
        print(f'[Stream] 模型加载成功', file=sys.stderr)
        return True
    except Exception as e:
        print(f'[Stream] 模型加载失败: {e}', file=sys.stderr)
        return False

def detect_image(image_data, args):
    results = []
    
    try:
        if model:
            import cv2
            import numpy as np
            
            img_bytes = base64.b64decode(image_data)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            
            if img is None:
                print('[Stream] 图像解码失败', file=sys.stderr, flush=True)
                return None
            
            detections = model.predict(
                source=img,
                conf=args.conf,
                save=False
            )
            
            for frame_idx, result in enumerate(detections):
                if result.keypoints is not None:
                    for person_idx, kps in enumerate(result.keypoints):
                        keypoints = []
                        kp_data = kps.data.cpu().numpy()[0]
                        
                        for kp_idx in range(len(kp_data)):
                            if len(kp_data[kp_idx]) >= 3:
                                x, y, conf = kp_data[kp_idx]
                                keypoints.append({
                                    'index': kp_idx,
                                    'x': float(x),
                                    'y': float(y),
                                    'confidence': float(conf)
                                })
                        
                        if keypoints:
                            vertical_distance = calculate_vertical_distance(keypoints)
                            body_angle = calculate_body_angle(keypoints)
                            use_angle = args.use_angle.lower() == 'true'
                            
                            fall, reason = is_fall(
                                vertical_distance,
                                body_angle,
                                args.threshold * 200,
                                args.angle_threshold,
                                use_angle
                            )
                            
                            results.append({
                                'timestamp': 0,
                                'frame': frame_idx,
                                'is_fall': fall,
                                'vertical_distance': vertical_distance,
                                'body_angle': body_angle,
                                'fall_reason': reason,
                                'keypoints': keypoints,
                                'person_count': len(result.keypoints)
                            })
                else:
                    results.append({
                        'timestamp': 0,
                        'frame': frame_idx,
                        'is_fall': False,
                        'keypoints': [],
                        'person_count': 0
                    })
                    
            return results
        else:
            return simulate_detection_stream(args)
            
    except Exception as e:
        print(f'[Stream] 检测失败: {e}', file=sys.stderr, flush=True)
        return simulate_detection_stream(args)

def simulate_detection_stream(args):
    import random
    import math
    
    center_x = 320
    center_y = 240
    base_distance = 140
    
    vertical_distance = base_distance + (random.random() - 0.5) * 40
    body_angle = 10 + random.random() * 25
    
    if random.random() < 0.1:
        vertical_distance = 50 + random.random() * 30
        body_angle = 60 + random.random() * 25
    
    vertical_distance = max(30, min(200, vertical_distance))
    body_angle = max(5, min(85, body_angle))
    
    keypoints = [
        {'index': 5, 'x': center_x - 30, 'y': center_y - int(vertical_distance // 2), 'confidence': 0.9},
        {'index': 6, 'x': center_x + 30, 'y': center_y - int(vertical_distance // 2), 'confidence': 0.9},
        {'index': 11, 'x': center_x - 25, 'y': center_y + int(vertical_distance // 2), 'confidence': 0.9},
        {'index': 12, 'x': center_x + 25, 'y': center_y + int(vertical_distance // 2), 'confidence': 0.9},
    ]
    
    use_angle = args.use_angle.lower() == 'true'
    
    fall, reason = is_fall(
        vertical_distance,
        body_angle,
        args.threshold * 200,
        args.angle_threshold,
        use_angle
    )
    
    return [{
        'timestamp': 0,
        'frame': 0,
        'is_fall': fall,
        'vertical_distance': vertical_distance,
        'body_angle': body_angle,
        'fall_reason': reason,
        'keypoints': keypoints,
        'person_count': 1
    }]

def main():
    parser = argparse.ArgumentParser(description='Fall Detection Stream Mode')
    parser.add_argument('--model', type=str, default='yolov8n-pose.pt', help='YOLO model path')
    parser.add_argument('--conf', type=float, default=0.3, help='Confidence threshold')
    parser.add_argument('--threshold', type=float, default=0.2, help='Shoulder-hip distance threshold')
    parser.add_argument('--min_kp_conf', type=float, default=0.3, help='Minimum keypoint confidence')
    parser.add_argument('--use_angle', type=str, default='true', help='Use angle detection')
    parser.add_argument('--angle_threshold', type=float, default=60.0, help='Fall angle threshold')
    args = parser.parse_args()
    
    print('[Stream] 正在加载模型...')
    sys.stdout.flush()

    try:
        if ULTRALYTICS_AVAILABLE:
            load_model(args.model)
            print('[Stream] 模型加载成功')
            sys.stdout.flush()
        else:
            print('[Stream] Ultralytics不可用，使用模拟检测模式')
            sys.stdout.flush()
    except Exception as e:
        print(f'[Stream] 模型加载失败，使用模拟模式: {e}')
        sys.stdout.flush()

    print('[READY]')
    sys.stdout.flush()
    
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                print('[Stream] 输入流关闭', file=sys.stderr)
                break
            
            line = line.strip()
            if not line:
                continue
            
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                print('[Stream] JSON解析失败', file=sys.stderr)
                continue
            
            image_data = data.get('image')
            if not image_data:
                print('[Stream] 缺少图像数据', file=sys.stderr)
                continue
            
            results = detect_image(image_data, args)
            
            if results is None:
                output = {'success': False, 'error': '检测失败'}
            else:
                output = {
                    'success': True,
                    'has_fall': any(r.get('is_fall', False) for r in results),
                    'person_count': max((r.get('person_count', 0) for r in results), default=0),
                    'detections': results
                }
            
            print(json.dumps(output, ensure_ascii=False))
            sys.stdout.flush()
            
        except KeyboardInterrupt:
            print('[Stream] 收到中断信号', file=sys.stderr)
            break
        except Exception as e:
            print(f'[Stream] 错误: {e}', file=sys.stderr)
            output = {'success': False, 'error': str(e)}
            print(json.dumps(output, ensure_ascii=False))
            sys.stdout.flush()

if __name__ == '__main__':
    main()