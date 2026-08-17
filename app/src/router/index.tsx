// 路由 —— 对齐 marktext router/index.ts：/editor 主页面、/preference 偏好设置。
import type { RouteObject } from 'react-router-dom';
import AppPage from '../pages/app';
import PreferencePage from '../pages/preference';
import General from '../prefComponents/general/index';
import Editor from '../prefComponents/editor/index';
import Markdown from '../prefComponents/markdown/index';
import Theme from '../prefComponents/theme/index';
import Image from '../prefComponents/image/index';
import Keybindings from '../prefComponents/keybindings/index';

const parseSettingsPage = (type: string | null | undefined): string => {
  let pageUrl = '/preference'
  if (type && /\/spelling$/.test(type)) {
    pageUrl += '/spelling'
  }
  return pageUrl
}

const routes = (type: string | null | undefined): RouteObject[] => [
  {
    path: '/',
    children: [
      { index: true, element: <AppPage /> },
      { path: 'editor', element: <AppPage /> },
      {
        path: 'preference',
        element: <PreferencePage />,
        children: [
          { index: true, element: <General /> },
          { path: 'general', element: <General /> },
          { path: 'editor', element: <Editor /> },
          { path: 'markdown', element: <Markdown /> },
          { path: 'theme', element: <Theme /> },
          { path: 'image', element: <Image /> },
          { path: 'keybindings', element: <Keybindings /> }
        ]
      }
    ]
  }
]

export default routes
