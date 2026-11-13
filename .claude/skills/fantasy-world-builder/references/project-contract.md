# 專案契約：現有架構與資產的進場方式

動手前先對照程式碼確認，這份文件描述的是 2026-11-13 的狀態。

## 檔案地圖

| 檔案 | 內容 | 這個 Skill 可以改嗎 |
|---|---|---|
| `src/kit.js` | 零件組與建造工具：`Track`、斷面、`SURFACES`（表面物理）、`SKINS`、`createBuilder()`（`add`、`surface`、`prop`、`track`、`padAhead`、`fromPad`、`mover`、`lantern`、`light`、`finish`…）。純資料與幾何，Node 也能跑。 | 既有的**不動**；可以**新增**零件／皮膚（見「往共用庫加東西」） |
| `src/library/assets.js` | **共用素材目錄**：`prop()` 能放的每一個東西、它的發光規則、發光預設（`GLOW`）、燈籠的光（`LANTERN_GLOW`）、素材包清單（`PACKS`）。 | 新增素材時加一筆 |
| `src/packs/<包>.collision.json`、`public/packs/<包>.glb` | 素材包：原始 `props.glb` 之外的具名材質道具。一個包只會新增名稱，不會蓋掉既有的。 | 由 `tools/blender_pack_<包>.py` 產生 |
| `src/library/mechanisms.js` | **共用機關**：`turntable`、`lift`、`shuttle`（接駁台）、`sweeper`、`pendulum`、`weighbridge`（秤橋／重力搖臂）、`flap`（彈簧門）、`funnel`、`bumpers`、`armillary`、`archOver`。另有 `seesaw`、`turnstile`、`trapdoor`、`trampoline`、`carousel`、`gearTrain`、`pendulumRow`、`musicDrum`、`windupKey`、`mobile`。只用建造工具的公開介面，任何朝向都能用。 | 可新增機關（先確認真的可重複使用）；既有機關的數字不動 |
| `src/globes/<id>.js` | 一顆球的內容：路線、圓台、燈、機關、景觀擺放。目前有 `lighthouse`（主球：燈塔之海）和 `practice`（迴旋球：無地板的純軌道球）。 | **這是你工作的地方** |
| `src/globes/<id>/` | 只有這顆球用的東西：大型地形、英雄地標、它自己的 Blender 腳本和說明（參考 `crownfall/`）。 | 這顆球自己的 |
| `src/globes/index.js` | 球的清單；第一顆是預設。 | 新增球時加一行 |
| `src/world.js` | 引擎入口：`buildWorld(id)`。 | 不動 |
| `src/physics.js` | Rapier 物理、玻璃解析碰撞、機關運動。 | 不動 |
| `src/main.js`、`src/input.js` | 主迴圈、鏡頭、操作、回正邏輯。 | 不動 |
| `src/render.js` | 材質、燈光、後製、載入 `props.glb`／`room.glb`。 | 可加材質、調燈光與後製；加新的資產載入路徑（見下方路徑 B）。 |
| `tools/blender_props.py` | 在 Blender 產生道具，匯出 `public/props.glb` 和 `src/props.collision.json`。 | 可延伸 |
| `tools/blender_room.py` | 球外房間，匯出 `public/room.glb`。 | 可延伸 |
| `scripts/verify.mjs` | 無頭物理測試，會跑架上每一顆球：每條路線雙向可通行、有坡的路線放手滑行、軌道不互相穿插。`node scripts/verify.mjs <id>` 只跑一顆。 | 不動；每次改球之後必跑 |
| `scripts/asset-report.mjs` | GLB 檢查：面數、貼圖、檔案大小、尺寸。 | 可延伸 |
| `scripts/globe-report.mjs` | 一顆球的密度與佈局：軌道長度、體積使用、朝向、公式化檢查、岔路、機關、發光稽核。 | 可延伸 |
| `scripts/sim-mechanisms.mjs` | 機關與表面的台架測試（蹺蹺板、活板門、旋轉門、彈跳鼓、冰／絨布）。 | 新增鉸接機關或表面時加一段 |
| `assets/library.json` | 資產庫清單。 | 持續維護 |

## 座標與尺度

- 球心在原點，玻璃內半徑 12。遊戲座標 Y 向上、X 向東、Z 向南。
- 地板是每顆球自己決定的（`createBuilder({ floorY, plateBottom, holes })`）。主球的海面在 `y = -6`，海板厚 0.3，開了兩個井，底下是倒掛的「海之下」。
- 鋼珠直徑 0.36。軌道寬約 0.72，護欄高 0.2。
- Blender 是 Z 向上；glTF 匯出會轉成 Y 向上。Blender 的 `-Y` 對應遊戲的 `+Z`（南）。
- 道具原點放在**底部中心**，這樣 `prop(name, pos, { up })` 可以直接立在任何朝向的面上（牆、天頂、海底都行）。
- 目前的尺度參考：房子約 1.2 × 1.5 × 1.4、樹約 1.5 高、燈塔 12.9 高、大蘑菇 9.6 高、浮島半徑 = 圓台半徑 × 1.18。

## 道具怎麼進遊戲

球的 `build()` 裡，`prop(name, pos, { up, yaw, scale, mats, collide })` 做兩件事：
記下一筆擺放資料給渲染端，並把 `src/props.collision.json` 裡同名的網格轉換後加進物理。
所以**看得到的就碰得到**，不需要另外寫替身碰撞。

### 路徑 A：具名材質道具（現行，已可用）

`public/props.glb` 裡的每個頂層物件是一個道具，材質只帶**名字**（例如 `paintRed`、`birch`、`grass`）。
`render.js` 的 `bakeProps()` 依名字換成遊戲自己的材質（帶程序化木紋），並把所有擺放合併成每種材質一個網格。

- 優點：零貼圖、繪製呼叫極少、風格和軌道完全一致。
- 限制：UV 和貼圖會被丟掉，所以不適合 Meshy 的貼圖模型。
- 新增材質名字時，要同時在 `render.js` 的 `makeMaterials()` 加一筆。
- `mats: { body: 'paintCream', roof: 'paintRed' }` 可以在擺放時替換材質，一個模型多種配色。

### 路徑 B：貼圖資產（Meshy 產出用；已可用）

1. 原始模型放 `assets/source/<id>/`。Meshy 的標準模型面數極高（實測 350 萬到 800 萬三角形），不能直接用。
2. 在 Blender 執行 `tools/blender_asset.py` 的 `process(id, 原始檔, height=…, tris=…)`：
   減面、貼圖縮到 1024、原點移到底部中心、匯出 `public/assets/<id>.glb`，並把低面數的碰撞網格寫進 `src/assets.collision.json`。
3. 在 `src/library/assets.js` 加一筆（`path: 'B'`、`file`、`glow`），並把名字加進 `TEXTURED_READY`。
4. 之後任何一顆球都能 `prop('<id>', …)`。渲染端保留它自己的貼圖，只統一調過粗糙度與環境光強度。
5. 跑 `npm run verify`、`npx vite build`，並實際看畫面。

## 發光規則（共用，不可繞過）

**同一個會發光的東西，在每一顆球發的光都一樣。** 光的來源只有三個，都在共用層：

1. **素材目錄的 `glow`**（`src/library/assets.js`）：`{ at: [x,y,z]（道具自己的座標）, color, intensity, reach, day }`。
   有 `glow` 的道具不論放在哪一顆球、哪個朝向、縮放多少，都會照亮周圍；放在會動的機關上，光會跟著走。
   新素材用 `GLOW` 裡的預設（`window`、`lamp`、`flame`、`star`、`crystal`），不要自己發明顏色和亮度：
   `glow('window', [0, 0.8, 0], 1.3)`，最後一個數字是「幾倍大的同一種光」。預設對應 `render.js` 裡同名的自發光材質。
2. **燈籠**：`LANTERN_GLOW`。亮度和範圍每顆球都一樣；球只能用 `lantern.illumination = { color }` 換顏色，寫了 `intensity`／`distance` 也會被忽略。
3. **機關自帶的光**（`armillary`、`carousel`）：寫在機關裡。

球自己的 `light(pos, color, intensity, distance, day)` 只能用在**這顆球自己的造型**（岩漿、洞穴裡的光、自製地形上的窗），
不可以放在共用素材旁邊「補亮」。`scripts/globe-report.mjs` 會標出疊在共用發光素材上的自補光。

引擎用一個小的光源池，把真實的光分配給最靠近鋼珠的幾個發光點，所以一顆球可以有上百個發光物而不拖慢畫面。
代價是：同一時間真正照亮周圍的只有最近的幾個，其餘只有自發光。

### 房間（球外）

書桌是獨立的貼圖模型 `public/assets/room_desk.glb`（`tools/blender_desk.py` 建模與 UV，Meshy 重新貼圖，10 點），不在 `room.glb` 裡；
它在房間裡的明暗由 `render.js` 的 `DESK_TONE` 決定。房間其餘部分用 `tools/build_room.py` 無頭重建（不會重匯出 `props.glb`）。

`public/room.glb` 整個載入，使用檔案內自己的顏色，載入時統一壓暗做出傍晚光線；發光材質（`room_sky|bulb|shade|moon|fairy`）除外。
房間同時被擷取成一張立方體貼圖，當作玻璃反射和球內視角的背景。改了房間就要重新確認這兩處。

## 零件與機關清單

所有物理特性都寫在共用庫裡，所以同一個零件、表面、機關在每一顆球的行為完全一樣。

**軌道零件**（`src/kit.js` 的 `Track`）
原有：`straight`、`turn`、`bankedTurn`、`pitch`（爬牆／上天頂）、`twist`、`helix`、`loop`、`ramp`、`bumps`、`pegs`、`stairs`、`drop`、`boost`（發射帶，單向）、`spline`。
新增：`wave(len, n, amp)`（左右蛇行）、`sCurve(len, shift)`（換線）、`dip(len, depth)`（谷；負值是丘，中立不變所以球會在谷裡來回晃）、
`switchback(n, len, deg, radius)`（之字下坡，radius 的正負決定先往哪邊折）、`beam(len)`（平衡木）、`keys(len)`（木琴鍵，輕微搓板）、`surface(name, len)`。

**斷面**（真正不同的物理形狀；`style({ section })` 或同名零件）
原有：`plank`（預設，可換皮膚）、`tube`（玻璃管）、`rails`（雙軌）、`trough`（圓槽）。
新增：`halfpipe`（寬 U 形，球會左右盪）、`vee`（兩片合板釘成的 V 槽，球被夾在正中間）、`cage`（六根鋼絲的雲霄飛車籠，看得穿）。

**表面**（`SURFACES`；`style({ surface })` 或 `surface(name, len)`；表面自帶皮膚，所以到處看起來都一樣）

| 表面 | 物理 | 用在 |
|---|---|---|
| `ice` | 幾乎沒有摩擦：球用滑的，加速比木頭快 | 冰湖、冰川、霜 |
| `felt` | 滾動阻力大：球明顯變慢，放手很快停下 | 撞球檯、絨布、苔地 |
| `rubber` | 高彈性：落在上面會彈回去 | 落點、彈跳鼓（`trampoline` 機關用的就是它） |

站台以外的固定造型要用某種表面時：`k.surface(geometry, 材質, 'rubber')`。

**皮膚**（只管外觀，物理永遠是標準斷面；`style({ skin })`）

| 皮膚 | 風格 | 樣子 |
|---|---|---|
| `wood` | 手作（預設） | 上漆合板、圓木護欄 |
| `crystal` | 奇幻 | 黃銅軌托著切面水晶 |
| `stone` | 奇幻微縮 | 一塊一塊的石板路、路緣石、外側有苔 |
| `vine` | 奇幻微縮 | 長苔的半圓木、藤蔓護欄、葉子和花苞 |
| `slats` | 高質感手作 | 吊橋：一片片不太整齊的木板、麻繩扶手 |
| `ivory` | 精緻雕琢 | 象牙白、金線鑲嵌、珠邊、鍍金龍骨 |
| `brass` | 精密機械 | 烤藍鋼板、黃銅軌、鉚釘、小欄杆 |
| `musicbox` | 音樂盒 | 鋼梳齒的板面，底下是有音釘的黃銅滾筒 |
| `keys` | 音樂盒／玩具 | 彩色木琴鍵（`keys()` 自動使用） |
| `ice`、`felt`、`rubber` | — | 對應表面自動使用，不要單獨當皮膚用 |

**站台**：`padAt`、`padAhead`、`fromPad`、`arrive`；`bumper` 放單一彈柱。

**機關**（`src/library/mechanisms.js`）
原有：`turntable`、`lift`、`shuttle`、`sweeper`、`pendulum`、`weighbridge`、`flap`、`funnel`、`bumpers`、`armillary`、`archOver`。
新增：

| 機關 | 怎麼玩 | 備註 |
|---|---|---|
| `seesaw` | 蹺蹺板：滾過中點，重量把另一端壓下去 | 鉸接；單向（近端→遠端）；回傳 `entry`／`exit` 給前後兩段軌道 |
| `trapdoor` | 活板門：踩上去就往下開，球掉到下一層 | 鉸接；回傳門打開時的末端位置，下面要放東西接 |
| `turnstile` | 站台中央的十字旋轉門，球把它推著轉 | 鉸接、自由旋轉 |
| `trampoline` | 橡膠彈跳鼓，適合放在落點 | 用 `rubber` 表面 |
| `carousel` | 旋轉木馬：轉盤＋黃銅柱＋條紋頂篷＋燈 | 用法同 `turntable`；它的光寫在機關裡 |
| `gearTrain` | 一排互相咬合的齒輪 | 裝飾（有碰撞） |
| `pendulumRow` | 一排錯開節奏的鐘擺 | 擺錘離軌道面的高度由你決定：要擋路還是只擦過頭頂 |
| `musicDrum` | 音樂盒滾筒與鋼梳 | 裝飾（有碰撞） |
| `windupKey` | 慢慢轉的發條鑰匙 | 裝飾 |
| `mobile` | 吊飾：轉動的臂上掛共用道具 | 掛發光道具時，光會跟著移動 |

`src/globes/atelier.js`（工坊樣品球）用到了所有新增的東西，`src/globes/practice.js`（迴旋球）用到了所有原有的，寫新球時可以對照寫法。
**但兩顆都是樣品架，佈局不要照抄。**

## 往共用庫加東西（零件、皮膚、機關、素材）

1. **只新增，不覆蓋。** 不改既有項目的行為、尺寸、物理數字、發光數字；新名稱不能和既有的重複（素材包載入時既有名稱優先）。
2. **物理數字寫在庫裡**，球裡不能帶參數去改它（例如某顆球自己決定冰有多滑）。外觀的顏色可以由球指定。
3. **新零件**要讓 `verify` 能跑（有 frames、有正確的 `nu`）；**新鉸接機關或新表面**要在 `scripts/sim-mechanisms.mjs` 加一段台架測試並通過。
4. **新材質名稱**要同時加進 `render.js` 的 `makeMaterials()`（在標記的區塊後面接著加）。
5. 加完之後 `npm run verify`（每一顆球）和 `npx vite build`。
6. 在樣品球（`atelier`）放一個實例，並實際看過畫面。

### 素材包（Blender 手作道具）

- 一個包 = `tools/blender_pack_<名字>.py` → `public/packs/<名字>.glb` ＋ `src/packs/<名字>.collision.json`，
  並在 `src/library/assets.js` 的 `PACKS` 和 `ASSETS` 登記（每個道具標 `pack`），在 `src/kit.js` 匯入碰撞檔。
- **用無頭模式匯出**，不要在使用者開著的 Blender 裡匯出（Blender 5.3 從第二個場景匯出 glTF 會當掉，2026-11-13 發生過）：
  `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/blender_pack_atelier.py -- export`
- 在開著的 Blender 裡可以執行腳本來「看」成品（它建在自己的場景 `PlexulisaAtelier`），但不要呼叫 `export()`。
- 原本的 `tools/blender_props.py`／`public/props.glb` 不需要、也不應該為了加新道具而重建。

### 會動的機關有三種

| 種類 | 怎麼動 | 用途 | 例子 |
|---|---|---|---|
| 轉動（預設） | 以固定速度繞一根軸轉 | 轉盤、掃桿、風車、齒輪 | `mover({ pivot, axis, speed })` |
| 往返（`kind: 'lift'`、`'swing'`） | 沿一條線來回並在兩端停留；或像鐘擺來回擺 | 升降梯、接駁台、鐘擺 | `lift`、`shuttle`、`pendulum` |
| 鉸接（`kind: 'hinge'`） | **真正的物理**：一個掛在鉸鏈上的物體，受重力、回復彈簧和鋼珠重量驅動 | 秤橋、彈簧門、任何「被球壓下去／推開」的東西 | `weighbridge`、`flap` |

鉸接件只能用 `k.box(...)` 組成（盒子同時是外觀和碰撞），並且要留意不要和固定的軌道或自己的柱子重疊，否則會卡住或亂彈。
彈簧的 `stiffness` 是「每弧度的力矩」；`weighbridge` 的寫法示範了怎麼依鋼珠重量算出剛好下沉到指定角度的彈簧。
新的鉸接機關一定要先寫一小段模擬（放一顆球上去跑幾秒，印出位置）確認行為，再放進球裡。

穿過會動機關的路線（例如接駁台的缺口）自動測試跑不過去，把 `track.manual = true` 標起來，測試會略過並註明需要真人試。

## 支架與燈

- **支架要少。** `createBuilder({ supports: false })` 關掉自動支架，改成每段軌道一根短肋條、軌道之間互相固定、浮島不立柱（`pole: false`）。迴旋球是這樣做的。
- **燈自動避開出入口。** `padLantern(name, pad)` 不給角度時，會在所有軌道都確定之後，站到最寬的那段沒有進出口的護欄中間。

## 垂直的軌道

不需要新零件：`pitch(90, r)` 把軌道彎上牆，之後接的任何零件（釘陣、之字、玻璃管、平衡木）就都是垂直的。鋼珠腳下的面永遠是「下」，所以牆上的路和地上的路一樣好走。

## 擺放

- 用現有的錨點：圓台（`pads`，有中心 `c`、朝上方向 `u`、半徑 `r`）、`padPoint(pad, 角度, 距離)`、軌道的 `frames`、`HOLES`。
  景觀應該以這些為基準擺，而不是寫死一堆座標。
- 讓軌道穿過景觀：拱門跨在軌道上、樹冠在軌道上方留出淨空、建築貼著軌道轉彎的外側。
  鋼珠加護欄的淨空高度至少留 0.6，寬度至少留軌道寬加 0.3。
- 不要擋住圓台的出入口、燈、升降梯柱、兩個井，以及支柱落點（支柱會自動避開軌道，但不會避開你新放的景觀）。
  往站台邊上擺東西之前先看 `pad.exits`（有軌道進出的角度）；會往下垂的東西（`floating_rock` 的根有 2.4 × 縮放那麼長）要檢查下方有沒有軌道；
  自己拉到玻璃的肋條要檢查沿途有沒有別的軌道。`atelier.js` 裡的 `spot()`、`outcrop()`、`plantRibs()` 是這三件事的寫法。
- 任何朝向都可以放東西：`up` 給 `(0,-1,0)` 就倒掛在海板底面，給朝球心的方向就長在側立的島上。
- 需要大量重複時，用有意圖的分佈（沿海岸線、沿坡向、成群成簇、留白），不要整片均勻亂數。
- 會動的東西用 `mover(...)`，裡面一樣可以呼叫 `prop()`。
- 區域需要自己的光（洞穴、發光的花園）時用 `light(pos, color, intensity, distance, day)`，少量使用；`day` 是開燈時的倍率。
- `setMood(fn)` 讓某個區域變成夜晚（主光淡出，只剩球自己的光）。玩家也可以按 N 關掉房間的燈，所以每顆球都要想好「關燈後靠什麼發光」。
- 站台可以用 `padAt(中心, 朝上, 參考方向, 半徑)` 直接放；軌道抵達站台時呼叫 `arrive(track, pad)` 開護欄缺口。

## 不能破壞的東西

- `npm run verify` 全數通過，且沒有新的 `WARNING`（軌道互相穿插）。
- 碰撞網格的最大半徑不超過玻璃（報告裡的 `max collision radius`）。
- 鋼珠、軌道、護欄在球內視角清楚可辨。
- 存檔鍵（主球 `plexulisa.v1`，其他球 `plexulisa.v1.<id>`）、每顆球燈的順序（第一盞是出生點）。
- 其他球：改了共用的東西之後，架上每一顆都要還能玩。
