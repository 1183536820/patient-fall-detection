// src/workers/detection.worker.ts

interface DetectionMessage {
  type: string;
  imageData?: ImageData;
  params?: {
    confidence: number;
    sensitivity: number;
  };
  timestamp?: number;
}

interface DetectionResult {
  type: 'detection_result';
  falls: boolean;
  highRiskPostures: Array<{
    type: string;
    severity: string;
    bbox: [number, number, number, number];
  }>;
  timestamp: number;
  processingTime: number;
}

// 模拟检测算法
function simulateDetection(_imageData: ImageData, _params: { confidence: number; sensitivity: number }): {
  falls: boolean;
  highRiskPostures: Array<{
    type: string;
    severity: string;
    bbox: [number, number, number, number];
  }>;
} {
  // 模拟检测逻辑
  // 这里可以替换为实际的 TensorFlow.js 或 WASM 模型调用
  const falls = Math.random() < 0.05; // 5% 概率检测到跌倒
  const highRiskPostures = [];

  // 模拟高危姿态检测
  if (Math.random() < 0.3) {
    highRiskPostures.push({
      type: 'bend',
      severity: Math.random() > 0.5 ? '中等' : '轻微',
      bbox: [100, 100, 200, 300] as [number, number, number, number]
    });
  }

  if (Math.random() < 0.2) {
    highRiskPostures.push({
      type: 'tilt',
      severity: Math.random() > 0.5 ? '严重' : '中等',
      bbox: [150, 120, 250, 320] as [number, number, number, number]
    });
  }

  if (Math.random() < 0.15) {
    highRiskPostures.push({
      type: 'single_leg',
      severity: '轻微',
      bbox: [80, 90, 180, 290] as [number, number, number, number]
    });
  }

  return {
    falls,
    highRiskPostures
  };
}

// 处理消息
self.onmessage = (event: MessageEvent<DetectionMessage>) => {
  const { type, imageData, params, timestamp } = event.data;

  if (type === 'detect' && imageData) {
    const startTime = performance.now();
    
    // 执行检测
    const result = simulateDetection(imageData, params || { confidence: 0.5, sensitivity: 5 });
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    // 回传结果
    const detectionResult: DetectionResult = {
      type: 'detection_result',
      falls: result.falls,
      highRiskPostures: result.highRiskPostures,
      timestamp: timestamp || Date.now(),
      processingTime
    };

    self.postMessage(detectionResult);
  }
};

// 初始化消息
self.postMessage({ type: 'ready' });
