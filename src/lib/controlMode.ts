// [v3] 总控台部署形态(基址非空=/control 代理形):机器视图只显实例
// (instance-*),local/lan-* 宿主册行隐藏勿删(fleet 跨机道依赖)。
export const basePath = window.location.pathname.replace(/\/[^/]*$/, "")
export const controlConsole = basePath !== ""
/** 总控视图可见性:实例命名机器才进侧栏与默认选中 */
export function instanceMachine(m: { name: string }): boolean {
  return m.name.startsWith("instance-")
}
