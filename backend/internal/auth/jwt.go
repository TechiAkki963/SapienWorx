package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrInvalidToken = errors.New("invalid access token")
	ErrExpiredToken = errors.New("access token expired")
)

type Role string

const (
	RoleCandidate   Role = "candidate"
	RoleRecruiter   Role = "recruiter"
	RoleMasterAdmin Role = "master_admin"
)

type Claims struct {
	Subject   string `json:"sub"`
	Role      Role   `json:"role"`
	Issuer    string `json:"iss"`
	Audience  string `json:"aud"`
	IssuedAt  int64  `json:"iat"`
	NotBefore int64  `json:"nbf"`
	ExpiresAt int64  `json:"exp"`
	TokenID   string `json:"jti,omitempty"`
}

type TokenManager struct {
	secret    []byte
	issuer    string
	audience  string
	ttl       time.Duration
	clockSkew time.Duration
	now       func() time.Time
}

func NewTokenManager(secret, issuer, audience string, ttl, clockSkew time.Duration) (*TokenManager, error) {
	if len(secret) < 32 {
		return nil, errors.New("JWT secret must be at least 32 bytes")
	}
	if strings.TrimSpace(issuer) == "" || strings.TrimSpace(audience) == "" {
		return nil, errors.New("JWT issuer and audience are required")
	}
	if ttl <= 0 {
		return nil, errors.New("JWT ttl must be positive")
	}
	return &TokenManager{secret: []byte(secret), issuer: issuer, audience: audience, ttl: ttl, clockSkew: clockSkew, now: time.Now}, nil
}

func (m *TokenManager) Issue(subject string, role Role, tokenID string) (string, error) {
	if strings.TrimSpace(subject) == "" || !validRole(role) {
		return "", errors.New("subject and valid role are required")
	}
	now := m.now().UTC()
	claims := Claims{
		Subject:   subject,
		Role:      role,
		Issuer:    m.issuer,
		Audience:  m.audience,
		IssuedAt:  now.Unix(),
		NotBefore: now.Add(-m.clockSkew).Unix(),
		ExpiresAt: now.Add(m.ttl).Unix(),
		TokenID:   tokenID,
	}
	return m.sign(claims)
}

func (m *TokenManager) Parse(token string) (Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return Claims{}, ErrInvalidToken
	}

	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return Claims{}, ErrInvalidToken
	}
	var header struct {
		Algorithm string `json:"alg"`
		Type      string `json:"typ"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil || header.Algorithm != "HS256" || header.Type != "JWT" {
		return Claims{}, ErrInvalidToken
	}

	expected := m.signature(parts[0] + "." + parts[1])
	provided, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !hmac.Equal(expected, provided) {
		return Claims{}, ErrInvalidToken
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return Claims{}, ErrInvalidToken
	}
	var claims Claims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return Claims{}, ErrInvalidToken
	}
	if claims.Subject == "" || claims.Issuer != m.issuer || claims.Audience != m.audience || !validRole(claims.Role) {
		return Claims{}, ErrInvalidToken
	}

	now := m.now().UTC()
	if claims.ExpiresAt <= now.Add(-m.clockSkew).Unix() {
		return Claims{}, ErrExpiredToken
	}
	if claims.NotBefore > now.Add(m.clockSkew).Unix() || claims.IssuedAt > now.Add(m.clockSkew).Unix() {
		return Claims{}, ErrInvalidToken
	}
	return claims, nil
}

func (m *TokenManager) sign(claims Claims) (string, error) {
	headerJSON := []byte(`{"alg":"HS256","typ":"JWT"}`)
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("marshal claims: %w", err)
	}
	header := base64.RawURLEncoding.EncodeToString(headerJSON)
	payload := base64.RawURLEncoding.EncodeToString(claimsJSON)
	body := header + "." + payload
	sig := base64.RawURLEncoding.EncodeToString(m.signature(body))
	return body + "." + sig, nil
}

func (m *TokenManager) signature(input string) []byte {
	mac := hmac.New(sha256.New, m.secret)
	_, _ = mac.Write([]byte(input))
	return mac.Sum(nil)
}

func validRole(role Role) bool {
	switch role {
	case RoleCandidate, RoleRecruiter, RoleMasterAdmin:
		return true
	default:
		return false
	}
}
