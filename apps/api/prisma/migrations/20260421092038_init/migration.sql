-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "GradeSystem" AS ENUM ('V_SCALE', 'FONT_SCALE');

-- CreateEnum
CREATE TYPE "HoldRole" AS ENUM ('START', 'HAND', 'FOOT', 'FINISH');

-- CreateEnum
CREATE TYPE "AscentStatus" AS ENUM ('FLASH', 'SENT', 'PROJECT', 'REPEAT');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "avatar_url" TEXT,
    "bio" TEXT,
    "country" VARCHAR(100),
    "role" "Role" NOT NULL DEFAULT 'USER',
    "gradeSystem" "GradeSystem" NOT NULL DEFAULT 'FONT_SCALE',
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "xp_points" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_follows" (
    "follower_id" INTEGER NOT NULL,
    "following_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_follows_pkey" PRIMARY KEY ("follower_id","following_id")
);

-- CreateTable
CREATE TABLE "board_layouts" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "manufacturer" VARCHAR(100),
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "description" TEXT,

    CONSTRAINT "board_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boards" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "gym_name" VARCHAR(150),
    "country" VARCHAR(100),
    "city" VARCHAR(100),
    "latitude" DECIMAL(65,30),
    "longitude" DECIMAL(65,30),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "layout_id" INTEGER NOT NULL,

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holds" (
    "id" SERIAL NOT NULL,
    "layout_id" INTEGER NOT NULL,
    "hold_code" VARCHAR(20) NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,

    CONSTRAINT "holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "angles" (
    "id" SERIAL NOT NULL,
    "value_degrees" INTEGER NOT NULL,
    "label" VARCHAR(50),

    CONSTRAINT "angles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grades" (
    "id" SERIAL NOT NULL,
    "vScale" VARCHAR(4) NOT NULL,
    "fontScale" VARCHAR(4) NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boulders" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "grade_id" INTEGER NOT NULL,
    "creator_id" INTEGER NOT NULL,
    "layout_id" INTEGER NOT NULL,
    "angle_id" INTEGER NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_draft" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "boulders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boulder_holds" (
    "boulder_id" INTEGER NOT NULL,
    "hold_id" INTEGER NOT NULL,
    "role" "HoldRole" NOT NULL,

    CONSTRAINT "boulder_holds_pkey" PRIMARY KEY ("boulder_id","hold_id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boulder_tags" (
    "boulder_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "boulder_tags_pkey" PRIMARY KEY ("boulder_id","tag_id")
);

-- CreateTable
CREATE TABLE "board_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "board_id" INTEGER,
    "title" VARCHAR(100),
    "note" TEXT,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ascents" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "boulder_id" INTEGER NOT NULL,
    "session_id" INTEGER,
    "status" "AscentStatus" NOT NULL,
    "attempts_count" INTEGER NOT NULL DEFAULT 0,
    "send_date" TIMESTAMPTZ,
    "felt_grade_id" INTEGER,
    "rating" INTEGER,
    "was_project" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ascents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ascent_notes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "boulder_id" INTEGER NOT NULL,
    "ascent_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ascent_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ascent_note_likes" (
    "user_id" INTEGER NOT NULL,
    "ascent_note_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ascent_note_likes_pkey" PRIMARY KEY ("user_id","ascent_note_id")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_boulders" (
    "boulder_id" INTEGER NOT NULL,
    "playlist_id" INTEGER NOT NULL,
    "position" INTEGER,
    "added_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_boulders_pkey" PRIMARY KEY ("boulder_id","playlist_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "holds_layout_id_hold_code_key" ON "holds"("layout_id", "hold_code");

-- CreateIndex
CREATE UNIQUE INDEX "angles_value_degrees_key" ON "angles"("value_degrees");

-- CreateIndex
CREATE UNIQUE INDEX "grades_vScale_key" ON "grades"("vScale");

-- CreateIndex
CREATE UNIQUE INDEX "grades_fontScale_key" ON "grades"("fontScale");

-- CreateIndex
CREATE UNIQUE INDEX "grades_rank_key" ON "grades"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- AddForeignKey
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "boards_layout_id_fkey" FOREIGN KEY ("layout_id") REFERENCES "board_layouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holds" ADD CONSTRAINT "holds_layout_id_fkey" FOREIGN KEY ("layout_id") REFERENCES "board_layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boulders" ADD CONSTRAINT "boulders_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boulders" ADD CONSTRAINT "boulders_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boulders" ADD CONSTRAINT "boulders_layout_id_fkey" FOREIGN KEY ("layout_id") REFERENCES "board_layouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boulders" ADD CONSTRAINT "boulders_angle_id_fkey" FOREIGN KEY ("angle_id") REFERENCES "angles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boulder_holds" ADD CONSTRAINT "boulder_holds_boulder_id_fkey" FOREIGN KEY ("boulder_id") REFERENCES "boulders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boulder_holds" ADD CONSTRAINT "boulder_holds_hold_id_fkey" FOREIGN KEY ("hold_id") REFERENCES "holds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boulder_tags" ADD CONSTRAINT "boulder_tags_boulder_id_fkey" FOREIGN KEY ("boulder_id") REFERENCES "boulders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boulder_tags" ADD CONSTRAINT "boulder_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_sessions" ADD CONSTRAINT "board_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_sessions" ADD CONSTRAINT "board_sessions_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ascents" ADD CONSTRAINT "ascents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ascents" ADD CONSTRAINT "ascents_boulder_id_fkey" FOREIGN KEY ("boulder_id") REFERENCES "boulders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ascents" ADD CONSTRAINT "ascents_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "board_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ascents" ADD CONSTRAINT "ascents_felt_grade_id_fkey" FOREIGN KEY ("felt_grade_id") REFERENCES "grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ascent_notes" ADD CONSTRAINT "ascent_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ascent_notes" ADD CONSTRAINT "ascent_notes_boulder_id_fkey" FOREIGN KEY ("boulder_id") REFERENCES "boulders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ascent_notes" ADD CONSTRAINT "ascent_notes_ascent_id_fkey" FOREIGN KEY ("ascent_id") REFERENCES "ascents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ascent_note_likes" ADD CONSTRAINT "ascent_note_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ascent_note_likes" ADD CONSTRAINT "ascent_note_likes_ascent_note_id_fkey" FOREIGN KEY ("ascent_note_id") REFERENCES "ascent_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_boulders" ADD CONSTRAINT "playlist_boulders_boulder_id_fkey" FOREIGN KEY ("boulder_id") REFERENCES "boulders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_boulders" ADD CONSTRAINT "playlist_boulders_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
