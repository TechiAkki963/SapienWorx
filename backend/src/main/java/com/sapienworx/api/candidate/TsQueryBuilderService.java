package com.sapienworx.api.candidate;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/** Translates structured recruiter input into a safely bound PostgreSQL tsquery. */
@Service
public class TsQueryBuilderService {

    public String build(List<String> anyKeywords, List<String> allKeywords, List<String> excludeKeywords) {
        String all = group(allKeywords, " & ");
        String any = group(anyKeywords, " | ");
        String exclude = group(excludeKeywords, " | ");
        return List.of(
                        all.isEmpty() ? "" : "(" + all + ")",
                        any.isEmpty() ? "" : "(" + any + ")",
                        exclude.isEmpty() ? "" : "!(" + exclude + ")")
                .stream().filter(part -> !part.isEmpty()).collect(Collectors.joining(" & "));
    }

    /**
     * Converts the deliberately small Boolean syntax exposed in recruiter
     * sourcing into a bound PostgreSQL tsquery. Only terms, quoted phrases,
     * parentheses, AND, OR and NOT are accepted; no database syntax is passed
     * through from the browser.
     */
    public String buildBooleanExpression(String expression) {
        if (expression == null || expression.isBlank()) return "";
        return new BooleanExpressionParser(expression).parse();
    }

    private String group(List<String> keywords, String operator) {
        if (keywords == null) return "";
        return keywords.stream().filter(Objects::nonNull).map(this::formatToken)
                .filter(token -> !token.isEmpty()).collect(Collectors.joining(operator));
    }

    private String formatToken(String keyword) {
        String cleaned = keyword.trim().replaceAll("<[^>]*>", " ").replaceAll("[^\\p{L}\\p{N}_ -]", " ").replaceAll("\\s+", " ").trim();
        return cleaned.isBlank() ? "" : cleaned.replace(" ", "<->");
    }

    private final class BooleanExpressionParser {
        private final List<Token> tokens;
        private int cursor;

        private BooleanExpressionParser(String expression) {
            tokens = tokenize(expression);
        }

        private String parse() {
            if (tokens.isEmpty()) throw invalidBooleanExpression();
            String result = orExpression();
            if (cursor != tokens.size()) throw invalidBooleanExpression();
            return result;
        }

        private String orExpression() {
            String result = andExpression();
            while (matches(TokenType.OR)) result = "(" + result + " | " + andExpression() + ")";
            return result;
        }

        private String andExpression() {
            String result = unaryExpression();
            while (matches(TokenType.AND)) result = "(" + result + " & " + unaryExpression() + ")";
            return result;
        }

        private String unaryExpression() {
            if (matches(TokenType.NOT)) return "!(" + unaryExpression() + ")";
            return primaryExpression();
        }

        private String primaryExpression() {
            if (matches(TokenType.OPEN)) {
                String nested = orExpression();
                if (!matches(TokenType.CLOSE)) throw invalidBooleanExpression();
                return nested;
            }
            if (cursor >= tokens.size() || tokens.get(cursor).type() != TokenType.TERM) throw invalidBooleanExpression();
            String token = formatToken(tokens.get(cursor++).value());
            if (token.isEmpty()) throw invalidBooleanExpression();
            return token;
        }

        private boolean matches(TokenType expected) {
            if (cursor >= tokens.size() || tokens.get(cursor).type() != expected) return false;
            cursor += 1;
            return true;
        }

        private List<Token> tokenize(String expression) {
            java.util.ArrayList<Token> result = new java.util.ArrayList<>();
            for (int index = 0; index < expression.length();) {
                char character = expression.charAt(index);
                if (Character.isWhitespace(character)) {
                    index += 1;
                    continue;
                }
                if (character == '(') {
                    result.add(new Token(TokenType.OPEN, "("));
                    index += 1;
                    continue;
                }
                if (character == ')') {
                    result.add(new Token(TokenType.CLOSE, ")"));
                    index += 1;
                    continue;
                }
                if (character == '"') {
                    int closingQuote = expression.indexOf('"', index + 1);
                    if (closingQuote < 0) throw invalidBooleanExpression();
                    result.add(new Token(TokenType.TERM, expression.substring(index + 1, closingQuote)));
                    index = closingQuote + 1;
                    continue;
                }
                int end = index;
                while (end < expression.length() && !Character.isWhitespace(expression.charAt(end))
                        && expression.charAt(end) != '(' && expression.charAt(end) != ')') end += 1;
                String value = expression.substring(index, end);
                String operator = value.toUpperCase(java.util.Locale.ROOT);
                result.add(switch (operator) {
                    case "AND" -> new Token(TokenType.AND, value);
                    case "OR" -> new Token(TokenType.OR, value);
                    case "NOT" -> new Token(TokenType.NOT, value);
                    default -> new Token(TokenType.TERM, value);
                });
                index = end;
            }
            return List.copyOf(result);
        }
    }

    private IllegalArgumentException invalidBooleanExpression() {
        return new IllegalArgumentException("Use terms or quoted phrases joined with AND, OR, NOT and parentheses.");
    }

    private enum TokenType { TERM, AND, OR, NOT, OPEN, CLOSE }

    private record Token(TokenType type, String value) { }
}
