// [v3] 总控台部署形态(基址非空=/control 代理形):机器视图只显实例
// (instance-*),local/lan-* 宿主册行隐藏勿删(fleet 跨机道依赖)。
// window 守卫:测试/SSR 等非浏览器环境按根部署形(空基址)退。
function detectBasePath(): string {
  if (typeof window === "undefined") return ""
  return window.location.pathname.replace(/\/[^/]*$/, "")
}
export const basePath = detectBasePath()
export const controlConsole = basePath !== ""
/** 总控视图可见性:实例命名机器才进侧栏与默认选中 */
export function instanceMachine(m: { name: string }): boolean {
  return m.name.startsWith("instance-")
}

/** [v3 F0] 品牌名(品牌词不进翻译面,作常量引用) */
export const BRAND_NAME = "皓玄"
