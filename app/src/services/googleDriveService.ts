import type { TelegramFolder, TelegramFile } from '../types';
import { formatBytes } from '../utils';

export interface GoogleDriveUser {
    email: string;
    name: string;
    picture?: string;
}

export interface GoogleDriveQuota {
    used: number;
    total: number;
}

const GDRIVE_STORAGE_KEY = 'telegram_drive_gdrive_state';
const GDRIVE_TOKEN_KEY = 'telegram_drive_gdrive_token';
const GDRIVE_USER_KEY = 'telegram_drive_gdrive_user';

interface StoredGDriveFile {
    id: number;
    googleFileId?: string;
    name: string;
    size: number;
    mime_type: string;
    folder_id: number | null;
    created_at: string;
    dataUrl?: string;
    webContentLink?: string;
}

interface StoredGDriveState {
    mode: 'demo' | 'oauth';
    folders: TelegramFolder[];
    files: StoredGDriveFile[];
    quota: GoogleDriveQuota;
    nextId: number;
}

const INITIAL_DEMO_FOLDERS: TelegramFolder[] = [
    { id: 101, name: '📄 Documentos' },
    { id: 102, name: '🖼️ Imagens & Mídias' },
    { id: 103, name: '🚀 Projetos Nuvem' },
    { id: 104, name: '💾 Backups Google Drive' },
];

const INITIAL_DEMO_FILES: StoredGDriveFile[] = [
    {
        id: 201,
        name: 'Relatório_Trimestral.pdf',
        size: 1024 * 1024 * 2.4, // 2.4 MB
        mime_type: 'application/pdf',
        folder_id: 101,
        created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    },
    {
        id: 202,
        name: 'Planilha_Orcamento_2026.xlsx',
        size: 1024 * 480, // 480 KB
        mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        folder_id: 101,
        created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    },
    {
        id: 203,
        name: 'Banner_Apresentacao.png',
        size: 1024 * 1024 * 1.8, // 1.8 MB
        mime_type: 'image/png',
        folder_id: 102,
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    },
    {
        id: 204,
        name: 'Wallpaper_4k.webp',
        size: 1024 * 1024 * 3.2,
        mime_type: 'image/webp',
        folder_id: 102,
        created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    },
    {
        id: 205,
        name: 'Arquitetura_Telegram_Drive.md',
        size: 1024 * 16,
        mime_type: 'text/markdown',
        folder_id: 103,
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
        id: 206,
        name: 'database_dump_2026.tar.gz',
        size: 1024 * 1024 * 18.5,
        mime_type: 'application/gzip',
        folder_id: 104,
        created_at: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
    },
];

class GoogleDriveService {
    private state: StoredGDriveState;
    private accessToken: string | null = null;
    private currentUser: GoogleDriveUser | null = null;
    private listeners = new Set<() => void>();

    constructor() {
        this.state = this.loadState();
        this.accessToken = this.loadToken();
        this.currentUser = this.loadUser();
    }

    private loadState(): StoredGDriveState {
        try {
            const raw = localStorage.getItem(GDRIVE_STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch {}
        return {
            mode: 'demo',
            folders: [...INITIAL_DEMO_FOLDERS],
            files: [...INITIAL_DEMO_FILES],
            quota: {
                used: INITIAL_DEMO_FILES.reduce((acc, f) => acc + f.size, 0),
                total: 1024 * 1024 * 1024 * 15, // 15 GB padrão gratuito do Google Drive
            },
            nextId: 300,
        };
    }

    private saveState(): void {
        try {
            localStorage.setItem(GDRIVE_STORAGE_KEY, JSON.stringify(this.state));
            this.notify();
        } catch (e) {
            console.error('[GoogleDriveService] Failed to save state', e);
        }
    }

    private loadToken(): string | null {
        try {
            return localStorage.getItem(GDRIVE_TOKEN_KEY);
        } catch {
            return null;
        }
    }

    private loadUser(): GoogleDriveUser | null {
        try {
            const raw = localStorage.getItem(GDRIVE_USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    public subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        for (const listener of this.listeners) {
            try {
                listener();
            } catch {}
        }
    }

    public isConnected(): boolean {
        return this.state.mode === 'demo' || Boolean(this.accessToken);
    }

    public getMode(): 'demo' | 'oauth' {
        return this.state.mode;
    }

    public getUser(): GoogleDriveUser {
        if (this.currentUser) return this.currentUser;
        return {
            email: this.state.mode === 'oauth' ? 'usuario@gmail.com' : 'demo.googledrive@cloud.local',
            name: this.state.mode === 'oauth' ? 'Google Drive Cloud' : 'Google Drive (Modo Nuvem)',
        };
    }

    public getQuota(): GoogleDriveQuota {
        return this.state.quota;
    }

    public setDemoMode(): void {
        this.state.mode = 'demo';
        this.currentUser = {
            email: 'demo.googledrive@cloud.local',
            name: 'Google Drive (Modo Nuvem)',
        };
        try {
            localStorage.setItem(GDRIVE_USER_KEY, JSON.stringify(this.currentUser));
        } catch {}
        this.saveState();
    }

    public setAccessToken(token: string, user?: GoogleDriveUser): void {
        this.accessToken = token;
        this.state.mode = 'oauth';
        if (user) {
            this.currentUser = user;
            try {
                localStorage.setItem(GDRIVE_USER_KEY, JSON.stringify(user));
            } catch {}
        }
        try {
            localStorage.setItem(GDRIVE_TOKEN_KEY, token);
        } catch {}
        this.saveState();
        void this.syncFromGoogleDrive();
    }

    public disconnect(): void {
        this.accessToken = null;
        this.currentUser = null;
        try {
            localStorage.removeItem(GDRIVE_TOKEN_KEY);
            localStorage.removeItem(GDRIVE_USER_KEY);
        } catch {}
        this.setDemoMode();
    }

    /**
     * Sincroniza metadados reais da API v3 do Google Drive caso token OAuth esteja ativo.
     */
    public async syncFromGoogleDrive(): Promise<void> {
        if (!this.accessToken || this.state.mode !== 'oauth') return;

        try {
            // 1. Obter informações de cota e usuário
            const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota,user', {
                headers: { Authorization: `Bearer ${this.accessToken}` },
            });
            if (aboutRes.ok) {
                const aboutData = await aboutRes.json();
                if (aboutData.storageQuota) {
                    this.state.quota = {
                        used: parseInt(aboutData.storageQuota.usage || '0', 10),
                        total: parseInt(aboutData.storageQuota.limit || `${1024 * 1024 * 1024 * 15}`, 10),
                    };
                }
                if (aboutData.user) {
                    this.currentUser = {
                        email: aboutData.user.emailAddress,
                        name: aboutData.user.displayName,
                        picture: aboutData.user.photoLink,
                    };
                    try {
                        localStorage.setItem(GDRIVE_USER_KEY, JSON.stringify(this.currentUser));
                    } catch {}
                }
            }

            // 2. Obter pastas do Google Drive
            const foldersRes = await fetch(
                "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name,parents)&pageSize=50",
                { headers: { Authorization: `Bearer ${this.accessToken}` } }
            );
            if (foldersRes.ok) {
                const foldersData = await foldersRes.json();
                const fetchedFolders: TelegramFolder[] = (foldersData.files || []).map((f: any, idx: number) => ({
                    id: 1000 + idx,
                    name: f.name,
                }));
                if (fetchedFolders.length > 0) {
                    this.state.folders = fetchedFolders;
                }
            }

            this.saveState();
        } catch (e) {
            console.warn('[GoogleDriveService] Falha ao sincronizar com Google Drive API, usando dados locais', e);
        }
    }

    public getFolders(): TelegramFolder[] {
        return this.state.folders;
    }

    public getFiles(folderId: number | null): TelegramFile[] {
        const stored = this.state.files.filter(f => (folderId === null ? true : f.folder_id === folderId));
        return stored.map(f => this.toTelegramFile(f));
    }

    public getAllFiles(): TelegramFile[] {
        return this.state.files.map(f => this.toTelegramFile(f));
    }

    private toTelegramFile(f: StoredGDriveFile): TelegramFile {
        const ext = f.name.includes('.') ? f.name.split('.').pop() : '';
        return {
            id: f.id,
            name: f.name,
            size: f.size,
            sizeStr: formatBytes(f.size),
            type: 'file',
            folder_id: f.folder_id,
            mime_type: f.mime_type,
            file_ext: ext,
            created_at: f.created_at,
        };
    }

    public createFolder(name: string): TelegramFolder {
        const newFolder: TelegramFolder = {
            id: ++this.state.nextId,
            name,
        };
        this.state.folders.push(newFolder);
        this.saveState();

        // Se estiver em modo OAuth, dispara criação na API do Google Drive em background
        if (this.accessToken && this.state.mode === 'oauth') {
            void fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    mimeType: 'application/vnd.google-apps.folder',
                }),
            }).catch(err => console.error('[GoogleDrive] create folder API error:', err));
        }

        return newFolder;
    }

    public deleteFolder(folderId: number): void {
        this.state.folders = this.state.folders.filter(f => f.id !== folderId);
        this.state.files = this.state.files.filter(f => f.folder_id !== folderId);
        this.recalculateQuota();
        this.saveState();
    }

    public renameFolder(folderId: number, newName: string): void {
        const target = this.state.folders.find(f => f.id === folderId);
        if (target) {
            target.name = newName;
            this.saveState();
        }
    }

    public addFile(
        file: { name: string; size: number; mimeType?: string; dataUrl?: string },
        folderId: number | null
    ): TelegramFile {
        const newFile: StoredGDriveFile = {
            id: ++this.state.nextId,
            name: file.name,
            size: file.size,
            mime_type: file.mimeType || 'application/octet-stream',
            folder_id: folderId,
            created_at: new Date().toISOString(),
            dataUrl: file.dataUrl,
        };
        this.state.files.unshift(newFile);
        this.recalculateQuota();
        this.saveState();
        return this.toTelegramFile(newFile);
    }

    public deleteFile(fileId: number): void {
        this.state.files = this.state.files.filter(f => f.id !== fileId);
        this.recalculateQuota();
        this.saveState();
    }

    public renameFile(fileId: number, newName: string): void {
        const target = this.state.files.find(f => f.id === fileId);
        if (target) {
            target.name = newName;
            this.saveState();
        }
    }

    public getFile(fileId: number): StoredGDriveFile | undefined {
        return this.state.files.find(f => f.id === fileId);
    }

    private recalculateQuota(): void {
        this.state.quota.used = this.state.files.reduce((acc, f) => acc + f.size, 0);
    }

    /**
     * Inicia o fluxo de autorização OAuth do Google Drive via Google Identity Services
     */
    public requestGoogleAuth(clientId: string): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            if (typeof window === 'undefined') {
                return resolve({ success: false, error: 'Ambiente não suportado' });
            }

            const scriptId = 'google-identity-services-script';
            const loadGIS = (onLoaded: () => void) => {
                if (document.getElementById(scriptId)) {
                    onLoaded();
                    return;
                }
                const script = document.createElement('script');
                script.id = scriptId;
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.defer = true;
                script.onload = onLoaded;
                script.onerror = () => resolve({ success: false, error: 'Falha ao carregar Google Identity Services.' });
                document.head.appendChild(script);
            };

            loadGIS(() => {
                try {
                    const google = (window as any).google;
                    if (!google?.accounts?.oauth2) {
                        return resolve({ success: false, error: 'Google OAuth2 não disponível.' });
                    }

                    const tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: clientId,
                        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
                        callback: async (response: any) => {
                            if (response.error) {
                                resolve({ success: false, error: response.error });
                                return;
                            }
                            if (response.access_token) {
                                this.setAccessToken(response.access_token);
                                resolve({ success: true });
                            }
                        },
                    });

                    tokenClient.requestAccessToken({ prompt: 'consent' });
                } catch (err: any) {
                    resolve({ success: false, error: err?.message || 'Erro ao inicializar login Google' });
                }
            });
        });
    }
}

export const googleDriveService = new GoogleDriveService();
