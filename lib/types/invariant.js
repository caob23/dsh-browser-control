/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-browser-bridge`.
 * @module @deepseek-ai/dsh-browser-bridge/invariant
 */
const PACKAGE_NAME = '@deepseek-ai/dsh-browser-bridge';
/** Cordis companion plugin name. */
export const name = 'browser-bridge-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/**
 * No runtime invariant: the bridge owns no durable session events or shared
 * mutable state; its socket lifecycle relations (dispose releases the port,
 * pending commands reject on link loss) are asserted by unit tests against
 * the private server instance.
 */
const install = () => { };
/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
/* jscpd:ignore-end */
