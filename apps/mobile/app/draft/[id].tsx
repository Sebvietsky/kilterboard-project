import { useLocalSearchParams } from 'expo-router';
import { DraftEditor } from '@/components/drafts/DraftEditor';

export default function EditDraftScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DraftEditor draftId={Number(id)} />;
}
