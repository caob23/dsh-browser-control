/**
 * Server-side RFC 6455 frame codec for the single local extension link. The
 * extension always masks its frames and never sends binary payloads; the
 * server replies unmasked. Fragmented text messages accumulate across
 * continuation frames, so a multi-megabyte screenshot result survives socket
 * chunk boundaries.
 * @module @deepseek-ai/dsh-browser-bridge/ws
 */
/** Hard ceiling on one frame's payload; a larger frame is a protocol error. */
export declare const MAX_FRAME_BYTES: number;
/** One parsed WebSocket frame. `opcode` follows RFC 6455: 1 text, 8 close, 9 ping, 10 pong, 0 continuation. */
export interface WsFrame {
    readonly fin: boolean;
    readonly opcode: number;
    readonly payload: Buffer;
}
/**
 * Incremental frame parser over arbitrary TCP chunks. `drain` parses every
 * complete frame currently buffered and keeps the remainder; an oversized or
 * unmasked data frame throws, and the caller closes the link.
 */
export declare class FrameReader {
    private buffer;
    /** Append one TCP chunk to the parse buffer. */
    push(chunk: Buffer): void;
    /** Parse and consume every complete frame, invoking `onFrame` per frame in order. */
    drain(onFrame: (frame: WsFrame) => void): void;
    private readFrame;
}
/** Encode one unmasked text frame carrying a UTF-8 JSON message. */
export declare function encodeTextFrame(text: string): Buffer;
/** Encode one control frame (opcode 0x8 close, 0x9 ping, 0xA pong); payload stays ≤ 125 bytes. */
export declare function encodeControlFrame(opcode: number, payload?: Buffer): Buffer;
/** Build the close-frame bytes for a status code plus a UTF-8 reason within the 125-byte limit. */
export declare function encodeCloseFrame(code: number, reason: string): Buffer;
