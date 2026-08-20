import {
  PRIVACY_POLICY_MARKDOWN,
  PRIVACY_POLICY_TITLE,
} from '../../content/legal';
import LegalDocumentScreen from '../../components/LegalDocumentScreen';

export default function PrivacyPolicyScreen() {
  return (
    <LegalDocumentScreen
      title={PRIVACY_POLICY_TITLE}
      markdown={PRIVACY_POLICY_MARKDOWN}
    />
  );
}
