package com.sapienworx.api.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Marks a successful sensitive operation for immutable DPDP audit capture. */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface AuditAction {

    String action();

    String resourceType();

    /** Zero-based UUID argument index, or -1 when no UUID resource is applicable. */
    int resourceIdArgumentIndex() default -1;

    /** Zero-based UUID candidate argument index, or -1 when no candidate is involved. */
    int candidateIdArgumentIndex() default -1;
}
