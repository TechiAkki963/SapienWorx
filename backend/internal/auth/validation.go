package auth

import (
	"errors"
	"net/mail"
	"regexp"
	"strings"
)

var phonePattern = regexp.MustCompile(`^\+[1-9][0-9]{7,14}$`)
var publicEmailDomains = map[string]struct{}{"gmail.com":{},"googlemail.com":{},"yahoo.com":{},"yahoo.co.in":{},"outlook.com":{},"hotmail.com":{},"live.com":{},"icloud.com":{},"proton.me":{},"protonmail.com":{},"aol.com":{},"gmx.com":{},"mail.com":{},"rediffmail.com":{},"zoho.com":{}}

func normalizeEmail(value string)(string,error){email:=strings.ToLower(strings.TrimSpace(value));address,err:=mail.ParseAddress(email);if err!=nil||address.Address!=email||len(email)>320{return "",errors.New("valid email is required")};return email,nil}
func emailDomain(email string)string{parts:=strings.Split(email,"@");if len(parts)!=2{return ""};return strings.ToLower(parts[1])}
func validateOfficialEmail(email string)error{domain:=emailDomain(email);if domain==""{return errors.New("valid work email is required")};if _,blocked:=publicEmailDomains[domain];blocked{return errors.New("recruiters must use an official company email address")};return nil}
func validatePassword(password string)error{if len(password)<12||len([]byte(password))>72{return errors.New("password must be at least 12 characters and no more than 72 bytes")};return nil}
func validatePhone(phone string)error{if !phonePattern.MatchString(strings.TrimSpace(phone)){return errors.New("phone must use E.164 format, for example +919876543210")};return nil}
