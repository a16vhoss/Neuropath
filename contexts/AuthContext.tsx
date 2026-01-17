import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, signIn, signUp, signOut, getProfile } from '../services/supabaseClient';
import type { User } from '@supabase/supabase-js';

interface Profile {
    id: string;
    email: string;
    full_name: string;
    role: 'student' | 'teacher' | 'institution';
    avatar_url?: string;
    xp: number;
    level: number;
    streak_days: number;
    last_study_date?: string;
}

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, fullName: string, role: 'student' | 'teacher') => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshProfile = async () => {
        if (!user) return;
        try {
            const profileData = await getProfile(user.id);
            setProfile(profileData);
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };

    useEffect(() => {
        let mounted = true;

        // Safety timeout to prevent infinite loading screen
        const safetyTimeout = setTimeout(() => {
            if (mounted && loading) {
                console.warn("Auth check timed out, forcing app load");
                setLoading(false);
            }
        }, 3000);

        // Listen for auth changes - this fires immediately with INITIAL_SESSION
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state change:', event, session?.user?.email);

            if (!mounted) return;

            // Clear timeout since we got a response
            clearTimeout(safetyTimeout);

            setUser(session?.user ?? null);

            if (session?.user) {
                try {
                    // Race condition: Timeout after 5s if DB is stuck
                    const profilePromise = getProfile(session.user.id);
                    const timeoutPromise = new Promise<null>((resolve) =>
                        setTimeout(() => resolve(null), 5000)
                    );

                    const profileData = await Promise.race([profilePromise, timeoutPromise]);

                    if (mounted) {
                        if (profileData) {
                            setProfile(profileData);
                        } else {
                            console.warn("Profile fetch timed out or returned null");
                        }
                    }
                } catch (error) {
                    console.error('Error fetching profile:', error);
                }
            } else {
                setProfile(null);
            }

            // Set loading to false after the auth state check
            if (mounted) setLoading(false);
        });

        return () => {
            mounted = false;
            clearTimeout(safetyTimeout);
            subscription.unsubscribe();
        };
    }, []);

    const handleSignIn = async (email: string, password: string) => {
        setLoading(true);
        try {
            await signIn(email, password);
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async (email: string, password: string, fullName: string, role: 'student' | 'teacher') => {
        setLoading(true);
        try {
            await signUp(email, password, fullName, role);
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        setLoading(true);
        try {
            await signOut();
            setProfile(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            loading,
            signIn: handleSignIn,
            signUp: handleSignUp,
            signOut: handleSignOut,
            refreshProfile
        }}>
            {children}
        </AuthContext.Provider>
    );
};
