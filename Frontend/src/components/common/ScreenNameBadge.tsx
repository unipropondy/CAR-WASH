import React from 'react';

interface ScreenNameBadgeProps {
  name: string;
  variant?: 'light' | 'dark' | 'header';
  style?: any;
}

/**
 * ScreenNameBadge
 * Disabled per user request to remove debug badges, monospace font, and pill UI across all pages.
 */
export const ScreenNameBadge: React.FC<ScreenNameBadgeProps> = () => {
  return null;
};

export default ScreenNameBadge;
