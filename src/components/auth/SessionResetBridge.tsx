'use client';

import { useEffect } from 'react';
import { usePayrollStore } from '../../store/usePayrollStore';

export function SessionResetBridge({
  authenticated,
}: {
  authenticated: boolean;
}) {
  const resetStore = usePayrollStore((state) => state.resetStore);

  useEffect(() => {
    if (!authenticated) {
      resetStore();
    }
  }, [authenticated, resetStore]);

  return null;
}
