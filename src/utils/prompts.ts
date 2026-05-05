export const PARAM_OPTIMIZATION_SYSTEM_PROMPT = `你是一个AI参数优化专家，专精于YOLOv8-Pose人体姿态估计的跌倒检测参数调优。
根据检测数据分析并输出最优参数，只需返回JSON格式（不要markdown），格式如下：
{
  "confidence": 0.3-0.9之间的数字,
  "shoulderHipThreshold": 0.05-0.4之间的数字,
  "minKeypointConfidence": 0.1-0.8之间的数字,
  "useAngleDetection": true或false,
  "fallAngleThreshold": 30-90之间的数字,
  "reason": "简短的中文优化原因"
}`

export function buildParamOptimizationUserPrompt(detectionStats) {
  return `请根据以下检测数据优化跌倒检测参数：
- 总帧数: ${detectionStats.totalFrames}
- 跌倒事件: ${detectionStats.fallEvents} 次
- 异常行为: ${detectionStats.abnormalBehaviors} 次
- 平均身体角度: ${detectionStats.avgBodyAngle}°
- 平均垂直距离: ${detectionStats.avgVerticalDistance}px
- 是否检测到人: ${detectionStats.personDetected ? '是' : '否'}
- 当前参数: ${JSON.stringify(detectionStats.currentParams)}`
}
