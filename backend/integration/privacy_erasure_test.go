package integration_test

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestAccountErasureRemovesOrAnonymisesPII(t *testing.T) {
	apiURL := strings.TrimRight(os.Getenv("AUDIT_API_URL"), "/")
	token := os.Getenv("AUDIT_ACCESS_TOKEN")
	userID := os.Getenv("AUDIT_USER_ID")
	databaseURL := os.Getenv("DATABASE_URL")
	if apiURL == "" || token == "" || userID == "" || databaseURL == "" {
		t.Skip("set AUDIT_API_URL, AUDIT_ACCESS_TOKEN, AUDIT_USER_ID and DATABASE_URL to run destructive privacy integration audit")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, apiURL+"/api/v1/user/account", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("account erasure request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusAccepted {
		t.Fatalf("DELETE /api/v1/user/account returned %d; expected 204 or 202", resp.StatusCode)
	}

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	assertCountZero(t, ctx, pool, "candidate_profiles", "user_id", userID)
	assertCountZero(t, ctx, pool, "chat_messages", "sender_id", userID)
	assertCountZero(t, ctx, pool, "chat_threads", "candidate_id", userID)

	var email string
	var phone *string
	var active bool
	err = pool.QueryRow(ctx, "SELECT email, phone_e164, is_active FROM users WHERE id=$1", userID).Scan(&email, &phone, &active)
	switch err {
	case nil:
		if active || phone != nil || !strings.HasPrefix(strings.ToLower(email), "deleted+") {
			t.Fatalf("retained user row is not irreversibly anonymised: email=%q phone_present=%t active=%t", email, phone != nil, active)
		}
	case pgx.ErrNoRows:
		// Hard deletion is also compliant with this test contract.
	default:
		t.Fatal(err)
	}

	if probe := os.Getenv("AUDIT_CV_PROBE_URL"); probe != "" {
		probeReq, err := http.NewRequestWithContext(ctx, http.MethodGet, probe, nil)
		if err != nil {
			t.Fatal(err)
		}
		probeResp, err := http.DefaultClient.Do(probeReq)
		if err != nil {
			t.Fatal(err)
		}
		probeResp.Body.Close()
		if probeResp.StatusCode >= 200 && probeResp.StatusCode < 300 {
			t.Fatalf("previously issued CV URL still returns %d after erasure; object should be deleted or inaccessible", probeResp.StatusCode)
		}
	}
}

func assertCountZero(t *testing.T, ctx context.Context, pool *pgxpool.Pool, table, column, userID string) {
	t.Helper()
	allowed := map[string]map[string]bool{
		"candidate_profiles": {"user_id": true},
		"chat_messages":      {"sender_id": true},
		"chat_threads":       {"candidate_id": true},
	}
	if !allowed[table][column] {
		t.Fatalf("unsafe audit identifier %s.%s", table, column)
	}
	var count int
	query := fmt.Sprintf("SELECT count(*) FROM %s WHERE %s=$1", table, column) // identifiers are allow-listed above; values remain parameterised.
	if err := pool.QueryRow(ctx, query, userID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("%s still contains %d rows linked to erased user", table, count)
	}
}
