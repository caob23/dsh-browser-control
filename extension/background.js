/**
 * DSH Browser Control — MV3 service worker.
 *
 * Maintains one outbound WebSocket to the local bridge (bridge/server.mjs),
 * receives JSON commands, executes them through chrome.tabs and the Chrome
 * DevTools Protocol (chrome.debugger), and replies with JSON results.
 *
 * Wire protocol (text frames, one JSON object each):
 *   ext -> bridge: {type:'hello', client, version, browser}
 *                  {type:'pong', t}                     (reply to {type:'ping'})
 *                  {type:'result', id, ok, result|error}
 *   bridge -> ext: {type:'ping', t}
 *                  {type:'command', id, command, params}
 */
'use strict';

const EXT_VERSION = chrome.runtime.getManifest().version;
const HEARTBEAT_MS = 20_000;
const MAX_BACKOFF_MS = 30_000;
const DEFAULT_PORT = 9777;
const DEFAULT_TOKEN = 'dsh-local';

/** Stored config shape (version 2): {port, token, autoConnect}. */
const DEFAULT_CONFIG = Object.freeze({
	port: DEFAULT_PORT,
	token: DEFAULT_TOKEN,
	autoConnect: true,
});

let cfg = { ...DEFAULT_CONFIG };
let ws = null;
let wsState = 'idle'; // idle | connecting | open
let backoffAttempt = 0;
let reconnectTimer = null;
let heartbeatTimer = null;
let helloInfo = null;
let lastError = null;
/** True after the user clicks 断开连接 in the popup; blocks auto-reconnect
 *  until they click 立即连接 again. Reset on browser restart. */
let manualDisconnect = false;

/** Tab ids we hold a persistent debugger attachment on. Detach only on
 *  explicit disconnect, tab close, or DevTools stealing the tab. */
const attachedTabs = new Set();

/* ------------------------------------------------------------------ config */

async function loadConfig() {
	const stored = await chrome.storage.local.get(Object.keys(DEFAULT_CONFIG));
	// v1→v2 migration: convert old serverUrl to port.
	if (stored.serverUrl && stored.port === undefined) {
		try {
			stored.port = new URL(stored.serverUrl).port ? Number(new URL(stored.serverUrl).port) : DEFAULT_PORT;
		} catch { stored.port = DEFAULT_PORT; }
		delete stored.serverUrl;
	}
	cfg = { ...DEFAULT_CONFIG, ...stored };
}

chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== 'local') return;
	for (const [key, change] of Object.entries(changes)) {
		if (key in DEFAULT_CONFIG) cfg[key] = change.newValue;
	}
});

/* ------------------------------------------------------------ ws lifecycle */

function setBadge(text, color) {
	try {
		chrome.action.setBadgeBackgroundColor({ color });
		chrome.action.setBadgeText({ text });
	} catch (err) {
		console.warn('[dsh-bridge] badge unavailable:', err.message);
	}
}

function setState(state) {
	wsState = state;
	if (state === 'open') setBadge('ON', '#16a34a');
	else if (state === 'connecting') setBadge('…', '#d97706');
	else setBadge('OFF', '#6b7280');
}

function send(obj) {
	if (!ws || ws.readyState !== WebSocket.OPEN) return false;
	ws.send(JSON.stringify(obj));
	return true;
}

function scheduleReconnect() {
	if (manualDisconnect || !cfg.autoConnect) return;
	const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** backoffAttempt);
	backoffAttempt += 1;
	clearTimeout(reconnectTimer);
	reconnectTimer = setTimeout(connect, delay);
}

function connect() {
	if (wsState === 'open' || wsState === 'connecting') return;
	clearTimeout(reconnectTimer);
	if (manualDisconnect || !cfg.autoConnect) return;

	let url;
	try {
		url = new URL(`ws://127.0.0.1:${cfg.port}/ws`);
	} catch (err) {
		lastError = `端口无法解析: ${err.message}`;
		setState('idle');
		return;
	}
	url.searchParams.set('token', cfg.token);

	setState('connecting');
	let sock;
	try {
		sock = new WebSocket(url.toString());
	} catch (err) {
		lastError = err.message;
		setState('idle');
		scheduleReconnect();
		return;
	}
	ws = sock;

	sock.onopen = () => {
		if (sock !== ws) return;
		backoffAttempt = 0;
		lastError = null;
		setState('open');
		startHeartbeat();
		sendHello();
	};
	sock.onmessage = (ev) => {
		if (sock !== ws || typeof ev.data !== 'string') return;
		let msg;
		try { msg = JSON.parse(ev.data); } catch { return; }
		handleBridgeMessage(msg);
	};
	sock.onclose = () => {
		if (sock !== ws) return;
		stopHeartbeat();
		ws = null;
		setState('idle');
		scheduleReconnect();
	};
	sock.onerror = () => { /* onclose always follows */ };
}

function disconnectNow() {
	clearTimeout(reconnectTimer);
	stopHeartbeat();
	if (ws) {
		const sock = ws;
		ws = null;
		sock.onclose = null;
		try { sock.close(); } catch { /* ignore */ }
	}
	detachAll();
	setState('idle');
}

function startHeartbeat() {
	stopHeartbeat();
	heartbeatTimer = setInterval(() => send({ type: 'ping', t: Date.now() }), HEARTBEAT_MS);
}

function stopHeartbeat() {
	if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

function sendHello() {
	const ua = navigator.userAgent;
	const name = /Edg\//.test(ua) ? 'edge' : /Chrome\//.test(ua) ? 'chrome' : 'chromium';
	const versionMatch = ua.match(/(?:Edg|Chrome)\/([\d.]+)/);
	helloInfo = { name, version: versionMatch ? versionMatch[1] : 'unknown', ua };
	send({ type: 'hello', client: 'dsh-browser-extension', version: EXT_VERSION, browser: helloInfo });
}

/* Alarm keeps the SW alive for reconnect even without user events. */
try { chrome.alarms.create('keepalive', { periodInMinutes: 0.5 }); }
catch { chrome.alarms.create('keepalive', { periodInMinutes: 1 }); }
chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name !== 'keepalive') return;
	if (wsState === 'idle') connect();
	else send({ type: 'ping', t: Date.now() });
});

/* ------------------------------------------------------------- dispatching */

function handleBridgeMessage(msg) {
	if (msg.type === 'ping') { send({ type: 'pong', t: msg.t }); return; }
	if (msg.type === 'command' && typeof msg.id === 'string') {
		runCommand(msg.command, msg.params ?? {})
			.then((result) => send({ type: 'result', id: msg.id, ok: true, result }))
			.catch((err) => send({ type: 'result', id: msg.id, ok: false, error: String((err && err.message) || err) }));
	}
}

async function runCommand(command, params) {
	const handler = COMMANDS[command];
	if (!handler) throw new Error(`unknown command: ${command}`);
	return handler(params);
}

/* ------------------------------------------------------------ tab helpers */

async function resolveTab(tabId) {
	if (tabId !== undefined && tabId !== null) {
		const tab = await chrome.tabs.get(tabId);
		return tab;
	}
	const [focused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
	if (focused) return focused;
	const all = await chrome.tabs.query({});
	if (all.length > 0) return all[0];
	throw new Error('no tab available');
}

function waitTabComplete(tabId, timeoutMs) {
	return new Promise((resolve) => {
		let done = false;
		const finish = () => { if (done) return; done = true; chrome.tabs.onUpdated.removeListener(listener); resolve(); };
		const listener = (id, info) => { if (id === tabId && info.status === 'complete') finish(); };
		chrome.tabs.onUpdated.addListener(listener);
		chrome.tabs.get(tabId).then((tab) => { if (tab.status === 'complete') finish(); }).catch(finish);
		setTimeout(finish, timeoutMs);
	});
}

/* ---------------------------------------------------------- debugger (CDP) — persistent attachment */

/**
 * Ensure a persistent debugger attachment on `tabId`. Attaches once on first
 * CDP call and holds the attachment until explicit detach or tab close.
 * The Chrome "is being controlled" banner stays visible until detach.
 */
async function ensureAttached(tabId) {
	if (attachedTabs.has(tabId)) return;
	await new Promise((resolve, reject) => {
		chrome.debugger.attach({ tabId }, '1.3', () => {
			const err = chrome.runtime.lastError;
			if (!err) { attachedTabs.add(tabId); resolve(); return; }
			if (/already attached/i.test(err.message)) {
				reject(new Error(`debugger attach failed: ${err.message} (DevTools 打开着这个页面? 先关掉)`));
				return;
			}
			reject(new Error(`debugger attach failed: ${err.message}`));
		});
	});
}

function detachTab(tabId) {
	attachedTabs.delete(tabId);
	chrome.debugger.detach({ tabId }, () => void chrome.runtime.lastError);
}

function detachAll() {
	for (const tabId of [...attachedTabs]) detachTab(tabId);
}

/* Clean up when a tab is closed (detaches automatically, but remove from set). */
chrome.tabs.onRemoved.addListener((tabId) => {
	if (attachedTabs.has(tabId)) attachedTabs.delete(tabId);
});

/* Clean up when DevTools steals a tab (detach event fires). */
chrome.debugger.onDetach.addListener((_source, reason) => {
	if (reason === 'target_closed' || reason === 'canceled_by_user') {
		// attachedTabs cleanup is handled by chrome.tabs.onRemoved
	}
});

function dbgSend(tabId, method, params) {
	return new Promise((resolve, reject) => {
		chrome.debugger.sendCommand({ tabId }, method, params ?? {}, (res) => {
			const err = chrome.runtime.lastError;
			if (err) reject(new Error(`${method} failed: ${err.message}`));
			else resolve(res);
		});
	});
}

/** Persistent CDP: attaches (if not already) and holds. */
async function withCDP(tabId, fn) {
	await ensureAttached(tabId);
	return fn((method, params) => dbgSend(tabId, method, params));
}

/* ------------------------------------------------------- command handlers */

async function cmdPing() {
	return { pong: true, t: Date.now(), version: EXT_VERSION };
}

async function cmdBrowserInfo() {
	return { client: 'dsh-browser-extension', version: EXT_VERSION, browser: helloInfo };
}

async function cmdTabsList() {
	const tabs = await chrome.tabs.query({});
	return {
		tabs: tabs.map((t) => ({
			id: t.id, windowId: t.windowId, index: t.index,
			title: t.title, url: t.url, active: t.active, pinned: t.pinned,
			audible: Boolean(t.audible),
		})),
	};
}

async function cmdTabsOpen(params) {
	if (!params.url) throw new Error('params.url is required');
	const created = await chrome.tabs.create({
		url: params.url,
		active: params.active !== undefined ? Boolean(params.active) : true,
	});
	if (params.wait !== false) await waitTabComplete(created.id, Number(params.timeoutMs) || 15_000);
	const fresh = await chrome.tabs.get(created.id).catch(() => null);
	return { tabId: created.id, url: fresh?.url, title: fresh?.title };
}

async function cmdTabsClose(params) {
	if (params.tabId === undefined) throw new Error('params.tabId is required');
	await chrome.tabs.remove(Number(params.tabId));
	return { closed: Number(params.tabId) };
}

async function cmdTabsActivate(params) {
	if (params.tabId === undefined) throw new Error('params.tabId is required');
	await chrome.tabs.update(Number(params.tabId), { active: true });
	return { activated: Number(params.tabId) };
}

async function cmdNav(params) {
	if (!params.url) throw new Error('params.url is required');
	const tab = await resolveTab(params.tabId);
	await chrome.tabs.update(tab.id, { url: params.url });
	if (params.wait !== false) await waitTabComplete(tab.id, Number(params.timeoutMs) || 15_000);
	const fresh = await chrome.tabs.get(tab.id).catch(() => null);
	return { tabId: tab.id, url: fresh?.url, title: fresh?.title };
}

async function cmdEval(params) {
	if (typeof params.expression !== 'string' || params.expression.length === 0) {
		throw new Error('params.expression is required');
	}
	const tab = await resolveTab(params.tabId);
	const value = await withCDP(tab.id, (send) => {
		return send('Runtime.evaluate', {
			expression: params.expression,
			awaitPromise: params.awaitPromise !== false,
			returnByValue: true,
			userGesture: true,
		}).then((res) => {
			if (res.exceptionDetails) {
				const d = res.exceptionDetails;
				throw new Error(`page exception: ${d.exception?.description ?? d.text}`);
			}
			return res.result;
		});
	});
	return { tabId: tab.id, value: value.value === undefined ? null : value.value, valueType: value.type };
}

async function cmdContent(params) {
	const mode = params.mode === 'html' ? 'html' : 'text';
	const tab = await resolveTab(params.tabId);
	const inner = mode === 'html'
		? 'document.documentElement.outerHTML'
		: '(document.body && (document.body.innerText || document.body.textContent)) || ""';
	const payload = await withCDP(tab.id, (send) =>
		send('Runtime.evaluate', {
			expression: `JSON.stringify({title: document.title, url: location.href, readyState: document.readyState, content: ${inner}})`,
			awaitPromise: false, returnByValue: true, userGesture: true,
		}).then((res) => {
			if (res.exceptionDetails) throw new Error(`page exception: ${res.exceptionDetails.text}`);
			return JSON.parse(res.result.value);
		}));
	return { tabId: tab.id, mode, ...payload };
}

async function cmdFind(params) {
	if (!params.selector) throw new Error('params.selector is required');
	const limit = Math.max(1, Math.min(50, Number(params.limit) || 10));
	const tab = await resolveTab(params.tabId);
	const payload = await withCDP(tab.id, (send) => send('Runtime.evaluate', {
		expression: `(() => {
			const els = [...document.querySelectorAll(${JSON.stringify(String(params.selector))})];
			return JSON.stringify({
				count: els.length,
				items: els.slice(0, ${limit}).map((el) => {
					const r = el.getBoundingClientRect();
					return {
						tag: el.tagName.toLowerCase(), id: el.id || undefined,
						class: String(el.className || '').slice(0, 120) || undefined,
						text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 160) || undefined,
						href: el instanceof Element && el.hasAttribute('href') ? el.getAttribute('href') : undefined,
						rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
					};
				}),
			});
		})()`,
		awaitPromise: false, returnByValue: true, userGesture: true,
	}).then((res) => JSON.parse(res.result.value)));
	return { tabId: tab.id, selector: params.selector, ...payload };
}

async function cmdClick(params) {
	if (!params.selector) throw new Error('params.selector is required');
	const tab = await resolveTab(params.tabId);
	return withCDP(tab.id, async (send) => {
		const hit = await send('Runtime.evaluate', {
			expression: `(() => {
				const el = document.querySelector(${JSON.stringify(String(params.selector))});
				if (!el) return null;
				el.scrollIntoView({ block: 'center', inline: 'center' });
				const r = el.getBoundingClientRect();
				return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
					tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().slice(0, 120) };
			})()`,
			awaitPromise: false, returnByValue: true, userGesture: true,
		}).then((res) => {
			if (res.exceptionDetails) throw new Error(res.exceptionDetails.text);
			return res.result.value;
		});
		if (!hit) throw new Error(`element not found: ${params.selector}`);
		const clickCount = params.doubleClick ? 2 : 1;
		await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hit.x, y: hit.y });
		await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hit.x, y: hit.y, button: 'left', clickCount });
		await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hit.x, y: hit.y, button: 'left', clickCount });
		return { tabId: tab.id, clicked: hit };
	});
}

async function cmdInput(params) {
	if (!params.selector) throw new Error('params.selector is required');
	if (params.value === undefined) throw new Error('params.value is required');
	const tab = await resolveTab(params.tabId);
	const result = await withCDP(tab.id, (send) => send('Runtime.evaluate', {
		expression: `(() => {
			const el = document.querySelector(${JSON.stringify(String(params.selector))});
			if (!el) return null;
			el.focus();
			const value = ${JSON.stringify(String(params.value))};
			if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
				const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
				Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
				el.dispatchEvent(new Event('input', { bubbles: true }));
				el.dispatchEvent(new Event('change', { bubbles: true }));
			} else if (el.isContentEditable) {
				el.textContent = value;
				el.dispatchEvent(new InputEvent('input', { bubbles: true }));
			} else if (el instanceof HTMLSelectElement) {
				el.value = value;
				el.dispatchEvent(new Event('change', { bubbles: true }));
			} else {
				el.textContent = value;
				el.dispatchEvent(new Event('input', { bubbles: true }));
				el.dispatchEvent(new Event('change', { bubbles: true }));
			}
			return { tag: el.tagName.toLowerCase(), value: String(el.value ?? el.textContent ?? '') };
		})()`,
		awaitPromise: false, returnByValue: true, userGesture: true,
	}).then((res) => {
		if (res.exceptionDetails) throw new Error(res.exceptionDetails.text);
		return res.result.value;
	}));
	if (!result) throw new Error(`element not found: ${params.selector}`);
	return { tabId: tab.id, filled: result };
}

const KEY_CODES = {
	Enter: [13, 'Enter'], Tab: [9, 'Tab'], Escape: [27, 'Escape'],
	Backspace: [8, 'Backspace'], Delete: [46, 'Delete'], Space: [32, 'Space'],
	ArrowUp: [38, 'ArrowUp'], ArrowDown: [40, 'ArrowDown'],
	ArrowLeft: [37, 'ArrowLeft'], ArrowRight: [39, 'ArrowRight'],
	Home: [36, 'Home'], End: [35, 'End'],
	PageUp: [33, 'PageUp'], PageDown: [34, 'PageDown'],
};
const MODIFIER_BITS = { alt: 1, ctrl: 2, control: 2, meta: 4, command: 4, shift: 8 };

async function cmdPress(params) {
	const key = String(params.key ?? '');
	if (key.length === 0) throw new Error('params.key is required');
	const tab = await resolveTab(params.tabId);
	let keyCode, code;
	if (KEY_CODES[key]) { [keyCode, code] = KEY_CODES[key]; }
	else if (key.length === 1) {
		keyCode = key.toUpperCase().charCodeAt(0);
		if (/^[a-z]$/i.test(key)) code = `Key${key.toUpperCase()}`;
		else if (/^[0-9]$/.test(key)) code = `Digit${key}`;
	}
	const text = params.text !== undefined
		? String(params.text)
		: key.length === 1 && !(params.modifiers ?? []).some((m) => m in MODIFIER_BITS && m !== 'shift') ? key : undefined;
	let modifiers = 0;
	for (const m of params.modifiers ?? []) modifiers |= MODIFIER_BITS[String(m).toLowerCase()] ?? 0;
	return withCDP(tab.id, async (send) => {
		await send('Input.dispatchKeyEvent', {
			type: 'keyDown', key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, code, text, unmodifiedText: text, modifiers,
		});
		if (text) {
			await send('Input.dispatchKeyEvent', { type: 'char', key, text, unmodifiedText: text, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, code, modifiers });
		}
		await send('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, code, modifiers });
		return { tabId: tab.id, key };
	});
}

async function cmdScreenshot(params) {
	const tab = await resolveTab(params.tabId);
	const format = params.format === 'jpeg' ? 'jpeg' : 'png';
	const res = await withCDP(tab.id, (send) => send('Page.captureScreenshot', {
		format, quality: format === 'jpeg' ? Math.min(100, Math.max(1, Number(params.quality) || 80)) : undefined,
		captureBeyondViewport: Boolean(params.fullPage),
	}));
	return { tabId: tab.id, format, base64: res.data, tabTitle: tab.title, tabUrl: tab.url };
}

async function cmdScroll(params) {
	const tab = await resolveTab(params.tabId);
	const dx = Number.isFinite(Number(params.x)) ? Number(params.x) : 0;
	const dy = Number.isFinite(Number(params.y)) ? Number(params.y) : 0;
	return withCDP(tab.id, (send) => send('Runtime.evaluate', {
		expression: `(() => {
			window.scrollBy({ left: ${JSON.stringify(dx)}, top: ${JSON.stringify(dy)}, behavior: 'instant' });
			return { tabId: ${tab.id}, scrollX: window.scrollX, scrollY: window.scrollY,
				pageHeight: document.documentElement.scrollHeight, viewportHeight: window.innerHeight };
		})()`,
		awaitPromise: false, returnByValue: true, userGesture: true,
	}).then((res) => res.result.value));
}

const SNAPSHOT_SELECTOR = 'a[href], button, input, select, textarea, [role="button"], [role="link"], '
	+ '[role="tab"], [role="checkbox"], [role="radio"], [contenteditable="true"], [onclick]';

async function cmdSnapshot(params) {
	const tab = await resolveTab(params.tabId);
	const limit = Math.min(200, Math.max(1, Number(params.limit) || 120));
	return withCDP(tab.id, async (send) => {
		await send('Runtime.enable').catch(() => {});
		const payload = await send('Runtime.evaluate', {
			expression: `(() => {
				const ATTR = 'data-dsh-ref';
				document.querySelectorAll('[' + ATTR + ']').forEach((el) => el.removeAttribute(ATTR));
				const nodes = [...document.querySelectorAll(${JSON.stringify(SNAPSHOT_SELECTOR)})];
				const items = [];
				let n = 0;
				for (const el of nodes) {
					if (items.length >= ${limit}) break;
					const r = el.getBoundingClientRect();
					if (r.width === 0 && r.height === 0) continue;
					const ref = 'e' + (++n);
					el.setAttribute(ATTR, ref);
					const isField = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
					items.push({
						ref, tag: el.tagName.toLowerCase(),
						type: el.getAttribute('type') || undefined,
						name: (el.getAttribute('aria-label') || el.getAttribute('placeholder')
							|| (el.textContent || '').trim().replace(/\\s+/g, ' ')).slice(0, 80) || undefined,
						value: isField || el instanceof HTMLSelectElement ? String(el.value ?? '').slice(0, 60) : undefined,
						href: el.hasAttribute('href') ? el.href : undefined,
						rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
					});
				}
				return { tabId: ${tab.id}, title: document.title, url: location.href, total: nodes.length, items };
			})()`,
			awaitPromise: false, returnByValue: true, userGesture: true,
		}).then((res) => {
			if (res.exceptionDetails) throw new Error(res.exceptionDetails.text);
			return res.result.value;
		});
		payload.limitedTo = limit;
		return payload;
	});
}

const COMMANDS = {
	ping: cmdPing, 'browser.info': cmdBrowserInfo,
	'tabs.list': cmdTabsList, 'tabs.open': cmdTabsOpen, 'tabs.close': cmdTabsClose, 'tabs.activate': cmdTabsActivate,
	nav: cmdNav, eval: cmdEval, content: cmdContent, find: cmdFind,
	click: cmdClick, input: cmdInput, press: cmdPress, scroll: cmdScroll,
	snapshot: cmdSnapshot, screenshot: cmdScreenshot,
};

/* ------------------------------------------------------------ popup link */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
	if (msg?.type === 'bridgeStatus') {
		sendResponse({ state: wsState, cfg, helloInfo, lastError });
		return false;
	}
	if (msg?.type === 'reconnect') {
		manualDisconnect = false;
		backoffAttempt = 0;
		disconnectNow();
		loadConfig().then(() => { connect(); sendResponse({ started: true }); });
		return true;
	}
	if (msg?.type === 'disconnect') {
		manualDisconnect = true;
		disconnectNow();
		sendResponse({ started: true });
		return false;
	}
	return false;
});

/* -------------------------------------------------------------- lifecycle */

async function init() {
	await loadConfig();
	connect();
}

chrome.runtime.onInstalled.addListener(() => init());
chrome.runtime.onStartup.addListener(() => init());
init();
