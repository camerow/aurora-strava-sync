package grades

import "testing"

func TestV(t *testing.T) {
	cases := []struct {
		difficulty int
		want       int
		ok         bool
	}{
		{1, 0, true},   // 1a/V0
		{12, 0, true},  // 4c/V0
		{13, 1, true},  // 5a/V1
		{15, 2, true},  // 5c/V2
		{18, 4, true},  // 6b/V4
		{22, 6, true},  // 7a/V6
		{23, 7, true},  // 7a+/V7
		{27, 10, true}, // 7c+/V10
		{39, 22, true}, // 9c+/V22
		{0, 0, false},
		{40, 0, false},
	}
	for _, c := range cases {
		got, ok := V(c.difficulty)
		if got != c.want || ok != c.ok {
			t.Errorf("V(%d) = %d,%v want %d,%v", c.difficulty, got, ok, c.want, c.ok)
		}
	}
}

func TestVFromDisplay(t *testing.T) {
	if v, ok := VFromDisplay(18.4); !ok || v != 4 {
		t.Errorf("VFromDisplay(18.4) = %d,%v want 4,true", v, ok)
	}
	if v, ok := VFromDisplay(22.6); !ok || v != 7 {
		t.Errorf("VFromDisplay(22.6) = %d,%v want 7,true (rounds to 23)", v, ok)
	}
}
