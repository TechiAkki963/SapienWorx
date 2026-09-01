FROM maven:3.9.9-eclipse-temurin-17 AS builder
WORKDIR /workspace

COPY pom.xml ./
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -ntp dependency:go-offline

COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -ntp -DskipTests package

FROM eclipse-temurin:17-jre-jammy AS runner
WORKDIR /app
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

RUN groupadd --system --gid 1001 sapienworx \
    && useradd --system --uid 1001 --gid sapienworx --create-home sapienworx

COPY --from=builder --chown=sapienworx:sapienworx /workspace/target/sapienworx-api-0.0.1-SNAPSHOT.jar /app/app.jar

USER sapienworx
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
