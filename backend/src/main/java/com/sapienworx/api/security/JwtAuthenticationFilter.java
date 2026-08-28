package com.sapienworx.api.security;

import com.sapienworx.api.admin.PlatformAccessPolicy;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String AUTH_COOKIE = "SWX_AUTH";

    private final JwtTokenService jwtTokenService;
    private final PlatformAccessPolicy platformAccessPolicy;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            Optional<String> token = tokenFrom(request);
            Optional<AuthenticatedUser> authenticatedUser = token.flatMap(jwtTokenService::verify);
            if (authenticatedUser.isPresent()) {
                AuthenticatedUser user = authenticatedUser.get();
                PlatformAccessPolicy.AccessDecision decision = platformAccessPolicy.accessFor(user);
                if (!decision.permitted()) {
                    response.sendError(decision.status().value(), decision.message());
                    return;
                }
                if (token.flatMap(jwtTokenService::issuedAt).map(issuedAt -> platformAccessPolicy.isSessionRevoked(user, issuedAt)).orElse(true)) {
                    response.sendError(401, "This session has been revoked. Please sign in again.");
                    return;
                }
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        user,
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + user.role().name()))
                );
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }
        filterChain.doFilter(request, response);
    }

    private Optional<String> tokenFrom(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return Optional.empty();
        }
        return Arrays.stream(request.getCookies())
                .filter(cookie -> AUTH_COOKIE.equals(cookie.getName()))
                .map(Cookie::getValue)
                .filter(value -> !value.isBlank())
                .findFirst();
    }
}
