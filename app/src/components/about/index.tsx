// 关于对话框 —— 对齐 marktext components/about/index.vue。
import { useEffect, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import bus from '../../bus';
import { GITHUB_REPO_URL } from '../../config';

export default function AboutDialog() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onShow = (): void => setVisible(true);
    bus.on('aboutDialog', onShow);
    return () => bus.off('aboutDialog', onShow);
  }, []);

  if (!visible) return null;

  return (
    <div className="modal-mask about-mask" onClick={() => setVisible(false)}>
      <div className="about" onClick={(e) => e.stopPropagation()}>
        <img src="/notademics-icon.png" alt="Notademics" className="about-logo" width={88} height={88} />
        <div className="about-title">Notademics</div>
        <div className="about-version">Version 0.2</div>
        <div className="about-description">一款轻量、专注且所见即所得的 Markdown 编辑器。<br />The Art of Minimal Markdown.</div>
        <div className="about-license">GNU General Public License v3.0</div>
        <div className="about-actions">
          <button className="about-link" onClick={() => void openUrl(GITHUB_REPO_URL)}>GitHub</button>
          <button className="about-close" onClick={() => setVisible(false)}>关闭</button>
        </div>
      </div>
    </div>
  );
}
