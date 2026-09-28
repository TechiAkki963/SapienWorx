package workforce

import "testing"

func TestCleanTypes(t *testing.T){
	got,err:=CleanTypes([]string{" competency ","tool","competency"})
	if err!=nil{t.Fatal(err)}
	if len(got)!=2 || got[0]!="competency" || got[1]!="tool"{t.Fatalf("unexpected types: %#v",got)}
	if _,err:=CleanTypes([]string{"programming_language"});err==nil{t.Fatal("expected invalid type rejection")}
}

func TestWorkforceNormalized(t *testing.T){
	if got:=workforceNormalized("  Critical   Care Nursing ");got!="critical care nursing"{t.Fatalf("unexpected normalization %q",got)}
}
