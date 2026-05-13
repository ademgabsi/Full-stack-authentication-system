import type { FingerprintData } from '@/types';

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(16);
}

function getCanvasHash(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    canvas.width = 200;
    canvas.height = 50;
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 200, 50);
    ctx.fillStyle = '#069';
    ctx.fillText('AuthSys FP v1.0', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('AuthSys FP v1.0', 4, 17);
    return hashString(canvas.toDataURL());
  } catch {
    return '';
  }
}

function getWebglHash(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return '';
    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return '';
    const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    return hashString(`${vendor}|${renderer}`);
  } catch {
    return '';
  }
}

function getFontsHash(): string {
  const fonts = [
    'Arial',
    'Courier New',
    'Georgia',
    'Times New Roman',
    'Verdana',
    'Helvetica',
    'Tahoma',
    'Trebuchet MS',
  ];
  const available: string[] = [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const baseWidth = ctx.measureText('mmmmmmmmmmlli').width;
  for (const font of fonts) {
    ctx.font = `72px "${font}", monospace`;
    const width = ctx.measureText('mmmmmmmmmmlli').width;
    if (width !== baseWidth) available.push(font);
  }
  return hashString(available.join(','));
}

export function collectFingerprint(): FingerprintData {
  return {
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    canvasHash: getCanvasHash(),
    webglHash: getWebglHash(),
    fontsHash: getFontsHash(),
    colorDepth: `${window.screen.colorDepth}`,
    touchSupport: 'ontouchstart' in window ? 'true' : 'false',
  };
}
