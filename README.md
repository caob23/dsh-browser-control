# DSH Browser Control

<p align="center">
  <img src="extension/icons/icon128.png" width="100" alt="DSH Browser Control">
</p>

<p align="center">
  <a href="README.md">绠€浣撲腑鏂?/a> 路 <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/caob23/dsh-browser-control/releases"><img src="https://img.shields.io/badge/version-1.0.1-blue?style=flat-square" alt="version"></a>
  <a href="https://github.com/caob23/dsh-browser-control/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="license"></a>
  <a href="https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline"><img src="https://img.shields.io/badge/Chrome-MV3-yellow?style=flat-square" alt="chrome mv3"></a>
  <a href="https://github.com/topics/dsh-plugin"><img src="https://img.shields.io/badge/DSH-Plugin-purple?style=flat-square" alt="dsh plugin"></a>
  <img src="https://img.shields.io/badge/CDP-powered-orange?style=flat-square" alt="cdp">
  <img src="https://img.shields.io/badge/tools-11-red?style=flat-square" alt="11 browser tools">
  <img src="https://img.shields.io/badge/tests-29%2F29-brightgreen?style=flat-square" alt="tests">
</p>

Chrome 娴忚鍣ㄦ墿灞?+ DeepSeek Harness 鎻掍欢锛岃 AI Agent 鍍忎汉涓€鏍锋搷鎺т綘鐨勭湡瀹炴祻瑙堝櫒銆?
<p align="center">
  <img src="assets/banner.png" width="480" alt="DSH Browser Control 鈥?a whale searching Google with a mouse">
</p>

## 杩欐槸浠€涔?
涓嶆槸鏃犲ご娴忚鍣紝涓嶆槸 Puppeteer鈥斺€旀槸浣犵殑**鐪熷疄 Chrome**锛屽甫鐫€浣犵殑鐧诲綍鎬併€佷綘鐨?cookies銆侫I 閫氳繃 Chrome DevTools Protocol 椹卞姩鏍囩椤碉紝浣犲彲浠ュ湪灞忓箷涓婄湅鍒版瘡涓€姝ユ搷浣溿€?
```
浣犲 AI 璇翠竴鍙ヨ瘽
      鈫?Agent 璋冪敤 browser_* 宸ュ叿
      鈫?DSH 鎻掍欢锛圵ebSocket 妗ワ級
      鈫?Chrome 鎵╁睍锛圕DP 椹卞姩锛?      鈫?浣犵殑鐪熷疄娴忚鍣ㄦ墽琛屾搷浣?      鈫?缁撴灉杩斿洖缁?Agent
```

## 鍜?MCP 娴忚鍣ㄦ柟妗堢殑鍖哄埆

甯傞潰涓婂凡缁忔湁 Playwright MCP銆丳uppeteer MCP銆乥rowser-use 绛夛紝瀹冧滑鐨勫叡鍚岀偣锛氬惎鍔ㄤ竴涓?*鑷繁涓嬭浇鐨勫叏鏂版祻瑙堝櫒瀹炰緥**銆傛湰椤圭洰璧扮殑鏄彟涓€鏉¤矾锛?
| | 鏈」鐩?| Playwright / Puppeteer MCP |
|---|---|---|
| 娴忚鍣?| 浣犳鍦ㄧ敤鐨勭湡瀹?Chrome | 鑷姩涓嬭浇鐨勭嫭绔嬪疄渚?|
| 鐧诲綍鎬?/ Cookies | 鉁?鍏ㄩ儴缁ф壙锛屾棤闇€閲嶆柊鐧诲綍 | 鉂?姣忔鍏ㄦ柊 profile |
| 杩囬獙璇佺爜 / 鎵爜鐧诲綍 | 浣犵殑浼氳瘽宸茬粡鐧诲綍锛屽熀鏈笉閬囧埌 | 缁忓父鍗″湪鐧诲綍澧?|
| 鍙鎬?| 灞忓箷涓婂疄鏃跺彲瑙侊紝闅忔椂榧犳爣鎺ョ | 鏃犲ご杩愯鎴栫嫭绔嬬獥鍙?|
| 鐜渚濊禆 | 鏃犻渶 Node / npx / Python | 闇€瑕?npx 鎴?uvx 杩愯鏃?|
| 鎺ュ叆鏂瑰紡 | 鍔犺浇鎵╁睍 + 璁剧疆椤靛紑鍏?| 缂栬緫 MCP 瀹㈡埛绔?JSON 閰嶇疆 |
| 纾佺洏鍗犵敤 | 澶嶇敤鐜版湁 Chrome锛岄浂鏂板 | 棰濆涓嬭浇鏁扮櫨 MB 娴忚鍣?|
| 闆嗘垚娣卞害 | dsh 鍘熺敓鎻掍欢锛堣缃崱鐗?/ 鐘舵€侀〉 / 娓呯悊鎸夐挳锛?| 閫氱敤 MCP server |

涓€鍙ヨ瘽锛?*瑕?AI 鐢?浣犺嚜宸辩殑"娴忚鍣ㄥ共娲伙紙宸茬櫥褰曠殑 B 绔欍€佺煡涔庛€佹窐瀹濆悗鍙帮級锛岀敤鏈」鐩紱瑕佸仛璺ㄦ祻瑙堝櫒銆佽法搴旂敤鐨勯€氱敤鑷姩鍖栨祴璇曪紝鐢?MCP銆?*

## 涓嬭浇

| 鏂囦欢 | 璇存槑 |
|---|---|
| [DSH-Browser-Control-1.0.1.zip](https://github.com/caob23/dsh-browser-control/releases/download/v1.0.1/DSH-Browser-Control-1.0.1.zip) | Chrome 鎵╁睍锛堣В鍘嬪悗鍔犺浇锛?|
| [dsh-browser-bridge-plugin-v1.0.1.zip](https://github.com/caob23/dsh-browser-control/releases/download/v1.0.1/dsh-browser-bridge-plugin-v1.0.1.zip) | dsh 鎻掍欢 |

## 瀹夎 Chrome 鎵╁睍锛?0 绉掞級

涓嬭浇 zip 鈫?瑙ｅ帇鍒板浐瀹氭枃浠跺す锛堝埆鍒狅級鈫?Chrome 鎵撳紑 `chrome://extensions` 鈫?寮€鍚€屽紑鍙戣€呮ā寮忋€嶁啋 鐐广€屽姞杞藉凡瑙ｅ帇鐨勬墿灞曠▼搴忋€嶁啋 閫夎В鍘嬪悗鐨勬枃浠跺す銆?
宸ュ叿鏍忓嚭鐜伴哺楸煎浘鏍?= 鎴愬姛銆傞渶瑕?Chrome 116+銆?
## 瀹夎 dsh 鎻掍欢锛? 鍒嗛挓锛?
### 鏂瑰紡 A锛氫竴閿畨瑁咃紙鎺ㄨ崘锛?
```bash
git clone https://github.com/caob23/dsh-browser-control.git
cd dsh-browser-control
./install.sh /浣犵殑璺緞/deepseek-harness
```

鑴氭湰鍙礋璐ｆ妸鎻掍欢鏂囦欢澶嶅埗鍒颁綅锛?*瀹屾垚鍚庝粛闇€鎵嬪姩鏀逛笁澶勯厤缃?*锛堝悓鏂瑰紡 B 鐨勭 2 姝ワ級锛屾敼瀹岄噸鍚?dsh 鎵嶄細鐢熸晥銆?
### 鏂瑰紡 B锛氭墜鍔ㄥ畨瑁?
涓嬭浇 [`dsh-browser-bridge-plugin-v1.0.1.zip`](https://github.com/caob23/dsh-browser-control/releases/download/v1.0.1/dsh-browser-bridge-plugin-v1.0.1.zip)锛岃В鍘嬪埌 deepseek-harness 鐨?`packages/web/browser-bridge/`銆?
鐒跺悗琛ュ厖涓夊閰嶇疆锛?
1. `packages/bundle/base/package.json` 鐨?dependencies 鍔狅細

```json
"@deepseek-ai/dsh-browser-bridge": "workspace:^"
```

2. `cordis.patch.yml` 鐨?plugins 鍒楄〃鍔狅細

```yaml
- id: browser-bridge
  name: '@deepseek-ai/dsh-browser-bridge'
  config:
    enabled: false
```

3. `tsconfig.host.json` 鐨?references 鍔狅細

```json
{ "path": "./packages/web/browser-bridge" }
```

閲嶅惎 dsh 鈫?璁剧疆椤靛嚭鐜般€孌SH 娴忚鍣ㄦ帶鍒躲€嶁啋 寮€鍚嵆鍙€傝缁嗚鏄庤 [dsh-config/README.md](dsh-config/README.md)銆?
## 浣跨敤

1. dsh 璁剧疆 鈫?鎻掍欢 鈫?DSH 娴忚鍣ㄦ帶鍒?鈫?寮€鍚?2. Chrome 鎵╁睍鑷姩杩炴帴锛堢鍙?9777锛孴oken 榛樿 dsh-local锛?3. 瀵硅瘽璇磋嚜鐒惰瑷€锛孉gent 鑷姩鎿嶆帶娴忚鍣?
璁块棶 `http://127.0.0.1:9777/` 鏌ョ湅杩炴帴鐘舵€併€?
## 宸ュ叿娓呭崟

| 宸ュ叿 | 鍔熻兘 |
|---|---|
| `browser_navigate` | 瀵艰埅鍒?URL |
| `browser_read` | 璇诲彇椤甸潰鏂囨湰/HTML |
| `browser_snapshot` | 椤甸潰蹇収 鈫?ref 浜や簰鏍?|
| `browser_click` | 鐐瑰嚮鍏冪礌锛坆y ref / selector锛?|
| `browser_type` | 鍦ㄨ緭鍏ユ濉叆鏂囨湰 |
| `browser_press` | 妯℃嫙閿洏鎸夐敭 |
| `browser_scroll` | 婊氬姩椤甸潰 |
| `browser_tabs` | 鏍囩椤电鐞嗭紙鍒楄〃/鏂板缓/鍏抽棴/鍒囨崲锛?|
| `browser_evaluate` | 鎵ц浠绘剰 JS |
| `browser_screenshot` | 鎴彇椤甸潰鎴浘 |
| `browser_cleanup` | 娓呯悊涓存椂鏂囦欢 |

## 鏋舵瀯

```
Chrome 娴忚鍣?  鈹斺攢 DSH Browser Control 鎵╁睍 (MV3)
       鈹斺攢 chrome.debugger (CDP)
            鈹斺攢 WebSocket 鈹€鈹€鈹€鈹€鈹€鈹€鈫?DSH 鎻掍欢 (browser-bridge)
                                      鈹斺攢 browser_* 宸ュ叿 鈫?Agent
```

**鍏抽敭璁捐锛?*
- 鎵╁睍涓诲姩澶栬繛妗ワ紙涓嶉渶瑕?native messaging host锛?- 榛樿鍏抽棴锛岃缃〉鎵嬪姩寮€鍚?- 鎸佷箙 debugger 闄勭潃鈥斺€旀帶鍒舵湡闂存í骞呭缁堟樉绀?- 浠呯洃鍚?127.0.0.1锛宼oken 璁よ瘉

## 宸查獙璇?
| 鍦烘櫙 | 缁撴灉 |
|---|---|
| 鐧惧害鎼滅储 鈫?鎻愬彇缁撴灉鏍囬 | 鉁?|
| B 绔欐悳绱㈢敤鎴?鈫?鍙戠淇?| 鉁?|
| B 绔欐悳绱?鈫?缁熻瑙嗛鍗＄墖 + 鎴浘 | 鉁?|
| 鍗曞厓娴嬭瘯 29/29 | 鉁?|
| 绫诲瀷妫€鏌ワ紙host + client锛?| 鉁?|

## 鏇存柊鏃ュ織

瑙?[CHANGELOG.md](CHANGELOG.md)銆?
## License

[MIT](LICENSE)
