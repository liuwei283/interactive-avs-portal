import { useEffect } from 'react';
import { config } from './config';

export function useTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${config.siteTitle}` : config.siteTitle;
  }, [title]);
}
