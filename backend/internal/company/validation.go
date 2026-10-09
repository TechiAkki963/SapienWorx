package company

import "github.com/jackc/pgx/v5/pgtype"

func validID(value string) bool {
	var id pgtype.UUID
	return len(value) == 36 && id.Scan(value) == nil && id.Valid
}
