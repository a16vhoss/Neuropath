import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

const AuthPage: React.FC = () => {
    const navigate = useNavigate();
    const { signIn, signUp, loading, user, profile } = useAuth();

    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'ok' | 'error'>('checking');
    const [connectionErrorDetails, setConnectionErrorDetails] = useState('');

    useEffect(() => {
        if (user && profile) {
            navigate(profile.role === 'teacher' ? '/teacher' : '/student', { replace: true });
        }
    }, [user, profile, navigate]);

    // Diagnostic check for Supabase connection
    useEffect(() => {
        const checkConnection = async () => {
            try {
                // Method 1: Simple fetch to seeing if domain resolves/reachable (expecting 404 but connection success)
                const url = import.meta.env.VITE_SUPABASE_URL;
                console.log('Testing connection to:', url);

                try {
                    await fetch(url + '/rest/v1/', { method: 'HEAD', headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY } });
                    setConnectionStatus('ok');
                } catch (fetchErr: any) {
                    console.error('Fetch check failed:', fetchErr);
                    setConnectionStatus('error');
                    setConnectionErrorDetails(`Browser blocked connection to Supabase. Check AdBlocker/Firewall. (${fetchErr.message})`);
                }
            } catch (err: any) {
                setConnectionStatus('error');
                setConnectionErrorDetails(err.message);
            }
        };

        checkConnection();
    }, []);

    const [isLogin, setIsLogin] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<'student' | 'teacher'>('student');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setSubmitting(true);

        const cleanEmail = email.trim().toLowerCase();
        const cleanPassword = password.trim();
        const cleanConfirmPassword = confirmPassword.trim();
        const cleanFullName = fullName.trim();

        if (!isLogin && cleanPassword !== cleanConfirmPassword) {
            setError('Las contraseñas no coinciden');
            setSubmitting(false);
            return;
        }

        if (!isLogin && cleanPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            setSubmitting(false);
            return;
        }

        try {
            // Add timeout to prevent infinite loading
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('La solicitud tardó demasiado. Verifica tu conexión e inténtalo de nuevo.')), 15000)
            );

            if (isLogin) {
                await Promise.race([signIn(cleanEmail, cleanPassword), timeoutPromise]);
                // Navigation is handled by useEffect when user/profile changes
            } else {
                await Promise.race([signUp(cleanEmail, cleanPassword, cleanFullName, role), timeoutPromise]);
                setSuccess('¡Cuenta creada! Ya puedes iniciar sesión.');
                setIsLogin(true);
            }
        } catch (err: any) {
            console.error('Auth error:', err);
            let message = err.message || 'Error al procesar la solicitud';
            if (message.includes('Failed to fetch')) {
                message = 'Error de conexión. Verifica tu internet o si un AdBlocker está bloqueando Supabase.';
            }
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });
            if (error) throw error;
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión con Google');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center gradient-hero p-4">
            <div className="max-w-md w-full">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-white text-4xl">neurology</span>
                        <span className="font-extrabold text-3xl tracking-tighter text-white">MHS</span>
                    </div>
                    <p className="text-blue-100">Aprende más inteligente, no más duro</p>
                </div>

                {/* Auth Card */}
                <div className="bg-white rounded-3xl shadow-2xl p-8">
                    {/* Connection Error Banner */}
                    {connectionStatus === 'error' && (
                        <div className="bg-rose-100 border-l-4 border-rose-500 text-rose-700 p-4 mb-6 rounded-r" role="alert">
                            <p className="font-bold">Error de Conexión Detectado</p>
                            <p className="text-sm">{connectionErrorDetails}</p>
                            <p className="text-xs mt-2 italic">Intenta desactivar AdBlockers o VPNs.</p>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-8">
                        <button
                            onClick={() => setIsLogin(true)}
                            className={`flex-1 py-3 rounded-lg font-bold transition-all ${isLogin ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
                                }`}
                        >
                            Iniciar Sesión
                        </button>
                        <button
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-3 rounded-lg font-bold transition-all ${!isLogin ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
                                }`}
                        >
                            Registrarse
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!isLogin && (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Nombre Completo</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Juan Pérez"
                                    required={!isLogin}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Correo Electrónico</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@correo.com"
                                required
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Contraseña</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none pr-12"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                                >
                                    <span className="material-symbols-outlined select-none">
                                        {showPassword ? 'visibility' : 'visibility_off'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {!isLogin && (
                            <>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Confirmar Contraseña</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required={!isLogin}
                                        minLength={6}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-3">Soy...</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setRole('student')}
                                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${role === 'student'
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-2xl">school</span>
                                            <span className="font-bold">Estudiante</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRole('teacher')}
                                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${role === 'teacher'
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-2xl">person</span>
                                            <span className="font-bold">Profesor</span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {error && (
                            <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-sm flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">error</span>
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl text-sm flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">check_circle</span>
                                {success}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <span className="animate-spin material-symbols-outlined">progress_activity</span>
                                    Procesando...
                                </>
                            ) : isLogin ? (
                                'Iniciar Sesión'
                            ) : (
                                'Crear Cuenta'
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-slate-200"></div>
                        <span className="text-slate-400 text-sm">o continúa con</span>
                        <div className="flex-1 h-px bg-slate-200"></div>
                    </div>

                    {/* Social Login */}
                    <div className="grid grid-cols-1 gap-4">
                        <button
                            onClick={handleGoogleLogin}
                            type="button"
                            className="flex items-center justify-center gap-2 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            <span className="font-medium text-slate-700">Continuar con Google</span>
                        </button>
                    </div>

                    {/* Footer */}
                    {isLogin && (
                        <p className="text-center text-sm text-slate-500 mt-6">
                            <button className="text-primary font-medium hover:underline">
                                ¿Olvidaste tu contraseña?
                            </button>
                        </p>
                    )}
                </div>

                {/* Back to Home */}
                <button
                    onClick={() => navigate('/')}
                    className="w-full mt-6 text-blue-100 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                    Volver al inicio
                </button>
            </div>
        </div>
    );
};

export default AuthPage;
