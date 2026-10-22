import { fontFamily } from 'tailwindcss/defaultTheme';
const config = {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                // ── STELLAR Design Tokens ──────────────────────────
                primary: {
                    DEFAULT: '#1D4ED8', // blue-700
                    hover: '#1E40AF',
                    soft: '#EFF6FF', // blue-50
                },
                accent: {
                    DEFAULT: '#0EA5E9', // sky-500
                },
                surface: '#F8FAFC',
                border: '#E2E8F0',
                text: {
                    DEFAULT: '#0F172A',
                    muted: '#64748B',
                },
                success: '#16A34A',
                warning: '#F59E0B',
                danger: '#DC2626',
            },
            fontFamily: {
                sans: ['Inter', ...fontFamily.sans],
            },
            fontSize: {
                // page title: 24px / 32px semibold
                'page-title': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
                // section title: 18px / 28px semibold
                'section-title': ['1.125rem', { lineHeight: '1.75rem', fontWeight: '600' }],
                // body: 14px / 20px
                body: ['0.875rem', { lineHeight: '1.25rem' }],
                // caption: 12px / 16px
                caption: ['0.75rem', { lineHeight: '1rem' }],
            },
            borderRadius: {
                xl: '0.75rem',
                '2xl': '1rem',
            },
            boxShadow: {
                card: '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
            },
            animation: {
                'shimmer': 'shimmer 1.5s infinite',
                'fade-in': 'fadeIn 0.2s ease-out',
                'slide-in-left': 'slideInLeft 0.25s ease-out',
            },
            keyframes: {
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(4px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideInLeft: {
                    '0%': { opacity: '0', transform: 'translateX(-8px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
            },
        },
    },
    plugins: [],
};
export default config;
