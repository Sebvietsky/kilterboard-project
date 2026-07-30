import { ProfileView } from '@/components/profile/ProfileView';

// L'onglet n'est qu'un point d'entrée : sans username, ProfileView affiche le
// profil courant. La même vue servira la future route /user/[username].
export default function ProfileScreen() {
  return <ProfileView />;
}
