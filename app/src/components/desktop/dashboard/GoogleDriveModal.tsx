import { useState, useEffect } from 'react';
import { Cloud, HardDrive, Key, X, ExternalLink, RefreshCw, LogOut, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { googleDriveService, type GoogleDriveUser } from '../../../services/googleDriveService';
import { formatBytes } from '../../../utils';

interface GoogleDriveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccountChanged?: () => void;
}

export function GoogleDriveModal({ isOpen, onClose, onAccountChanged }: GoogleDriveModalProps) {
    const [user, setUser] = useState<GoogleDriveUser>(() => googleDriveService.getUser());
    const [quota, setQuota] = useState(() => googleDriveService.getQuota());
    const [mode, setMode] = useState(() => googleDriveService.getMode());
    const [clientId, setClientId] = useState(() => {
        try {
            return localStorage.getItem('gdrive_client_id') || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
        } catch {
            return '';
        }
    });
    const [token, setToken] = useState('');
    const [customAccountEmail, setCustomAccountEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        const update = () => {
            setUser(googleDriveService.getUser());
            setQuota(googleDriveService.getQuota());
            setMode(googleDriveService.getMode());
        };
        const unsub = googleDriveService.subscribe(update);
        return () => unsub();
    }, []);

    if (!isOpen) return null;

    const percentUsed = Math.min((quota.used / quota.total) * 100, 100);

    const handleOAuthConnect = async () => {
        if (!clientId.trim()) {
            toast.error('Informe o seu Google OAuth Client ID abaixo.');
            return;
        }
        setLoading(true);
        try {
            localStorage.setItem('gdrive_client_id', clientId.trim());
            const res = await googleDriveService.requestGoogleAuth(clientId.trim());
            if (res.success) {
                toast.success('Conta Google conectada com sucesso!');
                onAccountChanged?.();
            } else {
                toast.error(res.error || 'Erro na autenticação do Google.');
            }
        } catch (e: any) {
            toast.error(e?.message || 'Falha ao conectar.');
        } finally {
            setLoading(false);
        }
    };

    const handleTokenConnect = async () => {
        if (!token.trim()) {
            toast.error('Informe um token de acesso válido.');
            return;
        }
        setLoading(true);
        try {
            googleDriveService.setAccessToken(token.trim(), {
                email: customAccountEmail.trim() || 'google.pro@gmail.com',
                name: 'Conta Google Pro (5 TB)',
            });
            toast.success('Token do Google Drive configurado!');
            setToken('');
            onAccountChanged?.();
        } catch (e: any) {
            toast.error(e?.message || 'Erro ao salvar token.');
        } finally {
            setLoading(false);
        }
    };

    const handleSetQuota = (terabytes: number) => {
        const bytes = terabytes * 1024 * 1024 * 1024 * 1024;
        googleDriveService.setQuotaLimit(bytes);
        setQuota(googleDriveService.getQuota());
        toast.success(`Cota configurada para ${terabytes} TB.`);
        onAccountChanged?.();
    };

    const handleDisconnect = () => {
        googleDriveService.disconnect();
        toast.info('Desconectado do Google Drive (Modo Demonstração ativado).');
        onAccountChanged?.();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div 
                className="quiet-raised relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-app-border bg-app-surface text-app-text shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-app-border px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/20">
                            <Cloud className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-app-text flex items-center gap-2">
                                Google Drive Cloud
                                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-badge font-medium text-blue-400 border border-blue-500/30">
                                    5 TB Pro
                                </span>
                            </h2>
                            <p className="text-xs text-app-text-secondary">
                                Gerenciamento de conta e armazenamento em nuvem
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="quiet-control rounded-lg p-1.5 text-app-text-tertiary hover:text-app-text hover:bg-app-surface-sunken"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-sm">
                    {/* Status do Armazenamento */}
                    <div className="rounded-xl border border-app-border bg-app-surface-sunken/40 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <HardDrive className="h-4 w-4 text-app-accent" />
                                <span className="font-medium text-app-text">Armazenamento em Nuvem</span>
                            </div>
                            <span className="text-xs font-medium text-app-text-secondary">
                                {formatBytes(quota.used)} de {formatBytes(quota.total)} ({percentUsed.toFixed(1)}%)
                            </span>
                        </div>

                        {/* Barra de Progresso */}
                        <div className="h-2 w-full overflow-hidden rounded-full bg-app-border/80">
                            <div 
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-app-accent transition-all duration-500"
                                style={{ width: `${percentUsed}%` }}
                            />
                        </div>

                        {/* Seleção rápida de cota do plano */}
                        <div className="flex items-center justify-between pt-1 text-xs text-app-text-secondary">
                            <span>Ajustar cota contratada:</span>
                            <div className="flex gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => handleSetQuota(5)}
                                    className={`px-2 py-0.5 rounded border text-badge font-semibold transition ${quota.total >= 5 * 1024 ** 4 ? 'bg-app-accent text-app-accent-contrast border-app-accent' : 'border-app-border bg-app-surface hover:bg-app-surface-sunken'}`}
                                >
                                    5 TB (Pro)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSetQuota(2)}
                                    className={`px-2 py-0.5 rounded border text-badge font-medium transition ${quota.total >= 2 * 1024 ** 4 && quota.total < 5 * 1024 ** 4 ? 'bg-app-accent text-app-accent-contrast border-app-accent' : 'border-app-border bg-app-surface hover:bg-app-surface-sunken'}`}
                                >
                                    2 TB
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSetQuota(0.0146484375)} // 15 GB
                                    className={`px-2 py-0.5 rounded border text-badge font-medium transition ${quota.total < 100 * 1024 ** 3 ? 'bg-app-accent text-app-accent-contrast border-app-accent' : 'border-app-border bg-app-surface hover:bg-app-surface-sunken'}`}
                                >
                                    15 GB (Grátis)
                                </button>
                            </div>
                        </div>

                        <div className="border-t border-app-border/50 pt-2 flex items-center justify-between text-xs">
                            <span className="text-app-text-secondary">Conta conectada:</span>
                            <span className="font-medium text-app-text truncate max-w-[280px]">
                                {user.email} {mode === 'demo' ? '(Modo Demonstração)' : '(Google OAuth)'}
                            </span>
                        </div>
                    </div>

                    {/* Método 1: Conexão via Google OAuth */}
                    <div className="rounded-xl border border-app-border bg-app-surface-raised p-4 space-y-3">
                        <div className="flex items-center gap-2 font-medium text-app-text">
                            <Key className="h-4 w-4 text-blue-400" />
                            <span>1. Conectar via Google OAuth (Recomendado)</span>
                        </div>
                        <p className="text-xs text-app-text-secondary leading-relaxed">
                            Conecta diretamente com sua conta Google oficial (Google One / Google Workspace 5 TB).
                        </p>

                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-app-text-secondary">Google OAuth Client ID:</label>
                            <input
                                type="text"
                                value={clientId}
                                onChange={e => setClientId(e.target.value)}
                                placeholder="ex: 123456789-xxxxxx.apps.googleusercontent.com"
                                className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs text-app-text outline-none focus:border-app-accent"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleOAuthConnect}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-blue-500 transition disabled:opacity-50"
                        >
                            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
                            <span>Entrar com Conta Google (OAuth)</span>
                        </button>
                    </div>

                    {/* Método 2: Conexão via Token Direto */}
                    <div className="rounded-xl border border-app-border bg-app-surface-raised p-4 space-y-3">
                        <div className="flex items-center gap-2 font-medium text-app-text">
                            <Sparkles className="h-4 w-4 text-emerald-400" />
                            <span>2. Conectar com Token de Acesso (Bearer Token)</span>
                        </div>
                        <p className="text-xs text-app-text-secondary leading-relaxed">
                            Útil para conectar contas corporativas ou tokens temporários sem configurar OAuth no Google Console.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-medium text-app-text-secondary mb-1">Email da Conta:</label>
                                <input
                                    type="email"
                                    value={customAccountEmail}
                                    onChange={e => setCustomAccountEmail(e.target.value)}
                                    placeholder="suaconta@gmail.com"
                                    className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs text-app-text outline-none focus:border-app-accent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-app-text-secondary mb-1">Token de Acesso:</label>
                                <input
                                    type="password"
                                    value={token}
                                    onChange={e => setToken(e.target.value)}
                                    placeholder="ya29.a0..."
                                    className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs text-app-text outline-none focus:border-app-accent"
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleTokenConnect}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 rounded-lg border border-app-border bg-app-surface px-4 py-2 text-xs font-medium text-app-text hover:bg-app-surface-sunken transition disabled:opacity-50"
                        >
                            <span>Salvar e Conectar Token</span>
                        </button>
                    </div>

                    {/* Guia Rápido de Configuração */}
                    <div className="border-t border-app-border/60 pt-3">
                        <button
                            type="button"
                            onClick={() => setShowHelp(!showHelp)}
                            className="text-xs text-app-text-secondary hover:text-app-text flex items-center justify-between w-full font-medium"
                        >
                            <span className="flex items-center gap-1.5 text-blue-400">
                                <ExternalLink className="h-3.5 w-3.5" />
                                Como obter meu Google Client ID no Google Cloud Console?
                            </span>
                            <span>{showHelp ? '▲' : '▼'}</span>
                        </button>

                        {showHelp && (
                            <div className="mt-3 space-y-2 rounded-lg border border-app-border bg-app-surface-sunken/40 p-3.5 text-xs text-app-text-secondary leading-relaxed">
                                <p className="font-semibold text-app-text">Passo a passo (leva 2 minutos):</p>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>Acesse o <strong>console.cloud.google.com</strong> com sua conta Google Pro de 5 TB.</li>
                                    <li>Crie um novo projeto (ex: <em>Telegram Drive Pro</em>).</li>
                                    <li>Em <strong>APIs e Serviços</strong> &gt; <strong>Biblioteca</strong>, pesquise e ative a <strong>Google Drive API</strong>.</li>
                                    <li>Em <strong>Credenciais</strong> &gt; <strong>Criar Credenciais</strong> &gt; <strong>ID do cliente OAuth</strong>:
                                        <ul className="list-disc list-inside ps-4 pt-1">
                                            <li>Tipo: <em>Aplicativo da Web</em></li>
                                            <li>Origens JavaScript autorizadas: <code>https://telegram-drive-app.vercel.app</code></li>
                                        </ul>
                                    </li>
                                    <li>Copie o <strong>Client ID</strong> gerado, cole no campo acima e clique em <strong>Entrar com Conta Google</strong>.</li>
                                </ol>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-app-border px-6 py-3.5 bg-app-surface-sunken/30">
                    <button
                        type="button"
                        onClick={handleDisconnect}
                        className="flex items-center gap-1.5 text-xs text-app-danger hover:underline font-medium"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Desconectar / Voltar para Demo</span>
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="quiet-control rounded-lg bg-app-accent px-4 py-2 text-xs font-semibold text-app-accent-contrast shadow hover:opacity-90"
                    >
                        Concluído
                    </button>
                </div>
            </div>
        </div>
    );
}
