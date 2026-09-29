package recruiter

import "testing"

func TestJobPercentage(t *testing.T) {
	tests := []struct {
		value int
		total int
		want  float64
	}{
		{0, 0, 0},
		{1, 4, 25},
		{1, 3, 33.3},
		{7, 5, 140},
	}
	for _, test := range tests {
		if got := jobPercentage(test.value, test.total); got != test.want {
			t.Fatalf("jobPercentage(%d,%d) = %v, want %v", test.value, test.total, got, test.want)
		}
	}
}

func TestRemainingOpenings(t *testing.T) {
	if got := remainingOpenings(3, 1); got != 2 {
		t.Fatalf("remainingOpenings(3,1) = %d, want 2", got)
	}
	if got := remainingOpenings(2, 4); got != 0 {
		t.Fatalf("remainingOpenings(2,4) = %d, want 0", got)
	}
}
