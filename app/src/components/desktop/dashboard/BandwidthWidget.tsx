import { BandwidthStats } from '../../../types';
import { formatBytes } from '../../../utils';

interface BandwidthWidgetProps {
    bandwidth: BandwidthStats | null;
}

export function BandwidthWidget({ bandwidth }: BandwidthWidgetProps) {
    if (!bandwidth) return null;

    const isWeb = typeof window !== 'undefined' && (!('__TAURI_INTERNALS__' in window) || Boolean((window as any).__TAURI_IS_WEB_FALLBACK__));
    const totalBytes = bandwidth.up_bytes + bandwidth.down_bytes;
    const limit = bandwidth.limit_bytes || (isWeb ? 15 * 1024 * 1024 * 1024 : 250 * 1024 * 1024 * 1024);
    const percent = Math.min((totalBytes / limit) * 100, 100);

    return (
        <div className="mt-1.5 space-y-1 text-metadata text-app-text-secondary">
            <div className="flex justify-between">
                <span>{isWeb ? 'Espaço Google Drive:' : 'Used this week:'}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-app-border">
                <div
                    className="h-full rounded-full bg-app-accent transition-[width] duration-500"
                    style={{ width: `${percent}%` }}
                ></div>
            </div>
            <div className="flex justify-between text-badge text-app-text-tertiary">
                <span>{formatBytes(totalBytes)}</span>
                <span>{formatBytes(limit)}</span>
            </div>
        </div>
    );
}
