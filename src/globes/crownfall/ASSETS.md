# 霜焰王城資產

`track.js` 使用遊戲現有的軌道零件和機關。軌道表面、配色與機關擺位只套用在這顆球。
`scene.js` 放置景觀、裝飾和燈光。新增模型的來源和成品都記錄在此。

| 遊戲內資產 | 來源 | 內容 |
| --- | --- | --- |
| `castle.json` | Meshy 6 網格與 2K 貼圖，以 `model_castle.py` 在 Blender 減面和取色 | 9,800 三角面，使用遊戲現有的手作材質 |
| `terrain.json` | `model_scene.py` 在 Blender 建模及匯出 | 山脊、冰川、火山熔流、瀑布、礦穴岩層、發光菇和手塑松林 |
| 石拱、房屋、船、水晶、齒輪 | 現有共用資產 | 擺位、尺寸和配色由 `scene.js` 指定 |
| 鐘亭、旗幟、礦車、水輪、吊橋索 | 新球場景內的造型 | 依地形和路段錨點搭建 |

Meshy 預覽 `01a1d08d-76e4-7113-a3de-97ea177a5cd7`，20 點。
貼圖 `01a1d08f-a5eb-737b-83b2-56050ae4ace4`，10 點。
原始 GLB 可透過貼圖任務 ID 重新下載，將路徑交給 `CROWNFALL_CASTLE_SOURCE` 後在 Blender 執行 `model_castle.py`。

從 `src/globes/index.js` 移除 `crownfall` 的匯入和球架項目，再刪除 `src/globes/crownfall.js` 及本資料夾，即可卸下整顆球。
