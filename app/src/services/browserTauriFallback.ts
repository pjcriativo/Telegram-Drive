/**
 * Browser fallback polyfill for standalone web environments (e.g. Vercel deployment).
 *
 * In native desktop/mobile releases, Tauri injects `__TAURI_INTERNALS__`,
 * `__TAURI_EVENT_PLUGIN_INTERNALS__`, and `__TAURI_OS_PLUGIN_INTERNALS__`.
 *
 * In a standard web browser, this module ensures those APIs exist so the
 * UI can render, persist settings to localStorage, and display preview flows
 * without unhandled runtime exceptions.
 */

if (typeof window !== 'undefined') {
  const isNativeTauri = '__TAURI_INTERNALS__' in window && !(window as any).__TAURI_IS_WEB_FALLBACK__;

  if (!isNativeTauri) {
    (window as any).__TAURI_IS_WEB_FALLBACK__ = true;

    if (!('__TAURI_OS_PLUGIN_INTERNALS__' in window)) {
      (window as any).__TAURI_OS_PLUGIN_INTERNALS__ = {
        os_type: 'windows',
        platform: 'windows',
        arch: 'x86_64',
        version: '11',
        family: 'windows',
      };
    }

    if (!('__TAURI_EVENT_PLUGIN_INTERNALS__' in window)) {
      (window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
        unregisterListener: () => {},
      };
    }

    if (!('__TAURI_INTERNALS__' in window) || (window as any).__TAURI_IS_WEB_FALLBACK__) {
      let nextId = 1;
      const callbacks = new Map<number, (value: any) => void>();
      const listeners = new Map<number, { event: string; handler: number }>();
      const stores: Record<string, any> = {};

      const loadLocalStores = () => {
        try {
          return JSON.parse(localStorage.getItem('telegram-drive-web-stores') || '{}');
        } catch {
          return {};
        }
      };

      const persistLocalStores = () => {
        try {
          localStorage.setItem('telegram-drive-web-stores', JSON.stringify(stores));
        } catch {}
      };

      try {
        Object.assign(stores, loadLocalStores());
      } catch {}

      (window as any).__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
        transformCallback: (callback: (value: any) => void) => {
          const id = nextId++;
          callbacks.set(id, callback);
          return id;
        },
        unregisterCallback: (id: number) => {
          callbacks.delete(id);
        },
        convertFileSrc: (path: string) => path,
        invoke: async (command: string, args: any = {}) => {
          // Plugin store operations (settings, configs)
          if (command === 'plugin:store|load') {
            stores[args.path] ??= {};
            return args.path;
          }
          if (command === 'plugin:store|get') {
            const store = stores[args.rid] ?? {};
            return [store[args.key], args.key in store];
          }
          if (command === 'plugin:store|set') {
            stores[args.rid] ??= {};
            stores[args.rid][args.key] = args.value;
            persistLocalStores();
            return;
          }
          if (command === 'plugin:store|delete') {
            if (stores[args.rid]) {
              delete stores[args.rid][args.key];
              persistLocalStores();
            }
            return true;
          }
          if (command === 'plugin:store|save') {
            persistLocalStores();
            return;
          }

          // Plugin event operations
          if (command === 'plugin:event|listen') {
            const id = nextId++;
            listeners.set(id, { event: args.event, handler: args.handler });
            return id;
          }
          if (command === 'plugin:event|unlisten') {
            listeners.delete(args.eventId);
            return;
          }

          // Core health and lifecycle commands
          if (command === 'cmd_get_startup_health') {
            return {
              ready: true,
              sponsor_port: 14201,
              streaming_port: 14201,
              streaming_port_is_fallback: false,
            };
          }
          if (command === 'cmd_migrate_proxy_secret') return null;
          if (command === 'cmd_load_api_hash') return stores['config.json']?.api_hash ?? null;
          if (command === 'cmd_store_api_hash') {
            stores['config.json'] ??= {};
            stores['config.json'].api_hash = args.apiHash;
            persistLocalStores();
            return null;
          }
          if (command === 'cmd_delete_api_hash') {
            if (stores['config.json']) delete stores['config.json'].api_hash;
            persistLocalStores();
            return null;
          }
          if (command === 'cmd_check_connection') return Boolean(stores['config.json']?.session_active);
          if (command === 'cmd_connect') return true;
          if (command === 'cmd_disconnect') {
            if (stores['config.json']) delete stores['config.json'].session_active;
            persistLocalStores();
            return true;
          }
          if (command === 'cmd_is_network_available') return typeof navigator !== 'undefined' ? navigator.onLine : true;
          if (command === 'cmd_get_sync_status') {
            return { enabled: false, running: false, activePairs: 0, pendingOps: 0, conflicts: 0, lastError: null, pairs: [] };
          }
          if (command === 'cmd_get_sync_settings') {
            return { enabled: false, debounceMs: 2000, encryption: 'inherit', scanner: 'full' };
          }
          if (command === 'cmd_get_sync_pairs') return [];
          if (command === 'cmd_get_settings_sync_status') return { available: false };
          if (command === 'cmd_get_android_transfer_environment') return { isTelevision: false };
          if (command === 'cmd_workspace_account') return 'web-preview-user';
          if (command === 'cmd_get_enriched_folders' || command === 'cmd_scan_folders') {
            return [{ id: 9, name: 'Saved Messages', file_count: 0 }];
          }
          if (command === 'cmd_touch_file_inventory') return true;
          if (command === 'cmd_search_local' || command === 'cmd_list_files') {
            return { files: [], total: 0, indexId: 'search-web-preview', nextOffset: null, indexed: true, complete: true, offline: true };
          }
          if (command === 'cmd_get_system_power_status') {
            return { on_battery: false, low_power_mode: false };
          }
          if (command === 'cmd_get_transfers' || command === 'cmd_get_active_transfers') {
            return [];
          }

          // Supporter licensing in web demo
          if (command === 'cmd_supporter_check_status') {
            return {
              state: 'inactive',
              ad_free: false,
              message: 'Web Preview mode',
              terms_version: '2026-08-11',
              terms_url: null,
              expires_at: null,
              offline_until: null,
              recovery_code_saved: false,
              checkout_pending: false,
            };
          }

          // Auth wizard commands in web preview
          if (command === 'cmd_auth_qr_login') return 'tg://login?token=web-preview-mock-token';
          if (command === 'cmd_auth_qr_poll') return { success: false };
          if (command === 'cmd_auth_request_code') {
            return { status: 'code_required', delivery: 'telegram_app', codeLength: 5, numericCode: true };
          }
          if (command === 'cmd_auth_sign_in') return { success: false, next_step: 'password' };
          if (command === 'cmd_auth_check_password') return { success: true };

          // Dialog / opener / shell mocks
          if (command === 'plugin:opener|open_url' || command === 'plugin:shell|open') {
            if (typeof window !== 'undefined' && (args.path || args.url)) {
              window.open(args.path || args.url, '_blank', 'noopener,noreferrer');
            }
            return true;
          }

          return null;
        },
      };
    }
  }
}

export {};
