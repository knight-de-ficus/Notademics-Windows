// Image 偏好页 —— 对齐 marktext prefComponents/image。
import { usePreferencesStore } from '../../store/preferences';
import { BoolInput, SelectInput, TextBoxInput, Separator } from '../common';

export default function Image() {
  const p = usePreferencesStore();

  return (
    <div className="pref-page">
      <h2>Image</h2>

      <Separator />
      <h3>Default Behavior</h3>
      <SelectInput
        title="Image Insert Action"
        value={p.imageInsertAction}
        options={[
          { label: 'Copy to folder', value: 'folder' },
          { label: 'Use absolute path', value: 'path' },
          { label: 'Upload to cloud', value: 'upload' }
        ]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('imageInsertAction', v)}
      />

      <Separator />
      <h3>Folder Setting</h3>
      <TextBoxInput title="Global image folder" value={p.imageFolderPath} onChange={(v) => p.SET_SINGLE_PREFERENCE('imageFolderPath', v)} />
      <BoolInput title="Prefer relative directory" value={p.imagePreferRelativeDirectory} onChange={(v) => p.SET_SINGLE_PREFERENCE('imagePreferRelativeDirectory', v)} />
      <SelectInput
        title="Copy image relative to"
        value={p.imageRelativeDirectoryBase}
        options={[
          { label: 'Relative to file', value: 'file' },
          { label: 'Relative to folder', value: 'root' }
        ]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('imageRelativeDirectoryBase', v)}
      />
      <TextBoxInput title="Relative folder name" value={p.imageRelativeDirectoryName} onChange={(v) => p.SET_SINGLE_PREFERENCE('imageRelativeDirectoryName', v)} />

      <Separator />
      <h3>Image Uploader</h3>
      <SelectInput
        title="Current Uploader"
        value={p.currentUploader}
        options={[
          { label: 'PicGo', value: 'picgo' },
          { label: 'CLI Script', value: 'cliScript' }
        ]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('currentUploader', v)}
      />
      {p.currentUploader === 'cliScript' && (
        <TextBoxInput title="Script path" value={p.cliScript} onChange={(v) => p.SET_SINGLE_PREFERENCE('cliScript', v)} />
      )}
    </div>
  );
}
