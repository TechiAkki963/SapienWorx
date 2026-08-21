package com.sapienworx.api.cvparser;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Predictable, explainable CV mapping. Every field uses an explicit pattern or
 * section header—no statistical or generative model is involved.
 */
@Service
public class DeterministicProfileMappingService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("(?i)\\b[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}\\b");
    private static final Pattern PHONE_PATTERN = Pattern.compile("(?<!\\d)(?:\\+?\\d[\\d .()\\-]{8,}\\d)(?!\\d)");
    private static final Pattern LOCATION_PATTERN = Pattern.compile("(?im)^\\s*(?:location|city|based in)\\s*[:\\-]\\s*(.{2,120})$");
    private static final Pattern HEADLINE_PATTERN = Pattern.compile("(?im)^\\s*(?:headline|professional title)\\s*[:\\-]\\s*(.{2,160})$");
    private static final Pattern DATE_RANGE_PATTERN = Pattern.compile(
            "(?i)(?:\\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\s+)?\\d{4}\\s*(?:-|–|to)\\s*(?:present|current|(?:\\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\s+)?\\d{4})"
    );
    private static final Pattern NAME_PATTERN = Pattern.compile("(?U)^[\\p{L}][\\p{L}'’.-]*(?:\\s+[\\p{L}][\\p{L}'’.-]*){1,3}$");
    private static final Pattern BACHELORS_PATTERN = Pattern.compile("(?i)\\b(?:b\\.?tech|b\\.?e\\.?|bachelor(?:'s)?|bsc|b\\.?sc|bca|b\\.?com)\\b");
    private static final Pattern MASTERS_PATTERN = Pattern.compile("(?i)\\b(?:m\\.?tech|m\\.?e\\.?|master(?:'s)?|msc|m\\.?sc|mca|mba)\\b");

    private static final List<SkillRule> SKILL_TAXONOMY = List.of(
            new SkillRule("Java", "(?i)(?<![\\p{L}])java(?![\\p{L}])"),
            new SkillRule("Spring Boot", "(?i)\\bspring[ -]?boot\\b"),
            new SkillRule("JavaScript", "(?i)\\bjavascript\\b"),
            new SkillRule("TypeScript", "(?i)\\btypescript\\b"),
            new SkillRule("React", "(?i)\\breact(?:\\.js)?\\b"),
            new SkillRule("Node.js", "(?i)\\bnode(?:\\.js|js)?\\b"),
            new SkillRule("Python", "(?i)\\bpython\\b"),
            new SkillRule("PostgreSQL", "(?i)\\bpostgres(?:ql)?\\b"),
            new SkillRule("SQL", "(?i)\\bsql\\b"),
            new SkillRule("AWS", "(?i)\\baws\\b|amazon web services"),
            new SkillRule("Docker", "(?i)\\bdocker\\b"),
            new SkillRule("Kubernetes", "(?i)\\bkubernetes\\b|\\bk8s\\b"),
            new SkillRule("Git", "(?i)\\bgit\\b")
    );

    private final String parserVersion;

    public DeterministicProfileMappingService(@Value("${app.cv-parser.parser-version:v1.0.0-deterministic}") String parserVersion) {
        this.parserVersion = parserVersion;
    }

    public ParsedCandidateProfile parseRawText(String rawText) {
        String text = normalise(rawText);
        List<String> warnings = new ArrayList<>();

        String email = firstMatch(EMAIL_PATTERN, text);
        if (email == null) {
            warnings.add("Email address not found. Please enter it manually.");
        }

        String mobile = extractMobile(text);
        if (mobile == null) {
            warnings.add("Mobile number not found. Please enter it manually.");
        }

        String fullName = extractName(text);
        if (fullName == null) {
            warnings.add("Name could not be confirmed. Please review it manually.");
        }

        String location = labelledValue(LOCATION_PATTERN, text);
        if (location == null) {
            warnings.add("Location not found. Please enter it manually.");
        }

        String headline = labelledValue(HEADLINE_PATTERN, text);
        List<String> skills = extractSkills(text);
        if (skills.isEmpty()) {
            warnings.add("No recognised skills were found. Please add your skills manually.");
        }

        List<ParsedCandidateProfile.ParsedExperience> experience = extractExperience(text);
        if (experience.isEmpty()) {
            warnings.add("Employment dates were not found. Please review your work experience.");
        }

        List<ParsedCandidateProfile.ParsedEducation> education = extractEducation(text);
        if (education.isEmpty()) {
            warnings.add("Education details were not found. Please add them manually.");
        }

        return new ParsedCandidateProfile(
                fullName,
                email,
                mobile,
                location,
                headline,
                List.copyOf(skills),
                List.copyOf(experience),
                List.copyOf(education),
                List.copyOf(warnings),
                parserVersion,
                "candidate-profile-v1"
        );
    }

    private String normalise(String rawText) {
        return rawText == null ? "" : rawText.replace('\u00a0', ' ').replace("\r\n", "\n").replace('\r', '\n');
    }

    private String firstMatch(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? matcher.group().trim() : null;
    }

    private String extractMobile(String text) {
        Matcher matcher = PHONE_PATTERN.matcher(text);
        while (matcher.find()) {
            String matched = matcher.group().trim();
            String digits = matched.replaceAll("\\D", "");
            if (digits.length() >= 10 && digits.length() <= 15) {
                return matched.startsWith("+") ? "+" + digits : digits;
            }
        }
        return null;
    }

    private String extractName(String text) {
        for (String line : text.split("\\n", 8)) {
            String candidate = line.trim();
            if (candidate.length() <= 80 && NAME_PATTERN.matcher(candidate).matches()) {
                return candidate;
            }
        }
        return null;
    }

    private String labelledValue(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? matcher.group(1).trim() : null;
    }

    private List<String> extractSkills(String text) {
        Set<String> skills = new LinkedHashSet<>();
        for (SkillRule skill : SKILL_TAXONOMY) {
            if (Pattern.compile(skill.pattern()).matcher(text).find()) {
                skills.add(skill.name());
            }
        }
        return new ArrayList<>(skills);
    }

    private List<ParsedCandidateProfile.ParsedExperience> extractExperience(String text) {
        String experienceSection = section(text, "experience", "employment", "work history", "professional experience");
        if (experienceSection == null) {
            return List.of();
        }

        List<ParsedCandidateProfile.ParsedExperience> entries = new ArrayList<>();
        for (String line : experienceSection.split("\\n")) {
            Matcher dates = DATE_RANGE_PATTERN.matcher(line);
            if (dates.find()) {
                entries.add(new ParsedCandidateProfile.ParsedExperience(line.trim(), dates.group()));
            }
        }
        return entries;
    }

    private List<ParsedCandidateProfile.ParsedEducation> extractEducation(String text) {
        String educationSection = section(text, "education", "academic qualifications", "qualifications");
        if (educationSection == null) {
            return List.of();
        }

        List<ParsedCandidateProfile.ParsedEducation> entries = new ArrayList<>();
        for (String line : educationSection.split("\\n")) {
            if (BACHELORS_PATTERN.matcher(line).find()) {
                entries.add(new ParsedCandidateProfile.ParsedEducation("BACHELORS", line.trim()));
            } else if (MASTERS_PATTERN.matcher(line).find()) {
                entries.add(new ParsedCandidateProfile.ParsedEducation("MASTERS", line.trim()));
            }
        }
        return entries;
    }

    private String section(String text, String... headings) {
        String[] lines = text.split("\\n");
        int start = -1;
        for (int index = 0; index < lines.length; index++) {
            String normalisedLine = lines[index].trim().toLowerCase(Locale.ROOT).replaceAll("[:\\-]$", "");
            for (String heading : headings) {
                if (normalisedLine.equals(heading)) {
                    start = index + 1;
                    break;
                }
            }
            if (start >= 0) {
                break;
            }
        }
        if (start < 0) {
            return null;
        }

        List<String> sectionLines = new ArrayList<>();
        for (int index = start; index < lines.length; index++) {
            String line = lines[index].trim();
            if (line.matches("[A-Z][A-Z &/]{2,}")) {
                break;
            }
            sectionLines.add(lines[index]);
        }
        return String.join("\n", sectionLines);
    }

    private record SkillRule(String name, String pattern) {
    }
}
