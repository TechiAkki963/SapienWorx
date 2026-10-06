package candidate

import (
	"bytes"
	"context"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/jackc/pgx/v5/pgxpool"
	"image"
	"image/png"
	"os"
	"strings"
	"testing"
)

func TestCandidateIdentityIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("PROFILE_V2_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated workspace test database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_profile_test" || (cfg.ConnConfig.Host != "swx-profile-v2-db" && cfg.ConnConfig.Host != "localhost" && cfg.ConnConfig.Host != "127.0.0.1") {
		t.Fatal("refusing non-isolated database")
	}
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var userID, otherID string
	hash, err := auth.HashPassword("Synthetic-photo-test-123!")
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range []*string{&userID, &otherID} {
		if err = db.QueryRow(ctx, `INSERT INTO users(email,password_hash,role,status,email_verified_at) VALUES(gen_random_uuid()::text||'@example.test',$1,'candidate','active',now()) RETURNING id::text`, hash).Scan(id); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, `DELETE FROM users WHERE id=$1`, *id)
		if _, err = db.Exec(ctx, `INSERT INTO candidate_profiles(user_id,full_name,profile_details) VALUES($1,'Synthetic Candidate','{"profile_visible_in_sourcing":true}')`, *id); err != nil {
			t.Fatal(err)
		}
	}
	service := NewService(db)
	authService := auth.NewService(db, nil, auth.ServiceConfig{})
	legacyVersion := strings.Repeat("a", 32)
	legacyURL := "/api/v1/users/profile-image?version=" + legacyVersion
	if _, err = db.Exec(ctx, `UPDATE users SET profile_image_url=$2,profile_image_key=$3 WHERE id=$1`, userID, legacyURL, "profile-images/"+userID+"/"+legacyVersion+".webp"); err != nil {
		t.Fatal(err)
	}
	summary, err := service.Summary(ctx, userID)
	if err != nil || summary.PhotoDataURL != legacyURL {
		t.Fatal("existing legacy owner image not preserved")
	}
	legacyPublic, err := service.PublicProfile(ctx, summary.ShareToken)
	if err != nil || legacyPublic.PhotoDataURL != "" {
		t.Fatal("owner-authenticated legacy URL must not display another viewer's account image publicly")
	}
	var imageBytes bytes.Buffer
	png.Encode(&imageBytes, image.NewRGBA(image.Rect(0, 0, 2, 2)))
	if err = service.UpdatePhoto(ctx, userID, "image/png", imageBytes.Bytes()); err != nil {
		t.Fatal(err)
	}
	summary, err = service.Summary(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	session, err := authService.SessionProfile(ctx, userID)
	if err != nil || session.ProfileImageURL != summary.PhotoDataURL {
		t.Fatal("session and owner must share canonical photo")
	}
	public, err := service.PublicProfile(ctx, summary.ShareToken)
	if err != nil || public.PhotoDataURL != summary.PhotoDataURL {
		t.Fatal("opted-in public photo must use same canonical source")
	}
	if err = service.RemovePhoto(ctx, userID); err != nil {
		t.Fatal(err)
	}
	summary, _ = service.Summary(ctx, userID)
	session, _ = authService.SessionProfile(ctx, userID)
	if summary.PhotoDataURL != "" || session.ProfileImageURL != "" {
		t.Fatal("removal left stale image reference")
	}
	for _, id := range []string{userID, otherID} {
		if _, err = db.Exec(ctx, `INSERT INTO candidate_notifications(candidate_id,kind,title,body,action_url) SELECT $1,'test','Notification','Synthetic','/candidate/profile' FROM generate_series(1,3)`, id); err != nil {
			t.Fatal(err)
		}
	}
	inbox, err := service.NotificationInbox(ctx, userID, 1, 1)
	if err != nil || inbox.UnreadCount != 3 || inbox.Total != 3 || len(inbox.Items) != 1 {
		t.Fatal("badge must count beyond limited visible page")
	}
	count, err := service.MarkAllNotificationsRead(ctx, userID)
	if err != nil || count != 3 {
		t.Fatal("mark all must update all owned notifications")
	}
	inbox, _ = service.NotificationInbox(ctx, userID, 1, 1)
	other, _ := service.NotificationInbox(ctx, otherID, 1, 1)
	if inbox.UnreadCount != 0 || other.UnreadCount != 3 {
		t.Fatal("notification read state leaked across owners")
	}
	if count, err = service.MarkAllNotificationsRead(ctx, userID); err != nil || count != 0 {
		t.Fatal("mark all must be idempotent")
	}
}
