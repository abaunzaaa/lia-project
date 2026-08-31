import { useTheme } from '../../context/ThemeContext';

export function useMedicationFormColors() {
  const { colors, isDark, isHighContrast } = useTheme();
  const light = !isDark && !isHighContrast;
  return {
    page: light ? '#FFFFFF' : colors.background,
    navy: light ? '#173B59' : colors.textPrimary,
    navyMain: light ? '#245C86' : colors.primary,
    ice: light ? '#EAF5FB' : colors.surfaceElevated,
    pastel: light ? '#D7EAF4' : colors.primaryLight,
    teal: light ? '#6FAFA7' : colors.secondary,
    secondary: light ? '#527181' : colors.textSecondary,
    border: isHighContrast ? colors.border : light ? '#DCE8EE' : colors.border,
    coral: light ? '#B85F52' : colors.error,
    card: light ? '#FFFFFF' : colors.surface,
    onPrimary: colors.onPrimary,
    primary: colors.primary,
    textPrimary: colors.textPrimary,
    isHighContrast,
    isDark,
    light,
    borderWidth: isHighContrast ? 2 : 1,
  };
}
