import {
  COMMUNITY_GUIDELINES_MARKDOWN,
  COMMUNITY_GUIDELINES_TITLE,
} from '../../content/legal';
import LegalDocumentScreen from '../../components/LegalDocumentScreen';

export default function CommunityGuidelinesScreen() {
  return (
    <LegalDocumentScreen
      title={COMMUNITY_GUIDELINES_TITLE}
      markdown={COMMUNITY_GUIDELINES_MARKDOWN}
    />
  );
}
