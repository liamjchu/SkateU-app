import {
  TERMS_OF_USE_MARKDOWN,
  TERMS_OF_USE_TITLE,
} from '../../content/legal';
import LegalDocumentScreen from '../../components/LegalDocumentScreen';

export default function TermsOfUseScreen() {
  return (
    <LegalDocumentScreen
      title={TERMS_OF_USE_TITLE}
      markdown={TERMS_OF_USE_MARKDOWN}
    />
  );
}
