// beta-accounts is invoked only through the beta host's private bootstrap tool.
// Its stdout is secret material and must be captured, never logged.
package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"os"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
)

func main() {
	accounts := make(map[string]map[string]string)
	for _, role := range []string{"candidate", "recruiter", "master_admin"} {
		var random [32]byte
		if _, err := rand.Read(random[:]); err != nil {
			os.Exit(1)
		}
		password := base64.RawURLEncoding.EncodeToString(random[:])
		hash, err := auth.HashPassword(password)
		if err != nil {
			os.Exit(1)
		}
		accounts[role] = map[string]string{"password": password, "hash": hash}
	}
	if err := json.NewEncoder(os.Stdout).Encode(accounts); err != nil {
		os.Exit(1)
	}
}
