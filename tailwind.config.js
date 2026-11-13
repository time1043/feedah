/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // The brand green (assets/logo.svg): the lime is the fill and always
        // sits under black text; the deep olive is its reading-on-white form.
        // Accent text is `text-accent-deep dark:text-accent`.
        accent: { DEFAULT: '#C5F36A', deep: '#55741E' },
        // The dark theme's filled-card background — the prototype's card
        // sitting on the black page. Light theme cards stay gray-100.
        surface: '#15171A',
      },
    },
  },
  plugins: [],
}
