# FORK 宗旨与回上游策略(皓玄 v3 线)

本仓是 [devswha/herdr-web-ui](https://github.com/devswha/herdr-web-ui) 的皓玄(haoxun)产品线 fork,v3 线工作分支 = `v3`。

## 宗旨

皓玄 v3 架构重构以 herdr-web-ui 为前端基座(计划真源:皓玄 G 仓 v3 分支 `docs/v3/`;战役分期 V3-0..V3-6)。fork 要做的四件事:

1. **base-path 支持运行时注入**(HERDR_WEB_BASE_PATH):SPA 与 WS/API 拼接统一走 baseUrl,支撑网关 `/i/{publicId}/` 按实例代理;
2. **C1 鉴权硬化**:token 设置后全量强制(含回环来源)——反代穿透回环豁免的雷在此根修;
3. **桌面面板**:`/desktop` WS 同源反代(参照 machine-relay.ts)+noVNC 组件承载,桌面窗进 pane 体系;
4. **文件面板同源化**:`/api/files`(家卷范围+路径归一化)。

## 回上游策略

- **补丁纪律**:fork 侧改动一律小粒度独立提交,标题带 `[v3]` 前缀,每提交自含上游可读性(不混产品私货);长期目标:C1 硬化与 base-path 两项争取直接回上游 PR,桌面/文件面板按上游意愿拆送。
- **rebase 节奏**:季度对 upstream/main rebase 一次(R11 fork 漂移缓解);rebase 冲突只许落在 fork 专属文件(FORK.md/桌面/文件面板),核心改动若冲突优先重写成更小补丁。
- **远端形**:`upstream` = devswha/herdr-web-ui(只拉不推);`origin` = 皓玄侧 fork 托管(待建,建后此行更新)。

## 冻结与切换

v2.9.x 产线(皓玄 G 仓 main/pi-acp-product,v2.9.13+0028 tag)维稳不动;v3 过 G5 终验才切,v2 全程可回退——fork 侧任何改动不得反噬此不变量。
