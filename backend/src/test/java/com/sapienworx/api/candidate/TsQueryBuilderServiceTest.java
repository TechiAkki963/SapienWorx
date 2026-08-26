package com.sapienworx.api.candidate;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TsQueryBuilderServiceTest {
    private final TsQueryBuilderService service = new TsQueryBuilderService();

    @Test
    void joinsAnyAllAndExcludedTermsWithTheCorrectPostgresOperators() {
        assertThat(service.build(List.of("react", "product design"), List.of("figma"), List.of("agency", "php")))
                .isEqualTo("(figma) & (react | product<->design) & !(agency | php)");
    }

    @Test
    void removesOperatorsAndEmptyTermsFromUntrustedInput() {
        assertThat(service.build(List.of("  ", "react; drop table"), List.of(), List.of("<script>")))
                .isEqualTo("(react<->drop<->table)");
    }

    @Test
    void convertsTheSupportedBooleanExpressionWithoutPassingRawSyntaxThrough() {
        assertThat(service.buildBooleanExpression("(Java OR \"Spring Boot\") AND NOT PHP"))
                .isEqualTo("((Java | Spring<->Boot) & !(PHP))");
    }

    @Test
    void rejectsAnIncompleteBooleanExpression() {
        assertThatThrownBy(() -> service.buildBooleanExpression("Java AND ("))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("AND, OR, NOT");
    }
}
