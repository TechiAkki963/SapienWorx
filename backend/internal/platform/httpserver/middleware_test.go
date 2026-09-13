package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
)

func TestAuthenticateAcceptsAccessCookie(t *testing.T){tokens,err:=auth.NewTokenManager("01234567890123456789012345678901","issuer","audience",15*time.Minute,30*time.Second);if err!=nil{t.Fatal(err)};token,err:=tokens.Issue("user-1",auth.RoleCandidate,"session-1");if err!=nil{t.Fatal(err)};handler:=Authenticate(tokens,"sw_access")(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){claims,ok:=ClaimsFromContext(r.Context());if !ok||claims.Subject!="user-1"{t.Fatal("claims missing")};w.WriteHeader(http.StatusNoContent)}));req:=httptest.NewRequest(http.MethodGet,"/",nil);req.AddCookie(&http.Cookie{Name:"sw_access",Value:token});res:=httptest.NewRecorder();handler.ServeHTTP(res,req);if res.Code!=http.StatusNoContent{t.Fatalf("status = %d",res.Code)}}
