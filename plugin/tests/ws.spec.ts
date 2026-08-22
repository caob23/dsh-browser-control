/** Frame codec unit tests: fragmentation, length boundaries, and protocol rejections. */
import { describe, expect, it } from 'vitest'
import {
  encodeCloseFrame, encodeControlFrame, encodeTextFrame,
  FrameReader, MAX_FRAME_BYTES, type WsFrame,
} from '../src/ws.ts'

/** Build one masked client text frame, mirroring the extension side of the link. */
function maskTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8')
  const mask = Buffer.from([0x11, 0x22, 0x33, 0x44])
  const masked = Buffer.from(payload)
  for (let i = 0; i < masked.length; i++) masked[i] = masked[i]! ^ mask[i & 3]!
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, masked])
  }
  if (payload.length < 65_536) {
    const header = Buffer.alloc(4)
    header[0] = 0x81
    header[1] = 0x80 | 126
    header.writeUInt16BE(payload.length, 2)
    return Buffer.concat([header, mask, masked])
  }
  const header = Buffer.alloc(10)
  header[0] = 0x81
  header[1] = 0x80 | 127
  header.writeBigUInt64BE(BigInt(payload.length), 2)
  return Buffer.concat([header, mask, masked])
}

describe('FrameReader', () => {
  it('parses a single small frame', () => {
    const reader = new FrameReader()
    reader.push(maskTextFrame('{"a":1}'))
    const frames: WsFrame[] = []
    reader.drain(frame => frames.push(frame))
    expect(frames).toHaveLength(1)
    expect(frames[0]).toMatchObject({ fin: true, opcode: 0x1 })
    expect(frames[0]?.payload.toString('utf8')).toBe('{"a":1}')
  })

  it('reassembles one message split across arbitrary TCP chunks', () => {
    const frame = maskTextFrame('x'.repeat(5000))
    const reader = new FrameReader()
    const texts: string[] = []
    for (let offset = 0; offset < frame.length; offset += 7) {
      reader.push(frame.subarray(offset, Math.min(offset + 7, frame.length)))
      reader.drain((parsed) => {
        texts.push(parsed.payload.toString('utf8'))
        expect(parsed.fin).toBe(true)
      })
    }
    expect(texts).toEqual(['x'.repeat(5000)])
  })

  it('rejects an oversized declared length', () => {
    const reader = new FrameReader()
    const header = Buffer.alloc(10)
    header[0] = 0x81
    header[1] = 127
    header.writeBigUInt64BE(BigInt(MAX_FRAME_BYTES) + 1n, 2)
    reader.push(header)
    expect(() => reader.drain(() => {})).toThrow(/frame too large/)
  })

  it('rejects unmasked data frames from the client side of the link', () => {
    const reader = new FrameReader()
    reader.push(Buffer.from([0x81, 5, ...Buffer.from('hello')]))
    expect(() => reader.drain(() => {})).toThrow(/unmasked/)
  })
})

describe('frame encoders', () => {
  it.each([10, 125, 126, 200, 65_535, 65_536, 70_000])('round-trips a %i-byte masked text frame through the server reader', (size) => {
    const text = 'y'.repeat(size)
    const reader = new FrameReader()
    reader.push(maskTextFrame(text))
    const parsed: WsFrame[] = []
    reader.drain(f => parsed.push(f))
    expect(parsed[0]?.payload.toString('utf8')).toBe(text)
  })

  it.each([10, 200, 70_000])('encodes server-direction text frames unmasked with exact length prefixes (%i-byte)', (size) => {
    const text = 'z'.repeat(size)
    const frame = encodeTextFrame(text)
    expect(frame[1]! & 0x80).toBe(0)
    const [payloadOffset, declared] = frame[1]! === 126
      ? [4, frame.readUInt16BE(2)]
      : frame[1]! === 127
        ? [10, Number(frame.readBigUInt64BE(2))]
        : [2, frame[1]!]
    expect(declared).toBe(size * 1)
    expect(frame.length).toBe(payloadOffset + Buffer.byteLength(text))
    expect(frame.subarray(payloadOffset).toString('utf8')).toBe(text)
  })

  it('encodes control frames with their opcode and payload', () => {
    const pong = encodeControlFrame(0xA, Buffer.from('pong'))
    expect(pong[0]).toBe(0x8A)
    expect(pong.subarray(2).toString()).toBe('pong')
    const close = encodeCloseFrame(1000, 'bye')
    expect(close[0]).toBe(0x88)
    expect(close.readUInt16BE(2)).toBe(1000)
    expect(close.subarray(4).toString()).toBe('bye')
  })

  it('truncates an over-long close reason to fit the control limit', () => {
    const close = encodeCloseFrame(1000, 'z'.repeat(500))
    expect(close.length).toBeLessThanOrEqual(125 + 2)
  })
})
