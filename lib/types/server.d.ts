/**
 * Local WebSocket+HTTP bridge between one browser extension and dsh. The
 * extension connects OUT to `ws://127.0.0.1:<port>/ws?token=...`, so no
 * native-messaging host or registry setup exists; dsh drives commands through
 * {@link BridgeServer.execute} and reads link state through {@link BridgeServer.status}.
 * A small HTTP face (`/api/status`, `/api/command`, `/api/cleanup`, `/`) keeps
 * the bridge usable from curl while the server runs.
 *
 * Wire protocol (text frames, one JSON object each):
 * - extension → server: `{type:'hello',…}`, `{type:'pong',t}`, `{type:'result',id,ok,result?|error}`
 * - server → extension: `{type:'ping',t}`, `{type:'command',id,command,params}`
 * @module @deepseek-ai/dsh-browser-bridge/server
 */
/** Per-command ceiling when the caller passes none. */
export declare const DEFAULT_COMMAND_TIMEOUT_MS = 60000;
/** Hard ceiling accepted from callers; longer waits cannot be expressed. */
export declare const MAX_COMMAND_TIMEOUT_MS = 300000;
/** Identity the extension announces right after the handshake completes. */
export interface BridgeHello {
    readonly client: string;
    readonly version: string;
    readonly browser: {
        readonly name: string;
        readonly version: string;
        readonly ua: string;
    };
}
/** Snapshot of the link and in-flight work, served verbatim on `/api/status`. */
export interface BridgeServerStatus {
    readonly listening: boolean;
    readonly port: number | undefined;
    readonly extensionConnected: boolean;
    readonly connectedAt: string | undefined;
    readonly hello: BridgeHello | undefined;
    readonly pendingCommands: number;
    readonly lastError: string | undefined;
}
/** Caller controls for one {@link BridgeServer.execute} round-trip. */
export interface BridgeExecuteOptions {
    /** Fail the command after this many milliseconds; defaults to 60s, capped at 300s. */
    readonly timeoutMs?: number;
    /** Cancellation from the tool execution; aborting fails the in-flight command. */
    readonly signal?: AbortSignal;
}
/** What {@link BridgeServer.cleanup} removed. */
export interface CleanupResult {
    /** Files deleted directly inside the screenshots directory. */
    readonly shotsRemoved: number;
    /** Scratch files deleted (agent temp scripts/artifacts matched by convention). */
    readonly scratchRemoved: readonly string[];
}
export interface BridgeServerOptions {
    readonly port: number;
    readonly token: string;
    /** Directory whose direct contents `cleanup()` clears; created on demand. */
    readonly shotsDir: string;
    /** Directory scanned for agent scratch files by `cleanup()`; defaults to the process working directory. */
    readonly scratchDir?: string;
    /** Optional line logger for lifecycle diagnostics. */
    readonly log?: (line: string) => void;
}
/**
 * Clear the screenshots directory and delete agent scratch files. Only the
 * top level of each location is touched; nested trees stay untouched.
 * @param options - `shotsDir` is cleared of direct file children; `scratchDir`
 *   defaults to the process working directory and loses only scratch-named files.
 * @returns counts and names of what was removed.
 */
export declare function cleanupArtifacts(options: {
    shotsDir: string;
    scratchDir?: string;
}): Promise<CleanupResult>;
/**
 * One live bridge endpoint. Start/stop may cycle repeatedly on one instance;
 * a fresh listener is built per start so a changed config reuses the class
 * without re-allocation concerns. Exactly one extension link is held at a
 * time; a newer WebSocket replaces the older one.
 */
export declare class BridgeServer {
    private readonly options;
    private httpServer;
    private clientSocket;
    private hello;
    private connectedAt;
    private readonly pending;
    private lastError;
    private continuationRemainder;
    private continuationOpen;
    constructor(options: BridgeServerOptions);
    /** Current link state, also served verbatim as `/api/status`. */
    get status(): BridgeServerStatus;
    /** Bind `127.0.0.1:<port>` and start accepting the extension plus HTTP calls. */
    start(): Promise<void>;
    /** Close the extension link, fail every pending command, and release the port. Idempotent. */
    stop(): Promise<void>;
    /**
     * Send one command to the connected extension and await its result.
     * Throws while no extension is linked; the rejection message names the fix.
     */
    execute(command: string, params: Record<string, unknown>, options?: BridgeExecuteOptions): Promise<unknown>;
    /**
     * Delete generated screenshots and agent scratch files via
     * {@link cleanupArtifacts} using this server's configured directories.
     */
    cleanup(): Promise<CleanupResult>;
    private log;
    private handleHttp;
    private respondJson;
    private handleCommandRequest;
    private handleUpgrade;
    private handleFrame;
    private handleText;
    private closeClientSocket;
    private failAllPending;
    private logVerbose;
}
