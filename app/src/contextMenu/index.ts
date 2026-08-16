// 原生右键菜单 —— 用 Tauri 2 的 Menu API 弹出系统菜单。
// 对齐 marktext contextMenu/popupMenu.ts 的调用方式（popupContextMenu(items, position) → Promise<选中 id>）。
import { Menu, MenuItem, PredefinedMenuItem, type MenuItemOptions } from '@tauri-apps/api/menu';
import { PhysicalPosition } from '@tauri-apps/api/dpi';

export interface ContextMenuItem {
  id?: string
  label?: string
  type?: 'normal' | 'separator' | 'checkbox' | 'radio'
  enabled?: boolean
  checked?: boolean
  submenu?: ContextMenuItem[]
  click?: () => void
}

export interface PopupPosition {
  x: number
  y: number
}

const toMenuItemOptions = (item: ContextMenuItem): MenuItemOptions => {
  const options: MenuItemOptions = {
    id: item.id ?? `menu-${Math.random().toString(36).slice(2)}`,
    text: item.label ?? '',
    enabled: item.enabled ?? true
  }
  return options
}

/**
 * 弹出原生右键菜单。
 * @param items 菜单项定义
 * @param position 屏幕坐标（可省略，省略时用鼠标位置由系统决定）
 * @returns 选中的菜单项 id（取消返回 null）
 */
export const popupContextMenu = async (
  items: ContextMenuItem[],
  position?: PopupPosition
): Promise<string | null> => {
  if (!items.length) return null
  try {
    const menuItems: Array<MenuItem | PredefinedMenuItem> = []
    for (const item of items) {
      if (item.type === 'separator') {
        menuItems.push(await PredefinedMenuItem.new({ item: 'Separator' }))
        continue
      }
      if (item.submenu?.length) {
        const sub = await Menu.new({
          items: item.submenu.map((s) => ({ id: s.id ?? '', text: s.label ?? '' }))
        })
        menuItems.push(
          await MenuItem.new({
            id: item.id ?? '',
            text: item.label ?? '',
            enabled: item.enabled ?? true,
            action: (menuId) => {
              if (item.click) item.click()
            }
          })
        )
        void sub
        continue
      }
      menuItems.push(
        await MenuItem.new({
          ...toMenuItemOptions(item),
          action: () => {
            if (item.click) item.click()
          }
        })
      )
    }
    const menu = await Menu.new({ items: menuItems as never[] })
    if (position) {
      await menu.popup(new PhysicalPosition(position.x, position.y))
    } else {
      await menu.popup()
    }
    // Tauri 2 的 popup 返回选中的 MenuItem id（Promise 形式）
    const result = await (menu.popup as unknown as (pos?: PhysicalPosition) => Promise<MenuItem | null>)(
      position ? new PhysicalPosition(position.x, position.y) : undefined
    )
    return result?.id ?? null
  } catch (err) {
    console.error('popupContextMenu failed:', err)
    return null
  }
}

/** 便捷：按钮/节点上绑定右键弹出 */
export const handleContextMenuEvent = (
  e: React.MouseEvent,
  items: ContextMenuItem[],
  onClick?: (id: string) => void
): void => {
  e.preventDefault()
  e.stopPropagation()
  void popupContextMenu(items, { x: e.clientX, y: e.clientY }).then((id) => {
    if (id && onClick) onClick(id)
  })
}
