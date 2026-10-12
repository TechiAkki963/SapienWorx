package recruiter

import (
	"embed"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
	"unicode"

	"github.com/signintech/gopdf"
)

// Fonts are the existing OFL-licensed job-card fonts; generation is offline.
//
//go:embed offerfonts/*.ttf
var offerPDFFonts embed.FS

func RenderOfferPDF(snapshot OfferSnapshot, version int, termsHash string, created time.Time) ([]byte, error) {
	if snapshot.Incomplete {
		return nil, ErrInvalid
	}
	if snapshot.Branding != nil {
		if err := validateOfferBranding(*snapshot.Branding); err != nil {
			return nil, err
		}
	}
	var pdf gopdf.GoPdf
	pdf.Start(gopdf.Config{PageSize: *gopdf.PageSizeA4, Unit: gopdf.UnitPT})
	missing := false
	for _, font := range []struct {
		name, file string
		style      int
	}{{"Offer", "NotoSans-Regular.ttf", gopdf.Regular}, {"Offer", "NotoSans-Bold.ttf", gopdf.Bold}} {
		data, err := offerPDFFonts.ReadFile("offerfonts/" + font.file)
		if err != nil {
			return nil, err
		}
		if err = pdf.AddTTFFontDataWithOption(font.name, data, gopdf.TtfOption{Style: font.style, UseKerning: true, OnGlyphNotFound: func(r rune) { missing = true }}); err != nil {
			return nil, err
		}
	}
	// Stable metadata is taken from the immutable version, never wall-clock time.
	pdf.SetInfo(gopdf.PdfInfo{Title: "Employment offer", Creator: "SapienWorx", Producer: "SapienWorx Offer Studio", CreationDate: created.UTC()})
	page, y := 0, 0.0
	clean := func(value string) string {
		return strings.Map(func(r rune) rune {
			if r == '\t' {
				return ' '
			}
			if unicode.IsControl(r) && r != '\n' {
				return -1
			}
			return r
		}, value)
	}
	nextPage := func() error {
		pdf.AddPage()
		page++
		pdf.SetTextColor(80, 87, 105)
		if err := pdf.SetFont("Offer", "", 9); err != nil {
			return err
		}
		pdf.SetXY(46, 806)
		if err := pdf.Cell(&gopdf.Rect{W: 500, H: 16}, fmt.Sprintf("SapienWorx | Version %d | Page %d | Terms %s", version, page, termsHash[:min(12, len(termsHash))])); err != nil {
			return err
		}
		r, g, b := byte(45), byte(56), byte(101)
		if snapshot.Branding != nil && snapshot.Branding.Accent != "" {
			rgb, _ := hex.DecodeString(strings.TrimPrefix(snapshot.Branding.Accent, "#"))
			r, g, b = rgb[0], rgb[1], rgb[2]
		}
		pdf.SetFillColor(r, g, b)
		pdf.RectFromUpperLeftWithStyle(46, 38, 503, 3, "F")
		y = 62
		return nil
	}
	if err := nextPage(); err != nil {
		return nil, err
	}
	write := func(text string, size float64, bold bool) error {
		style := ""
		if bold {
			style = "B"
		}
		if err := pdf.SetFont("Offer", style, size); err != nil {
			return err
		}
		pdf.SetTextColor(26, 35, 54)
		for _, paragraph := range strings.Split(clean(text), "\n") {
			lines, err := pdf.SplitTextWithWordWrap(paragraph, 503)
			if err != nil {
				return err
			}
			if len(lines) == 0 {
				lines = []string{""}
			}
			for _, line := range lines {
				height := size * 1.55
				if y+height > 765 {
					if err = nextPage(); err != nil {
						return err
					}
					if err = pdf.SetFont("Offer", style, size); err != nil {
						return err
					}
					pdf.SetTextColor(26, 35, 54)
				}
				pdf.SetXY(46, y)
				if err = pdf.Cell(&gopdf.Rect{W: 503, H: height}, line); err != nil {
					return err
				}
				y += height
			}
		}
		y += 8
		return nil
	}
	if snapshot.Branding != nil && snapshot.Branding.LogoDataURL != "" {
		logo, cfg, err := offerBrandLogo(snapshot.Branding.LogoDataURL)
		if err != nil {
			return nil, err
		}
		holder, err := gopdf.ImageHolderByBytes(logo)
		if err != nil {
			return nil, err
		}
		w, h := 120.0, 120.0*float64(cfg.Height)/float64(cfg.Width)
		if h > 48 {
			w = w * 48 / h
			h = 48
		}
		if err = pdf.ImageByHolder(holder, 46, y, &gopdf.Rect{W: w, H: h}); err != nil {
			return nil, err
		}
		y += h + 12
	}
	employment := strings.Join([]string{strings.ReplaceAll(snapshot.EmploymentType, "_", " "), snapshot.WorkMode, snapshot.WorkLocation, snapshot.Department}, " · ")
	employment = strings.Trim(employment, " ·")
	for _, part := range []struct {
		text string
		size float64
		bold bool
	}{{snapshot.CompanyName, 12, true}, {snapshot.Title, 22, true}, {"Prepared for " + snapshot.CandidateName, 12, false}, {snapshot.JobTitle, 12, true}, {employment, 11, false}, {snapshot.LetterText, 11, false}, {"Compensation and dates", 13, true}, {"Currency: " + snapshot.Currency, 11, false}, {"Joining date: " + snapshot.JoiningDate + "\nOffer valid until: " + snapshot.ExpiresAt, 11, false}} {
		if part.text == "" {
			continue
		}
		if err := write(part.text, part.size, part.bold); err != nil {
			return nil, err
		}
	}
	if snapshot.Branding != nil && snapshot.Branding.Address != "" {
		if err := write(snapshot.Branding.Address, 10, false); err != nil {
			return nil, err
		}
	}
	if len(snapshot.Fields) == 0 {
		if err := write("Annual compensation: "+snapshot.Currency+" "+snapshot.AnnualCompensation, 11, false); err != nil {
			return nil, err
		}
	}
	for _, field := range snapshot.Fields {
		if field.Kind == "section" {
			if err := write(field.Label, 13, true); err != nil {
				return nil, err
			}
			continue
		}
		if value, exists := snapshot.Values[field.Key]; exists {
			prefix := ""
			if field.Kind == "money" {
				prefix = snapshot.Currency + " "
			}
			if err := write(field.Label+": "+prefix+value, 11, false); err != nil {
				return nil, err
			}
		}
	}
	for _, clause := range snapshot.Clauses {
		if err := write(clause.Label, 13, true); err != nil {
			return nil, err
		}
		if err := write(clause.Text, 11, false); err != nil {
			return nil, err
		}
	}
	if snapshot.Branding != nil && snapshot.Branding.Signatory != "" {
		if err := write("Authorized signatory: "+snapshot.Branding.Signatory, 11, true); err != nil {
			return nil, err
		}
	}
	if len(snapshot.Annexures) > 0 {
		if err := write("Annexures included with this offer", 13, true); err != nil {
			return nil, err
		}
		for _, attachment := range snapshot.Annexures {
			if err := write(attachment.Filename+" | SHA-256 "+attachment.SHA256, 9, false); err != nil {
				return nil, err
			}
		}
	}
	if err := write("Your response is recorded against this exact offer version. Please use the secure SapienWorx candidate portal to accept, decline or request clarification.", 10, false); err != nil {
		return nil, err
	}
	if missing {
		return nil, fmt.Errorf("%w: letter contains characters not supported by the approved PDF font", ErrInvalid)
	}
	return pdf.GetBytesPdfReturnErr()
}
