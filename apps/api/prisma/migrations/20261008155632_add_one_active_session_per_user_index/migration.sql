/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `board_sessions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "board_sessions_one_active_per_user" ON "board_sessions"("user_id") WHERE ("ended_at" IS NULL);
