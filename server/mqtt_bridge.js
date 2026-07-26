import { createServer } from 'net'
import logger from './utils/logger.js'

const MQTT_PORT = 1883

/**
 * 一个轻量级 MQTT 3.1.1 代理实现
 * 只实现需要的功能: CONNECT, PUBLISH, PINGREQ, DISCONNECT
 * 香橙派用标准的 MQTT 客户端库就可以连接
 */
export async function startMqttBroker(broadcastFn) {
  const server = createServer((socket) => {
    let clientId = 'unknown'
    let streamBuffer = Buffer.alloc(0)

    const sendConnack = (returnCode = 0) => {
      // CONNACK packet: 0x20, 0x02, 0x00, returnCode
      const connack = Buffer.from([0x20, 0x02, 0x00, returnCode])
      socket.write(connack)
    }

    const sendPingresp = () => {
      socket.write(Buffer.from([0xD0, 0x00]))
    }

    const parseMqttPacket = (data) => {
      if (data.length < 2) return null
      const packetType = data[0] >> 4
      let remainingLength = 0
      let multiplier = 1
      let pos = 1
      while (pos < data.length) {
        const byte = data[pos++]
        remainingLength += (byte & 0x7f) * multiplier
        multiplier *= 0x80
        if ((byte & 0x80) === 0) break
        if (pos > 5) return null // malformed
      }
      if (data.length < pos + remainingLength) return null // incomplete
      return {
        type: packetType,
        flags: data[0] & 0x0F,
        remainingLength,
        headerLen: pos,
        payload: data.slice(pos, pos + remainingLength)
      }
    }

    socket.on('data', (data) => {
      streamBuffer = Buffer.concat([streamBuffer, data])

      while (streamBuffer.length >= 2) {
        const packet = parseMqttPacket(streamBuffer)
        if (!packet) break

        streamBuffer = streamBuffer.slice(packet.headerLen + packet.remainingLength)

        switch (packet.type) {
          case 1: {  // CONNECT
            try {
              const buf = packet.payload
              let p = 0
              const protoNameLen = buf.readUInt16BE(p); p += 2
              const protoName = buf.slice(p, p + protoNameLen).toString('utf8'); p += protoNameLen
              const protoLevel = buf[p++]
              const connectFlags = buf[p++]
              const keepAlive = buf.readUInt16BE(p); p += 2

              // 只支持 MQTT 3.1.1 (level 4) 或 5.0 (level 5)
              if (protoLevel !== 4 && protoLevel !== 5) {
                console.log(`[MQTT] ✗ 不支持的协议版本: ${protoLevel}`)
                sendConnack(1) // unacceptable protocol version
                socket.end()
                return
              }

              // 解析 Client ID
              const clientIdLen = buf.readUInt16BE(p); p += 2
              clientId = buf.slice(p, p + clientIdLen).toString('utf8'); p += clientIdLen

              console.log(`[MQTT] ✓ 客户端连接: ${clientId} (MQTT ${protoLevel === 4 ? '3.1.1' : '5.0'})`)
              logger.info('MQTT客户端已连接', { clientId, protocol: protoLevel === 4 ? '3.1.1' : '5.0' })
              sendConnack(0)
            } catch (e) {
              console.log(`[MQTT] ✗ 解析CONNECT失败: ${e.message}`)
              sendConnack(1)
              socket.end()
            }
            break
          }

          case 3: {  // PUBLISH
            try {
              const buf = packet.payload
              let p = 0
              const topicLen = buf.readUInt16BE(p); p += 2
              const topic = buf.slice(p, p + topicLen).toString('utf8'); p += topicLen

              // QoS 从固定头标志位获取 (packet.flags)
              const qos = (packet.flags >> 1) & 0x03
              if (qos > 0) {
                p += 2 // skip packet identifier (QoS 1/2)
              }

              const message = buf.slice(p).toString('utf8')
              console.log(`[MQTT] 📨 收到消息 [${topic}] (QoS${qos}): ${message.substring(0, 100)}`)

              if (topic === 'fall/alert') {
                console.log(`[MQTT] ⚠ 跌倒报警! 来自: ${clientId}`)
                try {
                  const data = JSON.parse(message)
                  if (broadcastFn) {
                    broadcastFn({
                      type: 'fall_alert',
                      source: 'mqtt',
                      device: data.device || clientId || 'orangepi5b',
                      room: data.room || '301',
                      timestamp: data.timestamp || Date.now(),
                      message: '检测到跌倒！'
                    })
                  }
                  logger.info('MQTT跌倒报警已广播', { device: data.device, room: data.room })
                } catch (e) {
                  if (broadcastFn) {
                    broadcastFn({ type: 'fall_alert', source: 'mqtt', message })
                  }
                }

                if (qos === 1) {
                  // PUBACK: 固定头(2) + Packet Identifier(2)
                  const puback = Buffer.from([0x40, 0x02, 0x00, 0x01])
                  socket.write(puback)
                }
              } else if (topic === 'fall/heartbeat') {
                console.log(`[MQTT] ♡ 心跳 ${clientId}: ${message.substring(0, 50)}`)
              }
            } catch (e) {
              console.log(`[MQTT] ✗ 解析PUBLISH失败: ${e.message}`)
            }
            break
          }

          case 12: {  // PINGREQ
            sendPingresp()
            break
          }

          case 14: {  // DISCONNECT
            console.log(`[MQTT] - 客户端断开: ${clientId}`)
            logger.info('MQTT客户端断开', { clientId })
            socket.end()
            break
          }

          default:
            console.log(`[MQTT] 未知包类型: ${packet.type}`)
        }
      }
    })

    socket.on('close', () => {
      console.log(`[MQTT] 🔌 连接关闭: ${clientId}`)
    })

    socket.on('error', (err) => {
      // 忽略 ECONNRESET (客户端强制断开)
      if (err.code !== 'ECONNRESET') {
        console.log(`[MQTT] ⚡ Socket错误: ${err.code}`)
      }
    })

    // 30秒无数据超时
    socket.setTimeout(30000, () => {
      socket.end()
    })
  })

  server.listen(MQTT_PORT, () => {
    console.log(`[MQTT] ✓ 自定义MQTT代理运行在端口 ${MQTT_PORT}`)
    console.log(`[MQTT] 香橙派连接地址: mqtt://你的PCIP:${MQTT_PORT}`)
    logger.info('MQTT代理启动成功', { port: MQTT_PORT })
  })

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[MQTT] 端口 ${MQTT_PORT} 已被占用，跳过`)
    } else {
      console.error(`[MQTT] 错误:`, err)
      logger.error('MQTT代理错误', err)
    }
  })

  return server
}
