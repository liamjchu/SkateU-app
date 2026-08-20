import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import AuthCredentialsForm from '../components/auth-credentials-form';
import { useAgeEligibilityStore } from '../store/ageEligibilityStore';

export default function SignupScreen() {
  const router = useRouter();
  const confirmedAgeEligibleThisSession = useAgeEligibilityStore(
    (state) => state.confirmedThisSession
  );

  useEffect(() => {
    if (!confirmedAgeEligibleThisSession) {
      router.replace('/age-gate');
    }
  }, [confirmedAgeEligibleThisSession, router]);

  if (!confirmedAgeEligibleThisSession) {
    return null;
  }

  return <AuthCredentialsForm mode="signup" />;
}
