export const THEME_PRESETS = [
  {
    id: 'light',
    name: '浅色模式',
    darkVariant: 'dark',
    colors: {
      primary: '#0078d4',
      accent: '#0067c0',
      secondary: '#5c5c5c',
      sidebarBg: '#f3f3f3',
      sidebarText: '#1b1b1b',
      sidebarHover: 'rgba(0, 0, 0, 0.06)',
      sidebarActive: 'rgba(0, 0, 0, 0.12)',
      sidebarBorder: 'rgba(0, 0, 0, 0.08)',
      sidebarSearchBg: 'rgba(0, 0, 0, 0.05)',
      sidebarSearchHover: 'rgba(0, 0, 0, 0.10)',
      sidebarPlaceholder: 'rgba(0, 0, 0, 0.45)',
      sidebarIconHover: 'rgba(0, 0, 0, 0.10)',
      headerBg: '#f3f3f3',
      headerText: '#1b1b1b'
    }
  },
  {
    id: 'dark',
    name: '深色模式',
    darkSurfaces: true,
    darkVariant: 'dark',
    colors: {
      // Soft Dark Organic Minimalist — Nordic/Morandi
      primary: '#a8c3a7',      // 浅鼠尾草（图标/强调）
      accent: '#94b093',       // 柔鼠尾草（active/勾选/主按钮）
      accentDark: '#7c9a7c',   // hover 深一档
      secondary: '#a2aa9f',
      onAccent: '#171a18',     // 鼠尾草实底上的深墨文字（浅底深字对比）
      sidebarBg: '#202020',
      sidebarText: '#f0f2f0',
      sidebarHover: 'rgba(255, 255, 255, 0.05)',
      sidebarActive: 'rgba(148, 176, 147, 0.16)',
      sidebarBorder: 'rgba(255, 255, 255, 0.06)',
      sidebarSearchBg: 'rgba(255, 255, 255, 0.06)',
      sidebarSearchHover: 'rgba(255, 255, 255, 0.10)',
      sidebarPlaceholder: 'rgba(240, 242, 240, 0.45)',
      sidebarIconHover: 'rgba(255, 255, 255, 0.10)',
      headerBg: '#1a1d1a',
      headerText: '#f0f2f0',
      surfaces: {
        bgMain: '#1a1d1a',        // 深哑光石板墨绿底
        bgPanel: '#272b2a',       // 柔和炭黑微暖卡片面
        bgHover: '#2f3432',
        bgActive: '#363b39',
        border: 'rgba(255, 255, 255, 0.08)',
        borderLight: 'rgba(255, 255, 255, 0.05)',
        borderSoft: 'rgba(255, 255, 255, 0.05)',
        textPrimary: '#f0f2f0',
        textSecondary: '#a2aa9f',
        textMuted: '#808a7e',
      }
    }
  },
  {
    id: 'passion',
    name: 'Passion',
    darkVariant: 'passion-dark',
    colors: {
      primary: '#4285F4',
      accent: '#1976D2',
      accentDark: '#1565C0',
      secondary: '#5c5c5c',
      success: '#4DB6AC',
      successDark: '#00897B',
      warning: '#FFCA28',
      warningDark: '#FB8C00',
      danger: '#EF5350',
      dangerDark: '#D32F2F',
      onAccent: '#ffffff',
      onSuccess: '#212121',
      onWarning: '#212121',
      onDanger: '#212121',
      sidebarBg: '#f3f3f3',
      sidebarText: '#1b1b1b',
      sidebarHover: 'rgba(0, 0, 0, 0.06)',
      sidebarActive: 'rgba(0, 0, 0, 0.12)',
      sidebarBorder: 'rgba(0, 0, 0, 0.08)',
      sidebarSearchBg: 'rgba(0, 0, 0, 0.05)',
      sidebarSearchHover: 'rgba(0, 0, 0, 0.10)',
      sidebarPlaceholder: 'rgba(0, 0, 0, 0.45)',
      sidebarIconHover: 'rgba(0, 0, 0, 0.10)',
      headerBg: '#f3f3f3',
      headerText: '#1b1b1b'
    }
  },
  {
    id: 'passion-dark',
    name: 'Passion 深色',
    darkSurfaces: true,
    darkVariant: 'passion-dark',
    colors: {
      primary: '#8AB4F8',
      accent: '#1976D2',
      accentDark: '#1565C0',
      secondary: '#adadad',
      success: '#4DB6AC',
      successDark: '#00897B',
      successBtn: '#4DB6AC',
      danger: '#EF5350',
      dangerDark: '#D32F2F',
      dangerBtn: '#EF5350',
      warning: '#FFCA28',
      warningDark: '#FB8C00',
      onAccent: '#ffffff',
      onSuccess: '#212121',
      onWarning: '#212121',
      onDanger: '#212121',
      sidebarBg: '#202020',
      sidebarText: '#ffffff',
      sidebarHover: 'rgba(255, 255, 255, 0.06)',
      sidebarActive: 'rgba(255, 255, 255, 0.10)',
      sidebarBorder: 'rgba(255, 255, 255, 0.08)',
      sidebarSearchBg: 'rgba(255, 255, 255, 0.08)',
      sidebarSearchHover: 'rgba(255, 255, 255, 0.14)',
      sidebarPlaceholder: 'rgba(255, 255, 255, 0.5)',
      sidebarIconHover: 'rgba(255, 255, 255, 0.12)',
      headerBg: '#272727',
      headerText: '#ffffff'
    }
  }
];
