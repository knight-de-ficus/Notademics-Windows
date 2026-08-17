// Muya 编辑器操作辅助 —— 内联格式与段落操作。
// 注意：npm 发布的 @muyajs/core 0.2.0 类型面较窄（无 format/insertImage），
// 这些方法在运行时存在，这里用受控的类型断言访问。
import type { Muya } from '@muyajs/core';

/** 工具栏支持的内联格式类型（对应 Muya.format 的入参） */
export type MuyaFormatType =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'inline-code'
  | 'link'
  | 'image';

/** 运行时存在但类型缺失的 Muya 方法 */
type MuyaRuntimeOps = {
  format: (type: string) => void;
  insertImage: (opts: { src: string; alt: string }) => void;
};

export function formatMuya(muya: Muya, type: MuyaFormatType): void {
  try {
    (muya as unknown as MuyaRuntimeOps).format(type);
  } catch (e) {
    console.error('muya.format failed:', type, e);
  }
}

/** 插入图片（Muya 会弹出路径选择器） */
export function insertImage(muya: Muya): void {
  try {
    (muya as unknown as MuyaRuntimeOps).insertImage({ src: '', alt: '' });
  } catch (e) {
    console.error('muya.insertImage failed:', e);
  }
}
