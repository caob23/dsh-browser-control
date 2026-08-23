/**
 * Browser-bridge plugin: one local WebSocket endpoint the DSH Browser Control
 * extension connects to, plus the model-facing `browser_*` tools that drive
 * it. The Settings-managed `enabled` flag starts and stops the listener live
 * through {@link installSettingsSection}'s change hook — no reload needed.
 *
 * Tools stay mounted whenever the plugin does; calling one while the bridge
 * is disabled or the extension is offline fails with a message naming the
 * fix, so the model can tell the user what to do instead of hanging.
 * @module @deepseek-ai/dsh-browser-bridge
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Cordis plugin name used by loader diagnostics. */
export declare const name = "browser-bridge";
/** The tool registry this plugin contributes `browser_*` tools to. */
export declare const inject: string[];
/** Settings namespace carrying the bridge switch and endpoint options. */
export declare const BROWSER_BRIDGE_SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
export interface Config {
    /**
     * Whether the local bridge listens. False keeps the tools mounted but every
     * call reports how to enable the bridge, so the opt-in stays explicit.
     */
    enabled?: boolean;
    /** Loopback port the extension dials; the HTTP face shares it. */
    port?: number;
    /** Shared secret the extension presents on the WebSocket upgrade query. */
    token?: string;
    /**
     * Directory screenshots are written to and `cleanup` clears. Relative paths
     * resolve against the process working directory at resolve time.
     */ shotsDir?: string;
}
export declare const Config: z<Config>;
/** Cordis plugin entry: wire the settings-driven lifecycle plus the model-facing tools. */
export declare function apply(ctx: Context, config: Config): void;
