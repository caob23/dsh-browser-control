/**
 * Server-side RFC 6455 frame codec for the single local extension link. The
 * extension always masks its frames and never sends binary payloads; the
 * server replies unmasked. Fragmented text messages accumulate across
 * continuation frames, so a multi-megabyte screenshot result survives socket
 * chunk boundaries.
 * @module @deepseek-ai/dsh-browser-bridge/ws
 */
/** Hard ceiling on one frame's payload; a larger frame is a protocol error. */
export const MAX_FRAME_BYTES = 64 * 1024 * 1024;
/**
 * Incremental frame parser over arbitrary TCP chunks. `drain` parses every
 * complete frame currently buffered and keeps the remainder; an oversized or
 * unmasked data frame throws, and the caller closes the link.
 */
export class FrameReader {
    buffer = Buffer.alloc(0);
    /** Append one TCP chunk to the parse buffer. */
    push(chunk) {
        this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
    }
    /** Parse and consume every complete frame, invoking `onFrame` per frame in order. */
    drain(onFrame) {
        for (;;) {
            const frame = this.readFrame();
            if (!frame)
                return;
            onFrame(frame);
        }
    }
    readFrame() {
        const buf = this.buffer;
        if (buf.length < 2)
            return null;
        const fin = (buf[0] & 0x80) !== 0;
        const opcode = buf[0] & 0x0f;
        const masked = (buf[1] & 0x80) !== 0;
        let length = buf[1] & 0x7f;
        let offset = 2;
        if (length === 126) {
            if (buf.length < offset + 2)
                return null;
            length = buf.readUInt16BE(offset);
            offset += 2;
        }
        else if (length === 127) {
            if (buf.length < offset + 8)
                return null;
            const extended = buf.readBigUInt64BE(offset);
            offset += 8;
            if (extended > BigInt(MAX_FRAME_BYTES))
                throw new Error(`websocket frame too large: ${extended} bytes`);
            length = Number(extended);
        }
        let maskKey = null;
        if (masked) {
            if (buf.length < offset + 4)
                return null;
            maskKey = buf.subarray(offset, offset + 4);
            offset += 4;
        }
        if (buf.length < offset + length)
            return null;
        if (!masked && (opcode === 0x1 || opcode === 0x0 || opcode === 0x2)) {
            throw new Error('websocket client sent an unmasked data frame');
        }
        const payload = Buffer.from(buf.subarray(offset, offset + length));
        if (maskKey) {
            for (let i = 0; i < payload.length; i++)
                payload[i] = payload[i] ^ maskKey[i & 3];
        }
        this.buffer = buf.subarray(offset + length);
        return { fin, opcode, payload };
    }
}
/** Encode one unmasked text frame carrying a UTF-8 JSON message. */
export function encodeTextFrame(text) {
    const payload = Buffer.from(text, 'utf8');
    if (payload.length < 126) {
        return Buffer.from([0x81, payload.length, ...payload]);
    }
    if (payload.length < 65_536) {
        const header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(payload.length, 2);
        return Buffer.concat([header, payload]);
    }
    const header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
    return Buffer.concat([header, payload]);
}
/** Encode one control frame (opcode 0x8 close, 0x9 ping, 0xA pong); payload stays ≤ 125 bytes. */
export function encodeControlFrame(opcode, payload = Buffer.alloc(0)) {
    return Buffer.concat([Buffer.from([0x80 | opcode, payload.length]), payload]);
}
/** Build the close-frame bytes for a status code plus a UTF-8 reason within the 125-byte limit. */
export function encodeCloseFrame(code, reason) {
    const reasonBytes = Buffer.from(reason, 'utf8').subarray(0, 123);
    const body = Buffer.alloc(2 + reasonBytes.length);
    body.writeUInt16BE(code, 0);
    reasonBytes.copy(body, 2);
    return encodeControlFrame(0x8, body);
}
