import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1440px',
      },
    },
    extend: {
      colors: {
        brand: {
          navy: {
            50: '#F0F4F8',
            100: '#D9E2EC',
            200: '#BCCCDC',
            300: '#9FB3C8',
            400: '#627D98',
            500: '#486581',
            600: '#334E68',
            700: '#26345A',
            800: '#1C2541',
            850: '#111A38',
            900: '#0B132B', // Official Midnight Navy
            950: '#070B19', // Obsidian Night Background
          },
          cyan: {
            50: '#F0F9FF',
            100: '#E0F2FE',
            200: '#BAE6FD',
            300: '#7DD3FC',
            400: '#38BDF8',
            500: '#00C2FF', // Gradient Start
            600: '#00A3FF', // Official Electric Cyan Primary
            700: '#0084E0',
            800: '#0066FF', // Vibrant Royal Blue
            900: '#004DC7',
          },
          blue: {
            500: '#00A3FF',
            600: '#0084E0',
            700: '#0066FF',
          },
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      fontFamily: {
        sans: ['var(--font-cairo)', 'Cairo', 'system-ui', '-apple-system', 'sans-serif'],
        cairo: ['var(--font-cairo)', 'Cairo', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'soft-sm': '0 1px 3px rgba(11, 19, 43, 0.05)',
        'soft-md': '0 4px 16px -2px rgba(11, 19, 43, 0.08), 0 2px 6px -1px rgba(11, 19, 43, 0.03)',
        'soft-lg': '0 8px 24px -4px rgba(11, 19, 43, 0.10), 0 4px 12px -2px rgba(11, 19, 43, 0.05)',
        'soft-xl': '0 16px 36px -6px rgba(11, 19, 43, 0.12), 0 8px 18px -4px rgba(11, 19, 43, 0.06)',
        'cyan-glow': '0 0 20px -3px rgba(0, 163, 255, 0.35)',
        'dark-card': '0 4px 24px -2px rgba(0, 0, 0, 0.45), 0 2px 8px -1px rgba(0, 163, 255, 0.04)',
        'card-soft': '0 4px 20px -2px rgba(11, 19, 43, 0.05)',
        'card-elevated': '0 10px 25px -3px rgba(11, 19, 43, 0.1)',
        'glow-cyan': '0 0 20px -2px rgba(0, 194, 255, 0.35)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 15px rgba(0, 163, 255, 0.4)' },
          '50%': { opacity: '0.8', boxShadow: '0 0 5px rgba(0, 163, 255, 0.2)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'pulse-glow': 'pulse-glow 2s infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
