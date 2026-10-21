package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/messaging"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
)

// This gate requires a disposable local database, never beta or production.
func TestMessagingUnicodeHTTPWebSocketAndPostgres(t *testing.T) {
	dsn := os.Getenv("MESSAGING_UNICODE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated messaging Unicode database not configured")
	}
	parsed, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.ConnConfig.Database != "sapienworx_emoji_test" || (parsed.ConnConfig.Host != "127.0.0.1" && parsed.ConnConfig.Host != "localhost") {
		t.Fatal("refusing non-isolated messaging Unicode database")
	}
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, parsed)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, query, args...); err != nil {
			t.Fatal(err)
		}
	}
	id := func(query string, args ...any) string {
		t.Helper()
		var value string
		if err := db.QueryRow(ctx, query, args...).Scan(&value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	files, err := filepath.Glob("../../../../database/migrations/*.up.sql")
	if err != nil || len(files) < 67 {
		t.Fatal("migration set unavailable")
	}
	var migrated bool
	if err := db.QueryRow(ctx, `SELECT to_regclass('public.chat_messages') IS NOT NULL`).Scan(&migrated); err != nil {
		t.Fatal(err)
	}
	if !migrated {
		for _, file := range files {
			raw, err := os.ReadFile(file)
			if err != nil {
				t.Fatal(err)
			}
			exec(string(raw))
		}
	}
	for _, setting := range []string{"server_encoding", "client_encoding"} {
		if got := id("SHOW " + setting); got != "UTF8" {
			t.Fatalf("%s = %s", setting, got)
		}
	}
	hash, err := auth.HashPassword("Synthetic-emoji-test-only-123!")
	if err != nil {
		t.Fatal(err)
	}
	user := func(role string) string {
		return id(`INSERT INTO users(email,password_hash,role,status,is_active,email_verified_at) VALUES(gen_random_uuid()::text||'@example.test',$1,$2,'active',true,now()) RETURNING id`, hash, role)
	}
	recruiterID, candidateID, outsiderID := user("recruiter"), user("candidate"), user("candidate")
	companyID := id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES('Synthetic Unicode QA','Synthetic Unicode QA','IN','verified') RETURNING id`)
	exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic Recruiter','verified')`, recruiterID, companyID)
	exec(`INSERT INTO company_memberships(company_id,user_id,role,scope) VALUES($1,$2,'primary_admin','{"all":true}')`, companyID, recruiterID)
	exec(`INSERT INTO candidate_profiles(user_id,full_name) VALUES($1,'Synthetic Candidate'),($2,'Synthetic Outsider')`, candidateID, outsiderID)
	subject := "Interview details 📅"
	threadID := id(`INSERT INTO chat_threads(recruiter_id,candidate_id,subject) VALUES($1,$2,$3) RETURNING id`, recruiterID, candidateID, subject)
	tokens := testTokens(t)
	cfg := testConfig()
	cfg.Auth.JWTSecret = strings.Repeat("synthetic-emoji-", 4)
	cfg.HTTP.MaxBodyBytes = 65536
	service := auth.NewService(db, tokens, auth.ServiceConfig{RefreshTTL: time.Hour, OTPTTL: time.Minute, OTPSecret: cfg.Auth.JWTSecret, Development: true})
	server := New(cfg, db, tokens, service, candidate.NewService(db), nil, nil, nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
	defer server.messages.Close()
	live := httptest.NewServer(server.http.Handler)
	defer live.Close()
	credential := func(userID string, role auth.Role) string {
		session := id(`INSERT INTO refresh_sessions(user_id,token_hash,expires_at) VALUES($1,convert_to(gen_random_uuid()::text,'UTF8'),now()+interval '1 hour') RETURNING id`, userID)
		token, err := tokens.Issue(userID, role, session)
		if err != nil {
			t.Fatal(err)
		}
		return token
	}
	recruiterToken, candidateToken, outsiderToken := credential(recruiterID, auth.RoleRecruiter), credential(candidateID, auth.RoleCandidate), credential(outsiderID, auth.RoleCandidate)
	request := func(token, method, path string, input any) *http.Response {
		t.Helper()
		raw, _ := json.Marshal(input)
		req, err := http.NewRequest(method, live.URL+path, bytes.NewReader(raw))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "http://localhost:3000")
		response, err := live.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { response.Body.Close() })
		return response
	}
	dial := func(token string) *websocket.Conn {
		header := http.Header{"Authorization": []string{"Bearer " + token}, "Origin": []string{"http://localhost:3000"}}
		conn, response, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(live.URL, "http")+"/api/v1/messaging/threads/"+threadID+"/ws", header)
		if err != nil {
			if response != nil {
				raw, _ := io.ReadAll(response.Body)
				response.Body.Close()
				t.Fatalf("WebSocket handshake: %d %s", response.StatusCode, raw)
			}
			t.Fatal(err)
		}
		t.Cleanup(func() { conn.Close() })
		return conn
	}
	recruiterSocket, candidateSocket := dial(recruiterToken), dial(candidateToken)
	defer recruiterSocket.Close()
	defer candidateSocket.Close()
	deadline := time.Now().Add(2 * time.Second)
	for server.messages.hub.ConnectionCount() != 2 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if server.messages.hub.ConnectionCount() != 2 {
		t.Fatal("both authenticated sockets must be registered")
	}
	cases := []string{"Wednesday 4 PM works ✅", "🙏🏽 Thank you", "Hello 👩🏽‍💻 — https://example.test/jobs\nSee you 📅", "👍🏻👍🏽👍🏿", "🎉", "<script>alert('x')</script> 🙂"}
	for i, content := range cases {
		t.Run(content, func(t *testing.T) {
			token := recruiterToken
			if i%2 == 1 {
				token = candidateToken
			}
			response := request(token, "POST", "/api/v1/messaging/threads/"+threadID+"/messages", map[string]string{"content": content})
			if response.StatusCode != 201 {
				raw, _ := io.ReadAll(response.Body)
				t.Fatalf("send: %d %s", response.StatusCode, raw)
			}
			var sent messaging.ChatMessage
			if err := json.NewDecoder(response.Body).Decode(&sent); err != nil || sent.Content != content {
				t.Fatalf("HTTP Unicode response mismatch: %v", err)
			}
			for _, socket := range []*websocket.Conn{recruiterSocket, candidateSocket} {
				socket.SetReadDeadline(time.Now().Add(3 * time.Second))
				var event messaging.WebSocketEvent
				if err := socket.ReadJSON(&event); err != nil {
					t.Fatal(err)
				}
				var payload messaging.MessagePayload
				if err := json.Unmarshal(event.Payload, &payload); err != nil || payload.Message.Content != content || payload.Message.ID != sent.ID {
					t.Fatalf("WebSocket Unicode mismatch: %v", err)
				}
			}
			if got := id(`SELECT content FROM chat_messages WHERE id=$1`, sent.ID); got != content {
				t.Fatal("stored Unicode differs")
			}
		})
	}
	var count int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM chat_messages WHERE thread_id=$1`, threadID).Scan(&count); err != nil || count != len(cases) {
		t.Fatalf("duplicate or missing messages: %d %v", count, err)
	}
	response := request(candidateToken, "GET", "/api/v1/messaging/threads/"+threadID+"/messages", nil)
	var history struct {
		Items []messaging.ChatMessage `json:"items"`
	}
	if err := json.NewDecoder(response.Body).Decode(&history); err != nil || len(history.Items) != len(cases) {
		t.Fatalf("history: %v", err)
	}
	for i, item := range history.Items {
		if item.Content != cases[i] {
			t.Fatalf("history item %d changed", i)
		}
	}
	response = request(recruiterToken, "GET", "/api/v1/messaging/threads", nil)
	var threads struct {
		Items []messaging.ThreadSummary `json:"items"`
	}
	if err := json.NewDecoder(response.Body).Decode(&threads); err != nil || len(threads.Items) != 1 || threads.Items[0].LastMessage == nil || *threads.Items[0].LastMessage != cases[len(cases)-1] {
		t.Fatalf("thread preview mismatch: %v", err)
	}
	if got := id(`SELECT body FROM candidate_notifications WHERE candidate_id=$1 ORDER BY created_at DESC LIMIT 1`, candidateID); got != subject {
		t.Fatal("notification subject Unicode changed")
	}
	if response := request(outsiderToken, "GET", "/api/v1/messaging/threads/"+threadID+"/messages", nil); response.StatusCode != 403 {
		t.Fatalf("outsider read: %d", response.StatusCode)
	}
	if response := request(outsiderToken, "POST", "/api/v1/messaging/threads/"+threadID+"/messages", map[string]string{"content": "👋"}); response.StatusCode != 403 {
		t.Fatalf("outsider write: %d", response.StatusCode)
	}
	if response := request(recruiterToken, "POST", "/api/v1/messaging/threads/"+threadID+"/messages", map[string]string{"content": strings.Repeat("🙂", 1251)}); response.StatusCode != 400 {
		t.Fatalf("byte limit: %d", response.StatusCode)
	}
	template, err := server.messages.service.CreateTemplate(ctx, recruiterID, messaging.TemplateInput{Title: "Professional greeting 👋", SubjectTemplate: "Hello {{CandidateName}} 📅", BodyTemplate: "Thank you 🙏🏽 {{CandidateName}}"})
	if err != nil || template.BodyTemplate != "Thank you 🙏🏽 {{CandidateName}}" {
		t.Fatalf("Unicode template: %v", err)
	}
}
