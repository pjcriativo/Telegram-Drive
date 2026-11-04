import { googleDriveService } from './googleDriveService';

/**
 * Browser fallback polyfill for standalone web environments (e.g. Vercel deployment).
 *
 * In native desktop/mobile releases, Tauri injects `__TAURI_INTERNALS__`,
 * `__TAURI_EVENT_PLUGIN_INTERNALS__`, and `__TAURI_OS_PLUGIN_INTERNALS__`.
 *
 * In a standard web browser, this module ensures those APIs exist and connects
 * to Google Drive Cloud Storage so the UI can render, browse folders, upload,
 * download, and manage files seamlessly.
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
          if (command === 'cmd_workspace_account') {
            return googleDriveService.getUser().email;
          }
          if (command === 'cmd_get_enriched_folders' || command === 'cmd_scan_folders') {
            return googleDriveService.getFolders();
          }
          if (command === 'cmd_touch_file_inventory') return true;
          if (command === 'cmd_search_local' || command === 'cmd_list_files') {
            const allFiles = googleDriveService.getAllFiles();
            return {
              files: allFiles,
              total: allFiles.length,
              indexId: 'gdrive-search',
              nextOffset: null,
              indexed: true,
              complete: true,
              offline: true,
            };
          }
          if (command === 'cmd_get_system_power_status') {
            return { on_battery: false, low_power_mode: false };
          }
          if (command === 'cmd_get_transfers' || command === 'cmd_get_active_transfers') {
            return [];
          }

          // Supporter licensing in web demo
          const webSupporterStatus = {
            state: 'inactive',
            ad_free: false,
            message: 'Ativação de apoiador disponível no app desktop.',
            terms_version: '2026-08-11',
            terms_url: null,
            expires_at: null,
            offline_until: null,
            recovery_code_saved: false,
            checkout_pending: false,
          };
          if (command === 'cmd_get_supporter_status') return webSupporterStatus;
          if (command === 'cmd_refresh_supporter') return webSupporterStatus;
          if (command === 'cmd_activate_supporter') return webSupporterStatus;
          if (command === 'cmd_poll_supporter_checkout') {
            return { status: 'not_started', recovery_code: null, message: 'Web preview — checkout indisponível' };
          }
          if (command === 'cmd_begin_supporter_checkout') {
            return { approval_url: 'https://www.paypal.com/', expires_at: Math.floor(Date.now() / 1000) + 3600 };
          }

          // Desktop lifecycle & app info
          if (command === 'cmd_desktop_frontend_ready' || command === 'cmd_desktop_frontend_unready') return null;
          if (command === 'cmd_get_installation_info') {
            return { managedByPackageManager: false, packageManager: null };
          }
          if (command === 'cmd_get_desktop_preferences') return { theme: 'system', language: null };
          if (command === 'cmd_update_desktop_preferences') return null;
          if (command === 'cmd_get_bandwidth') {
            const quota = googleDriveService.getQuota();
            return {
              date: new Date().toISOString().slice(0, 10),
              up_bytes: quota.used,
              down_bytes: 0,
              limit_bytes: quota.total,
              period: 'weekly',
            };
          }
          if (command === 'cmd_check_latency') return { latency_ms: 0 };
          if (command === 'cmd_detect_vpn') return { detected: false };
          if (command === 'cmd_get_pending_share_count') return 0;
          if (command === 'cmd_get_notification_permission') return 'denied';
          if (command === 'cmd_request_notification_permission') return 'denied';
          if (command === 'cmd_get_android_authentication_available') return false;
          if (command === 'cmd_android_authenticate') return false;
          if (command === 'cmd_configure_android_privacy') return null;
          if (command === 'cmd_logout') return null;
          if (command === 'cmd_get_pending_android_transfer_action') return null;

          // Transfer / file operations — backed by Google Drive Cloud Storage
          if (command === 'cmd_cancel_transfer') return null;
          if (command === 'cmd_cancel_transcode') return null;
          if (command === 'cmd_download_file') return true;
          if (command === 'cmd_upload_file' || command === 'initiate_upload') {
            const fileName = (args.path || 'arquivo_upload').split(/[/\\]/).pop() || 'arquivo_upload';
            return googleDriveService.addFile({
              name: fileName,
              size: 1024 * 750,
            }, args.folderId ?? null);
          }
          if (command === 'cmd_upload_from_url') {
            const fileName = (args.url || 'arquivo_url').split('/').pop() || 'arquivo_url';
            return googleDriveService.addFile({
              name: fileName,
              size: 1024 * 1024 * 2,
            }, args.folderId ?? null);
          }
          if (command === 'cmd_delete_file') {
            googleDriveService.deleteFile(args.messageId);
            return true;
          }
          if (command === 'cmd_delete_folder') {
            googleDriveService.deleteFolder(args.folderId);
            return true;
          }
          if (command === 'cmd_delete_group') return null;
          if (command === 'cmd_rename_file') {
            googleDriveService.renameFile(args.messageId, args.newName);
            return true;
          }
          if (command === 'cmd_rename_folder') {
            googleDriveService.renameFolder(args.folderId, args.newName);
            return true;
          }
          if (command === 'cmd_move_files') return null;
          if (command === 'cmd_revoke_share') return null;
          if (command === 'cmd_get_cached_files') {
            return googleDriveService.getFiles(args.folderId ?? null);
          }
          if (command === 'cmd_get_files') {
            const folderId = args.folderId ?? null;
            const files = googleDriveService.getFiles(folderId);
            return {
              ownerId: args.ownerId || googleDriveService.getUser().email,
              folderId: folderId,
              requestId: args.requestId || 'req-gdrive',
              files: files,
              complete: true,
            };
          }
          if (command === 'cmd_create_folder') {
            return googleDriveService.createFolder(args.name || 'Nova Pasta Google Drive');
          }
          if (command === 'cmd_get_preview') return null;
          if (command === 'cmd_delete_preview_for_message') return null;
          if (command === 'cmd_set_preview_pinned') return null;
          if (command === 'cmd_clean_preview_cache') return null;
          if (command === 'cmd_clean_cache') return null;
          if (command === 'cmd_delete_temp_zip') return null;
          if (command === 'cmd_open_file_externally') return null;
          if (command === 'cmd_set_file_activity_flag') return null;
          if (command === 'cmd_record_file_opened') return null;
          if (command === 'cmd_set_transcode_cache_limit') return null;
          if (command === 'cmd_set_preview_cache_limit') return null;
          if (command === 'cmd_cleanup_schedule') return null;
          if (command === 'cmd_cleanup_list') return [];
          if (command === 'cmd_cleanup_restore') return null;
          if (command === 'cmd_offline_pack_path') return null;
          if (command === 'cmd_remove_cached_path') return null;
          if (command === 'cmd_delete_android_staged_upload') return null;
          if (command === 'cmd_open_android_stream_player') return null;
          if (command === 'cmd_start_foreground_service') return null;
          if (command === 'cmd_stop_foreground_service') return null;
          if (command === 'cmd_update_foreground_service') return null;
          if (command === 'cmd_configure_android_transfer_recovery') return null;
          if (command === 'cmd_transfer_set_limits') return null;
          if (command === 'cmd_transfer_supply_prompt_token') return null;
          if (command === 'cmd_workspace_cancel_asset') return null;

          // Folder / group ordering
          if (command === 'cmd_update_folder_order') return null;
          if (command === 'cmd_update_group_order') return null;
          if (command === 'cmd_update_group') return null;
          if (command === 'cmd_assign_folder_to_group') return null;

          // Vault operations — not available in web preview
          if (command === 'cmd_create_vault') throw new Error('Vault indisponível no modo web.');
          if (command === 'cmd_lock_vault') return null;
          if (command === 'cmd_change_vault_passphrase') throw new Error('Vault indisponível no modo web.');
          if (command === 'cmd_import_vault_recovery') throw new Error('Vault indisponível no modo web.');
          if (command === 'cmd_record_vault_activity') return null;
          if (command === 'cmd_set_desktop_lock_on_sleep') return null;

          // Storage / device
          if (command === 'cmd_storage_read') {
            const quota = googleDriveService.getQuota();
            return {
              ownerId: googleDriveService.getUser().email,
              categories: [
                { id: 'google_drive', name: 'Google Drive Cloud Storage', bytes: quota.used, total: quota.total },
              ],
            };
          }
          if (command === 'cmd_storage_clear') return null;
          if (command === 'cmd_storage_limits') return null;

          // Settings sync
          if (command === 'cmd_upload_settings_sync') return null;
          if (command === 'cmd_download_settings_sync') return null;

          // Proxy
          if (command === 'cmd_apply_proxy_settings') return null;
          if (command === 'cmd_clear_proxy_secret') return null;
          if (command === 'cmd_clear_api_hash') return null;

          // Crash / crash reporting
          if (command === 'cmd_submit_crash_report') return null;

          // Locale
          if (command === 'cmd_set_native_language') return null;

          // Auth wizard commands in web preview
          if (command === 'cmd_auth_qr_login') return 'tg://login?token=web-preview-mock-token';
          if (command === 'cmd_auth_qr_poll') return { success: false };
          if (command === 'cmd_auth_request_code') {
            return { status: 'code_required', delivery: 'telegram_app', codeLength: 5, numericCode: true };
          }
          if (command === 'cmd_auth_sign_in') return { success: false, next_step: 'password' };
          if (command === 'cmd_auth_check_password') return { success: true };

          // Transfer list (new API names)
          if (command === 'cmd_transfer_list') return [];
          if (command === 'cmd_transfer_activity') return [];
          if (command === 'cmd_transfer_clear_terminal') return null;
          if (command === 'cmd_transfer_adopt_legacy') return null;
          if (command === 'cmd_transfer_discard_legacy') return null;
          if (command === 'cmd_transfer_enqueue_many') return null;

          // Folder / file creation & sharing
          if (command === 'cmd_create_folder') return null;
          if (command === 'cmd_create_group') return null;
          if (command === 'cmd_get_groups') return [];
          if (command === 'cmd_toggle_folder_visibility') return null;
          if (command === 'cmd_create_share') return null;
          if (command === 'cmd_list_shares') return [];
          if (command === 'cmd_export_folder_invite') return null;
          if (command === 'cmd_validate_dropped_paths') return [];
          if (command === 'cmd_zip_folder') return null;
          if (command === 'cmd_stage_android_upload') return null;
          if (command === 'cmd_stage_file_passphrase') return null;

          // Encryption
          if (command === 'cmd_get_encryption_capabilities') return { supported: false };
          if (command === 'cmd_get_encryption_settings') return { mode: 'none', keyId: null };
          if (command === 'cmd_update_encryption_settings') return null;
          if (command === 'cmd_get_crypto_inventory') return { keys: [] };
          if (command === 'cmd_get_file_encryption_info') return null;
          if (command === 'cmd_generate_recovery_key') return null;
          if (command === 'cmd_get_vault_status') return { locked: true, available: false };
          if (command === 'cmd_unlock_vault') throw new Error('Vault indisponível no modo web.');
          if (command === 'cmd_export_vault_recovery') return null;
          if (command === 'cmd_verify_vault_recovery') return null;

          // Transcode / streaming
          if (command === 'cmd_get_transcode_capabilities') return { supported: false };
          if (command === 'cmd_get_detailed_transcode_cache') return { entries: [], totalBytes: 0 };
          if (command === 'cmd_clear_transcode_cache') return null;
          if (command === 'cmd_prepare_transcoded_stream') return null;
          if (command === 'cmd_get_stream_info') return null;
          if (command === 'cmd_get_master_playlist_info') return null;
          if (command === 'cmd_get_video_metadata') return null;
          if (command === 'cmd_get_thumbnail') return null;
          if (command === 'cmd_get_display_preview') return null;
          if (command === 'cmd_get_android_playback_history') return [];
          if (command === 'cmd_playback_read') return null;
          if (command === 'cmd_playback_mutate') return null;

          // Offline packs
          if (command === 'cmd_offline_packs_list') return [];
          if (command === 'cmd_offline_pack_create') return null;
          if (command === 'cmd_offline_pack_action') return null;
          if (command === 'cmd_get_offline_cache_status') return { available: false };
          if (command === 'cmd_get_offline_files') return [];
          if (command === 'cmd_list_cached_files') return [];
          if (command === 'cmd_get_cached_files') return [];
          if (command === 'cmd_get_cached_variants') return [];

          // Archive / extract
          if (command === 'cmd_list_archive_contents') return { entries: [] };
          if (command === 'cmd_extract_archive_entry') return null;

          // Workspace (rich file ops)
          if (command === 'cmd_workspace_index') return null;
          if (command === 'cmd_workspace_read') return null;
          if (command === 'cmd_workspace_mutate') return null;
          if (command === 'cmd_workspace_asset') return null;

          // Proxy / network
          if (command === 'cmd_reconnect_with_network_settings') return null;
          if (command === 'cmd_get_proxy_status') return { active: false };
          if (command === 'cmd_test_proxy_traffic') return { success: false };

          // Sync
          if (command === 'cmd_add_sync_pair') return null;
          if (command === 'cmd_remove_sync_pair') return null;
          if (command === 'cmd_update_sync_pair') return null;
          if (command === 'cmd_preview_sync_pair') return null;
          if (command === 'cmd_set_sync_pair_active') return null;
          if (command === 'cmd_set_sync_scanner') return null;
          if (command === 'cmd_toggle_sync') return null;
          if (command === 'cmd_get_sync_conflicts') return [];
          if (command === 'cmd_resolve_conflict') return null;

          // API settings / WebDAV
          if (command === 'cmd_get_api_settings') return {};
          if (command === 'cmd_update_api_settings') return null;
          if (command === 'cmd_get_webdav_settings') return { enabled: false };
          if (command === 'cmd_update_webdav_settings') return null;
          if (command === 'cmd_regenerate_webdav_token') return null;
          if (command === 'cmd_regenerate_api_key') return null;

          // Storage insight / quota
          if (command === 'cmd_get_storage_insight') {
            const quota = googleDriveService.getQuota();
            const allFiles = googleDriveService.getAllFiles();
            return {
              files: allFiles,
              complete: true,
              scanned_count: allFiles.length,
              duplicate_groups: 0,
              used: quota.used,
              total: quota.total,
            };
          }
          if (command === 'cmd_set_weekly_quota') return null;

          // System diagnostics
          if (command === 'cmd_get_system_diagnostics') return { entries: [] };

          // File activity
          if (command === 'cmd_get_file_activity') return [];

          // Auth extras
          if (command === 'cmd_auth_cancel_code') return null;
          if (command === 'cmd_auth_resend_code') return { status: 'code_required', delivery: 'telegram_app', codeLength: 5, numericCode: true };

          // Dialog / opener / shell mocks
          if (command === 'plugin:opener|open_url' || command === 'plugin:shell|open') {
            if (typeof window !== 'undefined' && (args.path || args.url)) {
              window.open(args.path || args.url, '_blank', 'noopener,noreferrer');
            }
            return true;
          }

          // Unknown command — throw so .catch() handlers in the app handle it
          // gracefully instead of receiving null and crashing on property access.
          console.warn(`[web-fallback] Unhandled invoke command: ${command}`, args);
          throw new Error(`[web-preview] Command not available in browser: ${command}`);
        },
      };
    }
  }
}

export {};
