// 命令面板 —— 对齐 marktext components/commandPalette/index.vue。
import { useEffect, useMemo, useRef, useState } from 'react';
import { filter as fuzzyFilter } from 'fuzzaldrin';
import { useCommandCenterStore } from '../../store/commandCenter';
import type { CommandDescriptor } from '../../commands';
import bus from '../../bus';
import { t } from '../../i18n';

interface CommandPaletteProps {
  visible?: boolean
  onClose?: () => void
}

export default function CommandPalette({ visible: propVisible, onClose }: CommandPaletteProps) {
  const commandCenterStore = useCommandCenterStore();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isVisible = propVisible ?? visible;

  useEffect(() => {
    const onShow = (): void => {
      setVisible(true);
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    const off = (): void => {
      setVisible(false);
      onClose?.();
    };
    bus.on('show-command-palette', onShow);
    bus.on('command-palette-close', off);
    return () => {
      // mitt 无退订
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commands: CommandDescriptor[] = commandCenterStore.rootCommand?.subcommands ?? [];

  const filtered = useMemo(() => {
    if (!query) return commands;
    return fuzzyFilter(commands, query, { key: 'description' as never });
  }, [commands, query]);

  const execute = (cmd: CommandDescriptor): void => {
    setVisible(false);
    onClose?.();
    if (cmd.execute) {
      void cmd.execute();
    } else if (cmd.executeSubcommand && cmd.subcommands?.length) {
      void cmd.executeSubcommand(cmd.subcommands[0].id, cmd.subcommands[0].value);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="command-palette-mask" onClick={() => { setVisible(false); onClose?.(); }}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-search">
          <input
            ref={inputRef}
            value={query}
            placeholder={t('commandPalette.placeholder')}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const cmd = filtered[activeIndex];
                if (cmd) execute(cmd);
              } else if (e.key === 'Escape') {
                setVisible(false);
                onClose?.();
              }
            }}
          />
        </div>
        <div className="command-palette-list">
          {filtered.map((cmd: CommandDescriptor, index: number) => (
            <div
              key={cmd.id}
              className={`command-item${index === activeIndex ? ' active' : ''}`}
              onClick={() => execute(cmd)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className="command-description">{cmd.description}</span>
              {cmd.shortcut?.length ? <kbd className="command-shortcut">{cmd.shortcut[0]}</kbd> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
