// profile-schema exports local provider-neutral schemas. It opens no database,
// reads no CV and requires no API key or external provider.
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
)

func main() {
	kind := flag.String("kind", "candidate_profile", "candidate_profile, parser_result, review_view or review_patch")
	flag.Parse()
	data, err := profilecontract.JSONSchema(*kind)
	if err != nil {
		fmt.Fprintln(os.Stderr, "unsupported profile schema")
		os.Exit(1)
	}
	fmt.Println(string(data))
}
