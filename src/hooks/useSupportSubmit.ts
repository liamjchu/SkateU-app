import { useRef, useState } from 'react';
import { canAttemptSupportSubmit } from '../lib/userFeedback';

export function useSupportSubmit() {
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);

  const runSubmit = async (task: () => Promise<void>): Promise<boolean> => {
    if (!canAttemptSupportSubmit(lock.current) || !canAttemptSupportSubmit(submitting)) {
      return false;
    }

    lock.current = true;
    setSubmitting(true);
    try {
      await task();
      return true;
    } catch {
      return false;
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  };

  return { submitting, runSubmit };
}
