// 偏好设置页骨架 —— 对齐 marktext pages/preference.vue + prefComponents/sideBar。
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { t } from '../i18n';
import '../styles/marktext/preference.css';

const CATEGORIES = [
  { id: 'general', labelKey: 'preferences.categories.general' },
  { id: 'editor', labelKey: 'preferences.categories.editor' },
  { id: 'markdown', labelKey: 'preferences.categories.markdown' },
  { id: 'theme', labelKey: 'preferences.categories.theme' },
  { id: 'image', labelKey: 'preferences.categories.image' },
  { id: 'keybindings', labelKey: 'preferences.categories.keybindings' }
]

export default function PreferencePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const current = location.pathname.split('/').pop() ?? 'general';

  return (
    <div className="preference">
      <div className="pref-sidebar">
        <button className="pref-back-button" onClick={() => navigate('/editor')} aria-label="Back to editor">
          <span aria-hidden="true">←</span> Back to editor
        </button>
        <div className="pref-sidebar-title">{t('preferences.title')}</div>
        <ul className="pref-sidebar-list">
          {CATEGORIES.map((cat) => (
            <li
              key={cat.id}
              className={current === cat.id ? 'active' : ''}
              onClick={() => navigate(`/preference/${cat.id}`)}
            >
              {t(cat.labelKey)}
            </li>
          ))}
        </ul>
      </div>
      <div className="pref-content">
        <Outlet />
      </div>
    </div>
  );
}
