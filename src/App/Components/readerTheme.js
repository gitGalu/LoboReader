import { DarkTheme } from 'baseui';

// Base Web theme for everything drawn over the (black) reader. Base Web's dark
// theme is black and white except for a blue accent used in focus rings;
// LoboReader's UI is monochrome, so that accent becomes grey too.
const readerTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    accent: '#E2E2E2',
    borderAccent: 'rgba(226, 226, 226, 0.7)'
  }
};

export default readerTheme;
