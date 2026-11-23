-- CreateTable
CREATE TABLE "boulder_likes" (
    "user_id" INTEGER NOT NULL,
    "boulder_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boulder_likes_pkey" PRIMARY KEY ("user_id","boulder_id")
);

-- AddForeignKey
ALTER TABLE "boulder_likes" ADD CONSTRAINT "boulder_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boulder_likes" ADD CONSTRAINT "boulder_likes_boulder_id_fkey" FOREIGN KEY ("boulder_id") REFERENCES "boulders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
