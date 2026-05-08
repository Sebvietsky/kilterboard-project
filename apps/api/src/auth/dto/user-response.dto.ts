export class UserResponseDto {
  id!: number;
  username!: string;
  email!: string;
  avatarUrl!: string | null;
  bio!: string | null;
  country!: string | null;
  role!: string;
  gradeSystem!: string;
  isPublic!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
