/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'barchart-bg': '#ffffff',
                'barchart-border': '#e0e0e0',
                'barchart-text': '#333333',
                'candle-up': '#ffffff',
                'candle-down': '#000000',
                'candle-border-up': '#000000',
                'candle-border-down': '#000000',
                'bollinger-fill': 'rgba(144, 238, 144, 0.2)',
                'volume-up': '#26a69a',
                'volume-down': '#ef5350',
            },
            fontFamily: {
                'sans': ['Inter', 'sans-serif'], // Approximate match for clean UI
            }
        },
    },
    plugins: [],
}
