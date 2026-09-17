package httpserver

import (
	"github.com/TechiAkki963/SapienWorx/backend/internal/privacy"
	"github.com/jackc/pgx/v5/pgxpool"
)

func newPrivacyService(db DatabaseHealth) *privacy.Service {
	if pool, ok := db.(*pgxpool.Pool); ok {
		return privacy.NewService(pool)
	}
	return nil
}
