/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  // THIS IS THE MISSING LINK:
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        'outfit': ['Outfit_400Regular'],
        'outfit-medium': ['Outfit_500Medium'],
        'outfit-semibold': ['Outfit_600SemiBold'],
        'outfit-bold': ['Outfit_700Bold'],
        'outfit-black': ['Outfit_900Black'],
      },
      colors: {
        'darkGreen': "#2A2224",
        'logoGreen': "#E67A90",
        'lightGreen': "#EEEAE6",
        'lightGray': "#FBFAF7",
        'borderColor': "#DDD6D1",
        'accent': "#E67A90",
        'accentDark': "#CF5E78",
      }
    },
  },
  plugins: [],
}