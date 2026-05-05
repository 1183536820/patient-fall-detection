export interface LineChartOptions {
  xAxisData: string[]
  seriesData: Array<{ name: string; data: number[] }>
  yAxisMin?: number
  yAxisMax?: number
  stack?: boolean
}

export interface PieChartOptions {
  seriesName: string
  data: Array<{ value: number; name: string }>
}

export function createGridChartOption(options: LineChartOptions) {
  const { xAxisData, seriesData, yAxisMin = 0, yAxisMax, stack = false } = options

  return {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: seriesData.map(s => s.name)
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      outerLabels: { show: true }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xAxisData
    },
    yAxis: {
      type: 'value',
      min: yAxisMin,
      ...(yAxisMax && { max: yAxisMax })
    },
    series: seriesData.map(s => ({
      name: s.name,
      type: 'line',
      ...(stack && { stack: 'Total' }),
      data: s.data
    }))
  }
}

export function createLineChartOption(options: Omit<LineChartOptions, 'stack'>) {
  const { xAxisData, seriesData, yAxisMin = 0, yAxisMax } = options

  return {
    tooltip: {
      trigger: 'axis'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      outerLabels: { show: true }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xAxisData
    },
    yAxis: {
      type: 'value',
      min: yAxisMin,
      ...(yAxisMax && { max: yAxisMax })
    },
    series: seriesData.map(s => ({
      name: s.name,
      type: 'line',
      data: s.data
    }))
  }
}

export function createPieChartOption(options: PieChartOptions) {
  const { seriesName, data } = options

  return {
    tooltip: {
      trigger: 'item'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: seriesName,
        type: 'pie',
        radius: '60%',
        data,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  }
}

export function createGaugeChartOption(value: number, max: number = 100) {
  return {
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max,
        splitNumber: 4,
        axisLine: {
          lineStyle: {
            width: 6,
            color: [
              [0.3, '#67e0e3'],
              [0.7, '#37a2da'],
              [1, '#fd666d']
            ]
          }
        },
        pointer: {
          icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
          length: '12%',
          width: 20,
          offsetCenter: [0, '-60%'],
          itemStyle: {
            color: 'auto'
          }
        },
        axisTick: {
          length: 12,
          lineStyle: {
            color: 'auto',
            width: 2
          }
        },
        splitLine: {
          length: 20,
          lineStyle: {
            color: 'auto',
            width: 5
          }
        },
        axisLabel: {
          color: '#464646',
          fontSize: 12,
          distance: -60
        },
        title: {
          offsetCenter: [0, '-10%'],
          fontSize: 16
        },
        detail: {
          fontSize: 30,
          offsetCenter: [0, '0%'],
          valueAnimation: true,
          formatter: (value: number) => Math.round(value) + '',
          color: 'auto'
        },
        data: [{ value, name: '' }]
      }
    ]
  }
}

export function createBarChartOption(options: {
  xAxisData: string[]
  seriesData: Array<{ name: string; data: number[] }>
  yAxisMin?: number
}) {
  const { xAxisData, seriesData, yAxisMin = 0 } = options

  return {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: seriesData.map(s => s.name)
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      outerLabels: { show: true }
    },
    xAxis: {
      type: 'category',
      data: xAxisData
    },
    yAxis: {
      type: 'value',
      min: yAxisMin
    },
    series: seriesData.map(s => ({
      name: s.name,
      type: 'bar',
      data: s.data
    }))
  }
}

export function generateDateLabels(days: number, format: 'date' | 'time' = 'date'): string[] {
  const labels: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    if (format === 'date') {
      labels.push(date.toLocaleDateString('zh-CN'))
    } else {
      labels.push(`${i}:00`)
    }
  }
  return labels
}

export function generateTimeLabels(hours: number, interval: number = 2): string[] {
  const labels: string[] = []
  for (let i = 0; i < hours; i += interval) {
    labels.push(`${i}:00`)
  }
  return labels
}