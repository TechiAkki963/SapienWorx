package com.sapienworx.api.web;

import org.springframework.data.domain.Page;

import java.util.List;

/** Stable pagination contract; never exposes Spring Data's internal PageImpl JSON shape. */
public record ApiPageResponse<T>(
        List<T> content,
        long totalElements,
        int totalPages,
        int number,
        int size,
        boolean first,
        boolean last,
        int numberOfElements,
        boolean empty
) {
    public static <T> ApiPageResponse<T> from(Page<T> page) {
        return new ApiPageResponse<>(List.copyOf(page.getContent()), page.getTotalElements(), page.getTotalPages(),
                page.getNumber(), page.getSize(), page.isFirst(), page.isLast(), page.getNumberOfElements(), page.isEmpty());
    }
}
