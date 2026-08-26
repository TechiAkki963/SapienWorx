# Master Architecture Prompt: Spring Security SSR Cookie Exchange

**Objective:** Configure Spring Security to operate statelessly using JWTs stored in `HttpOnly` cookies. This ensures the Next.js frontend can securely authenticate requests during Server-Side Rendering (SSR) without relying on vulnerable `localStorage`.

---

## 1. The Cookie Generator (Auth Controller)

When the candidate or recruiter successfully verifies their OTP, the backend must construct a strict cookie and attach it directly to the response headers, rather than returning the token in the JSON body.

\`\`\`java
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.\*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@RequestBody OtpRequest request) {
        // 1. Validate OTP against Redis (omitted for brevity)
        boolean isValid = otpService.validate(request.getEmail(), request.getCode());

        if (!isValid) {
            return ResponseEntity.status(401).body("Invalid OTP");
        }

        // 2. Generate JWT
        String token = jwtService.generateToken(request.getEmail());

        // 3. Construct the HttpOnly Cookie
        ResponseCookie jwtCookie = ResponseCookie.from("swx_auth_token", token)
                .httpOnly(true)
                .secure(true) // Must be true in production (HTTPS)
                .sameSite("Strict") // Protects against CSRF
                .path("/")
                .maxAge(24 * 60 * 60) // 24 hours
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, jwtCookie.toString())
                .body(new AuthResponse("Authentication successful"));
    }

}
\`\`\`

---

## 2. The JWT Cookie Interceptor (Security Filter)

The backend needs a custom filter to intercept every incoming request, extract the cookie array, and populate the Spring `SecurityContext`.

\`\`\`java
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.Arrays;
import java.util.Optional;

@Component
public class JwtCookieFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtCookieFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // Extract the specific auth cookie safely
        String token = null;
        if (request.getCookies() != null) {
            Optional<Cookie> authCookie = Arrays.stream(request.getCookies())
                    .filter(cookie -> "swx_auth_token".equals(cookie.getName()))
                    .findFirst();

            if (authCookie.isPresent()) {
                token = authCookie.get().getValue();
            }
        }

        // Validate and set context
        if (token != null && jwtService.isTokenValid(token)) {
            String username = jwtService.extractUsername(token);

            UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                    username, null, jwtService.getAuthorities(token)
            );

            SecurityContextHolder.getContext().setAuthentication(authToken);
        }

        filterChain.doFilter(request, response);
    }

}
\`\`\`

---

## 3. The Security Configuration

Finally, wire the custom filter into the main Security Filter Chain, ensuring standard session creation is disabled.

\`\`\`java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtCookieFilter jwtCookieFilter;

    public SecurityConfig(JwtCookieFilter jwtCookieFilter) {
        this.jwtCookieFilter = jwtCookieFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable()) // CSRF mitigated by SameSite=Strict cookies
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/public/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtCookieFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

}
\`\`\`
