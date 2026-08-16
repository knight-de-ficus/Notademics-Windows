// 关于对话框 —— 对齐 marktext components/about/index.vue。
import { useEffect, useState } from 'react';
import bus from '../../bus';
import { useMainStore } from '../../store';
import { GITHUB_REPO_URL } from '../../config';

export default function AboutDialog() {
  const mainStore = useMainStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onShow = (): void => setVisible(true);
    bus.on('aboutDialog', onShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div className="modal-mask about-mask" onClick={() => setVisible(false)}>
      <div className="about" onClick={(e) => e.stopPropagation()}>
        <img src="notademics-icon.png" alt="Notademics" className="about-logo" width={80} height={80} />
        <div className="about-title">Notademics</div>
        <div className="about-version">Version {mainStore.appVersion}</div>
        <div className="about-description">The Art of Minimal Markdown</div>
        <a className="about-link" href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
        <button className="about-close" onClick={() => setVisible(false)}>Close</button>
      </div>
    </div>
  );
}
