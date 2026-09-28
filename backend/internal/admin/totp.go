package admin

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/binary"
	"errors"
	"fmt"
	"time"
)

// RFC 4226/6238: 30-second periods, six digits, one period of clock tolerance.
func totpCode(secret []byte, step int64, digits int) string {
	var counter [8]byte
	binary.BigEndian.PutUint64(counter[:], uint64(step))
	mac := hmac.New(sha1.New, secret)
	_, _ = mac.Write(counter[:])
	sum := mac.Sum(nil)
	offset := sum[len(sum)-1] & 15
	value := binary.BigEndian.Uint32(sum[offset:offset+4]) & 0x7fffffff
	modulus := uint32(1000000)
	if digits == 8 {
		modulus = 100000000
	}
	return fmt.Sprintf("%0*d", digits, value%modulus)
}

func validateTOTP(secret []byte, code string, now time.Time, lastStep int64) (int64, bool) {
	if len(code) != 6 {
		return 0, false
	}
	for _, ch := range code {
		if ch < '0' || ch > '9' {
			return 0, false
		}
	}
	current := now.Unix() / 30
	for _, step := range []int64{current, current - 1, current + 1} {
		if step > lastStep && step >= 0 && subtle.ConstantTimeCompare([]byte(totpCode(secret, step, 6)), []byte(code)) == 1 {
			return step, true
		}
	}
	return 0, false
}

func newMFASecret() ([]byte, string, error) {
	raw := make([]byte, 20)
	if _, err := rand.Read(raw); err != nil {
		return nil, "", err
	}
	return raw, base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(raw), nil
}

func mfaCipher(key string) (cipher.AEAD, error) {
	if len(key) < 32 {
		return nil, errors.New("admin MFA encryption is unavailable")
	}
	// Domain-separated from existing OTP HMAC use. Rotations require a recovery plan.
	mac := hmac.New(sha256.New, []byte(key))
	_, _ = mac.Write([]byte("sapienworx/admin-mfa/encryption/v1"))
	block, err := aes.NewCipher(mac.Sum(nil))
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

func encryptMFA(key, userID string, secret []byte) ([]byte, error) {
	aead, err := mfaCipher(key)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err = rand.Read(nonce); err != nil {
		return nil, err
	}
	return aead.Seal(nonce, nonce, secret, []byte(userID)), nil
}

func decryptMFA(key, userID string, encrypted []byte) ([]byte, error) {
	aead, err := mfaCipher(key)
	if err != nil {
		return nil, err
	}
	if len(encrypted) < aead.NonceSize()+aead.Overhead() {
		return nil, errors.New("invalid MFA credential")
	}
	return aead.Open(nil, encrypted[:aead.NonceSize()], encrypted[aead.NonceSize():], []byte(userID))
}
