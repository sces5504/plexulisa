---
name: fantasy-world-builder
description: 為 Plexulisa（Snow Globe × Perplexus 滾珠遊戲）設計新的球、或建造與美化現有球的球內奇幻世界和球外房間：用現成的軌道零件組排路線、規劃景觀、挑選或製作環境資產（建築、樹木、植物、城堡、雕像、地標）、用 Meshy 生成高品質資產、用 Blender 整理與組合、放進遊戲、實際渲染檢查並提出改進。當使用者要求做一顆新的球、新增或改善場景、景觀、地標、路線佈局、環境美術、資產庫，或提到「更精緻／更夢幻／更宏大／fantasy diorama／世界不夠漂亮／太空／太敷衍／軌道太少」時使用。不用於修改軌道零件本身、物理、碰撞規則或操作手感。
---

# Fantasy World Builder

把這顆球做成一件值得收藏的 Snow Globe：從外面看是精緻的玻璃球微縮景，進到裡面是一個宏大的奇幻世界。
這個遊戲會有很多顆不同的球，每一顆都是用同一套軌道零件拼出來的獨立世界。
這個 Skill 管的是**一顆球的設計：路線佈局、景觀與資產**。軌道零件組、物理和操作已經完成，是你拿來用的工具，不是你要改的東西。

## 開始前一定要做

1. 讀 [project-contract.md](references/project-contract.md)：現有架構、哪些不能動、資產怎麼進遊戲。
   讀 [globe-standards.md](references/globe-standards.md)：每顆球交付前要過的驗收標準。
2. 讀 `assets/library.json`：先看現有資產能不能直接用、換色、縮放或重新組合。
3. 跑 `npm run verify` 確認基準是綠的。之後每次改動 `src/globes/` 都要再跑，必須維持全數通過。
4. 確認工具：`mcp__blender__get_addon_status`（Blender 沒連上就說明並改用不需要它的步驟）、`meshy auth status`。

不確定現況時，先讀程式碼再動手。不要憑記憶假設 API 還長得一樣。

## 邊界（不可違反）

- **不重做軌道系統，既有的東西不改。** `src/kit.js` 既有的 `Track` 零件、斷面、表面（`SURFACES`）、`SKINS`、回正規則（`nu`／`gain`）、
  物理與碰撞的生成方式都保持原樣；共用機關與素材既有的行為和數字也一樣。改它們會改到別的球，需要時先向使用者說明原因並取得同意。
- **可以往共用庫新增**零件、皮膚、機關、素材，條件是只新增不覆蓋、物理數字寫在庫裡、有台架測試、加完後每一顆球重新驗證。
  只有這顆球用得到的東西留在這顆球自己的資料夾。
- **每顆球是獨立模組。** 做一顆新球不能影響遊戲本身、共用庫和其他球；共用的東西（零件組、房間、材質）改動後，架上每一顆球都要重新驗證。
- **Meshy 是付費的。** 任何會扣點的生成、重跑、加貼圖、remesh 之前：先估算成本、報餘額、講清楚要做哪幾個，等使用者明確同意。
  一次同意只涵蓋當次列出的項目。實際扣點記到 `assets/library.json`。
- **同一個會發光的東西，在每顆球都一樣亮。** 光寫在素材目錄，不在球裡補燈、不在球裡調亮度。
- **不敷衍，也沒有次等區域。** 不用方塊圓柱堆疊充當成品，不用亂數撒物件充當構圖；底面、背面這些不顯眼的地方要和主舞台同一個水準。佔位幾何只能當草稿，而且要標明。
- **不破壞可玩性。** 軌道必須看得清楚、鋼珠必須看得到、所有看得見的實體都要有碰撞。

## 工作流程：先做一顆好看的球，再把軌道放進去

順序是這個 Skill 最重要的規定，細節在 [globe-standards.md](references/globe-standards.md)。
**不要先排軌道再用景觀填空位**，那樣做出來的球會工整、公式化，使用者已經明確退回過。

1. **故事與構想**：這顆球裡發生什麼事？寫成三五句話給使用者看，再往下做。
   → [art-direction.md](references/art-direction.md)
2. **剪影**：兩三個大體量怎麼不對稱地佔滿整顆球（頂到玻璃、從上面垂下、橫跨中央、留一個看得穿的洞）。
   先用大塊的形從球外看輪廓。
3. **資產清單**：逐一標記「現有可用／現有改造／Blender 手作／Meshy 生成」，優先順序就是這個順序。
   先看 `src/library/assets.js` 和 `assets/library.json` 有什麼。英雄級地標和有機形體才值得用 Meshy。
4. **取得與整理資產**：
   - Meshy：用已安裝的 `meshy-3d-generation` Skill 執行。選型與成本閘門見 [asset-pipeline.md](references/asset-pipeline.md)。
   - Blender 手作（可重複使用的）：加進一個素材包（`tools/blender_pack_<名字>.py`），**無頭執行匯出**，見 project-contract。
   - 只有這顆球用的大型地形：放 `src/globes/<id>/`。
5. **把景做出來**：這時還沒有軌道。做到「不能玩也想買」的程度，實際從球外看過，再往下。
6. **找路、分關卡**：看著景決定鋼珠從哪裡滾到哪裡；軌道嵌進景裡，皮膚和表面跟著經過的地方換；
   分成幾條有名字、有性格的路線，互相接通。
7. **機關、光**：放在故事說得通的地方；想好關燈後靠什麼發光。
8. **登記**：新資產寫進 `src/library/assets.js`（會發光的一定要填 `glow`，用 `GLOW` 裡的預設）和 `assets/library.json`。
9. **驗證**：`node scripts/verify.mjs <id>`、`node scripts/globe-report.mjs <id>`、`npx vite build`、`node scripts/asset-report.mjs`；
   動過機關或表面再跑 `node scripts/sim-mechanisms.mjs`。共用層有改動時，架上每一顆球都要重新驗證。
10. **渲染檢查並提出改進**：實際看畫面，每次都要給出具體的下一步改進。
    → [review-loop.md](references/review-loop.md)
11. **對照驗收標準**：逐項過一遍 [globe-standards.md](references/globe-standards.md)，沒過的項目要修或明確回報。

## 保持彈性

[art-direction.md](references/art-direction.md) 裡的色盤、關鍵詞、預算數字是目前的起點，不是鎖死的規格。
使用者改變方向、或你看到畫面後有更好的判斷時，就更新那份文件並說明理由。
要守住的只有上面的「邊界」。

## 交付時要說清楚

- 這次新增、改造、重用了哪些資產；Meshy 實際花了幾點、剩多少。
- 驗證結果：路線測試、建置、資產報告的數字。
- 看過哪些畫面，哪些沒辦法看（例如 Blender 沒連上、手機沒測）。
- 你自己對畫面的批評，以及建議的下一步。
