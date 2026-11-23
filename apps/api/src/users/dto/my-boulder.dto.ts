// Un bloc que j'ai créé et publié (`GET /users/me/boulders`), à son
// inclinaison de création.
export class MyBoulderDto {
  id!: number;
  name!: string;
  angleDegrees!: number;
  // Cotation effective à cette inclinaison : celle du créateur, ou celle de
  // la communauté à partir de 5 votes. Jamais nulle, la cotation de départ
  // y est posée à la création.
  gradeRank!: number;
  createdAt!: Date;
}
