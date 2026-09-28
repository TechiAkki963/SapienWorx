package main

import (
	"bytes"
	"context"
	"strings"
	"testing"
)

const target = "10000000-0000-4000-8000-000000000001"
const operator = "20000000-0000-4000-8000-000000000001"

func TestRecoveryDefaultsToInspection(t *testing.T) {
	o, err := parseOptions([]string{"-target", target, "-operator", operator}, "")
	if err != nil || o.apply {
		t.Fatal("default was not inspection only")
	}
}
func TestRecoveryRejectsUnsafeArguments(t *testing.T) {
	for _, args := range [][]string{{"-target", target, "-operator", target}, {"-target", "not-an-id", "-operator", operator}, {"-target", target, "-operator", operator, "-apply"}, {"-target", target, "-operator", operator, "-password", "private"}, {"-target", target, "-operator", operator, "unexpected"}} {
		if _, err := parseOptions(args, ""); err == nil {
			t.Fatal("unsafe recovery arguments accepted")
		}
	}
}
func TestRecoveryRequiresAllApplyGates(t *testing.T) {
	args := []string{"-target", target, "-operator", operator, "-apply", "-confirm-target", target, "-approval-ref", "CASE-900", "-reason", "Identity checked independently"}
	if _, err := parseOptions(args, ""); err == nil {
		t.Fatal("disabled apply accepted")
	}
	if _, err := parseOptions(args, "true"); err != nil {
		t.Fatal(err)
	}
	args[6] = operator
	if _, err := parseOptions(args, "true"); err == nil {
		t.Fatal("wrong confirmation accepted")
	}
}
func TestRecoveryDoesNotEchoConnectionSecrets(t *testing.T) {
	var output bytes.Buffer
	err := run(context.Background(), []string{"-target", target, "-operator", operator}, func(key string) string {
		if key == "DATABASE_URL" {
			return "postgres://SECRET_PASSWORD@%broken"
		}
		return ""
	}, &output)
	if err == nil || strings.Contains(err.Error(), "SECRET_PASSWORD") || strings.Contains(output.String(), "SECRET_PASSWORD") {
		t.Fatal("database secret leaked or bad config accepted")
	}
}
