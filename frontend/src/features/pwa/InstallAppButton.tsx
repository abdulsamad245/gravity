import { Download } from 'lucide-react';
import { APP_NAME } from '../../shared/constants/app.constants';
import { usePwaInstall } from './usePwaInstall';

interface Props {
  onAfterAction?: () => void;
}

/**
 * Install entry for the room More / mobile menus. Native → OS sheet; iOS → soft guide.
 */
export function InstallAppButton({ onAfterAction }: Props) {
  const { available, capability, promptInstall, openSoftPrompt } = usePwaInstall();

  if (!available || !capability) return null;

  const run = () => {
    if (capability === 'native') {
      void (async () => {
        await promptInstall();
        onAfterAction?.();
      })();
      return;
    }
    openSoftPrompt();
    onAfterAction?.();
  };

  return (
    <button type="button" className="tool-flyout-item" role="menuitem" onClick={run}>
      <Download size={16} /> Install {APP_NAME}
    </button>
  );
}
