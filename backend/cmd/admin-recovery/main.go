// Offline operator tool; no HTTP endpoint. Inspection is the default.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"github.com/TechiAkki963/SapienWorx/backend/internal/admin"
	"github.com/jackc/pgx/v5/pgxpool"
	"io"
	"os"
	"regexp"
	"strings"
	"time"
)

type options struct {
	target, operator, reference, reason, confirmation string
	apply                                             bool
}

var uuid = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

func parseOptions(args []string, enabled string) (options, error) {
	o := options{}
	f := flag.NewFlagSet("admin-recovery", flag.ContinueOnError)
	f.SetOutput(io.Discard)
	f.StringVar(&o.target, "target", "", "Target admin UUID")
	f.StringVar(&o.operator, "operator", "", "Separately approved recovery operator UUID")
	f.StringVar(&o.reference, "approval-ref", "", "Reviewed case reference")
	f.StringVar(&o.reason, "reason", "", "Non-sensitive recovery reason")
	f.BoolVar(&o.apply, "apply", false, "Explicitly apply recovery")
	f.StringVar(&o.confirmation, "confirm-target", "", "Exact target UUID confirmation")
	if err := f.Parse(args); err != nil || f.NArg() != 0 {
		return o, errors.New("invalid recovery arguments; use only the documented flags")
	}
	o.target = strings.ToLower(strings.TrimSpace(o.target))
	o.operator = strings.ToLower(strings.TrimSpace(o.operator))
	o.reference = strings.TrimSpace(o.reference)
	o.reason = strings.TrimSpace(o.reason)
	if !uuid.MatchString(o.target) || !uuid.MatchString(o.operator) || o.target == o.operator {
		return o, errors.New("separate, valid target and operator UUIDs are required")
	}
	if o.apply && (enabled != "true" || o.confirmation != o.target || len(o.reference) < 5 || len(o.reference) > 200 || len(o.reason) < 10 || len(o.reason) > 1000) {
		return o, errors.New("apply requires the approved runtime enablement, exact target confirmation, case reference and reason")
	}
	return o, nil
}

func run(ctx context.Context, args []string, getenv func(string) string, out io.Writer) error {
	o, err := parseOptions(args, getenv("ADMIN_RECOVERY_APPLY_ENABLED"))
	if err != nil {
		return err
	}
	dsn := getenv("DATABASE_URL")
	if dsn == "" {
		return errors.New("DATABASE_URL must be supplied through the approved runtime environment")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return errors.New("database configuration could not be validated")
	}
	cfg.MaxConns = 1
	cfg.ConnConfig.ConnectTimeout = 5 * time.Second
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return errors.New("database connection unavailable; credentials were not printed")
	}
	defer db.Close()
	service := admin.NewService(db)
	plan, err := service.PlanMFARecovery(ctx, o.target, o.operator)
	if err != nil {
		return safeError(err)
	}
	if !o.apply {
		return json.NewEncoder(out).Encode(struct {
			Mode string                `json:"mode"`
			Plan admin.MFARecoveryPlan `json:"plan"`
		}{"inspection_only", plan})
	}
	if !plan.CredentialPresent {
		return errors.New("no credential is present; recovery was not applied")
	}
	if err = service.RecoverMFA(ctx, o.target, o.operator, o.reference, o.reason); err != nil {
		return safeError(err)
	}
	_, err = fmt.Fprintln(out, "Recovery applied and audited. Existing sessions revoked. Roles, account status and runtime encryption key were not changed. Fresh enrollment is required.")
	return err
}
func safeError(err error) error {
	switch {
	case errors.Is(err, admin.ErrForbidden):
		return errors.New("recovery operator is not authorized")
	case errors.Is(err, admin.ErrNotFound):
		return errors.New("target administrator was not found")
	case errors.Is(err, admin.ErrInvalid):
		return errors.New("recovery inputs were rejected")
	default:
		return errors.New("database operation failed; inspect approved server-side diagnostics without printing secrets; do not retry blindly")
	}
}
func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := run(ctx, os.Args[1:], os.Getenv, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
