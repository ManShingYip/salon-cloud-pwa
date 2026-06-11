/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    './node_modules/flowbite-react/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#E8D5DA',
          DEFAULT: '#C88EA7',
          dark: '#9B6B82',
        },
        surface: '#FFFFFF',
        bg: '#FEFAF6',
        text: {
          DEFAULT: '#3D2C33',
          muted: '#8B7E82',
        },
        success: '#6B9B7D',
        warning: '#D4A574',
        danger: '#D4736A',
        info: '#7B9CB5',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(61,44,51,0.06)',
        modal: '0 8px 32px rgba(61,44,51,0.12)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang TC"',
          '"SF Pro Text"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [
    require('flowbite/plugin'),
  ],
};
