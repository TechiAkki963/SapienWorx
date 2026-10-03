package emaildelivery

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/signer/v4"
)

type Message struct {
	To       string
	Subject  string
	TextBody string
	HTMLBody string
}

type AccountStatus struct {
	Provider                string `json:"provider"`
	Region                  string `json:"region"`
	FromAddress             string `json:"from_address"`
	SendingEnabled          bool   `json:"sending_enabled"`
	ProductionAccessEnabled bool   `json:"production_access_enabled"`
	EnforcementStatus       string `json:"enforcement_status,omitempty"`
}

type Suppression struct {
	Suppressed bool
	Reason     string
	Detail     string
}

type SuppressedDestination struct {
	Email  string
	Reason string
	Detail string
}

type Provider interface {
	Send(context.Context, Message) (string, error)
	Suppression(context.Context, string) (Suppression, error)
	Suppressions(context.Context) ([]SuppressedDestination, error)
	Account(context.Context) (AccountStatus, error)
}

type SESProvider struct {
	cfg    aws.Config
	from   string
	client *http.Client
	signer *v4.Signer
}

func NewSESProvider(cfg aws.Config, from string) *SESProvider {
	return &SESProvider{
		cfg:    cfg,
		from:   strings.TrimSpace(from),
		client: &http.Client{Timeout: 10 * time.Second},
		signer: v4.NewSigner(),
	}
}

func (p *SESProvider) endpoint(path string) string {
	return "https://email." + p.cfg.Region + ".amazonaws.com" + path
}

func (p *SESProvider) request(ctx context.Context, method, path string, body []byte) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, p.endpoint(path), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	if len(body) > 0 {
		req.Header.Set("Content-Type", "application/json")
	}
	credentials, err := p.cfg.Credentials.Retrieve(ctx)
	if err != nil {
		return nil, fmt.Errorf("retrieve AWS credentials: %w", err)
	}
	if err := p.signer.SignHTTP(ctx, credentials, req, sha256Hex(body), "ses", p.cfg.Region, time.Now().UTC()); err != nil {
		return nil, err
	}
	return p.client.Do(req)
}

func sha256Hex(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}

func (p *SESProvider) Send(ctx context.Context, message Message) (string, error) {
	payload := map[string]any{
		"FromEmailAddress": p.from,
		"Destination": map[string]any{
			"ToAddresses": []string{message.To},
		},
		"Content": map[string]any{
			"Simple": map[string]any{
				"Subject": map[string]string{
					"Data":    message.Subject,
					"Charset": "UTF-8",
				},
				"Body": map[string]any{
					"Text": map[string]string{
						"Data":    message.TextBody,
						"Charset": "UTF-8",
					},
					"Html": map[string]string{
						"Data":    message.HTMLBody,
						"Charset": "UTF-8",
					},
				},
			},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	resp, err := p.request(ctx, http.MethodPost, "/v2/email/outbound-emails", body)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("SES send returned %d: %s", resp.StatusCode, strings.TrimSpace(string(data)))
	}
	var result struct {
		MessageID string `json:"MessageId"`
	}
	if err := json.Unmarshal(data, &result); err != nil || strings.TrimSpace(result.MessageID) == "" {
		return "", errors.New("SES send response did not include MessageId")
	}
	return result.MessageID, nil
}

func (p *SESProvider) Suppression(ctx context.Context, email string) (Suppression, error) {
	path := "/v2/email/suppression/addresses/" + url.PathEscape(strings.ToLower(strings.TrimSpace(email)))
	resp, err := p.request(ctx, http.MethodGet, path, nil)
	if err != nil {
		return Suppression{}, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode == http.StatusNotFound {
		return Suppression{}, nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return Suppression{}, fmt.Errorf("SES suppression lookup returned %d", resp.StatusCode)
	}
	var result struct {
		Reason         string  `json:"Reason"`
		LastUpdateTime float64 `json:"LastUpdateTime"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return Suppression{}, err
	}
	return Suppression{
		Suppressed: true,
		Reason:     strings.ToLower(result.Reason),
		Detail:     "Amazon SES account-level suppression list",
	}, nil
}

func (p *SESProvider) Suppressions(ctx context.Context) ([]SuppressedDestination, error) {
	result := make([]SuppressedDestination, 0)
	nextToken := ""
	for {
		path := "/v2/email/suppression/addresses?PageSize=1000"
		if nextToken != "" {
			path += "&NextToken=" + url.QueryEscape(nextToken)
		}
		resp, err := p.request(ctx, http.MethodGet, path, nil)
		if err != nil {
			return nil, err
		}
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return nil, fmt.Errorf("SES suppression list returned %d", resp.StatusCode)
		}
		var page struct {
			Summaries []struct {
				EmailAddress string `json:"EmailAddress"`
				Reason       string `json:"Reason"`
			} `json:"SuppressedDestinationSummaries"`
			NextToken string `json:"NextToken"`
		}
		if err := json.Unmarshal(data, &page); err != nil {
			return nil, err
		}
		for _, item := range page.Summaries {
			email := strings.ToLower(strings.TrimSpace(item.EmailAddress))
			if email == "" {
				continue
			}
			result = append(result, SuppressedDestination{
				Email:  email,
				Reason: strings.ToLower(strings.TrimSpace(item.Reason)),
				Detail: "Amazon SES account-level suppression list",
			})
		}
		nextToken = strings.TrimSpace(page.NextToken)
		if nextToken == "" {
			return result, nil
		}
	}
}

func (p *SESProvider) Account(ctx context.Context) (AccountStatus, error) {
	resp, err := p.request(ctx, http.MethodGet, "/v2/email/account", nil)
	if err != nil {
		return AccountStatus{}, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return AccountStatus{}, fmt.Errorf("SES account lookup returned %d", resp.StatusCode)
	}
	var result struct {
		SendingEnabled          bool   `json:"SendingEnabled"`
		ProductionAccessEnabled bool   `json:"ProductionAccessEnabled"`
		EnforcementStatus       string `json:"EnforcementStatus"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return AccountStatus{}, err
	}
	return AccountStatus{
		Provider:                "amazon_ses",
		Region:                  p.cfg.Region,
		FromAddress:             p.from,
		SendingEnabled:          result.SendingEnabled,
		ProductionAccessEnabled: result.ProductionAccessEnabled,
		EnforcementStatus:       result.EnforcementStatus,
	}, nil
}
