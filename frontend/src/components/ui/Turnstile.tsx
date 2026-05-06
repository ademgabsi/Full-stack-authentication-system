import {
  useEffect,
  useRef,
  useCallback,
  useState,
  type FC,
} from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: TurnstileRenderOptions,
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
}

interface TurnstileProps {
  onToken: (token: string) => void;
  onError?: () => void;
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;

const Turnstile: FC<TurnstileProps> = ({ onToken, onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [enabled] = useState(() => !!SITE_KEY);

  const handleError = useCallback(() => {
    onToken('');
    onError?.();
  }, [onToken, onError]);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current) return;

      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // widget may already be removed
        }
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: onToken,
        'error-callback': handleError,
        'expired-callback': () => onToken(''),
        theme: 'light',
        size: 'normal',
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const checkInterval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(checkInterval);
          renderWidget();
        }
      }, 100);

      return () => clearInterval(checkInterval);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [enabled, onToken, handleError]);

  if (!enabled) return null;

  return <div ref={containerRef} className="flex justify-center" />;
};

export default Turnstile;
